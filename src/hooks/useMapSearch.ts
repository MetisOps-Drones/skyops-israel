"use client";

import { useMemo } from "react";
import { useAddressSearch } from "@/hooks/useAddressSearch";
import { useDrones } from "@/hooks/useDrones";
import { useMyFlightRequests } from "@/hooks/useFlightRequests";
import { FLIGHT_REQUEST_STATUS_LABELS } from "@/lib/constants/flight-request-status";

export interface DroneSearchResult {
  id: string;
  label: string;
  sublabel: string | null;
}

export interface FlightRequestSearchResult {
  id: string;
  label: string;
  sublabel: string;
  point: [number, number];
}

/**
 * Groups three independent search sources behind one query string: places
 * (Mapbox geocoding, existing), the pilot's own drones, and their own past
 * flight requests. Drones/requests are filtered client-side — both lists
 * are already fetched and cached for the map page (fleet size and request
 * history are both small per pilot), so a server-side search isn't worth it.
 */
export function useMapSearch(query: string) {
  const trimmed = query.trim();
  const places = useAddressSearch(query);
  const { data: drones = [] } = useDrones();
  const { data: flightRequests = [] } = useMyFlightRequests();

  const droneResults = useMemo<DroneSearchResult[]>(() => {
    if (trimmed.length < 2) return [];
    const q = trimmed.toLowerCase();
    return drones
      .filter(
        (d) =>
          d.nickname?.toLowerCase().includes(q) ||
          d.model?.toLowerCase().includes(q) ||
          d.registration_number?.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map((d) => ({
        id: d.id,
        label: d.nickname || d.model || "רחפן",
        sublabel: d.registration_number,
      }));
  }, [drones, trimmed]);

  const flightRequestResults = useMemo<FlightRequestSearchResult[]>(() => {
    if (trimmed.length < 2) return [];
    const q = trimmed.toLowerCase();
    return flightRequests
      .filter((r) => {
        const geom = r.center_point_geojson as unknown as GeoJSON.Point | null;
        if (!geom || geom.type !== "Point") return false;
        const droneLabel = r.drones?.nickname || r.drones?.model || "";
        return droneLabel.toLowerCase().includes(q) || FLIGHT_REQUEST_STATUS_LABELS[r.status].includes(trimmed);
      })
      .slice(0, 5)
      .map((r) => {
        const geom = r.center_point_geojson as unknown as GeoJSON.Point;
        return {
          id: r.id,
          label: r.drones?.nickname || r.drones?.model || "בקשת טיסה",
          sublabel: `${FLIGHT_REQUEST_STATUS_LABELS[r.status]} · ${new Date(r.start_time).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}`,
          point: geom.coordinates as [number, number],
        };
      });
  }, [flightRequests, trimmed]);

  return {
    places: places.data ?? [],
    placesLoading: places.isFetching,
    drones: droneResults,
    flightRequests: flightRequestResults,
  };
}
