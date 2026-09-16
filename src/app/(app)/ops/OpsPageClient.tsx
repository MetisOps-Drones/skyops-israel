"use client";

import { useState } from "react";
import { PendingRequestsTable } from "@/components/ops/PendingRequestsTable";
import { RequestDetailDrawer } from "@/components/ops/RequestDetailDrawer";
import { CoordinationAuthoritiesCard } from "@/components/ops/CoordinationAuthoritiesCard";
import type { FlightRequestWithRelations } from "@/hooks/useFlightRequests";

export function OpsPageClient() {
  const [selected, setSelected] = useState<FlightRequestWithRelations | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <PendingRequestsTable onSelect={setSelected} />
      <CoordinationAuthoritiesCard />
      <RequestDetailDrawer request={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
