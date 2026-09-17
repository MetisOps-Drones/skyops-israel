import { MapPageClient } from "./MapPageClient";

export default function MapPage() {
  // AppShell renders the map full-bleed (no TopNav/MobileBottomNav around
  // it), so this no longer needs to subtract their heights like every
  // other page's content area does — h-full alone fills the viewport.
  return (
    <div className="h-full w-full">
      <MapPageClient />
    </div>
  );
}
