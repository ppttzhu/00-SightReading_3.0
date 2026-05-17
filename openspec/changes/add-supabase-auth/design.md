## Context
The app is a React/Vite SPA deployed on Cloudflare Pages. Students currently enter `/client` without authentication, and CMS uses a client-provided shared secret for publishing and feedback management. The first auth milestone should introduce identity and role-based access without syncing student progress yet.

## Goals / Non-Goals
- Goals: optional student login, required admin access for CMS, Chinese auth UI, email/password registration, phone/password support when enabled in Supabase, nickname capture, no default anonymous Supabase sign-in.
- Non-Goals: student progress cloud sync, third-party OAuth, migrating stage content from Cloudflare KV, self-service admin registration.

## Decisions
- Use `@supabase/supabase-js` directly from the frontend with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Do not expose Supabase secret keys in the frontend. Any future elevated access must use a server-only `SUPABASE_SECRET_KEY` inside Cloudflare Functions or another trusted backend.
- Store app profile fields in a `profiles` table keyed by `auth.users.id`.
- Public registration inserts/updates a profile with `role = 'student'`.
- Admins are created or promoted manually in Supabase by updating `profiles.role = 'admin'`.
- `/client` remains public and does not call Supabase unless the user chooses login/register.
- `/cms` requires an authenticated Supabase session whose profile role is `admin`.
- Password strength rules are not duplicated in the frontend; Supabase remains the source of truth for accepted passwords.

## Data Model
```sql
create type public.app_role as enum ('student', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  role public.app_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
```

Policies should allow authenticated users to read/update their own nickname and allow admin users to read profiles needed for admin UI. Role promotion should be performed manually from Supabase SQL/Table Editor, not exposed in the public app.

Profile creation should be backed by an `auth.users` trigger that reads the submitted `nickname` from `raw_user_meta_data` and always stores `role = 'student'`. This keeps registration working even when email or phone confirmation means the user is not fully signed in immediately after sign-up.

## Supabase Configuration
- Site URL: `https://ruihan.me`
- Redirect URLs: `https://ruihan.me/**`, `http://localhost:5173/**`
- Enable Email provider.
- Enable Phone provider only if phone login should be live in this milestone.
- Disable third-party OAuth providers.

## Risks
- Supabase phone auth may require provider/SMS configuration and can create cost or deliverability considerations.
- Supabase may reject very weak passwords depending on project settings; the frontend will not add extra validation but must display backend errors clearly.
- Admin role checks happen in the client for routing in this milestone; any future admin-only database writes must also be protected by RLS or server-side checks.
