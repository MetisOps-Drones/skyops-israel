"use client";

import { useState } from "react";
import { PendingRequestsTable } from "@/components/ops/PendingRequestsTable";
import { RequestDetailDrawer } from "@/components/ops/RequestDetailDrawer";
import type { FlightRequestWithRelations } from "@/hooks/useFlightRequests";

export function OpsPageClient() {
  const [selected, setSelected] = useState<FlightRequestWithRelations | null>(null);

  return (
    <>
      <PendingRequestsTable onSelect={setSelected} />
      <RequestDetailDrawer request={selected} onClose={() => setSelected(null)} />
    </>
  );
}
