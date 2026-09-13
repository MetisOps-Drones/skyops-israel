import { create } from "zustand";
import type { FlightAltitudeBand, FlightPurposeInput } from "@/lib/validations/flight-request";
import { ALTITUDE_BAND_METERS } from "@/lib/validations/flight-request";

export type BubbleDrawMode = "idle" | "placing_pin" | "sizing_radius" | "drawing_polygon" | "done";
export type BubbleShapeType = "circle" | "polygon";

interface FlightWindow {
  startTime: Date | null;
  endTime: Date | null;
}

interface MapDrawState {
  drawMode: BubbleDrawMode;
  shapeType: BubbleShapeType;
  center: [number, number] | null;
  radiusMeters: number;
  polygon: GeoJSON.Polygon | null;
  altitudeBand: FlightAltitudeBand;
  maxAltitudeMeters: number;
  flightPurpose: FlightPurposeInput;
  flightWindow: FlightWindow;
  droneId: string | null;
  emergencyContactPhone: string;

  setDrawMode: (mode: BubbleDrawMode) => void;
  setShapeType: (shape: BubbleShapeType) => void;
  setCenter: (center: [number, number]) => void;
  setRadiusMeters: (radius: number) => void;
  setPolygon: (polygon: GeoJSON.Polygon | null) => void;
  setAltitudeBand: (band: FlightAltitudeBand) => void;
  setFlightPurpose: (purpose: FlightPurposeInput) => void;
  setFlightWindow: (window: FlightWindow) => void;
  setDroneId: (id: string | null) => void;
  setEmergencyContactPhone: (phone: string) => void;
  reset: () => void;
}

const initialState = {
  drawMode: "idle" as BubbleDrawMode,
  shapeType: "circle" as BubbleShapeType,
  center: null as [number, number] | null,
  radiusMeters: 100,
  polygon: null as GeoJSON.Polygon | null,
  altitudeBand: "under_100m" as FlightAltitudeBand,
  maxAltitudeMeters: ALTITUDE_BAND_METERS.under_100m,
  flightPurpose: "vlos_general" as FlightPurposeInput,
  flightWindow: { startTime: null, endTime: null } as FlightWindow,
  droneId: null as string | null,
  emergencyContactPhone: "",
};

export const useMapDrawStore = create<MapDrawState>((set) => ({
  ...initialState,

  setDrawMode: (drawMode) => set({ drawMode }),
  setShapeType: (shapeType) => set({ shapeType, polygon: null, center: null, drawMode: "idle" }),
  setCenter: (center) => set({ center }),
  setRadiusMeters: (radiusMeters) => set({ radiusMeters }),
  setPolygon: (polygon) => set({ polygon }),
  setAltitudeBand: (altitudeBand) =>
    set({ altitudeBand, maxAltitudeMeters: ALTITUDE_BAND_METERS[altitudeBand] }),
  setFlightPurpose: (flightPurpose) => set({ flightPurpose }),
  setFlightWindow: (flightWindow) => set({ flightWindow }),
  setDroneId: (droneId) => set({ droneId }),
  setEmergencyContactPhone: (emergencyContactPhone) => set({ emergencyContactPhone }),
  reset: () => set(initialState),
}));
