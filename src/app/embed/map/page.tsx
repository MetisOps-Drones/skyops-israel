import { EmbedMap } from "@/components/embed/EmbedMap";

export default function EmbedMapPage({ searchParams }: { searchParams: { key?: string } }) {
  return (
    <div className="h-screen w-screen">
      <EmbedMap apiKey={searchParams.key ?? ""} />
    </div>
  );
}
