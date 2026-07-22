"use client";

import { ModuleCrudPage } from "@/components/modules/module-crud-page";
import { formatDate } from "@/lib/utils";

export default function TasksPage() {
  return (
    <ModuleCrudPage
      title="Tasks"
      subtitle="Operational tasks"
      endpoint="/api/tasks"
      queryKey="tasks"
      exportName="tasks"
      statusOptions={[
        { label: "Todo", value: "todo" },
        { label: "In Progress", value: "in_progress" },
        { label: "Review", value: "review" },
        { label: "Done", value: "done" },
        { label: "Cancelled", value: "cancelled" }
      ]}
      defaults={{
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        dueDate: new Date().toISOString().slice(0, 10)
      }}
      columns={[
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        { key: "priority", label: "Priority" },
        { key: "dueDate", label: "Due", render: (row) => (row.dueDate ? formatDate(String(row.dueDate)) : "—") }
      ]}
      fields={[
        { name: "title", label: "Title", required: true },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Todo", value: "todo" },
            { label: "In Progress", value: "in_progress" },
            { label: "Review", value: "review" },
            { label: "Done", value: "done" },
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
        { name: "dueDate", label: "Due Date", type: "date" },
        { name: "description", label: "Description", type: "textarea" }
      ]}
      mapRowToForm={(row) => ({
        title: row.title,
        description: row.description ?? "",
        status: row.status,
        priority: row.priority,
        dueDate: row.dueDate ? String(row.dueDate).slice(0, 10) : ""
      })}
    />
  );
}
