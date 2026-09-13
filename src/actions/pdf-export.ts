"use server";

import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { FlightReportDocument, type FlightReportData } from "@/lib/pdf/FlightReportDocument";

export interface ExportFlightReportResult {
  success: boolean;
  error?: string;
  downloadUrl?: string;
}

/**
 * Module C export: pulls the pilot's licenses, airframes, and flight log
 * into a single PDF, stores it in the private `reports` bucket, and hands
 * back a short-lived signed URL rather than streaming bytes through the
 * Server Action response (which Next.js does not support well for binary
 * payloads of this size).
 */
export async function exportFlightReport(
  rangeStart?: string,
  rangeEnd?: string
): Promise<ExportFlightReportResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "יש להתחבר מחדש" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { success: false, error: "שליפת פרופיל נכשלה" };
  }

  const { data: licenses } = await supabase
    .from("pilot_licenses")
    .select("*")
    .eq("user_id", user.id)
    .order("expires_at");

  const { data: drones } = await supabase.from("drones").select("*").eq("user_id", user.id).order("nickname");

  let logsQuery = supabase
    .from("flight_logs")
    .select("*, drones ( nickname )")
    .eq("user_id", user.id)
    .order("start_time", { ascending: true });

  if (rangeStart) logsQuery = logsQuery.gte("start_time", rangeStart);
  if (rangeEnd) logsQuery = logsQuery.lte("start_time", rangeEnd);

  const { data: flightLogsRaw, error: logsError } = await logsQuery;

  if (logsError) {
    return { success: false, error: `שליפת יומן הטיסות נכשלה: ${logsError.message}` };
  }

  const reportData: FlightReportData = {
    pilot: profile,
    licenses: licenses ?? [],
    drones: drones ?? [],
    flightLogs: (flightLogsRaw ?? []).map((log) => ({
      ...log,
      droneName: (log as unknown as { drones: { nickname: string } | null }).drones?.nickname ?? "—",
    })),
    generatedAt: new Date(),
    rangeLabel:
      rangeStart && rangeEnd
        ? `${new Date(rangeStart).toLocaleDateString("en-GB")} – ${new Date(rangeEnd).toLocaleDateString("en-GB")}`
        : "All time",
  };

  // @react-pdf/renderer types renderToBuffer as accepting only a literal
  // <Document> element, not a component that renders one — a known gap in
  // its type defs (FlightReportDocument does render <Document> at runtime).
  const pdfBuffer = await renderToBuffer(createElement(FlightReportDocument, { data: reportData }) as never);

  const fileName = `${user.id}/flight-report-${Date.now()}.pdf`;
  const { error: uploadError } = await supabase.storage.from("reports").upload(fileName, pdfBuffer, {
    contentType: "application/pdf",
    upsert: false,
  });

  if (uploadError) {
    return { success: false, error: `שמירת הדוח נכשלה: ${uploadError.message}` };
  }

  const { data: signedUrlData, error: signError } = await supabase.storage
    .from("reports")
    .createSignedUrl(fileName, 60 * 10);

  if (signError || !signedUrlData) {
    return { success: false, error: "יצירת קישור להורדה נכשלה" };
  }

  return { success: true, downloadUrl: signedUrlData.signedUrl };
}
