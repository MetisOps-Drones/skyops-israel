"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Phone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMyOrgContext } from "@/hooks/useOrgContext";
import { useUploadAvatar } from "@/hooks/useProfileSettings";
import type { Tables } from "@/lib/types/database.types";

// Matches ROLE_LABELS in admin/platform/AdminPlatformPageClient.tsx — a fleet
// manager runs a whole org, not a solo business, so it gets its own label
// instead of reusing pilot_pro's "לקוח פרטי עסקי".
const TIER_LABELS: Record<string, string> = {
  pilot_hobby: "לקוח פרטי",
  pilot_pro: "לקוח פרטי עסקי",
  fleet_manager: "מנהל צי",
  dispatcher_admin: "מוקדן תיאום",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ProfileHeader({ profile }: { profile: Tables<"profiles"> }) {
  const { data: orgContext } = useMyOrgContext();
  const uploadAvatar = useUploadAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const hasOrg = Boolean(orgContext?.orgId);
  const tierLabel = hasOrg ? "ארגון" : TIER_LABELS[profile.role] ?? "לקוח פרטי";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    try {
      await uploadAvatar.mutateAsync(file);
      toast.success("תמונת הפרופיל עודכנה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "העלאת התמונה נכשלה");
      setPreviewUrl(null);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-brand-navy text-brand-navy-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 -top-16 h-48 w-48 rounded-full bg-brand-gold/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-white/5"
      />
      <div className="relative flex items-center gap-4 p-6">
        <div className="relative shrink-0">
          <Avatar className="h-20 w-20 ring-2 ring-brand-gold/70 ring-offset-2 ring-offset-brand-navy">
            {(previewUrl ?? profile.avatar_url) && (
              <AvatarImage src={previewUrl ?? profile.avatar_url ?? undefined} alt={profile.full_name} />
            )}
            <AvatarFallback className="bg-white/10 text-xl font-semibold text-brand-navy-foreground">
              {initials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploadAvatar.isPending}
            className="absolute -bottom-1 -left-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-brand-navy bg-brand-gold text-brand-gold-foreground shadow-sm transition-transform hover:scale-105"
            aria-label="החלפת תמונת פרופיל"
          >
            {uploadAvatar.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xl font-bold">{profile.full_name}</p>
          <span className="mt-1.5 inline-flex items-center rounded-full bg-brand-gold/15 px-2.5 py-0.5 text-xs font-semibold text-brand-gold">
            {tierLabel}
          </span>
          {profile.phone && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-brand-navy-foreground/70">
              <Phone className="h-3 w-3" />
              <span dir="ltr">{profile.phone}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
