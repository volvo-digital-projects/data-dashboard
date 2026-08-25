-- Volvo Data Dashboard manager-only login statistics.
-- Login identifiers are salted SHA-256 hashes before they reach Supabase.

create table if not exists public.volvo_dashboard_login_visitors (
  visitor_hash text primary key
    check (visitor_hash ~ '^[0-9a-f]{64}$'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists volvo_dashboard_login_visitors_last_seen_idx
  on public.volvo_dashboard_login_visitors (last_seen_at desc);

alter table public.volvo_dashboard_login_visitors enable row level security;
revoke all on table public.volvo_dashboard_login_visitors from anon, authenticated;

create or replace function public.get_volvo_dashboard_visit_stats()
returns table(total_visitors bigint, today_visitors bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint as total_visitors,
    count(*) filter (
      where timezone('Asia/Seoul', last_seen_at)::date =
            timezone('Asia/Seoul', now())::date
    )::bigint as today_visitors
  from public.volvo_dashboard_login_visitors;
$$;

create or replace function public.record_volvo_dashboard_visit(
  p_visitor_hash text
)
returns table(total_visitors bigint, today_visitors bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor_hash is null or p_visitor_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid visitor hash';
  end if;

  insert into public.volvo_dashboard_login_visitors (
    visitor_hash,
    first_seen_at,
    last_seen_at
  )
  values (p_visitor_hash, now(), now())
  on conflict (visitor_hash) do update
    set last_seen_at = excluded.last_seen_at;

  return query
  select
    count(*)::bigint as total_visitors,
    count(*) filter (
      where timezone('Asia/Seoul', last_seen_at)::date =
            timezone('Asia/Seoul', now())::date
    )::bigint as today_visitors
  from public.volvo_dashboard_login_visitors;
end;
$$;

revoke all on function public.get_volvo_dashboard_visit_stats() from public;
revoke all on function public.record_volvo_dashboard_visit(text) from public;
grant execute on function public.get_volvo_dashboard_visit_stats() to anon, authenticated;
grant execute on function public.record_volvo_dashboard_visit(text) to anon, authenticated;
