import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { extractPhrases } from "@/lib/analytics/chatPhrases";

export const dynamic = "force-dynamic";

/**
 * Daily cron (see vercel.json) that rebuilds `chat_phrase_stats` from every
 * booking_messages row. A full recompute rather than an incremental one —
 * simpler and correct (no risk of double-counting a conversation across
 * runs), and cheap at this app's chat volume. See src/lib/analytics/chatPhrases
 * for the n-gram extraction itself.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: messages, error } = await supabase
    .from("booking_messages")
    .select("booking_id, body, created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats = new Map<
    string,
    { phrase: string; length: number; occurrenceCount: number; conversationIds: Set<string>; first: string; last: string }
  >();

  for (const message of messages ?? []) {
    for (const { phrase, length } of extractPhrases(message.body)) {
      const key = `${length}:${phrase}`;
      const existing = stats.get(key);
      if (existing) {
        existing.occurrenceCount += 1;
        existing.conversationIds.add(message.booking_id);
        if (message.created_at < existing.first) existing.first = message.created_at;
        if (message.created_at > existing.last) existing.last = message.created_at;
      } else {
        stats.set(key, {
          phrase,
          length,
          occurrenceCount: 1,
          conversationIds: new Set([message.booking_id]),
          first: message.created_at,
          last: message.created_at,
        });
      }
    }
  }

  const rows = Array.from(stats.values())
    .filter((s) => s.conversationIds.size >= 2)
    .map((s) => ({
      phrase: s.phrase,
      phrase_length: s.length,
      occurrence_count: s.occurrenceCount,
      conversation_count: s.conversationIds.size,
      first_seen_at: s.first,
      last_seen_at: s.last,
    }));

  await supabase.from("chat_phrase_stats").delete().neq("phrase", "");

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("chat_phrase_stats").insert(rows);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, messagesScanned: messages?.length ?? 0, phrasesTracked: rows.length });
}
