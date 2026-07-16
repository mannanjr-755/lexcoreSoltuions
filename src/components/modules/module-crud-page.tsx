"use client";

import { useMemo, useState } from "react";
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
  FileText,
  RefreshCw
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(
    Object.fromEntries(columns.map((c) => [c.key, true]))
  );

  const { data, isLoading } = useQuery({
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

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [queryKey] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
      queryClient.refetchQueries({ queryKey: [queryKey], type: "active" }),
      queryClient.refetchQueries({ queryKey: ["dashboard-stats"], type: "active" })
    ]);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaults });
    setModalOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    setForm(mapRowToForm ? mapRowToForm(row) : { ...row });
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      // Only submit declared form fields — never send populated Mongo documents
      const cleaned: Record<string, unknown> = {};
      for (const field of fields) {
        if (values[field.name] !== undefined) cleaned[field.name] = values[field.name];
      }
      const payload = transformSubmit ? transformSubmit(cleaned) : cleaned;
      if (editing?._id) return api.patch(`${endpoint}/${editing._id}`, payload);
      return api.post(endpoint, payload);
    },
    onSuccess: async () => {
      toast.success(editing ? "Record updated successfully" : "Record added successfully");
      setModalOpen(false);
      await invalidate();
    },
    onError: (err) => {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "Save failed" : "Save failed");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`${endpoint}/${id}`);
      return res.data;
    },
    onSuccess: async () => {
      toast.success("Record deleted successfully.");
      setDeleteId(null);
      setSelected((prev) => prev.filter((x) => x !== deleteId));
      await invalidate();
    },
    onError: (err) =>
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "Delete failed" : "Delete failed")
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await api.delete(endpoint, { data: { ids } });
      return res.data;
    },
    onSuccess: async () => {
      toast.success("Record deleted successfully.");
      setSelected([]);
      setBulkConfirm(false);
      await invalidate();
    },
    onError: (err) =>
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "Bulk delete failed" : "Bulk delete failed")
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => api.post(endpoint, { action: "duplicate", id }),
    onSuccess: async () => {
      toast.success("Duplicated successfully");
      await invalidate();
    },
    onError: () => toast.error("Duplicate failed")
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async (nextStatus: string) =>
      api.post(endpoint, { action: "bulkUpdate", ids: selected, data: { status: nextStatus } }),
    onSuccess: async () => {
      toast.success("Bulk update complete");
      setSelected([]);
      await invalidate();
    },
    onError: () => toast.error("Bulk update failed")
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
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold brand-gradient-text">{title}</h1>
          <p className="mt-1 text-sm text-[#64748B]">{subtitle}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Add New
        </Button>
      </motion.div>

      <div className="glass-card premium-shadow flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
          <Input
            className="pl-10"
            placeholder="Search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {statusOptions.length > 0 && (
          <select
            className="h-11 rounded-[14px] border border-[#E2E8F0] bg-transparent px-3 text-sm"
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
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => invalidate()}
            title="Refresh from MongoDB"
          >
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportToCsv(exportName, exportRows)}>
            <Download className="size-4" /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportToExcel(exportName, exportRows)}>
            <FileSpreadsheet className="size-4" /> Excel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const text = exportRows.map((r) => Object.values(r).join(" | ")).join("\n");
              const blob = new Blob([text], { type: "application/pdf" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${exportName}.txt`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Export ready");
            }}
          >
            <FileText className="size-4" /> PDF
          </Button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-[rgba(212,175,55,0.25)] bg-[rgba(212,175,55,0.1)] px-4 py-3">
          <span className="text-sm">{selected.length} selected</span>
          <Button size="sm" variant="danger" onClick={() => setBulkConfirm(true)}>
            Bulk Delete
          </Button>
          {statusOptions[0] && (
            <Button size="sm" variant="secondary" onClick={() => bulkStatusMutation.mutate(statusOptions[0].value)}>
              Bulk Update Status
            </Button>
          )}
        </div>
      )}

      <div className="glass-card premium-shadow overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-[#E2E8F0] px-4 py-3">
          {columns.map((col) => (
            <label key={col.key} className="flex items-center gap-1.5 text-xs text-[#64748B]">
              <input
                type="checkbox"
                checked={visibleCols[col.key]}
                onChange={() => setVisibleCols((prev) => ({ ...prev, [col.key]: !prev[col.key] }))}
              />
              {col.label}
            </label>
          ))}
        </div>

        {isLoading ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={`No ${title.toLowerCase()} found`} description="Create your first record to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--card-bg)]">
                <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.length === rows.length && rows.length > 0}
                      onChange={() =>
                        setSelected(selected.length === rows.length ? [] : rows.map((r) => String(r._id)))
                      }
                    />
                  </th>
                  {activeColumns.map((col) => (
                    <th key={col.key} className="px-4 py-3 font-medium">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const id = String(row._id);
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
                        <div className="flex flex-wrap gap-1">
                          <Button size="icon" variant="ghost" title="View" onClick={() => { setViewing(row); setViewOpen(true); }}>
                            <Eye className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(row)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Duplicate" onClick={() => duplicateMutation.mutate(id)}>
                            <Copy className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Delete Permanently" onClick={() => setDeleteId(id)}>
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
        )}

        <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3 text-sm">
          <span className="text-[#64748B]">
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card premium-shadow max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"
          >
            <h2 className="font-display text-xl font-semibold">{editing ? "Update" : "Create"} {title}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field.name} className={cn(field.type === "textarea" && "sm:col-span-2")}>
                  <Label>{field.label}</Label>
                  {field.type === "select" ? (
                    <select
                      className="mt-1.5 h-11 w-full rounded-[14px] border border-[#E2E8F0] bg-transparent px-3 text-sm"
                      value={String(form[field.name] ?? "")}
                      onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                    >
                      {(field.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      className="mt-1.5 min-h-24 w-full rounded-[14px] border border-[#E2E8F0] bg-transparent px-3 py-2 text-sm"
                      value={String(form[field.name] ?? "")}
                      onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                    />
                  ) : (
                    <Input
                      className="mt-1.5"
                      type={field.type ?? "text"}
                      placeholder={field.placeholder}
                      value={String(form[field.name] ?? "")}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [field.name]: field.type === "number" ? Number(e.target.value) : e.target.value
                        }))
                      }
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
                {editing ? "Update" : "Create"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {viewOpen && viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="glass-card premium-shadow w-full max-w-lg p-6">
            <h2 className="font-display text-xl font-semibold">View {title}</h2>
            <div className="mt-4 space-y-2 text-sm">
              {columns.map((col) => (
                <div key={col.key} className="flex justify-between gap-4 border-b border-[#E2E8F0] py-2">
                  <span className="text-[#64748B]">{col.label}</span>
                  <span className="text-right">{col.render ? col.render(viewing) : String(getNested(viewing, col.key) ?? "—")}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setViewOpen(false)}>
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
