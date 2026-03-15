// ============================================================
// src/app/settings/page.tsx
// Settings — search preferences, platform toggles, thresholds.
// ============================================================

"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { SearchPreferences } from "@/lib/types";

// TS concept: A "switch" component built with a button
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between py-2 cursor-pointer"
      onClick={() => onChange(!checked)}
    >
      <span className="text-sm text-slate-300">{label}</span>
      <div
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-indigo-600" : "bg-slate-700"
        }`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
    </div>
  );
}

// TS: Helper to parse a comma-separated string into a string array
function parseList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function SettingsPage() {
  const { toast } = useToast();
  const supabase = createClient();

  const [prefs, setPrefs] = React.useState<SearchPreferences | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Form state — strings for comma-separated list inputs
  const [keywords, setKeywords] = React.useState("");
  const [locations, setLocations] = React.useState("");
  const [excludedCompanies, setExcludedCompanies] = React.useState("");
  const [excludedKeywords, setExcludedKeywords] = React.useState("");
  const [minScore, setMinScore] = React.useState(75);
  const [maxJobs, setMaxJobs] = React.useState(20);
  const [platforms, setPlatforms] = React.useState({
    linkedin: true,
    google_careers: true,
    indeed: true,
    unjobs: true,
    web: true,
  });
  const [isActive, setIsActive] = React.useState(true);

  React.useEffect(() => {
    loadPrefs();
  }, []);

  async function loadPrefs() {
    setLoading(true);
    const { data } = await supabase
      .from("search_preferences")
      .select("*")
      .single();

    if (data) {
      const p = data as SearchPreferences;
      setPrefs(p);
      setKeywords(p.keywords.join(", "));
      setLocations(p.locations.join(", "));
      setExcludedCompanies(p.excluded_companies.join(", "));
      setExcludedKeywords(p.excluded_keywords.join(", "));
      setMinScore(p.min_match_score);
      setMaxJobs(p.max_daily_jobs);
      setPlatforms(p.platforms);
      setIsActive(p.is_active);
    }
    setLoading(false);
  }

  async function savePrefs() {
    setSaving(true);
    const updates = {
      keywords: parseList(keywords),
      locations: parseList(locations),
      excluded_companies: parseList(excludedCompanies),
      excluded_keywords: parseList(excludedKeywords),
      min_match_score: minScore,
      max_daily_jobs: maxJobs,
      platforms,
      is_active: isActive,
    };

    const { error } = prefs
      ? await supabase.from("search_preferences").update(updates).eq("id", prefs.id)
      : await supabase.from("search_preferences").insert(updates);

    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Settings saved!" });
      loadPrefs();
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <Button onClick={savePrefs} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save
        </Button>
      </div>

      {/* Pipeline toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pipeline Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Toggle
            label={isActive ? "Pipeline is ACTIVE — runs daily at 8am UTC" : "Pipeline is PAUSED"}
            checked={isActive}
            onChange={setIsActive}
          />
        </CardContent>
      </Card>

      {/* Search keywords */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Search Keywords</CardTitle>
          <CardDescription className="text-xs">Comma-separated. Used across all platforms.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="programme manager, AI governance, digital transformation..."
          />
        </CardContent>
      </Card>

      {/* Locations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Target Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            placeholder="Geneva, Zurich, Dublin, Remote..."
          />
        </CardContent>
      </Card>

      {/* Score thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Match Thresholds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-slate-400">
              Minimum Match Score: <span className="text-white font-medium">{minScore}%</span>
            </label>
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full mt-2 accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>50%</span><span>95%</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">
              Max Daily Jobs: <span className="text-white font-medium">{maxJobs}</span>
            </label>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={maxJobs}
              onChange={(e) => setMaxJobs(Number(e.target.value))}
              className="w-full mt-2 accent-indigo-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Platform toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Enabled Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          {(Object.keys(platforms) as Array<keyof typeof platforms>).map((platform) => (
            <Toggle
              key={platform}
              label={platform.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              checked={platforms[platform]}
              onChange={(v) => setPlatforms((prev) => ({ ...prev, [platform]: v }))}
            />
          ))}
        </CardContent>
      </Card>

      {/* Exclusions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Exclusions</CardTitle>
          <CardDescription className="text-xs">Companies or keywords that disqualify a job</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-slate-400">Excluded Companies</label>
            <Input
              className="mt-1"
              value={excludedCompanies}
              onChange={(e) => setExcludedCompanies(e.target.value)}
              placeholder="Staffing Inc, Recruiter Co..."
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Excluded Keywords</label>
            <Input
              className="mt-1"
              value={excludedKeywords}
              onChange={(e) => setExcludedKeywords(e.target.value)}
              placeholder="marketing, sales, retail..."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
