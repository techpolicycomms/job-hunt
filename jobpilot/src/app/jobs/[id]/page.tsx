// ============================================================
// src/app/jobs/[id]/page.tsx
// Job Detail — full description, match panel, lens selector.
//
// TS concept: Dynamic route params are typed with `{ params: { id: string } }`.
// Next.js App Router passes route params as a Promise in Next.js 15.
// ============================================================

"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ExternalLink, Check, X, ChevronRight, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import type { Job, RoleLens, GeneratedMaterials } from "@/lib/types";

function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 30) return "text-orange-400";
  return "text-red-400";
}

export default function JobDetailPage() {
  // `useParams()` gets the dynamic route parameters
  // In Next.js App Router, params is now a Promise but useParams() is still sync
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [job, setJob] = React.useState<Job | null>(null);
  const [lenses, setLenses] = React.useState<RoleLens[]>([]);
  const [materials, setMaterials] = React.useState<GeneratedMaterials | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);

  React.useEffect(() => {
    if (params.id) loadData(params.id);
  }, [params.id]);

  async function loadData(id: string) {
    setLoading(true);
    const [jobRes, lensesRes, materialsRes] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", id).single(),
      supabase.from("role_lenses").select("*").order("sort_order"),
      supabase.from("generated_materials").select("*").eq("job_id", id).single(),
    ]);

    setJob(jobRes.data as Job | null);
    setLenses((lensesRes.data ?? []) as RoleLens[]);
    setMaterials(materialsRes.data as GeneratedMaterials | null);
    setLoading(false);
  }

  async function generateMaterials() {
    if (!job) return;
    setGenerating(true);
    const res = await fetch("/api/generate/cv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    });
    const data = await res.json();
    if (data.success) {
      setMaterials(data.data);
      router.push(`/apply/${job.id}`);
    }
    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6 text-center text-slate-400">
        <p>Job not found.</p>
        <Button onClick={() => router.back()} variant="outline" className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const selectedLenses = job.selected_lenses ?? [];
  const eligibility = job.eligibility_checks;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.back()} className="text-slate-400 pl-0">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Button>

      {/* Job header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{job.title}</h1>
          <p className="text-slate-400 mt-1">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
            {job.salary ? ` · ${job.salary}` : ""}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary">{job.source ?? "manual"}</Badge>
            <Badge variant="secondary" className="capitalize">
              {job.pipeline_status.replace(/_/g, " ")}
            </Badge>
            {job.job_type && <Badge variant="outline">{job.job_type}</Badge>}
          </div>
        </div>
        <div className="text-center shrink-0">
          <div className={`text-4xl font-bold ${getScoreColor(job.match_score)}`}>
            {job.match_score}%
          </div>
          <p className="text-xs text-slate-400 mt-1">Match Score</p>
        </div>
      </div>

      {job.recommendation && (
        <p className="text-sm text-indigo-300 italic">{job.recommendation}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        {job.url && (
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-3 w-3 mr-1" />
              View Original
            </Button>
          </a>
        )}
        <Button
          onClick={generateMaterials}
          disabled={generating}
          size="sm"
        >
          {generating ? (
            <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating...</>
          ) : (
            <>{materials ? "Regenerate Materials" : "Generate CV & Cover Letter"}</>
          )}
        </Button>
        {materials && (
          <Button size="sm" variant="outline" onClick={() => router.push(`/apply/${job.id}`)}>
            <ChevronRight className="h-3 w-3 mr-1" />
            Go to Apply
          </Button>
        )}
      </div>

      <Tabs defaultValue="description">
        <TabsList>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="match">Match Details</TabsTrigger>
          <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
        </TabsList>

        <TabsContent value="description" className="space-y-4">
          {job.description && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{job.description}</p>
              </CardContent>
            </Card>
          )}
          {job.requirements.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Requirements</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {job.requirements.map((req, i) => (
                    <li key={i} className="text-sm text-slate-300 flex gap-2">
                      <ChevronRight className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                      {req}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {job.responsibilities.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Responsibilities</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {job.responsibilities.map((r, i) => (
                    <li key={i} className="text-sm text-slate-300 flex gap-2">
                      <ChevronRight className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="match" className="space-y-4">
          {selectedLenses.map((lens) => (
            <Card key={lens.lens_id}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-400">{lens.stint_name}</p>
                    <p className="font-medium text-white text-sm">{lens.title}</p>
                  </div>
                  <span className={`text-lg font-bold ${getScoreColor(lens.score)}`}>
                    {lens.score}%
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="eligibility">
          {eligibility ? (
            <Card>
              <CardContent className="pt-6 space-y-3">
                {[
                  { label: "Education Match", ok: eligibility.education_match },
                  { label: "Experience Match", ok: eligibility.experience_match },
                  { label: "Language Match", ok: eligibility.language_match },
                  { label: "Location Match", ok: eligibility.location_match },
                  { label: "Work Permit OK", ok: eligibility.work_permit_ok },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{item.label}</span>
                    {item.ok ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <X className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                ))}
                {eligibility.flags.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      {eligibility.flags.map((flag, i) => (
                        <p key={i} className="text-xs text-yellow-400">
                          ⚠ {flag.issue}
                        </p>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <p className="text-slate-400 text-sm">No eligibility data yet.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
