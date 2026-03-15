// ============================================================
// src/app/dashboard/page.tsx
// Main dashboard with stats, quick URL input, pipeline status.
// ============================================================

"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase, CheckCircle2, Clock, TrendingUp, Play, Link as LinkIcon, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Job, PipelineRun } from "@/lib/types";

// ============================================================
// SCORE COLOR HELPER
// TS concept: function with typed parameter and return type
// ============================================================

function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 30) return "text-orange-400";
  return "text-red-400";
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  // TS concept: useState with explicit types
  const [stats, setStats] = React.useState({
    totalJobs: 0,
    pendingReview: 0,
    applied: 0,
    avgScore: 0,
  });
  const [recentJobs, setRecentJobs] = React.useState<Job[]>([]);
  const [lastRun, setLastRun] = React.useState<PipelineRun | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [pipelineRunning, setPipelineRunning] = React.useState(false);
  const [urlInput, setUrlInput] = React.useState("");

  // `useEffect` runs after the component mounts on the client
  React.useEffect(() => {
    loadData();
  }, []); // Empty dependency array = run once on mount

  async function loadData() {
    setLoading(true);
    try {
      // Parallel data fetching with Promise.all
      const [jobsRes, applicationsRes, runRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, title, company, match_score, pipeline_status, discovered_at, source")
          .order("discovered_at", { ascending: false })
          .limit(10),
        supabase
          .from("applications")
          .select("id, status")
          .eq("status", "applied"),
        supabase
          .from("pipeline_runs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
      ]);

      const jobs = (jobsRes.data ?? []) as Job[];
      const applications = applicationsRes.data ?? [];
      const run = runRes.data as PipelineRun | null;

      const pendingReview = jobs.filter(
        (j) => j.pipeline_status === "ready_for_review"
      ).length;

      const scores = jobs.filter((j) => j.match_score > 0).map((j) => j.match_score);
      const avgScore =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;

      setStats({
        totalJobs: jobs.length,
        pendingReview,
        applied: applications.length,
        avgScore,
      });
      setRecentJobs(jobs.slice(0, 5));
      setLastRun(run);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function runPipeline() {
    setPipelineRunning(true);
    try {
      const res = await fetch("/api/pipeline/run", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Pipeline complete!",
          description: `Found ${data.run.jobs_discovered} jobs, generated materials for ${data.run.materials_generated}`,
        });
        loadData();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Pipeline failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setPipelineRunning(false);
    }
  }

  async function addUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!urlInput.trim()) return;
    try {
      const res = await fetch("/api/jobs/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Job added!", description: "Parsing and matching in progress..." });
        setUrlInput("");
        router.push(`/jobs/${data.data.id}`);
      }
    } catch {
      toast({ title: "Failed to add URL", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            {lastRun
              ? `Last pipeline: ${format(new Date(lastRun.created_at), "MMM d, h:mm a")}`
              : "No pipeline runs yet"}
          </p>
        </div>
        <Button onClick={runPipeline} disabled={pipelineRunning}>
          {pipelineRunning ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</>
          ) : (
            <><Play className="h-4 w-4 mr-2" />Run Pipeline</>
          )}
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Jobs", value: stats.totalJobs, icon: Briefcase, color: "text-indigo-400" },
          { label: "Pending Review", value: stats.pendingReview, icon: Clock, color: "text-yellow-400" },
          { label: "Applied", value: stats.applied, icon: CheckCircle2, color: "text-green-400" },
          { label: "Avg Score", value: `${stats.avgScore}%`, icon: TrendingUp, color: getScoreColor(stats.avgScore) },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-70`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick URL input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-indigo-400" />
            Add Job URL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addUrl} className="flex gap-2">
            <Input
              placeholder="https://linkedin.com/jobs/view/..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">Parse & Match</Button>
          </form>
        </CardContent>
      </Card>

      {/* Recent jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentJobs.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">
                No jobs yet. Run the pipeline or add a URL above.
              </p>
            ) : (
              recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 cursor-pointer transition-colors"
                  onClick={() => router.push(`/jobs/${job.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white text-sm truncate">{job.title}</p>
                    <p className="text-xs text-slate-400">{job.company}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className={`text-sm font-bold ${getScoreColor(job.match_score)}`}>
                      {job.match_score}%
                    </span>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {job.pipeline_status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
