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
  ChevronDown
} from "lucide-react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";
import { exportToCsv, exportToExcel } from "@/lib/export";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type Employee = {
  _id: string;
  fullName: string;
  department?: string;
  employeeId?: string;
};

type Attendance = {
  _id: string;
  employeeId: Employee | string;
  employeeName: string;
  department?: string;
  date: string;
  dateKey?: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  workingHours?: number;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
};

const STATUS_OPTIONS = [
  { label: "Present", value: "present" },
  { label: "Absent", value: "absent" },
  { label: "Late", value: "late" },
  { label: "Half Day", value: "half_day" },
  { label: "Leave", value: "leave" },
  { label: "Work From Home", value: "work_from_home" }
];

type FormState = {
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
  department: string;
  remarks: string;
};

const emptyForm: FormState = {
  employeeId: "",
  date: new Date().toISOString().slice(0, 10),
  checkIn: "09:00",
  checkOut: "18:00",
  status: "present",
  department: "",
  remarks: ""
};

function EmployeeCombobox({
  employees,
  value,
  onChange,
  disabled
}: {
  employees: Employee[];
  value: string;
  onChange: (id: string, employee?: Employee) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = employees.find((e) => e._id === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q) ||
        e.employeeId?.toLowerCase().includes(q)
    );
  }, [employees, search]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between rounded-[12px] border border-[#E2E8F0] bg-white px-3 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
      >
        <span className={cn(!selected && "text-[#94A3B8]")}>
          {selected ? `${selected.fullName}${selected.department ? ` · ${selected.department}` : ""}` : "Select employee..."}
        </span>
        <ChevronDown className="size-4 text-[#64748B]" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-[14px] border border-[#E2E8F0] bg-white p-2 shadow-xl">
          <Input
            autoFocus
            placeholder="Search employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 h-10"
          />
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-[#64748B]">No employees found</p>
            ) : (
              filtered.map((e) => (
                <button
                  key={e._id}
                  type="button"
                  className={cn(
                    "flex w-full flex-col rounded-xl px-3 py-2 text-left text-sm hover:bg-[#F1F5F9]",
                    value === e._id && "bg-[rgba(212,175,55,0.12)]"
                  )}
                  onClick={() => {
                    onChange(e._id, e);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span className="font-medium text-[#0F172A]">{e.fullName}</span>
                  <span className="text-xs text-[#64748B]">
                    {e.employeeId ?? "—"} · {e.department ?? "General"}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Attendance | null>(null);
  const [viewing, setViewing] = useState<Attendance | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: ["employees-options"],
    queryFn: async () => (await api.get("/api/employees", { params: { limit: 100 } })).data
  });

  const employees: Employee[] = useMemo(() => employeesData?.data ?? [], [employeesData?.data]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) if (e.department) set.add(e.department);
    return Array.from(set).sort();
  }, [employees]);

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", query, status, department, page],
    queryFn: async () =>
      (
        await api.get("/api/attendance", {
          params: {
            query: query || undefined,
            status: status || undefined,
            department: department || undefined,
            page,
            limit: 10
          }
        })
      ).data
  });

  const rows: Attendance[] = useMemo(() => data?.data ?? [], [data?.data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["attendance"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
      queryClient.invalidateQueries({ queryKey: ["employees-options"] }),
      queryClient.refetchQueries({ queryKey: ["attendance"], type: "active" }),
      queryClient.refetchQueries({ queryKey: ["dashboard-stats"], type: "active" })
    ]);
  };

  const openCreate = () => {
    setEditing(null);
    setFormError("");
    setForm({
      ...emptyForm,
      employeeId: employees[0]?._id ?? "",
      department: employees[0]?.department ?? ""
    });
    setModalOpen(true);
  };

  const openEdit = (row: Attendance) => {
    const empId = typeof row.employeeId === "object" ? row.employeeId._id : String(row.employeeId);
    setEditing(row);
    setFormError("");
    setForm({
      employeeId: empId,
      date: (row.dateKey || String(row.date)).slice(0, 10),
      checkIn: row.checkIn ?? "",
      checkOut: row.checkOut ?? "",
      status: row.status,
      department: row.department ?? "",
      remarks: row.remarks ?? ""
    });
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormState) => {
      if (!values.employeeId) throw new Error("Please select an employee");
      if (!values.date) throw new Error("Attendance date is required");
      const payload = {
        employeeId: values.employeeId,
        date: values.date,
        checkIn: values.checkIn,
        checkOut: values.checkOut,
        status: values.status,
        department: values.department,
        remarks: values.remarks
      };
      if (editing?._id) return api.patch(`/api/attendance/${editing._id}`, payload);
      return api.post("/api/attendance", payload);
    },
    onSuccess: async () => {
      toast.success(editing ? "Attendance updated successfully" : "Attendance created successfully");
      setModalOpen(false);
      await invalidate();
    },
    onError: (err) => {
      const msg = isAxiosError(err)
        ? err.response?.data?.message ?? "Save failed"
        : err instanceof Error
          ? err.message
          : "Save failed";
      setFormError(msg);
      toast.error(msg);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/attendance/${id}`),
    onSuccess: async () => {
      toast.success("Record deleted successfully.");
      setDeleteId(null);
      await invalidate();
    },
    onError: (err) =>
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "Delete failed" : "Delete failed")
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => api.post("/api/attendance", { action: "duplicate", id }),
    onSuccess: async () => {
      toast.success("Attendance duplicated successfully");
      await invalidate();
    },
    onError: (err) =>
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "Duplicate failed" : "Duplicate failed")
  });

  const exportRows = rows.map((r) => ({
    Employee: r.employeeName,
    Date: r.dateKey ?? formatDate(r.date),
    "Check In": r.checkIn ?? "",
    "Check Out": r.checkOut ?? "",
    "Working Hours": r.workingHours ?? 0,
    Status: r.status,
    Department: r.department ?? "",
    Remarks: r.remarks ?? ""
  }));

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-3xl font-bold brand-gradient-text">Attendance</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Mark and manage daily attendance — employees load live from MongoDB
          </p>
        </div>
        <Button onClick={openCreate} disabled={employeesLoading || employees.length === 0}>
          <Plus className="size-4" /> Create Attendance
        </Button>
      </motion.div>

      <div className="glass-card premium-shadow flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
          <Input
            className="pl-10"
            placeholder="Search by employee name..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="h-11 rounded-[12px] border border-[#E2E8F0] bg-white px-3 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="h-11 rounded-[12px] border border-[#E2E8F0] bg-white px-3 text-sm"
          value={department}
          onChange={(e) => {
            setDepartment(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={() => exportToCsv("attendance", exportRows)}>
          <Download className="size-4" /> CSV
        </Button>
        <Button variant="secondary" size="sm" onClick={() => exportToExcel("attendance", exportRows)}>
          <FileSpreadsheet className="size-4" /> Excel
        </Button>
      </div>

      <div className="glass-card premium-shadow overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No attendance records"
            description="Create attendance for Abdul-Mannan, Raid Zia, Muhammad-Yousuf, Anjasha, or any employee in HRM."
            actionLabel="Create Attendance"
            onAction={openCreate}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Check In</th>
                  <th className="px-4 py-3 font-medium">Check Out</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Remarks</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className="border-b border-[#E2E8F0] transition hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#0F172A]">{row.employeeName}</p>
                      <p className="text-xs text-[#64748B]">{row.department || "—"}</p>
                    </td>
                    <td className="px-4 py-3">{row.dateKey ?? formatDate(row.date)}</td>
                    <td className="px-4 py-3 font-mono-num">{row.checkIn || "—"}</td>
                    <td className="px-4 py-3 font-mono-num">{row.checkOut || "—"}</td>
                    <td className="px-4 py-3 font-mono-num">{row.workingHours ?? 0}</td>
                    <td className="px-4 py-3 capitalize">{row.status.replaceAll("_", " ")}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-[#64748B]">{row.remarks || "—"}</td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">
                      {row.updatedAt ? formatDateTime(row.updatedAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="View"
                          onClick={() => {
                            setViewing(row);
                            setViewOpen(true);
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(row)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Duplicate"
                          onClick={() => duplicateMutation.mutate(row._id)}
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteId(row._id)}>
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
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
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08142D]/45 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl rounded-[18px] border border-[#E2E8F0] bg-white p-6 shadow-2xl"
          >
            <h2 className="font-display text-xl font-semibold text-[#0F172A]">
              {editing ? "Update Attendance" : "Create Attendance"}
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">Select an employee from the MongoDB employee list</p>

            {formError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Employee Name</Label>
                <div className="mt-1.5">
                  <EmployeeCombobox
                    employees={employees}
                    value={form.employeeId}
                    onChange={(id, emp) =>
                      setForm((prev) => ({
                        ...prev,
                        employeeId: id,
                        department: emp?.department ?? prev.department
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <Label>Attendance Date</Label>
                <Input
                  className="mt-1.5"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>

              <div>
                <Label>Attendance Status</Label>
                <select
                  className="mt-1.5 h-11 w-full rounded-[12px] border border-[#E2E8F0] bg-white px-3 text-sm"
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Check In Time</Label>
                <Input
                  className="mt-1.5"
                  type="time"
                  value={form.checkIn}
                  onChange={(e) => setForm((p) => ({ ...p, checkIn: e.target.value }))}
                />
              </div>

              <div>
                <Label>Check Out Time</Label>
                <Input
                  className="mt-1.5"
                  type="time"
                  value={form.checkOut}
                  onChange={(e) => setForm((p) => ({ ...p, checkOut: e.target.value }))}
                />
              </div>

              <div>
                <Label>Department</Label>
                <Input
                  className="mt-1.5"
                  value={form.department}
                  onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                  placeholder="Auto-filled from employee"
                />
              </div>

              <div className="sm:col-span-2">
                <Label>Remarks</Label>
                <textarea
                  className="mt-1.5 min-h-24 w-full rounded-[12px] border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
                  value={form.remarks}
                  onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
                {editing ? "Update" : "Save Attendance"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {viewOpen && viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08142D]/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[18px] border border-[#E2E8F0] bg-white p-6 shadow-2xl">
            <h2 className="font-display text-xl font-semibold">Attendance Details</h2>
            <div className="mt-4 space-y-2 text-sm">
              {[
                ["Employee", viewing.employeeName],
                ["Date", viewing.dateKey ?? formatDate(viewing.date)],
                ["Status", viewing.status],
                ["Check In", viewing.checkIn || "—"],
                ["Check Out", viewing.checkOut || "—"],
                ["Working Hours", String(viewing.workingHours ?? 0)],
                ["Department", viewing.department || "—"],
                ["Remarks", viewing.remarks || "—"],
                ["Created", viewing.createdAt ? formatDateTime(viewing.createdAt) : "—"],
                ["Updated", viewing.updatedAt ? formatDateTime(viewing.updatedAt) : "—"]
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-[#E2E8F0] py-2">
                  <span className="text-[#64748B]">{label}</span>
                  <span className="text-right font-medium capitalize text-[#0F172A]">{value}</span>
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
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
