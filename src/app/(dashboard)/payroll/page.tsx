"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { formatCurrency } from "@/lib/utils";
import { ModuleCrudPage } from "@/components/modules/module-crud-page";

export default function PayrollPage() {
  const { data } = useQuery({
    queryKey: ["employees-options"],
    queryFn: async () => (await api.get("/api/employees", { params: { limit: 100 } })).data
  });

  const employeeOptions = useMemo(
    () =>
      (data?.data ?? []).map((e: { _id: string; fullName: string }) => ({
        label: e.fullName,
        value: e._id
      })),
    [data]
  );

  const now = new Date();

  return (
    <ModuleCrudPage
      title="Payroll"
      subtitle="Salary processing stored in MongoDB"
      endpoint="/api/payroll"
      queryKey="payroll"
      exportName="payroll"
      statusOptions={[
        { label: "Draft", value: "draft" },
        { label: "Processed", value: "processed" },
        { label: "Paid", value: "paid" }
      ]}
      defaults={{
        employeeId: employeeOptions[0]?.value ?? "",
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        basicSalary: 0,
        allowances: 0,
        deductions: 0,
        netSalary: 0,
        status: "draft",
        notes: ""
      }}
      columns={[
        {
          key: "employeeId.fullName",
          label: "Employee",
          render: (row) => {
            const e = row.employeeId as { fullName?: string } | string | undefined;
            return typeof e === "object" ? e?.fullName ?? "—" : String(e ?? "—");
          }
        },
        { key: "month", label: "Month" },
        { key: "year", label: "Year" },
        { key: "netSalary", label: "Net", render: (row) => formatCurrency(Number(row.netSalary ?? 0)) },
        { key: "status", label: "Status" }
      ]}
      fields={[
        {
          name: "employeeId",
          label: "Employee",
          type: "select",
          options: employeeOptions.length ? employeeOptions : [{ label: "No employees", value: "" }]
        },
        { name: "month", label: "Month", type: "number" },
        { name: "year", label: "Year", type: "number" },
        { name: "basicSalary", label: "Basic Salary", type: "number" },
        { name: "allowances", label: "Allowances", type: "number" },
        { name: "deductions", label: "Deductions", type: "number" },
        { name: "netSalary", label: "Net Salary", type: "number" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Draft", value: "draft" },
            { label: "Processed", value: "processed" },
            { label: "Paid", value: "paid" }
          ]
        },
        { name: "notes", label: "Notes", type: "textarea" }
      ]}
      transformSubmit={(values) => {
        const basicSalary = Number(values.basicSalary ?? 0);
        const allowances = Number(values.allowances ?? 0);
        const deductions = Number(values.deductions ?? 0);
        return {
          ...values,
          basicSalary,
          allowances,
          deductions,
          netSalary: Number(values.netSalary ?? basicSalary + allowances - deductions)
        };
      }}
    />
  );
}
