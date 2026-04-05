"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  Link2,
  FileText,
  Download,
  Check,
  ChevronRight,
  AlertCircle,
  Clipboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// Step type
type Step = "input" | "review" | "generate" | "done";

interface ScrapedJobData {
  title: string;
  company: string;
  location: string | null;
  description: string;
  requirements: string[];
  keywords: string[];
  salary: string | null;
  job_type: string;
  level: string | null;
}

interface MaterialsData {
  id: string;
  cv_content: {
    name: string;
    summary: string;
    experience: Array<{ title: string; organization: string; period: string; bullets: string[] }>;
    skills: string[];
  };
  cover_letter_content: {
    subject: string;
    paragraphs: string[];
    angle: string;
  };
  file_prefix: string;
}

export default function GeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [step, setStep] = React.useState<Step>("input");
  const [url, setUrl] = React.useState(searchParams.get("url") ?? "");
  const [rawText, setRawText] = React.useState("");
  const [inputMode, setInputMode] = React.useState<"url" | "text">("url");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Scraped data
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [scrapedJob, setScrapedJob] = React.useState<ScrapedJobData | null>(null);

  // Generated materials
  const [materials, setMaterials] = React.useState<MaterialsData | null>(null);
  const [selectedLenses, setSelectedLenses] = React.useState<
    Array<{ stint_name: string; title: string; relevance: string }>
  >([]);

  // Auto-scrape if URL is provided via query param
  React.useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam) {
      setUrl(urlParam);
      handleScrape(urlParam);
    }
  }, []);

  async function handleScrape(overrideUrl?: string) {
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, string> = {};
      if (inputMode === "url" || overrideUrl) {
        body.url = overrideUrl ?? url;
      }
      if (inputMode === "text" || rawText) {
        body.rawText = rawText;
      }

      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (!result.success) {
        // If scraping failed, switch to text mode
        if (inputMode === "url" && result.error?.includes("Could not fetch")) {
          setInputMode("text");
          setError(result.error);
        } else {
          throw new Error(result.error);
        }
        return;
      }

      setJobId(result.data.job.id);
      setScrapedJob(result.data.parsed);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    setStep("generate");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      setMaterials(result.data.materials);
      setSelectedLenses(result.data.selectedLenses);
      setStep("done");

      toast({ title: "Documents generated!", description: "CV and cover letter are ready to download." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setStep("review");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkApplied() {
    if (!jobId) return;

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, materialsId: materials?.id }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      toast({ title: "Marked as applied!", description: "Tracked in your applications." });
      router.push("/applications");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to track application",
        variant: "destructive",
      });
    }
  }

  // Step indicator
  const steps: Array<{ key: Step; label: string }> = [
    { key: "input", label: "Job URL" },
    { key: "review", label: "Review Job" },
    { key: "generate", label: "Generating" },
    { key: "done", label: "Download" },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Generate Application</h1>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                i <= stepIndex
                  ? "bg-indigo-600/20 text-indigo-400"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              {i < stepIndex ? (
                <Check className="h-3 w-3" />
              ) : i === stepIndex && loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="h-4 w-4 text-slate-600" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-300 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* STEP 1: Input */}
      {step === "input" && (
        <Card>
          <CardHeader>
            <CardTitle>Paste a job URL or description</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={inputMode === "url" ? "default" : "outline"}
                size="sm"
                onClick={() => setInputMode("url")}
              >
                <Link2 className="h-4 w-4 mr-1" /> URL
              </Button>
              <Button
                variant={inputMode === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => setInputMode("text")}
              >
                <Clipboard className="h-4 w-4 mr-1" /> Paste Text
              </Button>
            </div>

            {inputMode === "url" ? (
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://linkedin.com/jobs/view/..."
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste the full job description here..."
                rows={10}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              />
            )}

            <Button
              onClick={() => handleScrape()}
              disabled={loading || (inputMode === "url" ? !url.trim() : !rawText.trim())}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scraping...
                </>
              ) : (
                "Scrape & Parse Job"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Review scraped job */}
      {step === "review" && scrapedJob && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{scrapedJob.title}</CardTitle>
                <p className="text-slate-400 mt-1">
                  {scrapedJob.company}
                  {scrapedJob.location && ` — ${scrapedJob.location}`}
                </p>
              </div>
              <div className="flex gap-2">
                {scrapedJob.job_type && (
                  <Badge variant="outline">{scrapedJob.job_type}</Badge>
                )}
                {scrapedJob.level && (
                  <Badge variant="outline">{scrapedJob.level}</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-1">Description</h3>
              <p className="text-sm text-slate-400">{scrapedJob.description}</p>
            </div>

            {scrapedJob.requirements.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-1">Requirements</h3>
                <ul className="list-disc list-inside text-sm text-slate-400 space-y-0.5">
                  {scrapedJob.requirements.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">ATS Keywords Detected</h3>
              <div className="flex flex-wrap gap-1.5">
                {scrapedJob.keywords.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>

            {scrapedJob.salary && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-1">Salary</h3>
                <p className="text-sm text-slate-400">{scrapedJob.salary}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setStep("input"); setError(null); }}>
                Back
              </Button>
              <Button onClick={handleGenerate} disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" /> Generate CV & Cover Letter
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Generating (loading state) */}
      {step === "generate" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-400" />
            <p className="text-lg font-medium text-white">Generating your documents...</p>
            <p className="text-sm text-slate-400">
              AI is selecting the best framing of your experience and tailoring your CV and cover letter.
            </p>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Done — Review & Download */}
      {step === "done" && materials && (
        <div className="space-y-4">
          {/* Lens selection summary */}
          {selectedLenses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Experience Framing Selected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedLenses.map((lens, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 mt-0.5">
                        {lens.stint_name}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium text-white">{lens.title}</p>
                        <p className="text-xs text-slate-400">{lens.relevance}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* CV and Cover Letter Tabs */}
          <Card>
            <Tabs defaultValue="cv">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="cv">CV Preview</TabsTrigger>
                    <TabsTrigger value="cl">Cover Letter Preview</TabsTrigger>
                  </TabsList>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/api/documents/${materials.id}?type=cv`, "_blank")}
                    >
                      <Download className="h-4 w-4 mr-1" /> CV PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/api/documents/${materials.id}?type=cover_letter`, "_blank")}
                    >
                      <Download className="h-4 w-4 mr-1" /> Cover Letter PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <TabsContent value="cv" className="mt-0">
                  <div className="bg-white text-black rounded-lg p-6 max-h-[600px] overflow-y-auto">
                    <h1 className="text-xl font-bold text-center">{materials.cv_content.name}</h1>
                    <hr className="my-3" />
                    <h2 className="text-sm font-bold uppercase text-gray-700 mb-1">Professional Summary</h2>
                    <p className="text-sm mb-4">{materials.cv_content.summary}</p>
                    <h2 className="text-sm font-bold uppercase text-gray-700 mb-1">Experience</h2>
                    {materials.cv_content.experience.map((role, i) => (
                      <div key={i} className="mb-3">
                        <div className="flex justify-between">
                          <p className="text-sm font-bold">{role.title}</p>
                          <p className="text-xs text-gray-500">{role.period}</p>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">{role.organization}</p>
                        <ul className="list-disc list-inside text-sm space-y-0.5 ml-2">
                          {role.bullets.map((b, j) => (
                            <li key={j}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <h2 className="text-sm font-bold uppercase text-gray-700 mb-1">Skills</h2>
                    <p className="text-sm">{materials.cv_content.skills.join(" • ")}</p>
                  </div>
                </TabsContent>
                <TabsContent value="cl" className="mt-0">
                  <div className="bg-white text-black rounded-lg p-6 max-h-[600px] overflow-y-auto">
                    <p className="text-xs text-gray-400 mb-4">{materials.cover_letter_content.subject}</p>
                    <p className="text-sm font-medium mb-3">Dear Hiring Manager,</p>
                    {materials.cover_letter_content.paragraphs.map((para, i) => (
                      <p key={i} className="text-sm mb-3">{para}</p>
                    ))}
                    <p className="text-sm mt-4">Sincerely,</p>
                    <p className="text-sm font-bold">{materials.cv_content.name}</p>
                    <div className="mt-4 pt-2 border-t">
                      <p className="text-xs text-gray-400">
                        Angle: {materials.cover_letter_content.angle}
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep("input"); setUrl(""); setRawText(""); setScrapedJob(null); setMaterials(null); setError(null); }}>
              New Job
            </Button>
            <Button onClick={handleMarkApplied} className="flex-1">
              <Check className="h-4 w-4 mr-2" /> Mark as Applied & Track
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
