"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, Trash2, FileSpreadsheet, Download } from "lucide-react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";
import { exportToCsv, exportToExcel } from "@/lib/export";
import { formatCurrency } from "@/lib/utils";
import {
  customerCreateSchema,
  formatCustomerPhone,
  type CustomerCreateInput
} from "@/validators/customer.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/providers/auth-provider";

type Customer = {
  _id: string;
  id?: string;
  customerId: string;
  name: string;
  phone: string;
  projectName: string;
  projectType: string;
  status: string;
  priority: string;
  totalCost: number;
  advancePaid: number;
  paidAmount: number;
  remainingAmount: number;
  projectDeadline: string;
  notes?: string;
};

const statusColors: Record<string, string> = {
  lead: "bg-[#FEF3C7] text-[#D97706]",
  active: "bg-[#EFF6FF] text-[#2563EB]",
  on_hold: "bg-[#F1F5F9] text-[#64748B]",
  completed: "bg-[#F0FDF4] text-[#22C55E]",
  cancelled: "bg-[#FEF2F2] text-[#EF4444]"
};

const emptyForm: CustomerCreateInput = {
  name: "",
  phone: "",
  whatsapp: "",
  address: "",
  projectName: "",
  projectType: "Web Application",
  totalCost: 0,
  advancePaid: 0,
  paidAmount: 0,
  projectDeadline: new Date().toISOString().slice(0, 10),
  priority: "medium",
  status: "lead",
  notes: "",
  technology: []
};

async function refreshCustomerQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["customers"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
    queryClient.refetchQueries({ queryKey: ["customers"], type: "active" }),
    queryClient.refetchQueries({ queryKey: ["dashboard-stats"], type: "active" })
  ]);
}

export default function CustomersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["customers", query, status, page],
    queryFn: async () =>
      (
        await api.get("/api/crm/customers", {
          params: { query: query || undefined, status: status || undefined, page, limit: 10 }
        })
      ).data
  });

  const customers: Customer[] = useMemo(() => data?.data ?? [], [data?.data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));

  const form = useForm<CustomerCreateInput>({
    // Zod transforms (money/optionalText) widen input vs output; cast keeps RHF aligned.
    resolver: zodResolver(customerCreateSchema) as Resolver<CustomerCreateInput>,
    defaultValues: emptyForm
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ ...emptyForm, projectDeadline: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    form.reset({
      name: customer.name,
      phone: customer.phone,
      projectName: customer.projectName,
      projectType: customer.projectType,
      totalCost: customer.totalCost,
      advancePaid: customer.advancePaid,
      paidAmount: Math.max(0, customer.paidAmount - (customer.advancePaid ?? 0)),
      projectDeadline: customer.projectDeadline.slice(0, 10),
      priority: customer.priority as CustomerCreateInput["priority"],
      status: customer.status as CustomerCreateInput["status"],
      notes: customer.notes ?? "",
      technology: []
    });
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: CustomerCreateInput) => {
      const toAmount = (value: unknown) => {
        const n = typeof value === "number" ? value : Number(value);
        return Number.isFinite(n) && n >= 0 ? n : 0;
      };
      const payload = {
        ...values,
        name: values.name.trim(),
        phone: values.phone.trim(),
        projectName: values.projectName.trim(),
        projectType: values.projectType.trim(),
        totalCost: toAmount(values.totalCost),
        advancePaid: toAmount(values.advancePaid ?? 0),
        paidAmount: toAmount(values.paidAmount ?? 0),
        ...(user?.id ? { assignedManager: user.id } : {})
      };
      if (editing) {
        const response = await api.patch(`/api/crm/customers/${editing._id}`, payload);
        return { mode: "update" as const, customer: (response.data.customer ?? response.data) as Customer };
      }
      const response = await api.post("/api/crm/customers", payload);
      return { mode: "create" as const, customer: response.data as Customer };
    },
    onSuccess: async (result) => {
      toast.success(result.mode === "update" ? "Customer updated" : "Customer created successfully");
      setModalOpen(false);
      setEditing(null);
      submitLockRef.current = false;
      form.reset({ ...emptyForm, projectDeadline: new Date().toISOString().slice(0, 10) });
      setPage(1);

      // Instant UI update, then reconcile with server.
      queryClient.setQueriesData({ queryKey: ["customers"] }, (current: unknown) => {
        if (!current || typeof current !== "object") return current;
        const pageData = current as { data?: Customer[]; total?: number };
        const list = Array.isArray(pageData.data) ? [...pageData.data] : [];
        const saved = {
          ...result.customer,
          _id: result.customer._id || result.customer.id || ""
        };
        if (result.mode === "create") {
          return {
            ...pageData,
            data: [saved, ...list.filter((item) => item._id !== saved._id)],
            total: (pageData.total ?? list.length) + 1
          };
        }
        return {
          ...pageData,
          data: list.map((item) => (item._id === saved._id ? { ...item, ...saved } : item))
        };
      });

      await refreshCustomerQueries(queryClient);
    },
    onError: (err) => {
      submitLockRef.current = false;
      const message = isAxiosError(err) ? err.response?.data?.message ?? "Save failed" : "Save failed";
      toast.error(message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/crm/customers/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["customers"] });
      queryClient.setQueriesData({ queryKey: ["customers"] }, (current: unknown) => {
        if (!current || typeof current !== "object") return current;
        const pageData = current as { data?: Customer[]; total?: number };
        const list = Array.isArray(pageData.data) ? pageData.data : [];
        return {
          ...pageData,
          data: list.filter((item) => item._id !== id),
          total: Math.max(0, (pageData.total ?? list.length) - 1)
        };
      });
    },
    onSuccess: async () => {
      toast.success("Record deleted successfully.");
      setDeleteId(null);
      await refreshCustomerQueries(queryClient);
    },
    onError: async (err) => {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "Delete failed" : "Delete failed");
      await refreshCustomerQueries(queryClient);
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => api.delete("/api/crm/customers", { data: { ids } }),
    onMutate: async (ids) => {
      const idSet = new Set(ids);
      queryClient.setQueriesData({ queryKey: ["customers"] }, (current: unknown) => {
        if (!current || typeof current !== "object") return current;
        const pageData = current as { data?: Customer[]; total?: number };
        const list = Array.isArray(pageData.data) ? pageData.data : [];
        const next = list.filter((item) => !idSet.has(item._id));
        return {
          ...pageData,
          data: next,
          total: Math.max(0, (pageData.total ?? list.length) - (list.length - next.length))
        };
      });
    },
    onSuccess: async () => {
      toast.success("Record deleted successfully.");
      setSelected([]);
      await refreshCustomerQueries(queryClient);
    },
    onError: async (err) => {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "Bulk delete failed" : "Bulk delete failed");
      await refreshCustomerQueries(queryClient);
    }
  });

  const exportRows = useMemo(
    () =>
      customers.map((c) => ({
        ID: c.customerId,
        Name: c.name,
        Phone: formatCustomerPhone(c.phone),
        Project: c.projectName,
        Status: c.status,
        Total: c.totalCost,
        Paid: c.paidAmount,
        Remaining: c.remainingAmount
      })),
    [customers]
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (selected.length === customers.length) setSelected([]);
    else setSelected(customers.map((c) => c._id));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">CRM Customers</h1>
          <p className="text-sm text-[#64748B]">
            {total} customers &middot; Revenue {formatCurrency(data?.financials?.totalCost ?? 0)} &middot; Pending{" "}
            {formatCurrency(data?.financials?.remainingAmount ?? 0)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportToCsv("customers", exportRows)} disabled={!exportRows.length}>
            <Download className="size-4" /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportToExcel("customers", exportRows)} disabled={!exportRows.length}>
            <FileSpreadsheet className="size-4" /> Excel
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> Add Customer
          </Button>
        </div>
      </motion.div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
            <Input
              className="pl-9"
              placeholder="Search by name or phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-[10px] border border-[#E2E8F0] bg-white px-3 text-sm"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All statuses</option>
            <option value="lead">Lead</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {selected.length > 0 ? (
            <Button variant="danger" size="sm" onClick={() => bulkDeleteMutation.mutate(selected)} loading={bulkDeleteMutation.isPending}>
              <Trash2 className="size-4" /> Delete ({selected.length})
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden premium-shadow">
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <div className="p-8 text-center text-sm text-[#EF4444]">Failed to load customers.</div>
        ) : customers.length === 0 ? (
          <EmptyState
            title="No customers yet"
            description="Create your first customer to start tracking projects and payments."
            actionLabel="Add Customer"
            onAction={openCreate}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={selected.length === customers.length} onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="px-4 py-3 font-medium text-[#64748B] text-xs uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-3 font-medium text-[#64748B] text-xs uppercase tracking-wider">Project</th>
                    <th className="px-4 py-3 font-medium text-[#64748B] text-xs uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 font-medium text-[#64748B] text-xs uppercase tracking-wider text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-[#64748B] text-xs uppercase tracking-wider text-right">Pending</th>
                    <th className="px-4 py-3 font-medium text-[#64748B] text-xs uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((item) => (
                    <tr key={item._id} className="border-b border-[#E2E8F0] transition hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.includes(item._id)} onChange={() => toggleSelect(item._id)} className="rounded" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EFF6FF] text-xs font-bold text-[#2563EB]">
                            {item.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#0F172A]">{item.name}</p>
                            <p className="truncate text-xs text-[#64748B]">{formatCustomerPhone(item.phone)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#0F172A]">{item.projectName}</td>
                      <td className="px-4 py-3">
                        <span className={["inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", statusColors[item.status] ?? "bg-[#F1F5F9] text-[#64748B]"].join(" ")}>
                          {item.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.totalCost)}</td>
                      <td className="px-4 py-3 text-right text-[#EF4444]">{formatCurrency(item.remainingAmount)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteId(item._id)}>
                            <Trash2 className="size-4 text-[#EF4444]" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3 text-sm text-[#64748B]">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <CardHeader>
              <CardTitle>{editing ? "Edit Customer" : "Add Customer"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={form.handleSubmit(
                  (values) => {
                    if (submitLockRef.current || saveMutation.isPending) return;
                    submitLockRef.current = true;
                    saveMutation.mutate(values);
                  },
                  () => toast.error("Please fix the highlighted form fields")
                )}
                className="grid gap-4 sm:grid-cols-2"
                noValidate
              >
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input {...form.register("name")} />
                  {form.formState.errors.name ? <p className="text-xs text-[#EF4444]">{form.formState.errors.name.message}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <Label>Phone *</Label>
                  <Input placeholder="03001234567" {...form.register("phone")} />
                  {form.formState.errors.phone ? <p className="text-xs text-[#EF4444]">{form.formState.errors.phone.message}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <Label>Project Name *</Label>
                  <Input {...form.register("projectName")} />
                  {form.formState.errors.projectName ? (
                    <p className="text-xs text-[#EF4444]">{form.formState.errors.projectName.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label>Project Type *</Label>
                  <Input {...form.register("projectType")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Total Cost</Label>
                  <Input type="number" min="0" step="0.01" {...form.register("totalCost", { valueAsNumber: true })} />
                  {form.formState.errors.totalCost ? (
                    <p className="text-xs text-[#EF4444]">{form.formState.errors.totalCost.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label>Advance Paid</Label>
                  <Input type="number" min="0" step="0.01" {...form.register("advancePaid", { valueAsNumber: true })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Additional Paid</Label>
                  <Input type="number" min="0" step="0.01" {...form.register("paidAmount", { valueAsNumber: true })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Deadline *</Label>
                  <Input type="date" {...form.register("projectDeadline")} />
                  {form.formState.errors.projectDeadline ? (
                    <p className="text-xs text-[#EF4444]">{form.formState.errors.projectDeadline.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <select className="h-10 w-full rounded-[10px] border border-[#E2E8F0] bg-white px-3 text-sm" {...form.register("status")}>
                    <option value="lead">Lead</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <select className="h-10 w-full rounded-[10px] border border-[#E2E8F0] bg-white px-3 text-sm" {...form.register("priority")}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="col-span-full space-y-1.5">
                  <Label>Notes</Label>
                  <Input {...form.register("notes")} />
                </div>
                <div className="col-span-full flex justify-end gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={saveMutation.isPending}>
                    {editing ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete permanently?"
        description="Are you sure you want to permanently delete this record? This action cannot be undone."
        confirmLabel="Delete Permanently"
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}
