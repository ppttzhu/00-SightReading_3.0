## 1. Supabase Setup

- [x] 1.1 Install `@supabase/supabase-js`
- [x] 1.2 Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to `.env.example`
- [x] 1.3 Add Supabase SQL setup docs/migration for `profiles`, `app_role`, and RLS
- [x] 1.4 Document Supabase Auth provider and redirect URL settings in `README.md`

## 2. Auth Core

- [x] 2.1 Create `src/core/auth/supabaseClient.ts`
- [x] 2.2 Create auth context/store for session, profile, loading, sign in, sign up, sign out, and refresh profile
- [x] 2.3 Ensure app startup does not perform Supabase anonymous sign-in
- [x] 2.4 Persist and restore Supabase sessions through the official client

## 3. Frontend UI

- [x] 3.1 Build Chinese login/register UI supporting email or phone identifier, nickname on registration, and password
- [x] 3.2 Add account controls to student layout while keeping `/client` usable while logged out
- [x] 3.3 Add Chinese logged-out, logged-in, loading, and error states
- [x] 3.4 Do not add frontend password strength validation; display Supabase errors when returned

## 4. Role-Based CMS Access

- [x] 4.1 Create route guard for `/cms` that requires authenticated profile role `admin`
- [x] 4.2 Show Chinese access-denied/login-required states for non-admin and logged-out users
- [x] 4.3 Keep public registration role fixed to `student`; do not expose admin self-selection

## 5. Verification

- [x] 5.1 Run TypeScript build
- [ ] 5.2 Run existing tests
- [ ] 5.3 Manually verify logged-out `/client`, student login/register, student denied `/cms`, and admin allowed `/cms`

Verification note: `openspec validate add-supabase-auth --strict` and `npx tsc -b` pass. `npm run build`, `npm run test`, and `npm run lint` are blocked in this shell by Node 18.3.0; the project requires Node 20.19+ or 22.12+.
