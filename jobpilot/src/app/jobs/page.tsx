// ============================================================
// src/app/jobs/page.tsx
// Job Discovery — browse, filter, search, manual URL input.
// ============================================================

"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, Loader2, Bookmark, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Job, PipelineStatus } from "@/lib/types";
import { format } from "date-fns";

function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 30) return "text-orange-400";
  return "text-red-400";
}

// TS concept: Union type used as a component prop
type StatusFilter = PipelineStatus | "all";

export default function JobsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [urlInput, setUrlInput] = React.useState("");

  React.useEffect(() => {
    loadJobs();
  }, [statusFilter]);

  async function loadJobs() {
    setLoading(true);
    let query = supabase
      .from("jobs")
      .select("*")
      .order("match_score", { ascending: false })
      .order("discovered_at", { ascending: false })
      .limit(100);

    if (statusFilter !== "all") {
      query = query.eq("pipeline_status", statusFilter);
    }

    const { data } = await query;
    setJobs((data ?? []) as Job[]);
    setLoading(false);
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
        toast({ title: "Job added!" });
        setUrlInput("");
        router.push(`/jobs/${data.data.id}`);
      }
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  }

  async function toggleBookmark(job: Job, e: React.MouseEvent) {
    e.stopPropagation(); // Don't navigate to job detail
    await supabase
      .from("jobs")
      .update({ is_bookmarked: !job.is_bookmarked })
      .eq("id", job.id);
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, is_bookmarked: !j.is_bookmarked } : j))
    );
  }

  // Filter jobs client-side by search text
  // TS concept: `.filter()` returns a new array of the same type
  const filteredJobs = jobs.filter((job) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      job.title?.toLowerCase().includes(q) ||
      job.company?.toLowerCase().includes(q) ||
      job.location?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-white">Job Discovery</h1>

      {/* URL input */}
      <form onSubmit={addUrl} className="flex gap-2">
        <Input
          placeholder="Paste a job URL to parse..."
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          className="flex-1"
        />
        <Button type="submit">Add Job</Button>
      </form>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search jobs..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-44">
            <Filter className="h-3 w-3 mr-1 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="discovered">Discovered</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="ready_for_review">Ready for Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="applied">Applied</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-slate-400 self-center">
          {filteredJobs.length} jobs
        </p>
      </div>

      {/* Jobs list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {filteredJobs.map((job) => (
            <Card
              key={job.id}
              className="cursor-pointer hover:bg-slate-800/70 transition-colors"
              onClick={() => router.push(`/jobs/${job.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white text-sm">{job.title}</span>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {job.pipeline_status.replace(/_/g, " ")}
                      </Badge>
                      {job.source && (
                        <Badge variant="outline" className="text-xs">{job.source}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {job.company}
                      {job.location ? ` · ${job.location}` : ""}
                      {job.salary ? ` · ${job.salary}` : ""}
                    </p>
                    {job.recommendation && (
                      <p className="text-xs text-slate-500 italic mt-1">{job.recommendation}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-base font-bold ${getScoreColor(job.match_score)}`}>
                      {job.match_score}%
                    </span>
                    <button
                      onClick={(e) => toggleBookmark(job, e)}
                      className="text-slate-500 hover:text-yellow-400"
                    >
                      <Bookmark
                        className={`h-4 w-4 ${job.is_bookmarked ? "fill-yellow-400 text-yellow-400" : ""}`}
                      />
                    </button>
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300" />
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredJobs.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p>No jobs found. Try adjusting filters or run the pipeline.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
