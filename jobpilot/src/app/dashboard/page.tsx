"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Link2, Briefcase, Clock, Trophy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [url, setUrl] = React.useState("");
  const [applications, setApplications] = React.useState<
    Array<{
      id: string;
      status: string;
      date_applied: string;
      job: { title: string; company: string; url: string } | null;
    }>
  >([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data } = await supabase
      .from("applications")
      .select("id, status, date_applied, job:jobs(title, company, url)")
      .order("date_applied", { ascending: false })
      .limit(10);
    setApplications((data as unknown as typeof applications) ?? []);
    setLoading(false);
  }

  function handleSubmitUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    router.push(`/generate?url=${encodeURIComponent(url.trim())}`);
  }

  const total = applications.length;
  const interviews = applications.filter((a) => a.status === "interview").length;
  const offers = applications.filter((a) => a.status === "offer").length;
  const rejected = applications.filter((a) => a.status === "rejected").length;

  const statusColors: Record<string, string> = {
    applied: "bg-blue-500/20 text-blue-400",
    screening: "bg-yellow-500/20 text-yellow-400",
    interview: "bg-purple-500/20 text-purple-400",
    offer: "bg-green-500/20 text-green-400",
    rejected: "bg-red-500/20 text-red-400",
    withdrawn: "bg-slate-500/20 text-slate-400",
    ghosted: "bg-slate-500/20 text-slate-400",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Hero: URL Input */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-3xl font-bold text-white">JobPilot</h1>
        <p className="text-slate-400 text-lg">
          Paste a job URL to generate ATS-optimized CV and cover letter
        </p>
        <form onSubmit={handleSubmitUrl} className="flex gap-2 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://linkedin.com/jobs/view/... or any job URL"
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <Button type="submit" size="lg" disabled={!url.trim()}>
            Generate
          </Button>
        </form>
        <button
          onClick={() => router.push("/generate")}
          className="text-sm text-slate-500 hover:text-slate-300 underline"
        >
          Or paste job description text directly
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-white">{total}</p>
              <p className="text-xs text-slate-400">Total Applied</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-purple-400" />
            <div>
              <p className="text-2xl font-bold text-white">{interviews}</p>
              <p className="text-xs text-slate-400">Interviews</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-white">{offers}</p>
              <p className="text-xs text-slate-400">Offers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-white">{rejected}</p>
              <p className="text-xs text-slate-400">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            </div>
          ) : applications.length === 0 ? (
            <p className="text-slate-400 text-center py-8">
              No applications yet. Paste a job URL above to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer"
                  onClick={() => router.push("/applications")}
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {app.job?.title ?? "Unknown"}
                    </p>
                    <p className="text-xs text-slate-400">{app.job?.company ?? ""}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={statusColors[app.status] ?? ""}>
                      {app.status}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {format(new Date(app.date_applied), "MMM d")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
