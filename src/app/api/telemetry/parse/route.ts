import { NextResponse } from "next/server";
import { parseDjiTelemetryCsv, summarizeTelemetryForStorage } from "@/lib/telemetry/parseDji";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file provided" }, { status: 400 });
  }

  if (!/\.(csv|txt)$/i.test(file.name)) {
    return NextResponse.json({ error: "expected a .csv or .txt DJI telemetry export" }, { status: 400 });
  }

  try {
    const text = await file.text();
    const parsed = parseDjiTelemetryCsv(text);
    const summary = summarizeTelemetryForStorage(parsed);

    return NextResponse.json({
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      durationMinutes: parsed.durationMinutes,
      maxAltitudeM: parsed.maxAltitudeM,
      maxDistanceM: parsed.maxDistanceM,
      minBatteryPercent: parsed.minBatteryPercent,
      sampleCount: parsed.sampleCount,
      telemetryData: summary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed to parse telemetry file" },
      { status: 422 }
    );
  }
}
