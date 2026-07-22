"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ModuleCrudPage } from "@/components/modules/module-crud-page";

export default function InvoicesPage() {
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
      title="Invoices"
      subtitle="Payments and receivables"
      endpoint="/api/payments"
      queryKey="payments"
      exportName="invoices"
      statusOptions={[
        { label: "Pending", value: "pending" },
        { label: "Paid", value: "paid" },
        { label: "Partial", value: "partial" },
        { label: "Overdue", value: "overdue" },
        { label: "Cancelled", value: "cancelled" }
      ]}
      defaults={{
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        customerId: customerOptions[0]?.value ?? "",
        amount: 0,
        tax: 0,
        discount: 0,
        grandTotal: 0,
        status: "pending",
        paymentMethod: "bank",
        dueDate: new Date().toISOString().slice(0, 10),
        notes: ""
      }}
      columns={[
        { key: "invoiceNumber", label: "Invoice #" },
        {
          key: "customerId.name",
          label: "Customer",
          render: (row) => {
            const c = row.customerId as { name?: string } | string | undefined;
            return typeof c === "object" ? c?.name ?? "—" : String(c ?? "—");
          }
        },
        { key: "grandTotal", label: "Total", render: (row) => formatCurrency(Number(row.grandTotal ?? 0)) },
        { key: "status", label: "Status" },
        { key: "dueDate", label: "Due", render: (row) => formatDate(String(row.dueDate ?? "")) }
      ]}
      fields={[
        { name: "invoiceNumber", label: "Invoice Number", required: true },
        {
          name: "customerId",
          label: "Customer",
          type: "select",
          required: true,
          options: customerOptions.length ? customerOptions : [{ label: "Create a customer first", value: "" }]
        },
        { name: "amount", label: "Amount", type: "number" },
        { name: "tax", label: "Tax", type: "number" },
        { name: "discount", label: "Discount", type: "number" },
        { name: "grandTotal", label: "Grand Total", type: "number" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Pending", value: "pending" },
            { label: "Paid", value: "paid" },
            { label: "Partial", value: "partial" },
            { label: "Overdue", value: "overdue" },
            { label: "Cancelled", value: "cancelled" }
          ]
        },
        {
          name: "paymentMethod",
          label: "Method",
          type: "select",
          options: [
            { label: "Cash", value: "cash" },
            { label: "Bank", value: "bank" },
            { label: "Card", value: "card" },
            { label: "Online", value: "online" }
          ]
        },
        { name: "dueDate", label: "Due Date", type: "date" },
        { name: "paidAt", label: "Paid At", type: "date" },
        { name: "notes", label: "Notes", type: "textarea" }
      ]}
      mapRowToForm={(row) => ({
        invoiceNumber: row.invoiceNumber,
        customerId:
          typeof row.customerId === "object" && row.customerId
            ? (row.customerId as { _id: string })._id
            : row.customerId,
        amount: row.amount,
        tax: row.tax,
        discount: row.discount,
        grandTotal: row.grandTotal,
        status: row.status,
        paymentMethod: row.paymentMethod,
        dueDate: String(row.dueDate ?? "").slice(0, 10),
        paidAt: row.paidAt ? String(row.paidAt).slice(0, 10) : "",
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
          grandTotal: Number(values.grandTotal ?? amount + tax - discount),
          paidAt: values.paidAt || undefined
        };
      }}
    />
  );
}
