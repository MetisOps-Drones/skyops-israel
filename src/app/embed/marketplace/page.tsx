import { EmbedMarketplace } from "@/components/embed/EmbedMarketplace";

export default function EmbedMarketplacePage({ searchParams }: { searchParams: { key?: string } }) {
  return (
    <div className="h-screen w-screen">
      <EmbedMarketplace apiKey={searchParams.key ?? ""} />
    </div>
  );
}
