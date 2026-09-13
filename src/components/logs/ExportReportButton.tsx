"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportFlightReport } from "@/actions/pdf-export";

export function ExportReportButton() {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const result = await exportFlightReport();
      if (!result.success || !result.downloadUrl) {
        toast.error(result.error ?? "ייצוא הדוח נכשל");
        return;
      }
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown />}
      ייצוא דוח PDF
    </Button>
  );
}
