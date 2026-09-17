"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Navigation, Pin, Loader2 } from "lucide-react";
import { BubbleMap } from "@/components/map/BubbleMap";
import { FlightParamsDrawer } from "@/components/map/FlightParamsDrawer";
import { AirspaceHUD } from "@/components/map/AirspaceHUD";
import { LayerControlPanel } from "@/components/map/LayerControlPanel";
import { LocationInfoCard } from "@/components/map/LocationInfoCard";
import { MapSearchBox } from "@/components/map/MapSearchBox";
import type { FlightRequestSearchResult } from "@/hooks/useMapSearch";
import { useMapDrawStore } from "@/stores/useMapDrawStore";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { DEFAULT_MAP_BASE_STYLE, DEFAULT_MAP_LAYER_VISIBILITY, type MapBaseStyle, type MapLayerVisibility } from "@/lib/types/map-ui";
import { cn } from "@/lib/utils";

export function MapPageClient() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState<[number, number] | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<MapLayerVisibility>(DEFAULT_MAP_LAYER_VISIBILITY);
  const [baseStyle, setBaseStyle] = useState<MapBaseStyle>(DEFAULT_MAP_BASE_STYLE);
  const [highContrast, setHighContrast] = useState(false);
  const [infoCardPoint, setInfoCardPoint] = useState<[number, number] | null>(null);
  const [infoCardOpen, setInfoCardOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const { drawMode, reset, setShapeType, setCenter, setDrawMode, setDroneId } = useMapDrawStore();

  const currentLocation = useCurrentLocation(true);

  // Once a pin is placed and sized (or a polygon is finished), move straight
  // to the flight-request details rather than requiring a separate button.
  useEffect(() => {
    if (drawMode === "done") {
      setDrawerOpen(true);
    }
  }, [drawMode]);

  function recenterToCurrentLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("הדפדפן שלך לא תומך באיתור מיקום");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const point: [number, number] = [position.coords.longitude, position.coords.latitude];
        setFlyToTarget(point);
        setInfoCardPoint(point);
        setInfoCardOpen(true);
      },
      () => {
        setLocating(false);
        toast.error("לא הצלחנו לאתר את המיקום שלך — ודאו שנתתם הרשאת מיקום");
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  function startPinForCoordination() {
    reset();
    setShapeType("circle");
    setDrawMode("placing_pin");
    toast.message("הציבו סיכה על המפה כדי לתאם מרחב אווירי לטיסה");
  }

  function handleInspectPoint(point: [number, number]) {
    setInfoCardPoint(point);
    setInfoCardOpen(true);
  }

  function handleAddressSelect(point: [number, number]) {
    setFlyToTarget(point);
    setInfoCardPoint(point);
    setInfoCardOpen(true);
  }

  function handleSelectDrone(droneId: string, label: string) {
    // reset() clears the whole draw store (including droneId), so it must
    // run before setDroneId, not after — the ordering here directly
    // determines whether the pre-selected drone survives.
    reset();
    setShapeType("circle");
    setDrawMode("placing_pin");
    setDroneId(droneId);
    toast.message(`הרחפן "${label}" נבחר — הציבו סיכה על המפה כדי להתחיל בקשת טיסה`);
  }

  function handleSelectFlightRequest(result: FlightRequestSearchResult) {
    setFlyToTarget(result.point);
    setSelectedHistoryId(result.id);
  }

  function handleRequestCoordinationFromCard(point: [number, number]) {
    reset();
    setShapeType("circle");
    setCenter(point);
    setDrawMode("done");
    setInfoCardOpen(false);
  }

  return (
    <div className="relative h-full w-full">
      <BubbleMap
        flyToTarget={flyToTarget}
        layerVisibility={layerVisibility}
        baseStyle={baseStyle}
        highContrast={highContrast}
        onInspectPoint={handleInspectPoint}
        selectedHistoryId={selectedHistoryId}
        onSelectedHistoryIdChange={setSelectedHistoryId}
      />

      <AirspaceHUD
        coords={currentLocation.coords}
        showWind={layerVisibility.windHazard}
        highContrast={highContrast}
      />

      <div className="absolute top-16 start-4 z-10 flex max-w-[calc(100%-2rem)] items-start gap-2">
        <LayerControlPanel
          visibility={layerVisibility}
          onVisibilityChange={setLayerVisibility}
          baseStyle={baseStyle}
          onBaseStyleChange={setBaseStyle}
          highContrast={highContrast}
          onHighContrastChange={setHighContrast}
        />
        <MapSearchBox
          onSelectPlace={handleAddressSelect}
          onSelectDrone={handleSelectDrone}
          onSelectFlightRequest={handleSelectFlightRequest}
          highContrast={highContrast}
        />
      </div>

      <div className="absolute bottom-4 end-4 z-10 flex flex-col items-end gap-3">
        <div className="flex items-center gap-2">
          {!currentLocation.coords && (
            <span className="rounded-full bg-card/95 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
              {currentLocation.loading ? "מאתר מיקום..." : "מיקום לא זמין"}
            </span>
          )}
          <button
            type="button"
            onClick={recenterToCurrentLocation}
            disabled={locating}
            aria-label="איפוס המפה למיקום הנוכחי"
            title="איפוס המפה למיקום הנוכחי"
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full bg-card text-foreground shadow-md transition-colors hover:bg-accent",
              highContrast ? "border-2 border-foreground" : "border border-input",
              "disabled:opacity-60"
            )}
          >
            {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5" />}
          </button>
        </div>
        <button
          type="button"
          onClick={startPinForCoordination}
          aria-label="דקירת מרחב אווירי לתיאום"
          title="דקירת מרחב אווירי לתיאום"
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full shadow-md transition-colors",
            drawMode !== "idle" && drawMode !== "done"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : cn("bg-card text-foreground hover:bg-accent", highContrast ? "border-2 border-foreground" : "border border-input")
          )}
        >
          <Pin className="h-5 w-5" />
        </button>
      </div>

      <FlightParamsDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <LocationInfoCard
        point={infoCardPoint}
        open={infoCardOpen}
        onOpenChange={setInfoCardOpen}
        onRequestCoordination={handleRequestCoordinationFromCard}
      />
    </div>
  );
}
