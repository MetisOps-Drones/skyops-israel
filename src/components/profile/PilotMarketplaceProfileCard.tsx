"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserSquare2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagMultiSelect } from "@/components/ui/tag-multiselect";
import { useMyPilotProfile, useUpdatePilotProfile, type PilotProfileInput } from "@/hooks/usePilotProfile";
import {
  DRONE_MODELS,
  UAV_CATEGORIES,
  FLIGHT_MODES,
  PILOT_SKILLS,
  PILOT_SOFTWARE,
  PILOT_SPECIALIZATIONS,
  SERVICE_AREAS,
} from "@/lib/constants/pilot-skills";

const EMPTY: PilotProfileInput = {
  headline: "",
  years_experience: null,
  drone_models: [],
  uav_categories: [],
  flight_modes: [],
  skills: [],
  software: [],
  specializations: [],
  service_areas: [],
};

/**
 * The "LinkedIn-style" editable side of the marketplace profile — structured
 * experience an org can actually evaluate, instead of just a free-text bio.
 * Shown to every pilot_pro (not gated on marketplace-eligible plan): filling
 * this in is free, only *listing* requires the paid tier's freelance toggle.
 */
export function PilotMarketplaceProfileCard() {
  const { data: existing, isLoading } = useMyPilotProfile();
  const update = useUpdatePilotProfile();
  const [form, setForm] = useState<PilotProfileInput>(EMPTY);

  useEffect(() => {
    if (existing) {
      setForm({
        headline: existing.headline,
        years_experience: existing.years_experience,
        drone_models: existing.drone_models,
        uav_categories: existing.uav_categories,
        flight_modes: existing.flight_modes,
        skills: existing.skills,
        software: existing.software,
        specializations: existing.specializations,
        service_areas: existing.service_areas,
      });
    }
  }, [existing]);

  function patch(p: Partial<PilotProfileInput>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function handleSave() {
    try {
      await update.mutateAsync(form);
      toast.success("פרופיל המרקטפלייס נשמר");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "השמירה נכשלה");
    }
  }

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserSquare2 className="h-4 w-4" />
          </span>
          פרופיל מרקטפלייס
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          זה מה שארגונים רואים כשהם פותחים את הפרופיל שלכם מהמרקטפלייס — ככל שיותר מפורט, כך קל יותר להתאים אתכם
          לעבודה הנכונה.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="headline">כותרת מקצועית</Label>
            <Input
              id="headline"
              placeholder="לדוגמה: מטיס מסחרי | מיפוי וסקר | BVLOS"
              value={form.headline ?? ""}
              onChange={(e) => patch({ headline: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="years">שנות ניסיון</Label>
            <Input
              id="years"
              type="number"
              min={0}
              max={60}
              dir="ltr"
              value={form.years_experience ?? ""}
              onChange={(e) => patch({ years_experience: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        </div>

        <TagMultiSelect
          label="אזורי שירות"
          value={form.service_areas}
          onChange={(v) => patch({ service_areas: v })}
          suggestions={SERVICE_AREAS}
        />
        <TagMultiSelect
          label="דגמי רחפנים שהוטסו"
          value={form.drone_models}
          onChange={(v) => patch({ drone_models: v })}
          suggestions={DRONE_MODELS}
        />
        <TagMultiSelect
          label="סוגי כטב״ם"
          value={form.uav_categories}
          onChange={(v) => patch({ uav_categories: v })}
          suggestions={UAV_CATEGORIES}
        />
        <TagMultiSelect
          label="מצבי הטסה ידניים"
          value={form.flight_modes}
          onChange={(v) => patch({ flight_modes: v })}
          suggestions={FLIGHT_MODES}
        />
        <TagMultiSelect
          label="תחומי התמחות (סקילים)"
          value={form.skills}
          onChange={(v) => patch({ skills: v })}
          suggestions={PILOT_SKILLS}
        />
        <TagMultiSelect
          label="תוכנות"
          value={form.software}
          onChange={(v) => patch({ software: v })}
          suggestions={PILOT_SOFTWARE}
        />
        <TagMultiSelect
          label="תפקידים"
          value={form.specializations}
          onChange={(v) => patch({ specializations: v })}
          suggestions={PILOT_SPECIALIZATIONS}
        />

        <Button onClick={handleSave} disabled={update.isPending} className="self-end">
          {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          שמירת פרופיל
        </Button>
      </CardContent>
    </Card>
  );
}
