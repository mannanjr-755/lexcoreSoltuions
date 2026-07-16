"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ModuleCrudPage } from "@/components/modules/module-crud-page";

export default function ProjectsPage() {
  const { data } = useQuery({
    queryKey: ["customers-options"],
    queryFn: async () => (await api.get("/api/crm/customers", { params: { limit: 100 } })).data
  });

  const customerOptions = useMemo(
    () =>
      (data?.data ?? []).map((c: { _id: string; name: string }) => ({
        label: c.name,
        value: c._id
      })),
    [data]
  );

  return (
    <ModuleCrudPage
      title="Projects"
      subtitle="Manage delivery pipeline with live MongoDB records"
      endpoint="/api/projects"
      queryKey="projects"
      exportName="projects"
      statusOptions={[
        { label: "Pending", value: "pending" },
        { label: "Active", value: "active" },
        { label: "On Hold", value: "on_hold" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" }
      ]}
      defaults={{
        name: "",
        customerId: customerOptions[0]?.value ?? "",
        description: "",
        status: "pending",
        priority: "medium",
        progress: 0,
        budget: 0,
        spent: 0,
        deadline: new Date().toISOString().slice(0, 10)
      }}
      columns={[
        { key: "name", label: "Name" },
        {
          key: "customerId.name",
          label: "Customer",
          render: (row) => {
            const c = row.customerId as { name?: string } | string | undefined;
            return typeof c === "object" ? c?.name ?? "—" : String(c ?? "—");
          }
        },
        { key: "status", label: "Status" },
        { key: "progress", label: "Progress", render: (row) => `${row.progress ?? 0}%` },
        { key: "budget", label: "Budget", render: (row) => formatCurrency(Number(row.budget ?? 0)) },
        { key: "deadline", label: "Deadline", render: (row) => formatDate(String(row.deadline ?? "")) }
      ]}
      fields={[
        { name: "name", label: "Project Name", required: true },
        {
          name: "customerId",
          label: "Customer",
          type: "select",
          options: customerOptions.length ? customerOptions : [{ label: "No customers", value: "" }]
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Pending", value: "pending" },
            { label: "Active", value: "active" },
            { label: "On Hold", value: "on_hold" },
            { label: "Completed", value: "completed" },
            { label: "Cancelled", value: "cancelled" }
          ]
        },
        {
          name: "priority",
          label: "Priority",
          type: "select",
          options: [
            { label: "Low", value: "low" },
            { label: "Medium", value: "medium" },
            { label: "High", value: "high" },
            { label: "Urgent", value: "urgent" }
          ]
        },
        { name: "progress", label: "Progress %", type: "number" },
        { name: "budget", label: "Budget", type: "number" },
        { name: "spent", label: "Spent", type: "number" },
        { name: "deadline", label: "Deadline", type: "date" },
        { name: "description", label: "Description", type: "textarea" }
      ]}
      mapRowToForm={(row) => ({
        name: row.name,
        customerId: typeof row.customerId === "object" && row.customerId ? (row.customerId as { _id: string })._id : row.customerId,
        description: row.description ?? "",
        status: row.status,
        priority: row.priority,
        progress: row.progress ?? 0,
        budget: row.budget ?? 0,
        spent: row.spent ?? 0,
        deadline: String(row.deadline ?? "").slice(0, 10)
      })}
    />
  );
}
