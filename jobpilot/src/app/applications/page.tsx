"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  List,
  Loader2,
  Calendar,
  Download,
  ExternalLink,
  StickyNote,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import type { ApplicationStatus } from "@/lib/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const STATUSES: Array<{ value: ApplicationStatus; label: string; color: string }> = [
  { value: "applied", label: "Applied", color: "border-blue-500 bg-blue-500/10" },
  { value: "screening", label: "Screening", color: "border-yellow-500 bg-yellow-500/10" },
  { value: "interview", label: "Interview", color: "border-purple-500 bg-purple-500/10" },
  { value: "offer", label: "Offer", color: "border-green-500 bg-green-500/10" },
  { value: "rejected", label: "Rejected", color: "border-red-500 bg-red-500/10" },
  { value: "withdrawn", label: "Withdrawn", color: "border-slate-500 bg-slate-500/10" },
  { value: "ghosted", label: "Ghosted", color: "border-slate-600 bg-slate-600/10" },
];

interface AppRow {
  id: string;
  status: ApplicationStatus;
  date_applied: string;
  notes: string | null;
  next_action: string | null;
  next_action_date: string | null;
  job: { id: string; title: string; company: string; location: string | null; url: string } | null;
  materials: { id: string; file_prefix: string | null } | null;
}

export default function ApplicationsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [apps, setApps] = React.useState<AppRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<"kanban" | "table">("kanban");
  const [editingNotes, setEditingNotes] = React.useState<string | null>(null);
  const [notesValue, setNotesValue] = React.useState("");

  React.useEffect(() => {
    loadApplications();
  }, []);

  async function loadApplications() {
    setLoading(true);
    const { data } = await supabase
      .from("applications")
      .select("*, job:jobs(id, title, company, location, url), materials:generated_materials(id, file_prefix)")
      .order("date_applied", { ascending: false });
    setApps((data as AppRow[]) ?? []);
    setLoading(false);
  }

  async function updateStatus(appId: string, status: ApplicationStatus) {
    await fetch(`/api/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)));
  }

  async function updateNotes(appId: string) {
    await fetch(`/api/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesValue }),
    });
    setApps((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, notes: notesValue } : a))
    );
    setEditingNotes(null);
    toast({ title: "Notes saved" });
  }

  async function deleteApp(appId: string) {
    await fetch(`/api/applications/${appId}`, { method: "DELETE" });
    setApps((prev) => prev.filter((a) => a.id !== appId));
    toast({ title: "Application removed" });
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
          <h1 className="text-2xl font-bold text-white">Applications</h1>
          <p className="text-slate-400 text-sm mt-1">{apps.length} tracked</p>
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
          <Button size="sm" onClick={() => router.push("/generate")}>
            + New
          </Button>
        </div>
      </div>

      {apps.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p>No applications yet.</p>
          <Button className="mt-4" onClick={() => router.push("/generate")}>
            Generate your first application
          </Button>
        </div>
      ) : view === "kanban" ? (
        /* Kanban Board */
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STATUSES.map((col) => {
            const colApps = apps.filter((a) => a.status === col.value);
            return (
              <div key={col.value} className="shrink-0 w-64">
                <div
                  className={`border-t-2 ${col.color} rounded-t-lg px-3 py-2 mb-2`}
                >
                  <span className="text-sm font-medium text-white">{col.label}</span>
                  <span className="ml-2 text-xs text-slate-400">({colApps.length})</span>
                </div>
                <div className="space-y-2 min-h-20">
                  {colApps.map((app) => (
                    <Card key={app.id} className="hover:bg-slate-800 transition-colors">
                      <CardContent className="p-3 space-y-2">
                        <p className="text-sm font-medium text-white leading-tight">
                          {app.job?.title ?? "Unknown Job"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {app.job?.company ?? ""}
                        </p>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          <span className="text-xs text-slate-500">
                            {format(new Date(app.date_applied), "MMM d")}
                          </span>
                        </div>
                        {/* Status change */}
                        <Select
                          value={app.status}
                          onValueChange={(v) => updateStatus(app.id, v as ApplicationStatus)}
                        >
                          <SelectTrigger className="h-6 text-xs border-slate-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* Actions row */}
                        <div className="flex gap-1">
                          {app.materials?.id && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                title="Download CV"
                                onClick={() =>
                                  window.open(`/api/documents/${app.materials!.id}?type=cv`, "_blank")
                                }
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {app.job?.url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title="View job posting"
                              onClick={() => window.open(app.job!.url, "_blank")}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                title="Notes"
                                onClick={() => {
                                  setEditingNotes(app.id);
                                  setNotesValue(app.notes ?? "");
                                }}
                              >
                                <StickyNote className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Notes — {app.job?.title}</DialogTitle>
                              </DialogHeader>
                              <textarea
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                rows={5}
                                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                                placeholder="Add notes about this application..."
                              />
                              <Button onClick={() => updateNotes(app.id)} className="w-full">
                                Save Notes
                              </Button>
                            </DialogContent>
                          </Dialog>
                        </div>
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
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-medium text-white">
                    {app.job?.title ?? "—"}
                  </TableCell>
                  <TableCell className="text-slate-300">
                    {app.job?.company ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={app.status}
                      onValueChange={(v) => updateStatus(app.id, v as ApplicationStatus)}
                    >
                      <SelectTrigger className="h-7 text-xs w-32 border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-slate-400 text-sm">
                    {format(new Date(app.date_applied), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-slate-400 text-sm max-w-48 truncate">
                    {app.notes ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {app.materials?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Download CV"
                          onClick={() =>
                            window.open(`/api/documents/${app.materials!.id}?type=cv`, "_blank")
                          }
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {app.job?.url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View posting"
                          onClick={() => window.open(app.job!.url, "_blank")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-300"
                        title="Delete"
                        onClick={() => deleteApp(app.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
