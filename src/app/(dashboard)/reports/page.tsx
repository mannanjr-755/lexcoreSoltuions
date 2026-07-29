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

const COLORS = ["#2563EB", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6"];

const tooltipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: 12,
  fontSize: 12,
  color: "#0F172A",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
};

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => (await api.get("/api/dashboard/stats")).data
  });

  if (isLoading || !data) {
    return <div className="h-64 animate-pulse rounded-[16px] bg-[#F1F5F9]" />;
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
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Reports</h1>
          <p className="text-sm text-[#64748B]">Live aggregates from database</p>
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
          ["Customers", String(data.customers.total)]
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 premium-shadow">
            <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">{label}</p>
            <p className="mt-2 text-2xl font-bold text-[#0F172A]">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>6-Month Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.chartData}>
                  <defs>
                    <linearGradient id="revFillR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563EB" fill="url(#revFillR)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Status Mix</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={projectPie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
                    {projectPie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profit & Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="expenses" fill="#EF4444" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="profit" fill="#22C55E" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
