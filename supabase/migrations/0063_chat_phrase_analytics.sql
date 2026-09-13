-- Recurring-problem detection across booking chats — deliberately NOT an
-- LLM call per message. A daily job (src/app/api/cron/analyze-chat-phrases)
-- tokenizes new booking_messages, extracts 3-5 word n-grams, and upserts
-- counts here; the admin screen surfaces phrases that repeat across many
-- distinct bookings (e.g. "זה יקר לי מדי") as a recurring-issue signal.
-- Written only by the cron job's service-role client (bypasses RLS, same as
-- the license-expiry sweep) — the policy below is just for the admin read.

create table chat_phrase_stats (
  id uuid primary key default uuid_generate_v4(),
  phrase text not null,
  phrase_length smallint not null,
  occurrence_count integer not null default 0,
  conversation_count integer not null default 0,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  unique (phrase, phrase_length)
);

alter table chat_phrase_stats enable row level security;

create policy "Dispatcher admins read chat phrase stats"
  on chat_phrase_stats for select
  using (is_dispatcher_admin());

create function admin_recurring_chat_phrases(min_conversations int default 3, limit_count int default 50)
returns table (
  phrase text,
  phrase_length smallint,
  occurrence_count integer,
  conversation_count integer,
  last_seen_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not is_dispatcher_admin() then
    raise exception 'Admins only';
  end if;

  return query
    select cps.phrase, cps.phrase_length, cps.occurrence_count, cps.conversation_count, cps.last_seen_at
    from chat_phrase_stats cps
    where cps.conversation_count >= min_conversations
    order by cps.conversation_count desc, cps.occurrence_count desc
    limit limit_count;
end;
$$;

create function admin_marketplace_bookings_overview()
returns table (status booking_status, booking_count bigint)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not is_dispatcher_admin() then
    raise exception 'Admins only';
  end if;

  return query
    select b.status, count(*) from marketplace_bookings b group by b.status;
end;
$$;
