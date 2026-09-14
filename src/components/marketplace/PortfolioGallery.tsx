"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePilotPortfolioItems, usePortfolioSignedUrls } from "@/hooks/usePortfolio";
import { Loader2, PlayCircle } from "lucide-react";

function GalleryTile({ storagePath, mediaType, title, description, url }: { storagePath: string; mediaType: string; title: string; description: string | null; url: string | undefined }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="aspect-video w-full bg-muted">
        {url && mediaType === "image" && <img src={url} alt={title} className="h-full w-full object-cover" />}
        {url && mediaType === "video" && <video src={url} controls className="h-full w-full object-cover" />}
        {!url && (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            {mediaType === "video" ? <PlayCircle className="h-8 w-8" /> : <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-sm font-medium">{title}</p>
        {description && <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

/** Read-only view of a pilot's portfolio on their marketplace profile page — the "טעימה" an org needs before hiring. */
export function PortfolioGallery({ pilotId }: { pilotId: string }) {
  const { data: items = [], isLoading } = usePilotPortfolioItems(pilotId);
  const { data: urls } = usePortfolioSignedUrls(items.map((i) => i.storage_path));

  if (isLoading) return null;
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>תיק עבודות</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <GalleryTile
              key={item.id}
              storagePath={item.storage_path}
              mediaType={item.media_type}
              title={item.title}
              description={item.description}
              url={urls?.[item.storage_path]}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
