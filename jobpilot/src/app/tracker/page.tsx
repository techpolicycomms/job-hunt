// ============================================================
// src/app/tracker/page.tsx
// Application Tracker — Kanban and table view.
// ============================================================

"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { Application, ApplicationStatus } from "@/lib/types";
import { format } from "date-fns";

// Kanban column configuration
// TS concept: Array of typed objects with `as const` for literal types
const KANBAN_COLUMNS: Array<{
  status: ApplicationStatus;
  label: string;
  color: string;
}> = [
  { status: "applied", label: "Applied", color: "border-blue-500" },
  { status: "screening", label: "Screening", color: "border-yellow-500" },
  { status: "interview_scheduled", label: "Interview", color: "border-purple-500" },
  { status: "offer", label: "Offer!", color: "border-green-500" },
  { status: "rejected", label: "Rejected", color: "border-red-500" },
];

export default function TrackerPage() {
  const router = useRouter();
  const supabase = createClient();

  const [applications, setApplications] = React.useState<Application[]>([]);
  const [loading, setLoading] = React.useState(true);
  // TS concept: Union type as state — only these two strings are valid
  const [view, setView] = React.useState<"kanban" | "table">("kanban");

  React.useEffect(() => {
    loadApplications();
  }, []);

  async function loadApplications() {
    setLoading(true);
    const { data } = await supabase
      .from("applications")
      .select("*, job:jobs(title, company, location, match_score)")
      .order("date_applied", { ascending: false });
    setApplications((data ?? []) as Application[]);
    setLoading(false);
  }

  async function updateStatus(appId: string, status: ApplicationStatus) {
    await supabase.from("applications").update({ status }).eq("id", appId);
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status } : a))
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Application Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">{applications.length} applications</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("table")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p>No applications yet. Approve jobs from the Pipeline to start tracking.</p>
        </div>
      ) : view === "kanban" ? (
        /* Kanban Board */
        <div className="flex gap-3 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => {
            const colApps = applications.filter((a) => a.status === col.status);
            return (
              <div key={col.status} className="shrink-0 w-64">
                <div className={`border-t-2 ${col.color} rounded-t-lg bg-slate-800/50 px-3 py-2 mb-2`}>
                  <span className="text-sm font-medium text-white">{col.label}</span>
                  <span className="ml-2 text-xs text-slate-400">({colApps.length})</span>
                </div>
                <div className="space-y-2 min-h-20">
                  {colApps.map((app) => (
                    <Card
                      key={app.id}
                      className="cursor-pointer hover:bg-slate-800 transition-colors"
                      onClick={() => app.job_id && router.push(`/jobs/${app.job_id}`)}
                    >
                      <CardContent className="p-3">
                        <p className="text-sm font-medium text-white leading-tight">
                          {(app.job as { title?: string })?.title ?? "Unknown Job"}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {(app.job as { company?: string })?.company ?? ""}
                        </p>
                        <div className="flex items-center gap-1 mt-2">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          <span className="text-xs text-slate-500">
                            {format(new Date(app.date_applied), "MMM d")}
                          </span>
                        </div>
                        {/* Quick status change */}
                        <Select
                          value={app.status}
                          onValueChange={(v) => updateStatus(app.id, v as ApplicationStatus)}
                        >
                          <SelectTrigger
                            className="h-6 text-xs mt-2 border-slate-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="applied">Applied</SelectItem>
                            <SelectItem value="screening">Screening</SelectItem>
                            <SelectItem value="interview_scheduled">Interview</SelectItem>
                            <SelectItem value="interview_done">Interview Done</SelectItem>
                            <SelectItem value="offer">Offer</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="withdrawn">Withdrawn</SelectItem>
                            <SelectItem value="ghosted">Ghosted</SelectItem>
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Title</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Next Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow
                  key={app.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/jobs/${app.job_id}`)}
                >
                  <TableCell className="font-medium text-white">
                    {(app.job as { title?: string })?.title ?? "—"}
                  </TableCell>
                  <TableCell className="text-slate-300">
                    {(app.job as { company?: string })?.company ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={app.status}
                      onValueChange={(v) => updateStatus(app.id, v as ApplicationStatus)}
                    >
                      <SelectTrigger
                        className="h-7 text-xs w-36 border-slate-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="applied">Applied</SelectItem>
                        <SelectItem value="screening">Screening</SelectItem>
                        <SelectItem value="interview_scheduled">Interview Scheduled</SelectItem>
                        <SelectItem value="offer">Offer</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="ghosted">Ghosted</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-slate-400 text-sm">
                    {format(new Date(app.date_applied), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-slate-400 text-sm">
                    {app.next_action ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
