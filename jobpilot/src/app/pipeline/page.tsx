// ============================================================
// src/app/pipeline/page.tsx
// THE KEY PAGE — Pipeline Review with expandable job cards,
// CV/CL preview, approve/skip buttons, bulk actions.
// ============================================================

"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import {
  ChevronDown, ChevronUp, Check, X, FileText, Mail, ExternalLink,
  Loader2, RefreshCw, CheckSquare, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Job, GeneratedMaterials, CVContent, CoverLetterContent } from "@/lib/types";

function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 30) return "text-orange-400";
  return "text-red-400";
}

function getScoreBg(score: number): string {
  if (score >= 75) return "bg-green-900/30 border-green-700/50";
  if (score >= 50) return "bg-yellow-900/30 border-yellow-700/50";
  return "bg-red-900/30 border-red-700/50";
}

// ============================================================
// JOB CARD WITH EXPANDABLE DETAILS
// ============================================================

interface JobReviewCardProps {
  job: Job;
  onApprove: (jobId: string) => Promise<void>;
  onSkip: (jobId: string) => Promise<void>;
}

function JobReviewCard({ job, onApprove, onSkip }: JobReviewCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [materials, setMaterials] = React.useState<GeneratedMaterials | null>(null);
  const [loadingMaterials, setLoadingMaterials] = React.useState(false);
  const [actioning, setActioning] = React.useState(false);
  const supabase = createClient();

  // Load materials when card is expanded
  async function loadMaterials() {
    if (materials) return; // Already loaded
    setLoadingMaterials(true);
    const { data } = await supabase
      .from("generated_materials")
      .select("*")
      .eq("job_id", job.id)
      .single();
    setMaterials(data as GeneratedMaterials | null);
    setLoadingMaterials(false);
  }

  function toggleExpand() {
    setExpanded(!expanded);
    if (!expanded) loadMaterials();
  }

  async function handleApprove() {
    setActioning(true);
    await onApprove(job.id);
    setActioning(false);
  }

  async function handleSkip() {
    setActioning(true);
    await onSkip(job.id);
    setActioning(false);
  }

  // TS concept: Optional chaining `?.` — safely accesses nested properties
  // If `job.match_details` is null/undefined, `?.stints` returns undefined
  const stints = job.match_details?.stints;
  const selectedLenses = job.selected_lenses ?? [];
  const eligibility = job.eligibility_checks;

  return (
    <Card className={`border ${getScoreBg(job.match_score)}`}>
      {/* Card header — always visible */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white text-sm">{job.title}</h3>
              <Badge variant="secondary" className="text-xs">{job.source}</Badge>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              {job.company} {job.location ? `· ${job.location}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-lg font-bold ${getScoreColor(job.match_score)}`}>
              {job.match_score}%
            </span>
          </div>
        </div>

        {/* Selected lenses summary */}
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedLenses.slice(0, 4).map((lens) => (
            <Badge key={lens.lens_id} variant="outline" className="text-xs">
              {lens.title.split(" ").slice(0, 3).join(" ")}
            </Badge>
          ))}
        </div>

        <p className="text-xs text-slate-400 italic mt-1">{job.recommendation}</p>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={actioning}
            className="bg-green-700 hover:bg-green-600 text-white"
          >
            <Check className="h-3 w-3 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSkip}
            disabled={actioning}
            className="border-red-700 text-red-400 hover:bg-red-900/30"
          >
            <X className="h-3 w-3 mr-1" />
            Skip
          </Button>
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost" className="text-slate-400">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleExpand}
            className="ml-auto text-slate-400"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {/* Expandable details */}
      {expanded && (
        <CardContent className="pt-0 border-t border-slate-800">
          {loadingMaterials ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
            </div>
          ) : (
            <Tabs defaultValue="cv" className="mt-4">
              <TabsList>
                <TabsTrigger value="cv">
                  <FileText className="h-3 w-3 mr-1" />CV
                </TabsTrigger>
                <TabsTrigger value="cl">
                  <Mail className="h-3 w-3 mr-1" />Cover Letter
                </TabsTrigger>
                <TabsTrigger value="match">Match Details</TabsTrigger>
              </TabsList>

              <TabsContent value="cv">
                {materials?.cv_content ? (
                  <CVPreview cv={materials.cv_content as CVContent} />
                ) : (
                  <p className="text-slate-400 text-sm py-4">No CV generated yet.</p>
                )}
              </TabsContent>

              <TabsContent value="cl">
                {materials?.cover_letter_content ? (
                  <CLPreview cl={materials.cover_letter_content as CoverLetterContent} />
                ) : (
                  <p className="text-slate-400 text-sm py-4">No cover letter generated yet.</p>
                )}
              </TabsContent>

              <TabsContent value="match">
                <div className="space-y-3 mt-2">
                  {/* Eligibility checks */}
                  {eligibility && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Education", ok: eligibility.education_match },
                        { label: "Experience", ok: eligibility.experience_match },
                        { label: "Language", ok: eligibility.language_match },
                        { label: "Location", ok: eligibility.location_match },
                        { label: "Work Permit", ok: eligibility.work_permit_ok },
                      ].map((check) => (
                        <div key={check.label} className="flex items-center gap-2 text-xs">
                          {check.ok ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <X className="h-3 w-3 text-red-400" />
                          )}
                          <span className={check.ok ? "text-slate-300" : "text-red-400"}>
                            {check.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Per-stint scores */}
                  {stints && Object.entries(stints).map(([stintName, scores]) => {
                    const bestScore = Array.isArray(scores) ? scores[0] : null;
                    if (!bestScore) return null;
                    return (
                      <div key={stintName} className="text-xs">
                        <p className="text-slate-400">{stintName}</p>
                        <p className="text-white font-medium">
                          {bestScore.title} — {bestScore.score}%
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          Matched: {Array.isArray(bestScore.matched_tags) ? bestScore.matched_tags.join(", ") : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Mini CV preview component
function CVPreview({ cv }: { cv: CVContent }) {
  return (
    <ScrollArea className="h-64 mt-2">
      <div className="text-xs space-y-3 pr-3">
        <div className="font-semibold text-white">{cv.name}</div>
        <p className="text-slate-300">{cv.summary}</p>
        {cv.experience?.slice(0, 3).map((exp, i) => (
          <div key={i}>
            <p className="font-medium text-white">{exp.title} — {exp.organization}</p>
            <p className="text-slate-500">{exp.period}</p>
            <ul className="list-disc list-inside space-y-0.5 mt-1">
              {exp.bullets?.slice(0, 2).map((b, bi) => (
                <li key={bi} className="text-slate-400">{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// Mini cover letter preview component
function CLPreview({ cl }: { cl: CoverLetterContent }) {
  return (
    <ScrollArea className="h-64 mt-2">
      <div className="text-xs space-y-2 pr-3">
        <p className="text-slate-300">{cl.salutation}</p>
        {cl.paragraphs?.map((p, i) => (
          <p key={i} className="text-slate-400">{p}</p>
        ))}
        <p className="text-slate-300">{cl.closing}</p>
      </div>
    </ScrollArea>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function PipelinePage() {
  const { toast } = useToast();
  const supabase = createClient();

  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [reviewed, setReviewed] = React.useState(0);
  const total = jobs.length + reviewed;

  React.useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    setLoading(true);
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("pipeline_status", "ready_for_review")
      .order("match_score", { ascending: false });
    setJobs((data ?? []) as Job[]);
    setLoading(false);
  }

  async function approveJob(jobId: string) {
    const res = await fetch("/api/pipeline/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    if (res.ok) {
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      setReviewed((r) => r + 1);
      toast({ title: "Approved!", description: "Job moved to tracker." });
    }
  }

  async function skipJob(jobId: string) {
    const res = await fetch("/api/pipeline/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    if (res.ok) {
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      setReviewed((r) => r + 1);
      toast({ title: "Skipped", description: "Job archived." });
    }
  }

  async function approveAll() {
    for (const job of jobs) {
      await approveJob(job.id);
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
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pipeline Review</h1>
          <p className="text-slate-400 text-sm mt-1">
            {reviewed}/{total} reviewed · {jobs.length} remaining
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadJobs}>
            <RefreshCw className="h-3 w-3 mr-1" />Refresh
          </Button>
          {jobs.length > 0 && (
            <Button size="sm" onClick={approveAll} className="bg-green-700 hover:bg-green-600">
              <CheckSquare className="h-3 w-3 mr-1" />Approve All
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all"
            style={{ width: `${(reviewed / total) * 100}%` }}
          />
        </div>
      )}

      {/* Job cards */}
      {jobs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
          <p className="text-lg font-medium text-white">All caught up!</p>
          <p className="text-sm mt-1">No jobs waiting for review. Run the pipeline to discover more.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobReviewCard
              key={job.id}
              job={job}
              onApprove={approveJob}
              onSkip={skipJob}
            />
          ))}
        </div>
      )}
    </div>
  );
}

