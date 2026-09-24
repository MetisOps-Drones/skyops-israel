"use client";

import { useState } from "react";
import { PendingRequestsTable } from "@/components/ops/PendingRequestsTable";
import { OpsQueueMap } from "@/components/ops/OpsQueueMap";
import { RequestDetailPanel } from "@/components/ops/RequestDetailPanel";
import { CoordinationAuthoritiesCard } from "@/components/ops/CoordinationAuthoritiesCard";
import type { FlightRequestWithRelations } from "@/hooks/useFlightRequests";

export function OpsPageClient() {
  const [selected, setSelected] = useState<FlightRequestWithRelations | null>(null);

  // Selecting a request swaps the panel's own content rather than opening
  // another overlay on top of it — see RequestDetailPanel for why.
  if (selected) {
    return <RequestDetailPanel request={selected} onClose={() => setSelected(null)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">מוקד תיאום</h1>
        <p className="text-sm text-muted-foreground">בקשות NOTAM ותיאום מרחב אווירי הממתינות לטיפול</p>
      </div>
      <OpsQueueMap selectedId={null} onSelect={setSelected} />
      <PendingRequestsTable onSelect={setSelected} />
      <CoordinationAuthoritiesCard />
    </div>
  );
}
