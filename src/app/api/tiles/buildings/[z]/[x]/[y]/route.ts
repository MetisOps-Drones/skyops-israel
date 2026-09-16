import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Mapbox Vector Tile endpoint for the buildings layer (~3.5M rows — far too
 * many to ship as GeoJSON, see migration 0067). PostGIS does the clipping
 * and simplification per tile via buildings_mvt(); PostgREST returns the
 * bytea result raw when asked for `application/octet-stream` instead of its
 * usual base64-in-JSON encoding, so this route just passes that through.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { z: string; x: string; y: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });
  }

  const z = Number(params.z);
  const x = Number(params.x);
  const y = Number(params.y);
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
    return NextResponse.json({ error: "פרמטרי אריח לא תקינים" }, { status: 400 });
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/buildings_mvt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/octet-stream",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ z, x, y }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "שליפת אריח נכשלה" }, { status: 502 });
  }

  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/x-protobuf",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
