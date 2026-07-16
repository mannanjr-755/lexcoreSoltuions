"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { formatCurrency } from "@/lib/utils";
import { ModuleCrudPage } from "@/components/modules/module-crud-page";

export default function EmployeesPage() {
  const { data } = useQuery({
    queryKey: ["departments-options"],
    queryFn: async () => (await api.get("/api/departments", { params: { limit: 100 } })).data
  });

  const departmentOptions = useMemo(() => {
    const fromApi = (data?.data ?? []).map((d: { name: string }) => ({
      label: d.name,
      value: d.name
    }));
    if (fromApi.length) return fromApi;
    return [
      { label: "Engineering", value: "Engineering" },
      { label: "Operations", value: "Operations" },
      { label: "HR", value: "HR" },
      { label: "General", value: "General" }
    ];
  }, [data]);

  return (
    <ModuleCrudPage
      title="Employees"
      subtitle="HR directory synced with MongoDB — new employees appear in Attendance automatically"
      endpoint="/api/employees"
      queryKey="employees"
      exportName="employees"
      statusOptions={[
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "On Leave", value: "on_leave" }
      ]}
      defaults={{
        employeeId: `EMP-${Date.now().toString().slice(-5)}`,
        fullName: "",
        email: "",
        phone: "",
        department: departmentOptions[0]?.value ?? "Engineering",
        position: "Developer",
        salary: 0,
        status: "active",
        joinDate: new Date().toISOString().slice(0, 10),
        attendancePercentage: 100
      }}
      columns={[
        { key: "employeeId", label: "ID" },
        { key: "fullName", label: "Name" },
        { key: "email", label: "Email" },
        { key: "department", label: "Department" },
        { key: "position", label: "Position" },
        { key: "salary", label: "Salary", render: (row) => formatCurrency(Number(row.salary ?? 0)) },
        { key: "status", label: "Status" },
        { key: "attendancePercentage", label: "Attendance", render: (row) => `${row.attendancePercentage ?? 0}%` }
      ]}
      fields={[
        { name: "employeeId", label: "Employee ID", required: true },
        { name: "fullName", label: "Full Name", required: true },
        { name: "email", label: "Email", required: true },
        { name: "phone", label: "Phone" },
        {
          name: "department",
          label: "Department",
          type: "select",
          required: true,
          options: departmentOptions
        },
        { name: "position", label: "Position", required: true },
        { name: "salary", label: "Salary", type: "number" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
            { label: "On Leave", value: "on_leave" }
          ]
        },
        { name: "joinDate", label: "Join Date", type: "date" },
        { name: "attendancePercentage", label: "Attendance %", type: "number" }
      ]}
      mapRowToForm={(row) => ({
        ...row,
        joinDate: String(row.joinDate ?? "").slice(0, 10)
      })}
    />
  );
}
