import type { AirspaceZoneType } from "@/lib/types/database.types";

/** Base map imagery — independent of the "high contrast" accessibility mode, which overrides this for sunlight readability. */
export type MapBaseStyle = "colorful" | "light" | "satellite";
export const DEFAULT_MAP_BASE_STYLE: MapBaseStyle = "colorful";

export type MapLayerVisibility = {
  /** RESTRICTED_AREA + FIRING_ZONE */
  nfz: boolean;
  natureReserves: boolean;
  /** CTR — airport control zones, the closest existing zone type to "national infrastructure". */
  infrastructure: boolean;
  /** Not an airspace_zones row — toggles the live wind readout in the HUD. */
  windHazard: boolean;
  /** The advisory AIP-reference overlay (useAipReferenceZones) — approximate, not authoritative. */
  aipReference: boolean;
  /** The signed-in pilot's own past coordination requests, shown as small status-colored dots. */
  myHistory: boolean;
  /** Admin-only: every pilot/org's active or pending coordination footprint on the platform, not just the signed-in user's own. */
  allCoordinations: boolean;
  /** Individual building footprints, served as static R2-hosted vector tiles — visual reference only, only rendered from minzoom 14. */
  buildings: boolean;
  /** Buildings dissolved into wide "built-up area" blobs (100m connect-distance) so a cluster of houses reads as a neighborhood — visible from a lower zoom than individual buildings. */
  neighborhoods: boolean;
};

export const DEFAULT_MAP_LAYER_VISIBILITY: MapLayerVisibility = {
  nfz: true,
  natureReserves: true,
  infrastructure: true,
  windHazard: true,
  aipReference: true,
  buildings: true,
  neighborhoods: true,
  // Opt-in, not on by default — a pilot's own past-request dots sitting on the map by default
  // reads as unexplained clutter (surfaced as literal user confusion: "why does this just show
  // up?"). Toggle lives in LayerControlPanel under "הבקשות שלי במפה".
  myHistory: false,
  allCoordinations: false,
};

export function zoneCategoryOf(type: AirspaceZoneType): keyof Omit<MapLayerVisibility, "windHazard"> {
  if (type === "NATURE_RESERVE") return "natureReserves";
  if (type === "CTR") return "infrastructure";
  return "nfz";
}
