"use client";

import { useEffect, useState } from "react";

export type CurrentLocationState = {
  coords: [number, number] | null;
  error: string | null;
  loading: boolean;
};

/** Live GPS position, kept up to date via watchPosition — backs the map HUD's clearance/wind readout and one-click coordinate sharing. */
export function useCurrentLocation(enabled: boolean): CurrentLocationState {
  const [state, setState] = useState<CurrentLocationState>({ coords: null, error: null, loading: enabled });

  useEffect(() => {
    if (!enabled) return;
    if (!("geolocation" in navigator)) {
      setState({ coords: null, error: "הדפדפן שלך לא תומך באיתור מיקום", loading: false });
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setState({
          coords: [position.coords.longitude, position.coords.latitude],
          error: null,
          loading: false,
        });
      },
      () => {
        setState({ coords: null, error: "לא ניתן לאתר מיקום — בדקו הרשאת מיקום", loading: false });
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return state;
}
