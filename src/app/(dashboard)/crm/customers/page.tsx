"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, Trash2, FileSpreadsheet, FileText, Download } from "lucide-react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";
import { exportToCsv, exportToExcel } from "@/lib/export";
import { formatCurrency } from "@/lib/utils";
import { customerCreateSchema, type CustomerCreateInput } from "@/validators/customer.schema";
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
  customerId: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
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

export default function CustomersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
    resolver: zodResolver(customerCreateSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      projectName: "",
      projectType: "Web Application",
      totalCost: 0,
      advancePaid: 0,
      paidAmount: 0,
      projectDeadline: new Date().toISOString().slice(0, 10),
      priority: "medium",
      status: "lead",
      technology: []
    }
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      name: "",
      phone: "",
      email: "",
      company: "",
      address: "",
      whatsapp: "",
      projectName: "",
      projectType: "Web Application",
      totalCost: 0,
      advancePaid: 0,
      paidAmount: 0,
      projectDeadline: new Date().toISOString().slice(0, 10),
      priority: "medium",
      status: "lead",
      notes: "",
      technology: [],
      assignedManager: user?.id
    });
    setModalOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    form.reset({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      company: customer.company ?? "",
      projectName: customer.projectName,
      projectType: customer.projectType,
      totalCost: customer.totalCost,
      advancePaid: customer.advancePaid,
      paidAmount: Math.max(0, customer.paidAmount - (customer.advancePaid ?? 0)),
      projectDeadline: customer.projectDeadline.slice(0, 10),
      priority: customer.priority as CustomerCreateInput["priority"],
      status: customer.status as CustomerCreateInput["status"],
      notes: customer.notes ?? "",
      technology: [],
      assignedManager: user?.id
    });
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: CustomerCreateInput) => {
      const payload = {
        ...values,
        totalCost: Number(values.totalCost),
        advancePaid: Number(values.advancePaid ?? 0),
        paidAmount: Number(values.paidAmount ?? 0),
        assignedManager: values.assignedManager || user?.id
      };
      if (editing) {
        return api.patch(`/api/crm/customers/${editing._id}`, payload);
      }
      return api.post("/api/crm/customers", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Customer updated" : "Customer created");
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (err) => {
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "Save failed" : "Save failed");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/crm/customers/${id}`),
    onSuccess: async () => {
      toast.success("Record deleted successfully.");
      setDeleteId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
        queryClient.refetchQueries({ queryKey: ["customers"], type: "active" }),
        queryClient.refetchQueries({ queryKey: ["dashboard-stats"], type: "active" })
      ]);
    },
    onError: (err) =>
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "Delete failed" : "Delete failed")
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => api.delete("/api/crm/customers", { data: { ids } }),
    onSuccess: async () => {
      toast.success("Record deleted successfully.");
      setSelected([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
        queryClient.refetchQueries({ queryKey: ["customers"], type: "active" }),
        queryClient.refetchQueries({ queryKey: ["dashboard-stats"], type: "active" })
      ]);
    },
    onError: (err) =>
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "Bulk delete failed" : "Bulk delete failed")
  });

  const exportRows = useMemo(
    () =>
      customers.map((c) => ({
        ID: c.customerId,
        Name: c.name,
        Email: c.email,
        Phone: c.phone,
        Company: c.company ?? "",
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
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-space)] text-3xl font-bold brand-gradient-text">CRM Customers</h1>
          <p className="text-[#64748B]">
            {total} customers · Revenue {formatCurrency(data?.financials?.totalRevenue ?? 0)} · Pending{" "}
            {formatCurrency(data?.financials?.totalPending ?? 0)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => exportToCsv("customers", exportRows)} disabled={!exportRows.length}>
            <Download className="size-4" /> CSV
          </Button>
          <Button variant="secondary" onClick={() => exportToExcel("customers", exportRows)} disabled={!exportRows.length}>
            <FileSpreadsheet className="size-4" /> Excel
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Add Customer
          </Button>
        </div>
      </motion.div>

      <Card className="premium-shadow">
        <CardContent className="flex flex-wrap gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
            <Input
              className="pl-10"
              placeholder="Search customers..."
              value={query}
              onChange={(e) => {
                setPage(1);
                setQuery(e.target.value);
              }}
            />
          </div>
          <select
            className="h-11 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] px-4 text-sm"
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
            <Button variant="danger" onClick={() => bulkDeleteMutation.mutate(selected)} loading={bulkDeleteMutation.isPending}>
              <Trash2 className="size-4" /> Delete ({selected.length})
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/80 backdrop-blur-xl">
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <div className="p-8 text-center text-red-400">Failed to load customers. Check MongoDB connection.</div>
        ) : customers.length === 0 ? (
          <EmptyState
            title="No customers yet"
            description="Create your first customer to start tracking projects and payments."
            actionLabel="Add Customer"
            onAction={openCreate}
          />
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-[#E2E8F0] bg-[#F1F5F9]">
                <tr>
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={selected.length === customers.length} onChange={toggleAll} />
                  </th>
                  <th className="px-4 py-3 font-medium text-[#64748B]">ID</th>
                  <th className="px-4 py-3 font-medium text-[#64748B]">Customer</th>
                  <th className="px-4 py-3 font-medium text-[#64748B]">Project</th>
                  <th className="px-4 py-3 font-medium text-[#64748B]">Status</th>
                  <th className="px-4 py-3 font-medium text-[#64748B]">Total</th>
                  <th className="px-4 py-3 font-medium text-[#64748B]">Pending</th>
                  <th className="px-4 py-3 font-medium text-[#64748B]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((item) => (
                  <tr key={item._id} className="border-b border-[#E2E8F0] transition hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.includes(item._id)} onChange={() => toggleSelect(item._id)} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#C9A227]">{item.customerId}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-[#64748B]">{item.email}</div>
                    </td>
                    <td className="px-4 py-3">{item.projectName}</td>
                    <td className="px-4 py-3 capitalize text-[#C9A227]">{item.status.replace("_", " ")}</td>
                    <td className="px-4 py-3">{formatCurrency(item.totalCost)}</td>
                    <td className="px-4 py-3 text-red-400">{formatCurrency(item.remainingAmount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(item._id)}>
                          <Trash2 className="size-4 text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto premium-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5 text-[#C9A227]" />
                {editing ? "Edit Customer" : "Add Customer"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input {...form.register("name")} />
                  {form.formState.errors.name ? <p className="text-xs text-red-400">{form.formState.errors.name.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" {...form.register("email")} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input {...form.register("phone")} />
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input {...form.register("company")} />
                </div>
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input {...form.register("projectName")} />
                </div>
                <div className="space-y-2">
                  <Label>Project Type</Label>
                  <Input {...form.register("projectType")} />
                </div>
                <div className="space-y-2">
                  <Label>Total Cost</Label>
                  <Input type="number" step="0.01" {...form.register("totalCost", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Advance Paid</Label>
                  <Input type="number" step="0.01" {...form.register("advancePaid", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Additional Paid</Label>
                  <Input type="number" step="0.01" {...form.register("paidAmount", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Deadline</Label>
                  <Input type="date" {...form.register("projectDeadline")} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] px-4 text-sm" {...form.register("status")}>
                    <option value="lead">Lead</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <select className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] px-4 text-sm" {...form.register("priority")}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="col-span-full space-y-2">
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
