-- Leaderboards: stage completions + best scores + ranking queries
-- Run in Supabase SQL Editor after docs/supabase/auth.sql

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.stage_completion_events (
  id bigint generated always as identity primary key,
  player_key text not null,
  user_id uuid references public.profiles(id) on delete set null,
  guest_id text,
  display_name text not null,
  module_id text not null,
  stage_id text not null,
  time_ms integer not null check (time_ms >= 0),
  perfect boolean not null default true,
  completed_at timestamptz not null default now(),
  constraint stage_completion_events_identity check (user_id is not null or guest_id is not null)
);

comment on table public.stage_completion_events is '每次闯关通关记录（用于能力榜/努力榜统计）';

create index stage_completion_events_completed_at_idx
  on public.stage_completion_events (completed_at desc);

create index stage_completion_events_module_completed_idx
  on public.stage_completion_events (module_id, completed_at desc);

create index stage_completion_events_stage_idx
  on public.stage_completion_events (stage_id, completed_at desc);

create table public.stage_best_scores (
  player_key text not null,
  user_id uuid references public.profiles(id) on delete set null,
  guest_id text,
  stage_id text not null,
  module_id text not null,
  display_name text not null,
  time_ms integer not null check (time_ms >= 0),
  completed_at timestamptz not null default now(),
  primary key (player_key, stage_id)
);

comment on table public.stage_best_scores is '每关每位玩家的最快通关用时';

create index stage_best_scores_stage_time_idx
  on public.stage_best_scores (stage_id, time_ms asc);

-- ---------------------------------------------------------------------------
-- Trigger: maintain best score per player per stage
-- ---------------------------------------------------------------------------

create or replace function public.upsert_stage_best_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.perfect then
    return new;
  end if;

  insert into public.stage_best_scores (
    player_key, user_id, guest_id, stage_id, module_id, display_name, time_ms, completed_at
  )
  values (
    new.player_key, new.user_id, new.guest_id, new.stage_id, new.module_id,
    new.display_name, new.time_ms, new.completed_at
  )
  on conflict (player_key, stage_id) do update
  set
    time_ms = least(public.stage_best_scores.time_ms, excluded.time_ms),
    completed_at = case
      when excluded.time_ms < public.stage_best_scores.time_ms then excluded.completed_at
      else public.stage_best_scores.completed_at
    end,
    display_name = excluded.display_name,
    module_id = excluded.module_id;

  return new;
end;
$$;

create trigger stage_completion_events_upsert_best
after insert on public.stage_completion_events
for each row
execute function public.upsert_stage_best_score();

-- ---------------------------------------------------------------------------
-- Period helper (week starts Monday, aligned with client)
-- ---------------------------------------------------------------------------

create or replace function public.ranking_period_start(p_period text)
returns timestamptz
language sql
immutable
as $$
  select case p_period
    when 'month' then date_trunc('month', now() at time zone 'utc')
    when 'year' then date_trunc('year', now() at time zone 'utc')
    else (
      date_trunc('day', now() at time zone 'utc')
      - ((extract(dow from now() at time zone 'utc')::int + 6) % 7) * interval '1 day'
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: per-stage leaderboard (fastest time)
-- ---------------------------------------------------------------------------

create or replace function public.get_stage_leaderboard(p_stage_id text)
returns table (
  id text,
  display_name text,
  time_ms integer,
  completed_at timestamptz,
  rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.player_key as id,
    s.display_name,
    s.time_ms,
    s.completed_at,
    row_number() over (order by s.time_ms asc, s.completed_at asc) as rank
  from public.stage_best_scores s
  where s.stage_id = p_stage_id
  order by s.time_ms asc, s.completed_at asc
  limit 50;
$$;

-- ---------------------------------------------------------------------------
-- RPC: global ability / effort rankings
-- ---------------------------------------------------------------------------

create or replace function public.get_global_rankings(
  p_type text,
  p_period text default 'week',
  p_module_id text default null
)
returns table (
  id text,
  display_name text,
  value bigint,
  rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select *
    from public.stage_completion_events e
    where e.perfect = true
      and e.completed_at >= public.ranking_period_start(p_period)
      and (p_module_id is null or p_module_id = '' or e.module_id = p_module_id)
  ),
  aggregated as (
    select
      f.player_key,
      max(f.display_name) as display_name,
      min(f.time_ms)::bigint as best_time_ms,
      count(*)::bigint as completion_count
    from filtered f
    group by f.player_key
  ),
  ranked as (
    select
      a.player_key as id,
      a.display_name,
      case when p_type = 'effort' then a.completion_count else a.best_time_ms end as value,
      row_number() over (
        order by
          case when p_type = 'ability' then a.best_time_ms end asc nulls last,
          case when p_type = 'effort' then a.completion_count end desc nulls last,
          a.player_key asc
      ) as rank
    from aggregated a
  )
  select r.id, r.display_name, r.value, r.rank
  from ranked r
  order by r.rank
  limit 100;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.stage_completion_events enable row level security;
alter table public.stage_best_scores enable row level security;

create policy "Public read stage completions"
on public.stage_completion_events
for select
to anon, authenticated
using (true);

create policy "Public read stage best scores"
on public.stage_best_scores
for select
to anon, authenticated
using (true);

create policy "Authenticated insert own completion"
on public.stage_completion_events
for insert
to authenticated
with check (auth.uid() = user_id and guest_id is null);

create policy "Anonymous insert guest completion"
on public.stage_completion_events
for insert
to anon
with check (user_id is null and guest_id is not null);

-- Best scores are written only by trigger (security definer)

grant select on public.stage_completion_events to anon, authenticated;
grant select on public.stage_best_scores to anon, authenticated;
grant insert on public.stage_completion_events to anon, authenticated;

grant execute on function public.get_stage_leaderboard(text) to anon, authenticated;
grant execute on function public.get_global_rankings(text, text, text) to anon, authenticated;
grant execute on function public.ranking_period_start(text) to anon, authenticated;
