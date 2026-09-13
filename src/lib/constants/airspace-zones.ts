import * as turf from "@turf/turf";
import type { AirspaceZoneType } from "@/lib/types/database.types";

/**
 * Client-side mirror of `supabase/migrations/0012_seed_airspace_zones.sql`,
 * used for instant map rendering and the first-pass spatial check that runs
 * before the authoritative server-side PostGIS query
 * (`find_intersecting_zones`, called from `checkAirspaceIntersection` in
 * src/actions/flight-requests.ts). Keep the two in sync if you edit either.
 */
export interface MockAirspaceZone {
  id: string;
  name: string;
  type: AirspaceZoneType;
  minAltitudeM: number;
  maxAltitudeM: number;
  alwaysActive: boolean;
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
}

export const ISRAEL_MAP_CENTER: [number, number] = [35.2137, 31.7683];
export const ISRAEL_MAP_DEFAULT_ZOOM = 8;

const benGurionCtr = turf.circle([34.8867, 32.0114], 9, { units: "kilometers" });
const palmachimRestricted = turf.circle([34.6893, 31.8968], 12, { units: "kilometers" });

const telAvivUrbanZone = turf.polygon([
  [
    [34.74, 32.03],
    [34.82, 32.03],
    [34.82, 32.13],
    [34.74, 32.13],
    [34.74, 32.03],
  ],
]);

const northFiringZone = turf.polygon([
  [
    [35.55, 33.05],
    [35.75, 33.05],
    [35.75, 33.25],
    [35.55, 33.25],
    [35.55, 33.05],
  ],
]);

export const MOCK_AIRSPACE_ZONES: MockAirspaceZone[] = [
  {
    id: "ben-gurion-ctr",
    name: "אזור בקרה נתב״ג (Ben Gurion CTR)",
    type: "CTR",
    minAltitudeM: 0,
    maxAltitudeM: 3000,
    alwaysActive: true,
    feature: benGurionCtr,
  },
  {
    id: "palmachim-restricted",
    name: "אזור מוגבל פלמחים (Palmachim)",
    type: "RESTRICTED_AREA",
    minAltitudeM: 0,
    maxAltitudeM: 3000,
    alwaysActive: true,
    feature: palmachimRestricted,
  },
  {
    id: "tel-aviv-urban",
    name: "אזור עירוני תל אביב (Tel Aviv Urban Zone)",
    type: "RESTRICTED_AREA",
    minAltitudeM: 0,
    maxAltitudeM: 1000,
    alwaysActive: true,
    feature: telAvivUrbanZone,
  },
  {
    id: "north-firing-zone",
    name: "אזור אש צפוני (North Firing Zone)",
    type: "FIRING_ZONE",
    minAltitudeM: 0,
    maxAltitudeM: 5000,
    alwaysActive: false,
    feature: northFiringZone,
  },
];

export const AIRSPACE_ZONE_COLORS: Record<AirspaceZoneType, string> = {
  CTR: "#2563eb",
  FIRING_ZONE: "#dc2626",
  RESTRICTED_AREA: "#ea580c",
  NATURE_RESERVE: "#16a34a",
};

export const AIRSPACE_ZONE_LABELS: Record<AirspaceZoneType, string> = {
  CTR: "אזור בקרת טיסה (CTR)",
  FIRING_ZONE: "שטח אש",
  RESTRICTED_AREA: "שטח מוגבל",
  NATURE_RESERVE: "שמורת טבע",
};
