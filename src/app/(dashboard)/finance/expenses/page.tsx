"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import { ModuleCrudPage } from "@/components/modules/module-crud-page";

export default function ExpensesPage() {
  return (
    <ModuleCrudPage
      title="Expenses"
      subtitle="Track operating costs from MongoDB"
      endpoint="/api/expenses"
      queryKey="expenses"
      exportName="expenses"
      statusOptions={[]}
      defaults={{
        title: "",
        category: "office",
        amount: 0,
        description: "",
        date: new Date().toISOString().slice(0, 10)
      }}
      columns={[
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        { key: "amount", label: "Amount", render: (row) => formatCurrency(Number(row.amount ?? 0)) },
        { key: "date", label: "Date", render: (row) => formatDate(String(row.date ?? "")) }
      ]}
      fields={[
        { name: "title", label: "Title", required: true },
        {
          name: "category",
          label: "Category",
          type: "select",
          options: [
            "office",
            "marketing",
            "hosting",
            "software",
            "electricity",
            "internet",
            "transport",
            "miscellaneous"
          ].map((v) => ({ label: v, value: v }))
        },
        { name: "amount", label: "Amount", type: "number", required: true },
        { name: "date", label: "Date", type: "date", required: true },
        { name: "description", label: "Description", type: "textarea" }
      ]}
      mapRowToForm={(row) => ({
        title: row.title,
        category: row.category,
        amount: row.amount,
        description: row.description ?? "",
        date: String(row.date ?? "").slice(0, 10)
      })}
    />
  );
}
