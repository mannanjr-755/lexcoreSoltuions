"use client";

import { ModuleCrudPage } from "@/components/modules/module-crud-page";

export default function DepartmentsPage() {
  return (
    <ModuleCrudPage
      title="Departments"
      subtitle="Organize teams — synced with MongoDB and used by Attendance & Employees"
      endpoint="/api/departments"
      queryKey="departments"
      exportName="departments"
      statusOptions={[
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" }
      ]}
      defaults={{
        name: "",
        code: "",
        description: "",
        managerName: "",
        status: "active"
      }}
      columns={[
        { key: "name", label: "Department" },
        { key: "code", label: "Code" },
        { key: "managerName", label: "Manager" },
        { key: "employeeCount", label: "Employees" },
        { key: "status", label: "Status" },
        { key: "description", label: "Description" }
      ]}
      fields={[
        { name: "name", label: "Department Name", required: true },
        { name: "code", label: "Code", placeholder: "ENG" },
        { name: "managerName", label: "Manager Name" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" }
          ]
        },
        { name: "description", label: "Description", type: "textarea" }
      ]}
    />
  );
}
