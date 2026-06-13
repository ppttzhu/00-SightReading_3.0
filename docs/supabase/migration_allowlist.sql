-- Migration: Create public.allowlist table
-- Purpose: Student registration allowlist - teachers manage approved nicknames,
--          students must provide a valid nickname to register.

create table public.allowlist (
  id uuid primary key default gen_random_uuid(),
  nickname text unique not null,
  profile_id uuid references public.profiles(id) on delete set null,
  email text,
  created_at timestamptz not null default now(),
  registered_at timestamptz
);

alter table public.allowlist enable row level security;

-- Admin: full CRUD
create policy "Admins can manage allowlist"
on public.allowlist
for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

-- Student: read-only (for registration validation)
create policy "Students can read allowlist"
on public.allowlist
for select
to authenticated
using (public.current_user_role() = 'student');

-- Anonymous: read-only (needed for pre-signup allowlist validation)
create policy "Anon can read allowlist for registration"
on public.allowlist
for select
to anon
using (true);

-- Authenticated users can claim an unclaimed allowlist entry (set profile_id on signup)
create policy "Users can claim allowlist entry on registration"
on public.allowlist
for update
to authenticated
using (profile_id is null)
with check (profile_id = auth.uid());
