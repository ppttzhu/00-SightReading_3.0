# Change: Add Supabase Authentication

## Why
The app currently lets all students use `/client` anonymously and protects CMS writes with a shared secret. We need real user accounts with student/admin roles while preserving anonymous public access to the student practice experience.

## What Changes
- Add Supabase Auth for optional student login and required CMS admin login
- Support email + password registration/login first, with phone + password as a configured option
- Keep `/client` usable without signing in; do not create Supabase anonymous users by default
- Capture nickname during registration and store public profile data separately from auth credentials
- Assign new public registrations the `student` role only; admins are created/promoted manually in Supabase
- Add Chinese frontend auth UI and account states
- Document Supabase environment variables, redirect URLs, and profile/role schema

## Impact
- Affected specs: `auth` (new)
- Affected code: `package.json`, `.env.example`, `README.md`, `src/App.tsx`, `src/main.tsx`, `src/pages/client/ClientLayout.tsx`, `src/pages/cms/CMSLayout.tsx`, new `src/core/auth/*`, new auth UI components
- External services: Supabase Auth and Supabase Postgres
