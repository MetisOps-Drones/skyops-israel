import { MapPageClient } from "./MapPageClient";

export default function MapPage() {
  return (
    <div className="h-[calc(100vh-3.5rem-4rem)] w-full md:h-[calc(100vh-3.5rem)]">
      <MapPageClient />
    </div>
  );
}
