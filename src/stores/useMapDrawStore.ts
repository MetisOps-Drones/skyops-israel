import { create } from "zustand";
import type { CameraType, FlightAltitudeBand, FlightPurposeInput } from "@/lib/validations/flight-request";
import { altitudeBandForMeters } from "@/lib/validations/flight-request";

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
  /** Derived from maxAltitudeMeters — kept for callers that still think in coarse bands. */
  altitudeBand: FlightAltitudeBand;
  /** The planned flight altitude, entered by the pilot in meters. */
  maxAltitudeMeters: number;
  flightPurpose: FlightPurposeInput;
  flightWindow: FlightWindow;
  droneId: string | null;
  emergencyContactPhone: string;
  /** null = not chosen yet — a required field with no sensible default. */
  cameraType: CameraType | null;
  /** How long it takes the pilot to land the drone once ATC asks — null until filled in. */
  takedownResponseSeconds: number | null;

  setDrawMode: (mode: BubbleDrawMode) => void;
  setShapeType: (shape: BubbleShapeType) => void;
  setCenter: (center: [number, number]) => void;
  setRadiusMeters: (radius: number) => void;
  setPolygon: (polygon: GeoJSON.Polygon | null) => void;
  setMaxAltitudeMeters: (meters: number) => void;
  setFlightPurpose: (purpose: FlightPurposeInput) => void;
  setFlightWindow: (window: FlightWindow) => void;
  setDroneId: (id: string | null) => void;
  setEmergencyContactPhone: (phone: string) => void;
  setCameraType: (type: CameraType | null) => void;
  setTakedownResponseSeconds: (seconds: number | null) => void;
  reset: () => void;
}

const initialState = {
  drawMode: "idle" as BubbleDrawMode,
  shapeType: "circle" as BubbleShapeType,
  center: null as [number, number] | null,
  radiusMeters: 100,
  polygon: null as GeoJSON.Polygon | null,
  altitudeBand: "under_50m" as FlightAltitudeBand,
  maxAltitudeMeters: 50,
  flightPurpose: "vlos_general" as FlightPurposeInput,
  flightWindow: { startTime: null, endTime: null } as FlightWindow,
  droneId: null as string | null,
  emergencyContactPhone: "",
  cameraType: null as CameraType | null,
  takedownResponseSeconds: null as number | null,
};

export const useMapDrawStore = create<MapDrawState>((set) => ({
  ...initialState,

  setDrawMode: (drawMode) => set({ drawMode }),
  setShapeType: (shapeType) => set({ shapeType, polygon: null, center: null, drawMode: "idle" }),
  setCenter: (center) => set({ center }),
  setRadiusMeters: (radiusMeters) => set({ radiusMeters }),
  setPolygon: (polygon) => set({ polygon }),
  setMaxAltitudeMeters: (maxAltitudeMeters) =>
    set({ maxAltitudeMeters, altitudeBand: altitudeBandForMeters(maxAltitudeMeters) }),
  setFlightPurpose: (flightPurpose) => set({ flightPurpose }),
  setFlightWindow: (flightWindow) => set({ flightWindow }),
  setDroneId: (droneId) => set({ droneId }),
  setEmergencyContactPhone: (emergencyContactPhone) => set({ emergencyContactPhone }),
  setCameraType: (cameraType) => set({ cameraType }),
  setTakedownResponseSeconds: (takedownResponseSeconds) => set({ takedownResponseSeconds }),
  reset: () => set(initialState),
}));
