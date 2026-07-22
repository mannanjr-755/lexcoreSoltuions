"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ModuleCrudPage } from "@/components/modules/module-crud-page";

export default function QuotationsPage() {
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
      title="Quotations"
      subtitle="Sales quotations"
      endpoint="/api/quotations"
      queryKey="quotations"
      exportName="quotations"
      statusOptions={[
        { label: "Draft", value: "draft" },
        { label: "Sent", value: "sent" },
        { label: "Accepted", value: "accepted" },
        { label: "Rejected", value: "rejected" },
        { label: "Expired", value: "expired" }
      ]}
      defaults={{
        quotationNumber: `QT-${Date.now().toString().slice(-6)}`,
        customerId: customerOptions[0]?.value ?? "",
        title: "",
        amount: 0,
        tax: 0,
        discount: 0,
        grandTotal: 0,
        status: "draft",
        validUntil: new Date().toISOString().slice(0, 10),
        notes: ""
      }}
      columns={[
        { key: "quotationNumber", label: "Number" },
        { key: "title", label: "Title" },
        { key: "grandTotal", label: "Total", render: (row) => formatCurrency(Number(row.grandTotal ?? 0)) },
        { key: "status", label: "Status" },
        { key: "validUntil", label: "Valid Until", render: (row) => formatDate(String(row.validUntil ?? "")) }
      ]}
      fields={[
        { name: "quotationNumber", label: "Quotation #", required: true },
        {
          name: "customerId",
          label: "Customer",
          type: "select",
          required: true,
          options: customerOptions.length ? customerOptions : [{ label: "Create a customer first", value: "" }]
        },
        { name: "title", label: "Title", required: true },
        { name: "amount", label: "Amount", type: "number" },
        { name: "tax", label: "Tax", type: "number" },
        { name: "discount", label: "Discount", type: "number" },
        { name: "grandTotal", label: "Grand Total", type: "number" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Draft", value: "draft" },
            { label: "Sent", value: "sent" },
            { label: "Accepted", value: "accepted" },
            { label: "Rejected", value: "rejected" },
            { label: "Expired", value: "expired" }
          ]
        },
        { name: "validUntil", label: "Valid Until", type: "date" },
        { name: "notes", label: "Notes", type: "textarea" }
      ]}
      mapRowToForm={(row) => ({
        quotationNumber: row.quotationNumber,
        customerId:
          typeof row.customerId === "object" && row.customerId
            ? (row.customerId as { _id: string })._id
            : row.customerId,
        title: row.title,
        amount: row.amount,
        tax: row.tax,
        discount: row.discount,
        grandTotal: row.grandTotal,
        status: row.status,
        validUntil: String(row.validUntil ?? "").slice(0, 10),
        notes: row.notes ?? ""
      })}
      transformSubmit={(values) => {
        const amount = Number(values.amount ?? 0);
        const tax = Number(values.tax ?? 0);
        const discount = Number(values.discount ?? 0);
        return {
          ...values,
          amount,
          tax,
          discount,
          grandTotal: Number(values.grandTotal ?? amount + tax - discount)
        };
      }}
    />
  );
}
