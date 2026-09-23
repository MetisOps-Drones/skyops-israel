import { NextRequest, NextResponse } from "next/server";
import { checkProximity } from "@/lib/geo/proximity-check";

export async function GET(request: NextRequest) {
  const latParam = request.nextUrl.searchParams.get("lat");
  const lonParam = request.nextUrl.searchParams.get("lon");
  if (!latParam || !lonParam) {
    return NextResponse.json({ error: "lat/lon נדרשים" }, { status: 400 });
  }
  const result = await checkProximity(Number(latParam), Number(lonParam));
  return NextResponse.json(result);
}
