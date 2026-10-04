import { NextResponse } from "next/server";
import { fetchLiveNotams } from "@/lib/notams/live-feed";

/**
 * Thin proxy so the client never talks to raw.githubusercontent.com
 * directly — keeps the third-party URL and fetch-cache behavior in one
 * place (src/lib/notams/live-feed.ts), reused identically by the
 * authoritative server-side check in actions/flight-requests.ts.
 */
export async function GET() {
  try {
    const notams = await fetchLiveNotams();
    return NextResponse.json({ notams });
  } catch (err) {
    return NextResponse.json(
      { notams: [], error: err instanceof Error ? err.message : "שגיאה בטעינת נוטאמים" },
      { status: 502 }
    );
  }
}
