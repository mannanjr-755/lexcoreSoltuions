"use client";

import { ModuleCrudPage } from "@/components/modules/module-crud-page";

export default function DocumentsPage() {
  return (
    <ModuleCrudPage
      title="Documents"
      subtitle="Document registry"
      endpoint="/api/documents"
      queryKey="documents"
      exportName="documents"
      statusOptions={[]}
      defaults={{
        title: "",
        category: "other",
        fileUrl: "https://",
        notes: ""
      }}
      columns={[
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        {
          key: "fileUrl",
          label: "File",
          render: (row) => (
            <a href={String(row.fileUrl)} target="_blank" rel="noreferrer" className="text-amber-300 hover:underline">
              Open
            </a>
          )
        }
      ]}
      fields={[
        { name: "title", label: "Title", required: true },
        {
          name: "category",
          label: "Category",
          type: "select",
          options: [
            { label: "Contract", value: "contract" },
            { label: "Invoice", value: "invoice" },
            { label: "Proposal", value: "proposal" },
            { label: "Policy", value: "policy" },
            { label: "Other", value: "other" }
          ]
        },
        { name: "fileUrl", label: "File URL", required: true, placeholder: "https://..." },
        { name: "notes", label: "Notes", type: "textarea" }
      ]}
    />
  );
}
