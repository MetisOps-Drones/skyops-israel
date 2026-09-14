"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Clock, BadgeCheck, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMarketplaceFreelancers, type MarketplaceFreelancer } from "@/hooks/useMarketplace";
import { MyEngagementsCard } from "@/components/marketplace/MyEngagementsCard";
import { StarRow } from "@/components/marketplace/StarRow";

const DAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const ALL_VALUE = "__all__";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function hoursSummary(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  const openDays = raw.filter((d): d is { day: number; open: boolean; from: string; to: string } => Boolean(d?.open));
  if (openDays.length === 0) return null;
  return openDays.map((d) => `${DAY_LABELS[d.day]} ${d.from}-${d.to}`).join(" · ");
}

function FreelancerCard({ freelancer }: { freelancer: MarketplaceFreelancer }) {
  const hours = hoursSummary(freelancer.business_hours);

  return (
    <Link href={`/marketplace/${freelancer.id}`} className="block">
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {freelancer.avatar_url && <AvatarImage src={freelancer.avatar_url} alt={freelancer.full_name} />}
              <AvatarFallback>{initials(freelancer.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-semibold">{freelancer.full_name}</p>
                {freelancer.is_verified_pilot && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="מטיס מאומת" />}
              </div>
              <Badge variant="secondary" className="mt-0.5">
                {freelancer.professional_category ?? "מטיס עצמאי"}
              </Badge>
            </div>
          </div>

          {freelancer.headline && <p className="text-sm font-medium text-foreground">{freelancer.headline}</p>}

          {freelancer.service_areas.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{freelancer.service_areas.join(" · ")}</span>
            </div>
          )}

          {freelancer.review_count > 0 ? (
            <div className="flex items-center gap-2">
              <StarRow rating={freelancer.avg_rating ?? 0} size="h-3.5 w-3.5" />
              <span className="text-xs text-muted-foreground">
                {freelancer.avg_rating?.toFixed(1)} ({freelancer.review_count} ביקורות)
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">אין עדיין דירוגים</p>
          )}

          {freelancer.bio && <p className="line-clamp-2 text-sm text-muted-foreground">{freelancer.bio}</p>}

          {freelancer.specializations.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {freelancer.specializations.slice(0, 3).map((s) => (
                <Badge key={s} variant="outline" className="text-[11px]">
                  {s}
                </Badge>
              ))}
            </div>
          )}

          {freelancer.my_contact_request_status === "pending" && (
            <Badge variant="warning" className="w-fit">
              בקשת יצירת קשר ממתינה לתשובה
            </Badge>
          )}
          {freelancer.my_contact_request_status === "accepted" && (
            <Badge variant="success" className="w-fit">
              יצרתם קשר
            </Badge>
          )}

          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {hours && (
              <div className="flex items-start gap-1.5">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{hours}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function MarketplacePageClient() {
  const { data: freelancers = [], isLoading, isError } = useMarketplaceFreelancers();
  const [search, setSearch] = useState("");
  const [specializationFilter, setSpecializationFilter] = useState(ALL_VALUE);
  const [skillFilter, setSkillFilter] = useState(ALL_VALUE);
  const [areaFilter, setAreaFilter] = useState(ALL_VALUE);

  const allSpecializations = useMemo(
    () => Array.from(new Set(freelancers.flatMap((f) => f.specializations))).sort(),
    [freelancers]
  );
  const allSkills = useMemo(() => Array.from(new Set(freelancers.flatMap((f) => f.skills))).sort(), [freelancers]);
  const allAreas = useMemo(
    () => Array.from(new Set(freelancers.flatMap((f) => f.service_areas))).sort(),
    [freelancers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return freelancers.filter((f) => {
      // Search checks the structured tags too, not just name/headline — a
      // business typing a skill like "LiDAR" should find it even when the
      // pilot never put that word in their free-text headline.
      const matchesQuery =
        !q ||
        f.full_name.toLowerCase().includes(q) ||
        (f.headline ?? "").toLowerCase().includes(q) ||
        f.specializations.some((s) => s.toLowerCase().includes(q)) ||
        f.skills.some((s) => s.toLowerCase().includes(q));
      if (!matchesQuery) return false;
      if (specializationFilter !== ALL_VALUE && !f.specializations.includes(specializationFilter)) return false;
      if (skillFilter !== ALL_VALUE && !f.skills.includes(skillFilter)) return false;
      if (areaFilter !== ALL_VALUE && !f.service_areas.includes(areaFilter)) return false;
      return true;
    });
  }, [freelancers, search, specializationFilter, skillFilter, areaFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <MyEngagementsCard />
        <p className="text-sm text-muted-foreground">טוען...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <MyEngagementsCard />
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
          טעינת המרקטפלייס נכשלה — נסו לרענן את הדף.
        </div>
      </div>
    );
  }

  if (freelancers.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <MyEngagementsCard />
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          אין כרגע מטיסים עצמאיים פנויים במרקטפלייס.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <MyEngagementsCard />
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם, כותרת, תפקיד או תחום התמחות"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-9"
          />
        </div>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="אזור שירות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>כל אזורי הארץ</SelectItem>
            {allAreas.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={specializationFilter} onValueChange={setSpecializationFilter}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="תפקיד" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>כל התפקידים</SelectItem>
            {allSpecializations.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={skillFilter} onValueChange={setSkillFilter}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="תחום התמחות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>כל תחומי ההתמחות</SelectItem>
            {allSkills.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          אין מטיסים התואמים את החיפוש/הסינון.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <FreelancerCard key={f.id} freelancer={f} />
          ))}
        </div>
      )}
    </div>
  );
}
