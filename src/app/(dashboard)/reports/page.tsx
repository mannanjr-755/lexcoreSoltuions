"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import api from "@/lib/axios";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportToCsv, exportToExcel } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";

const COLORS = ["#D4AF37", "#3B82F6", "#22C55E", "#EF4444", "#A855F7"];

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => (await api.get("/api/dashboard/stats")).data
  });

  if (isLoading || !data) {
    return <div className="h-64 animate-pulse rounded-[18px] bg-[#F1F5F9]" />;
  }

  const projectPie = [
    { name: "Active", value: data.projects.active },
    { name: "Completed", value: data.projects.completed },
    { name: "Pending", value: data.projects.pending },
    { name: "Cancelled", value: data.projects.cancelled }
  ];

  const exportRows = (data.chartData ?? []).map((row: { month: string; revenue: number; expenses: number; profit: number }) => ({
    Month: row.month,
    Revenue: row.revenue,
    Expenses: row.expenses,
    Profit: row.profit
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold brand-gradient-text">Reports</h1>
          <p className="mt-1 text-sm text-[#64748B]">Live aggregates from MongoDB</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportToCsv("lexcore-report", exportRows)}>
            <Download className="size-4" /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportToExcel("lexcore-report", exportRows)}>
            <FileSpreadsheet className="size-4" /> Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Revenue", formatCurrency(data.financials.totalRevenue)],
          ["Profit", formatCurrency(data.financials.totalProfit)],
          ["Expenses", formatCurrency(data.financials.totalExpenses)],
          ["Customers", data.customers.total]
        ].map(([label, value]) => (
          <div key={String(label)} className="glass-card premium-shadow p-5">
            <p className="text-xs uppercase tracking-wider text-[#64748B]">{label}</p>
            <p className="mt-2 font-display text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card premium-shadow border-[#E2E8F0]">
          <CardHeader>
            <CardTitle className="font-display">6-Month Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip contentStyle={{ background: "#1E293B", borderRadius: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#D4AF37" fill="#D4AF37" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card premium-shadow border-[#E2E8F0]">
          <CardHeader>
            <CardTitle className="font-display">Project Status Mix</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={projectPie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
                  {projectPie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1E293B", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card premium-shadow border-[#E2E8F0] lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display">Profit & Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip contentStyle={{ background: "#1E293B", borderRadius: 12 }} />
                <Bar dataKey="expenses" fill="#EF4444" radius={[6, 6, 0, 0]} />
                <Bar dataKey="profit" fill="#22C55E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
