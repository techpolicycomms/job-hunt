// ============================================================
// src/app/apply/[id]/page.tsx
// Apply — editable CV and cover letter, copy-to-clipboard,
// mark as applied.
// ============================================================

"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Check, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Job, GeneratedMaterials, CVContent, CoverLetterContent } from "@/lib/types";

// TS concept: A "copy button" component with local state
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="ghost" size="sm" onClick={copy} className="text-slate-400 h-7">
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      <span className="ml-1 text-xs">{copied ? "Copied!" : "Copy"}</span>
    </Button>
  );
}

export default function ApplyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [job, setJob] = React.useState<Job | null>(null);
  const [materials, setMaterials] = React.useState<GeneratedMaterials | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [applying, setApplying] = React.useState(false);

  // Editable text states for the CV and cover letter
  const [cvText, setCvText] = React.useState("");
  const [clText, setClText] = React.useState("");

  React.useEffect(() => {
    if (params.id) loadData(params.id);
  }, [params.id]);

  async function loadData(id: string) {
    setLoading(true);
    const [jobRes, materialsRes] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", id).single(),
      supabase.from("generated_materials").select("*").eq("job_id", id).single(),
    ]);

    const jobData = jobRes.data as Job | null;
    const matsData = materialsRes.data as GeneratedMaterials | null;

    setJob(jobData);
    setMaterials(matsData);

    // Convert structured content to plain text for editing
    if (matsData?.cv_content) {
      setCvText(cvToText(matsData.cv_content as CVContent));
    }
    if (matsData?.cover_letter_content) {
      setClText(clToText(matsData.cover_letter_content as CoverLetterContent));
    }
    setLoading(false);
  }

  // Convert structured CV JSON to readable plain text
  function cvToText(cv: CVContent): string {
    const lines: string[] = [
      cv.name,
      `${cv.contact?.email ?? ""} | ${cv.contact?.phone ?? ""} | ${cv.contact?.linkedin ?? ""}`,
      "",
      "PROFESSIONAL SUMMARY",
      cv.summary ?? "",
      "",
      "EXPERIENCE",
    ];

    cv.experience?.forEach((exp) => {
      lines.push(`${exp.title} — ${exp.organization} (${exp.period})`);
      exp.bullets?.forEach((b) => lines.push(`• ${b}`));
      lines.push("");
    });

    lines.push("EDUCATION");
    cv.education?.forEach((edu) => {
      lines.push(`${edu.degree} — ${edu.institution} (${edu.period})`);
    });

    lines.push("", "SKILLS");
    lines.push(cv.skills?.join(", ") ?? "");

    lines.push("", "CERTIFICATIONS");
    cv.certifications?.forEach((c) => lines.push(`• ${c}`));

    return lines.join("\n");
  }

  // Convert structured cover letter JSON to plain text
  function clToText(cl: CoverLetterContent): string {
    return [
      cl.salutation,
      "",
      ...(cl.paragraphs ?? []),
      "",
      cl.closing,
      "",
      job?.company ? `Re: ${cl.subject}` : cl.subject,
    ].join("\n");
  }

  async function markAsApplied() {
    if (!job || !materials) return;
    setApplying(true);
    try {
      // Create application record
      const { error } = await supabase.from("applications").insert({
        job_id: job.id,
        materials_id: materials.id,
        status: "applied",
        date_applied: new Date().toISOString().split("T")[0],
        lenses_used: materials.lenses_used,
      });

      if (error) throw error;

      // Update job pipeline status
      await supabase
        .from("jobs")
        .update({ pipeline_status: "applied" })
        .eq("id", job.id);

      // Mark materials as approved
      await supabase
        .from("generated_materials")
        .update({ is_approved: true, approved_at: new Date().toISOString() })
        .eq("id", materials.id);

      toast({ title: "Marked as applied!", description: "Job added to your tracker." });
      router.push("/tracker");
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!job) {
    return <div className="p-6 text-slate-400">Job not found.</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => router.back()} className="text-slate-400 pl-0">
        <ArrowLeft className="h-4 w-4 mr-1" />Back
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Apply: {job.title}</h1>
          <p className="text-slate-400 text-sm mt-1">{job.company}</p>
        </div>
        <Button onClick={markAsApplied} disabled={applying}>
          {applying ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Mark as Applied
        </Button>
      </div>

      <Tabs defaultValue="cv">
        <TabsList>
          <TabsTrigger value="cv">CV / Resume</TabsTrigger>
          <TabsTrigger value="cl">Cover Letter</TabsTrigger>
          <TabsTrigger value="form">Form Fill Data</TabsTrigger>
        </TabsList>

        <TabsContent value="cv">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Tailored CV</CardTitle>
                <CopyButton text={cvText} />
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
                className="min-h-[500px] font-mono text-xs"
                placeholder="CV content will appear here after generation..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cl">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Cover Letter</CardTitle>
                <CopyButton text={clText} />
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={clText}
                onChange={(e) => setClText(e.target.value)}
                className="min-h-[400px] text-sm"
                placeholder="Cover letter will appear here after generation..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="form">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* Common application form fields with copy buttons */}
              {[
                { label: "Full Name", value: "Rahul Jha" },
                { label: "Email", value: "rjha1909@gmail.com" },
                { label: "Phone", value: "+41 78818 6778" },
                { label: "LinkedIn", value: "https://linkedin.com/in/r-jha" },
                { label: "Current Location", value: "Geneva, Switzerland" },
                { label: "Years of Experience", value: "11" },
                { label: "Notice Period / Availability", value: "Immediate" },
                { label: "Work Authorization", value: "Swiss Permis B (EU eligible)" },
                { label: "Desired Salary", value: "CHF 100,000 - 130,000" },
              ].map((field) => (
                <div key={field.label} className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <p className="text-xs text-slate-400">{field.label}</p>
                    <p className="text-sm text-white">{field.value}</p>
                  </div>
                  <CopyButton text={field.value} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
