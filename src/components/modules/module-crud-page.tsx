"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Eye,
  Download,
  FileSpreadsheet,
  RefreshCw,
  AlertCircle,
  Database
} from "lucide-react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";
import { exportToCsv, exportToExcel } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "textarea";
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
  placeholder?: string;
};

export type ColumnDef = {
  key: string;
  label: string;
  render?: (row: Record<string, unknown>) => React.ReactNode;
};

type ModuleCrudProps = {
  title: string;
  subtitle: string;
  endpoint: string;
  queryKey: string;
  columns: ColumnDef[];
  fields: FieldDef[];
  statusOptions?: Array<{ label: string; value: string }>;
  defaults?: Record<string, unknown>;
  mapRowToForm?: (row: Record<string, unknown>) => Record<string, unknown>;
  transformSubmit?: (values: Record<string, unknown>) => Record<string, unknown>;
  exportName: string;
};

function getNested(row: Record<string, unknown>, key: string) {
  if (key.includes(".")) {
    const [a, b] = key.split(".");
    const obj = row[a] as Record<string, unknown> | undefined;
    return obj?.[b];
  }
  return row[key];
}

function extractApiError(err: unknown): string {
  if (!isAxiosError(err)) return "Save failed. Please try again.";
  const data = err.response?.data as
    | { message?: string; errors?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } }
    | undefined;
  if (data?.errors?.fieldErrors) {
    const first = Object.entries(data.errors.fieldErrors).find(([, msgs]) => msgs?.length);
    if (first) return `${first[0]}: ${first[1][0]}`;
  }
  if (data?.errors?.formErrors?.length) return data.errors.formErrors[0];
  return data?.message ?? `Request failed (${err.response?.status ?? "network"})`;
}

function rowId(row: Record<string, unknown>) {
  return String(row._id ?? row.id ?? "");
}

export function ModuleCrudPage({
  title,
  subtitle,
  endpoint,
  queryKey,
  columns,
  fields,
  statusOptions = [],
  defaults = {},
  mapRowToForm,
  transformSubmit,
  exportName
}: ModuleCrudProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [viewing, setViewing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(defaults);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(
    Object.fromEntries(columns.map((c) => [c.key, true]))
  );

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: [queryKey, query, status, page],
    queryFn: async () =>
      (
        await api.get(endpoint, {
          params: { query: query || undefined, status: status || undefined, page, limit: 10 }
        })
      ).data
  });

  const rows: Record<string, unknown>[] = useMemo(() => data?.data ?? [], [data?.data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));
  const activeCount = rows.filter((r) => String(r.status ?? "").includes("active") || r.status === "present").length;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [queryKey] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
      queryClient.refetchQueries({ queryKey: [queryKey], type: "active" }),
      queryClient.refetchQueries({ queryKey: ["dashboard-stats"], type: "active" })
    ]);
  };

  const validateForm = (values: Record<string, unknown>) => {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (!field.required) continue;
      const raw = values[field.name];
      const empty =
        raw === undefined ||
        raw === null ||
        (typeof raw === "string" && !raw.trim()) ||
        (field.type === "number" && (raw === "" || Number.isNaN(Number(raw))));
      if (empty) errors[field.name] = `${field.label} is required`;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openCreate = () => {
    setEditing(null);
    setFieldErrors({});
    setForm({ ...defaults });
    setModalOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    setFieldErrors({});
    setForm(mapRowToForm ? mapRowToForm(row) : { ...row });
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const cleaned: Record<string, unknown> = {};
      for (const field of fields) {
        if (values[field.name] !== undefined) cleaned[field.name] = values[field.name];
      }
      const payload = transformSubmit ? transformSubmit(cleaned) : cleaned;
      const editId = editing ? rowId(editing) : "";
      if (editId) return api.patch(`${endpoint}/${editId}`, payload);
      return api.post(endpoint, payload);
    },
    onSuccess: async () => {
      toast.success(editing ? "Record updated successfully" : "Record created successfully");
      setModalOpen(false);
      setEditing(null);
      setFieldErrors({});
      setForm({ ...defaults });
      setPage(1);
      await invalidate();
    },
    onError: (err) => {
      toast.error(extractApiError(err));
    }
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!validateForm(form)) {
      toast.error("Please fill all required fields");
      return;
    }
    saveMutation.mutate(form);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`${endpoint}/${id}`)).data,
    onSuccess: async () => {
      toast.success("Record deleted successfully.");
      setDeleteId(null);
      setSelected((prev) => prev.filter((x) => x !== deleteId));
      await invalidate();
    },
    onError: (err) => toast.error(extractApiError(err))
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => (await api.delete(endpoint, { data: { ids } })).data,
    onSuccess: async () => {
      toast.success("Selected records deleted.");
      setSelected([]);
      setBulkConfirm(false);
      await invalidate();
    },
    onError: (err) => toast.error(extractApiError(err))
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => api.post(endpoint, { action: "duplicate", id }),
    onSuccess: async () => {
      toast.success("Duplicated successfully");
      await invalidate();
    },
    onError: (err) => toast.error(extractApiError(err))
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async (nextStatus: string) =>
      api.post(endpoint, { action: "bulkUpdate", ids: selected, data: { status: nextStatus } }),
    onSuccess: async () => {
      toast.success("Bulk update complete");
      setSelected([]);
      await invalidate();
    },
    onError: (err) => toast.error(extractApiError(err))
  });

  const exportRows = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const col of columns) out[col.label] = getNested(row, col.key);
    return out;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const activeColumns = columns.filter((c) => visibleCols[c.key]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-3xl font-bold brand-gradient-text">{title}</h1>
          <p className="mt-1 text-sm text-[#64748B]">{subtitle}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" /> Add New
        </Button>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="glass-card premium-shadow p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Total records</p>
          <p className="mt-1 font-mono-num text-2xl font-bold text-[#0F172A]">{total}</p>
        </div>
        <div className="glass-card premium-shadow p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">On this page</p>
          <p className="mt-1 font-mono-num text-2xl font-bold text-[#0F172A]">{rows.length}</p>
        </div>
        <div className="glass-card premium-shadow p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Active / tagged</p>
          <p className="mt-1 font-mono-num text-2xl font-bold text-[#C9A227]">{activeCount}</p>
        </div>
      </div>

      <div className="glass-card premium-shadow flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
          <Input
            className="pl-10"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {statusOptions.length > 0 && (
          <select
            className="h-11 rounded-[12px] border border-[#E2E8F0] bg-white px-3 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={() => void refetch()} loading={isFetching}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => exportToCsv(exportName, exportRows)}
          disabled={!exportRows.length}
        >
          <Download className="size-4" /> CSV
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => exportToExcel(exportName, exportRows)}
          disabled={!exportRows.length}
        >
          <FileSpreadsheet className="size-4" /> Excel
        </Button>
        {selected.length > 0 && (
          <>
            {statusOptions[0] && (
              <select
                className="h-9 rounded-[10px] border border-[#E2E8F0] bg-white px-2 text-xs"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) bulkStatusMutation.mutate(e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="">Bulk status…</option>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <Button type="button" variant="danger" size="sm" onClick={() => setBulkConfirm(true)}>
              <Trash2 className="size-4" /> Delete ({selected.length})
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {columns.map((col) => (
          <label key={col.key} className="flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-xs text-[#64748B]">
            <input
              type="checkbox"
              checked={visibleCols[col.key]}
              onChange={() => setVisibleCols((p) => ({ ...p, [col.key]: !p[col.key] }))}
            />
            {col.label}
          </label>
        ))}
      </div>

      <div className="glass-card premium-shadow overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            title={`No ${title.toLowerCase()} yet`}
            description="Create your first record to get started."
            actionLabel="Add New"
            onAction={openCreate}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.length > 0 && selected.length === rows.length}
                        onChange={() =>
                          setSelected(selected.length === rows.length ? [] : rows.map((r) => rowId(r)))
                        }
                      />
                    </th>
                    {activeColumns.map((col) => (
                      <th key={col.key} className="px-4 py-3 font-medium text-[#64748B]">
                        {col.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 font-medium text-[#64748B]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const id = rowId(row);
                    return (
                      <tr key={id} className="border-b border-[#E2E8F0] transition hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selected.includes(id)} onChange={() => toggleSelect(id)} />
                        </td>
                        {activeColumns.map((col) => (
                          <td key={col.key} className="px-4 py-3">
                            {col.render ? col.render(row) : String(getNested(row, col.key) ?? "—")}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setViewing(row);
                                setViewOpen(true);
                              }}
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(row)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => duplicateMutation.mutate(id)}
                            >
                              <Copy className="size-4" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" onClick={() => setDeleteId(id)}>
                              <Trash2 className="size-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3 text-sm text-[#64748B]">
              <span>
                Page {page} of {totalPages} · {total} total
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08142D]/55 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass-card premium-shadow max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#08142D] to-[#1E3A8A] text-[#E6C86E]">
                <Database className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-[#0F172A]">
                  {editing ? "Update" : "Create"} {title}
                </h2>
                <p className="text-sm text-[#64748B]">
                  {editing ? "Edit fields and save your changes." : "Fill required fields, then click Create."}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.name} className={cn(field.type === "textarea" && "sm:col-span-2")}>
                    <Label>
                      {field.label}
                      {field.required ? <span className="text-red-500"> *</span> : null}
                    </Label>
                    {field.type === "select" ? (
                      <select
                        className={cn(
                          "mt-1.5 h-11 w-full rounded-[14px] border bg-white px-3 text-sm",
                          fieldErrors[field.name] ? "border-red-300" : "border-[#E2E8F0]"
                        )}
                        value={String(form[field.name] ?? "")}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, [field.name]: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, [field.name]: "" }));
                        }}
                      >
                        <option value="">Select {field.label.toLowerCase()}</option>
                        {(field.options ?? []).map((o) => (
                          <option key={o.value} value={o.value} disabled={!o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        className={cn(
                          "mt-1.5 min-h-24 w-full rounded-[14px] border bg-white px-3 py-2 text-sm",
                          fieldErrors[field.name] ? "border-red-300" : "border-[#E2E8F0]"
                        )}
                        value={String(form[field.name] ?? "")}
                        placeholder={field.placeholder}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, [field.name]: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, [field.name]: "" }));
                        }}
                      />
                    ) : (
                      <Input
                        className={cn("mt-1.5", fieldErrors[field.name] && "border-red-300")}
                        type={field.type ?? "text"}
                        placeholder={field.placeholder}
                        value={String(form[field.name] ?? "")}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            [field.name]: field.type === "number" ? Number(e.target.value) : e.target.value
                          }));
                          setFieldErrors((prev) => ({ ...prev, [field.name]: "" }));
                        }}
                      />
                    )}
                    {fieldErrors[field.name] ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                        <AlertCircle className="size-3" />
                        {fieldErrors[field.name]}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setModalOpen(false);
                    setFieldErrors({});
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={saveMutation.isPending}>
                  {editing ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {viewOpen && viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08142D]/55 p-4 backdrop-blur-sm">
          <div className="glass-card premium-shadow w-full max-w-lg p-6">
            <h2 className="font-display text-xl font-semibold">View {title}</h2>
            <div className="mt-4 space-y-2 text-sm">
              {columns.map((col) => (
                <div key={col.key} className="flex justify-between gap-4 border-b border-[#E2E8F0] py-2">
                  <span className="text-[#64748B]">{col.label}</span>
                  <span className="text-right font-medium">
                    {col.render ? col.render(viewing) : String(getNested(viewing, col.key) ?? "—")}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setViewOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete permanently?"
        description="Are you sure you want to permanently delete this record? This action cannot be undone."
        confirmLabel="Delete Permanently"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={bulkConfirm}
        title="Delete permanently?"
        description={`Are you sure you want to permanently delete ${selected.length} selected record(s)? This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        loading={bulkDeleteMutation.isPending}
        onConfirm={() => bulkDeleteMutation.mutate(selected)}
        onCancel={() => setBulkConfirm(false)}
      />
    </div>
  );
}
