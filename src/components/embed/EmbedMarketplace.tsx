"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, BadgeCheck, Star, MapPin, AlertTriangle, ExternalLink } from "lucide-react";

interface EmbedFreelancer {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  professional_category: string | null;
  is_verified_pilot: boolean;
  avg_rating: number | null;
  review_count: number;
  headline: string | null;
  years_experience: number | null;
  specializations: string[];
  skills: string[];
  service_areas: string[];
}

const ALL_VALUE = "__all__";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
        />
      ))}
    </div>
  );
}

function Card({ f }: { f: EmbedFreelancer }) {
  return (
    <a
      href={`/marketplace/${f.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
          {f.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.avatar_url} alt={f.full_name} className="h-full w-full object-cover" />
          ) : (
            initials(f.full_name)
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-slate-900">{f.full_name}</p>
            {f.is_verified_pilot && <BadgeCheck className="h-4 w-4 shrink-0 text-blue-600" aria-label="מטיס מאומת" />}
          </div>
          <p className="truncate text-xs text-slate-500">{f.professional_category ?? "מטיס עצמאי"}</p>
        </div>
      </div>

      {f.headline && <p className="text-sm font-medium text-slate-800">{f.headline}</p>}

      {f.service_areas.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span>{f.service_areas.join(" · ")}</span>
        </div>
      )}

      {f.review_count > 0 ? (
        <div className="flex items-center gap-2">
          <StarRow rating={f.avg_rating ?? 0} />
          <span className="text-xs text-slate-500">
            {f.avg_rating?.toFixed(1)} ({f.review_count})
          </span>
        </div>
      ) : (
        <p className="text-xs text-slate-400">אין עדיין דירוגים</p>
      )}

      {f.specializations.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {f.specializations.slice(0, 3).map((s) => (
            <span key={s} className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
              {s}
            </span>
          ))}
        </div>
      )}

      <span className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-600">
        יצירת קשר דרך MetisOps
        <ExternalLink className="h-3 w-3" />
      </span>
    </a>
  );
}

/** The embeddable marketplace widget behind the "marketplace_embed" API layer. Read-only directory — contact requests always route through a real MetisOps login, opened in a new tab. */
export function EmbedMarketplace({ apiKey }: { apiKey: string }) {
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState(ALL_VALUE);
  const [specializationFilter, setSpecializationFilter] = useState(ALL_VALUE);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["embed_marketplace", apiKey],
    queryFn: async (): Promise<EmbedFreelancer[]> => {
      const res = await fetch(`/api/public/v1/marketplace?key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) throw new Error("failed");
      const json = await res.json();
      return json.freelancers;
    },
    enabled: Boolean(apiKey),
  });

  const freelancers = data ?? [];
  const allAreas = useMemo(() => Array.from(new Set(freelancers.flatMap((f) => f.service_areas))).sort(), [freelancers]);
  const allSpecializations = useMemo(
    () => Array.from(new Set(freelancers.flatMap((f) => f.specializations))).sort(),
    [freelancers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return freelancers.filter((f) => {
      const matchesQuery =
        !q ||
        f.full_name.toLowerCase().includes(q) ||
        (f.headline ?? "").toLowerCase().includes(q) ||
        f.specializations.some((s) => s.toLowerCase().includes(q)) ||
        f.skills.some((s) => s.toLowerCase().includes(q));
      if (!matchesQuery) return false;
      if (areaFilter !== ALL_VALUE && !f.service_areas.includes(areaFilter)) return false;
      if (specializationFilter !== ALL_VALUE && !f.specializations.includes(specializationFilter)) return false;
      return true;
    });
  }, [freelancers, search, areaFilter, specializationFilter]);

  if (!apiKey) {
    return <EmbedError message="נדרש מפתח API — הוסיפו ?key=מפתח-שכבת-marketplace_embed לכתובת ההטמעה." />;
  }
  if (isError) {
    return <EmbedError message="מפתח ה-API אינו תקין, בוטל, או שאינו מוגדר לשכבת ההטמעה הנכונה." />;
  }

  return (
    <div dir="rtl" className="flex h-full w-full flex-col gap-3 overflow-y-auto bg-slate-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, תפקיד או התמחות"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pe-9 ps-3 text-sm outline-none focus:border-blue-400"
          />
        </div>
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm sm:w-40"
        >
          <option value={ALL_VALUE}>כל אזורי הארץ</option>
          {allAreas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={specializationFilter}
          onChange={(e) => setSpecializationFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm sm:w-40"
        >
          <option value={ALL_VALUE}>כל התפקידים</option>
          {allSpecializations.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-slate-500">טוען...</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">אין מטיסים התואמים את החיפוש.</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((f) => (
          <Card key={f.id} f={f} />
        ))}
      </div>

      <a
        href="https://metis-ops.com"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-auto mt-2 w-fit text-[11px] font-medium text-slate-400"
      >
        מופעל על ידי MetisOps
      </a>
    </div>
  );
}

function EmbedError({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-50 p-6 text-center">
      <AlertTriangle className="h-6 w-6 text-amber-600" />
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  );
}
