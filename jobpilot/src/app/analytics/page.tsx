// ============================================================
// src/app/analytics/page.tsx
// Analytics — recharts charts for pipeline stats.
// ============================================================

"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { Job, Application, PipelineRun } from "@/lib/types";

const COLORS = ["#6366f1", "#22c55e", "#eab308", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function AnalyticsPage() {
  const supabase = createClient();
  const [loading, setLoading] = React.useState(true);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [applications, setApplications] = React.useState<Application[]>([]);
  const [runs, setRuns] = React.useState<PipelineRun[]>([]);

  React.useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [jobsRes, appsRes, runsRes] = await Promise.all([
      supabase.from("jobs").select("match_score, pipeline_status, source, discovered_at"),
      supabase.from("applications").select("status, date_applied"),
      supabase
        .from("pipeline_runs")
        .select("*")
        .order("run_date", { ascending: true })
        .limit(30),
    ]);
    setJobs((jobsRes.data ?? []) as Job[]);
    setApplications((appsRes.data ?? []) as Application[]);
    setRuns((runsRes.data ?? []) as PipelineRun[]);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  // Compute chart data
  // Score distribution: bucket jobs into score ranges
  const scoreDistribution = [
    { range: "85-100%", count: jobs.filter((j) => j.match_score >= 85).length },
    { range: "75-84%", count: jobs.filter((j) => j.match_score >= 75 && j.match_score < 85).length },
    { range: "50-74%", count: jobs.filter((j) => j.match_score >= 50 && j.match_score < 75).length },
    { range: "30-49%", count: jobs.filter((j) => j.match_score >= 30 && j.match_score < 50).length },
    { range: "0-29%", count: jobs.filter((j) => j.match_score < 30).length },
  ];

  // Application status breakdown
  const statusCounts = applications.reduce<Record<string, number>>((acc, app) => {
    acc[app.status] = (acc[app.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
  }));

  // Source breakdown
  const sourceCounts = jobs.reduce<Record<string, number>>((acc, job) => {
    const src = job.source ?? "unknown";
    acc[src] = (acc[src] ?? 0) + 1;
    return acc;
  }, {});
  const sourceData = Object.entries(sourceCounts).map(([name, value]) => ({ name, value }));

  // Pipeline funnel
  const pipelineData = runs.slice(-14).map((run) => ({
    date: run.run_date,
    discovered: run.jobs_discovered,
    matched: run.jobs_matched,
    generated: run.materials_generated,
  }));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-300">Match Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreDistribution}>
                <XAxis dataKey="range" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Application Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-300">Application Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
                No applications yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {statusData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Job Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-300">Jobs by Source</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sourceData} layout="vertical">
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#94a3b8", fontSize: 11 }} width={80} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pipeline Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-300">Pipeline Trend (last 14 runs)</CardTitle>
          </CardHeader>
          <CardContent>
            {pipelineData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
                No pipeline runs yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={pipelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }} />
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                  <Line type="monotone" dataKey="discovered" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="matched" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="generated" stroke="#eab308" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
