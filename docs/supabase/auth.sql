create type public.app_role as enum ('student', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  role public.app_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nickname', ''), '新同学'),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.current_user_role()
returns public.app_role
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can insert own student profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id and role = 'student');

create policy "Users can update own nickname"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id and role = public.current_user_role());

create policy "Admins can read profiles"
on public.profiles
for select
to authenticated
using (public.current_user_role() = 'admin');

-- To promote an existing user manually:
-- update public.profiles set role = 'admin' where id = '<auth-user-uuid>';
