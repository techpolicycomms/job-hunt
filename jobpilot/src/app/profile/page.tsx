// ============================================================
// src/app/profile/page.tsx
// Profile — personal info, education, and 17-lens manager.
// ============================================================

"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { Loader2, Save, Plus, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Profile, RoleLens } from "@/lib/types";

// ============================================================
// LENS CARD COMPONENT
// TS concept: Strict interface for props
// ============================================================

interface LensCardProps {
  lens: RoleLens;
  onUpdate: (id: string, updates: Partial<RoleLens>) => void;
  onDelete: (id: string) => void;
}

function LensCard({ lens, onUpdate, onDelete }: LensCardProps) {
  const [tagInput, setTagInput] = React.useState("");

  function addTag() {
    if (!tagInput.trim()) return;
    const newTags = [...lens.tags, tagInput.trim()];
    onUpdate(lens.id, { tags: newTags });
    setTagInput("");
  }

  function removeTag(tag: string) {
    onUpdate(lens.id, { tags: lens.tags.filter((t) => t !== tag) });
  }

  return (
    <Card className="border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-indigo-400">{lens.stint_name} · {lens.period}</p>
            <p className="text-xs text-slate-500 font-mono">{lens.lens_id}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(lens.id)}
            className="h-6 w-6 text-slate-600 hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        <Input
          value={lens.title}
          onChange={(e) => onUpdate(lens.id, { title: e.target.value })}
          className="mt-1 h-8 text-sm font-medium"
          placeholder="Lens title..."
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Tags */}
        <div>
          <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1">
            <Tag className="h-3 w-3" />Tags (for matching)
          </p>
          <div className="flex flex-wrap gap-1 mb-2">
            {lens.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs cursor-pointer hover:bg-red-900/30 hover:text-red-400"
                onClick={() => removeTag(tag)}
              >
                {tag} ×
              </Badge>
            ))}
          </div>
          <div className="flex gap-1">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag()}
              placeholder="Add tag..."
              className="h-7 text-xs"
            />
            <Button size="sm" variant="outline" onClick={addTag} className="h-7 px-2">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div>
          <p className="text-xs text-slate-400 mb-1">Summary</p>
          <Textarea
            value={lens.summary ?? ""}
            onChange={(e) => onUpdate(lens.id, { summary: e.target.value })}
            className="min-h-[60px] text-xs"
            placeholder="One paragraph summary..."
          />
        </div>

        {/* Bullets */}
        <div>
          <p className="text-xs text-slate-400 mb-1">Bullet Points (one per line)</p>
          <Textarea
            value={lens.bullets.join("\n")}
            onChange={(e) =>
              onUpdate(lens.id, { bullets: e.target.value.split("\n").filter(Boolean) })
            }
            className="min-h-[80px] text-xs font-mono"
            placeholder="• Led AI integration...&#10;• Built 8-person team..."
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function ProfilePage() {
  const { toast } = useToast();
  const supabase = createClient();

  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [lenses, setLenses] = React.useState<RoleLens[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [profileRes, lensesRes] = await Promise.all([
      supabase.from("profiles").select("*").single(),
      supabase.from("role_lenses").select("*").order("sort_order"),
    ]);
    setProfile(profileRes.data as Profile | null);
    setLenses((lensesRes.data ?? []) as RoleLens[]);
    setLoading(false);
  }

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        linkedin: profile.linkedin,
        nationality: profile.nationality,
        work_permit: profile.work_permit,
        years_experience: profile.years_experience,
        languages: profile.languages,
        education: profile.education,
        certifications: profile.certifications,
        publications: profile.publications,
      })
      .eq("id", profile.id);

    if (!error) toast({ title: "Profile saved!" });
    else toast({ title: "Error", description: error.message, variant: "destructive" });
    setSaving(false);
  }

  function updateLensLocal(id: string, updates: Partial<RoleLens>) {
    setLenses((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  }

  async function saveLens(lensId: string) {
    const lens = lenses.find((l) => l.id === lensId);
    if (!lens) return;
    await supabase.from("role_lenses").update({
      title: lens.title,
      tags: lens.tags,
      summary: lens.summary,
      bullets: lens.bullets,
    }).eq("id", lensId);
    toast({ title: "Lens saved!" });
  }

  async function deleteLens(lensId: string) {
    await supabase.from("role_lenses").delete().eq("id", lensId);
    setLenses((prev) => prev.filter((l) => l.id !== lensId));
  }

  // Group lenses by stint
  const lensesByStint = lenses.reduce<Record<string, RoleLens[]>>((acc, lens) => {
    if (!acc[lens.stint_name]) acc[lens.stint_name] = [];
    acc[lens.stint_name].push(lens);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <Button onClick={saveProfile} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Profile
        </Button>
      </div>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="lenses">CV Lenses ({lenses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4">
          {profile && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-sm">Basic Information</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Full Name", field: "name" as keyof Profile },
                    { label: "Email", field: "email" as keyof Profile },
                    { label: "Phone", field: "phone" as keyof Profile },
                    { label: "LinkedIn", field: "linkedin" as keyof Profile },
                    { label: "Address", field: "address" as keyof Profile },
                    { label: "Nationality", field: "nationality" as keyof Profile },
                    { label: "Work Permit", field: "work_permit" as keyof Profile },
                    { label: "Years Experience", field: "years_experience" as keyof Profile },
                  ].map(({ label, field }) => (
                    <div key={field}>
                      <label className="text-xs text-slate-400">{label}</label>
                      <Input
                        className="mt-1"
                        value={String(profile[field] ?? "")}
                        onChange={(e) =>
                          setProfile((p) =>
                            p ? { ...p, [field]: field === "years_experience" ? Number(e.target.value) : e.target.value } : p
                          )
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="lenses" className="space-y-6">
          {Object.entries(lensesByStint).map(([stintName, stintLenses]) => (
            <div key={stintName}>
              <h3 className="text-sm font-semibold text-indigo-400 mb-3">
                {stintName} ({stintLenses.length} lenses)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {stintLenses.map((lens) => (
                  <div key={lens.id}>
                    <LensCard
                      lens={lens}
                      onUpdate={updateLensLocal}
                      onDelete={deleteLens}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full text-xs"
                      onClick={() => saveLens(lens.id)}
                    >
                      Save this lens
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
