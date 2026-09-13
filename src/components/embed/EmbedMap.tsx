"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Map, { Source, Layer, NavigationControl } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { AlertTriangle } from "lucide-react";
import { ISRAEL_MAP_CENTER, ISRAEL_MAP_DEFAULT_ZOOM } from "@/lib/constants/airspace-zones";

interface ZonesResponse {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: GeoJSON.Geometry;
    properties: { id: string; name: string; source: "airspace_zones" | "aip_reference_zones"; category?: string };
  }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  CTR: "#2563eb",
  FIRING_ZONE: "#dc2626",
  RESTRICTED_AREA: "#d97706",
  NATURE_RESERVE: "#16a34a",
};
const AIP_DEFAULT_COLOR = "#7c3aed";

/**
 * The embeddable map widget behind the "map_embed" API layer — a partner
 * puts this in an <iframe>. Deliberately lean: no auth-bound hooks (no
 * draw mode, no personal history, no legal-check flow that requires a real
 * account) — just the zone overlays a visitor can look at, fetched through
 * the public zones endpoint with the embed's own API key.
 */
export function EmbedMap({ apiKey }: { apiKey: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["embed_zones", apiKey],
    queryFn: async (): Promise<ZonesResponse> => {
      const res = await fetch(`/api/public/v1/zones?key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: Boolean(apiKey),
  });

  const zonesGeojson = useMemo<ZonesResponse>(
    () => data ?? { type: "FeatureCollection", features: [] },
    [data]
  );

  if (!apiKey) {
    return (
      <EmbedError message="נדרש מפתח API — הוסיפו ?key=מפתח-שכבת-map_embed לכתובת ההטמעה." />
    );
  }
  if (isError) {
    return <EmbedError message="מפתח ה-API אינו תקין, בוטל, או שאינו מוגדר לשכבת ההטמעה הנכונה." />;
  }

  return (
    <div className="relative h-full w-full">
      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: ISRAEL_MAP_CENTER[0],
          latitude: ISRAEL_MAP_CENTER[1],
          zoom: ISRAEL_MAP_DEFAULT_ZOOM,
        }}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
      >
        <NavigationControl position="top-left" />
        <Source id="embed-zones" type="geojson" data={zonesGeojson}>
          <Layer
            id="embed-zones-fill"
            type="fill"
            paint={{
              "fill-color": [
                "match",
                ["get", "category"],
                "CTR",
                CATEGORY_COLORS.CTR,
                "FIRING_ZONE",
                CATEGORY_COLORS.FIRING_ZONE,
                "RESTRICTED_AREA",
                CATEGORY_COLORS.RESTRICTED_AREA,
                "NATURE_RESERVE",
                CATEGORY_COLORS.NATURE_RESERVE,
                AIP_DEFAULT_COLOR,
              ],
              "fill-opacity": 0.18,
            }}
          />
          <Layer
            id="embed-zones-line"
            type="line"
            paint={{
              "line-color": [
                "match",
                ["get", "category"],
                "CTR",
                CATEGORY_COLORS.CTR,
                "FIRING_ZONE",
                CATEGORY_COLORS.FIRING_ZONE,
                "RESTRICTED_AREA",
                CATEGORY_COLORS.RESTRICTED_AREA,
                "NATURE_RESERVE",
                CATEGORY_COLORS.NATURE_RESERVE,
                AIP_DEFAULT_COLOR,
              ],
              "line-width": 1.5,
            }}
          />
        </Source>
      </Map>

      {isLoading && (
        <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-white/95 px-4 py-1.5 text-xs font-medium text-slate-700 shadow">
          טוען שכבות מרחב אווירי...
        </div>
      )}

      <a
        href="https://metis-ops.com"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 start-2 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium text-slate-600 shadow"
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
