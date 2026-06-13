# Student Allowlist Registration — Full Spec

---

# Requirements Document

## Introduction

This feature introduces a student registration allowlist system. Teachers manage a list of approved nicknames via the CMS. Students must provide a nickname from this allowlist during registration. The system prevents duplicate registrations for the same nickname and rejects nicknames not on the list.

## Glossary

- **System**: The SightReading web application (frontend + Supabase backend)
- **CMS**: The teacher-facing content management interface at /cms
- **Allowlist**: A database table (`public.allowlist`) storing approved nicknames that students may use during registration
- **Teacher**: An authenticated user with the `admin` role who manages the allowlist via the CMS
- **Student**: A user who registers with a nickname from the allowlist
- **Registration_Flow**: The signUp process in AuthProvider.tsx that creates a Supabase auth user and a profile record
- **Allowlist_Page**: The CMS page at /cms/allowlist for managing the allowlist

## Requirements

### Requirement 1: Allowlist Database Table

**User Story:** As a developer, I want a dedicated allowlist table in the database, so that approved nicknames and their registration status can be tracked.

#### Acceptance Criteria

1. THE System SHALL provide a `public.allowlist` table with columns: `id` (primary key, uuid), `nickname` (text, unique, not null), `profile_id` (uuid, foreign key to `public.profiles.id`, nullable), and `created_at` (timestamptz, default now()).
2. THE System SHALL enforce a unique constraint on the `nickname` column of the allowlist table.
3. THE System SHALL set `profile_id` to null for nicknames that have not yet been registered.
4. WHEN a student completes registration with an allowlist nickname, THE System SHALL store the student's profile ID in the `profile_id` column of the corresponding allowlist row.

### Requirement 2: CMS Navigation Entry

**User Story:** As a teacher, I want a "学生注册" navigation entry in the CMS sidebar, so that I can access the allowlist management page.

#### Acceptance Criteria

1. THE System SHALL display a navigation entry labeled "学生注册" in the CMS sidebar NAV_ITEMS array.
2. THE System SHALL route the "学生注册" navigation entry to the path `/cms/allowlist`.
3. WHEN the teacher navigates to `/cms/allowlist`, THE System SHALL render the Allowlist_Page.

### Requirement 3: Single-Entry CRUD for Allowlist

**User Story:** As a teacher, I want to add, view, and delete individual nicknames on the allowlist, so that I can manage which students are permitted to register.

#### Acceptance Criteria

1. THE Allowlist_Page SHALL display a list of all nicknames in the allowlist table.
2. THE Allowlist_Page SHALL display the registration status for each nickname: the associated student email address and registration timestamp if `profile_id` is present, or an "未注册" indicator if `profile_id` is null.
3. WHEN the teacher submits a new nickname via the single-entry input, THE System SHALL insert the nickname into the allowlist table.
4. IF the teacher submits a nickname that already exists in the allowlist, THEN THE System SHALL display an error message indicating the nickname is duplicated.
5. WHEN the teacher deletes a nickname that has no associated `profile_id`, THE System SHALL remove the nickname from the allowlist table.
6. IF the teacher attempts to delete a nickname that has an associated `profile_id`, THEN THE System SHALL display a confirmation warning before proceeding with deletion.

### Requirement 4: Batch Import for Allowlist

**User Story:** As a teacher, I want to paste multiple nicknames at once (separated by newlines), so that I can efficiently populate the allowlist.

#### Acceptance Criteria

1. THE Allowlist_Page SHALL provide a batch import textarea that accepts multiple nicknames separated by newlines.
2. WHEN the teacher submits a batch import, THE System SHALL parse the input by splitting on newline characters and trim whitespace from each entry.
3. WHEN the teacher submits a batch import, THE System SHALL insert all valid, non-duplicate nicknames into the allowlist table.
4. IF any nicknames in a batch import already exist in the allowlist, THEN THE System SHALL skip the duplicates and display a summary indicating how many were added and how many were skipped.
5. THE System SHALL ignore empty entries resulting from consecutive delimiters or leading/trailing whitespace in batch import input.

### Requirement 5: Registration Allowlist Validation

**User Story:** As a student, I want clear feedback during registration if my nickname is not on the allowlist or already taken, so that I understand why registration failed.

#### Acceptance Criteria

1. WHEN a student submits a registration form, THE Registration_Flow SHALL query the allowlist table to check whether the provided nickname exists.
2. IF the provided nickname does not exist in the allowlist table, THEN THE Registration_Flow SHALL reject the registration and display the error message "您还不是学员，请联系睿涵老师。".
3. IF the provided nickname exists in the allowlist but already has a non-null `profile_id`, THEN THE Registration_Flow SHALL reject the registration and display the error message "该昵称已被注册，请联系睿涵老师。".
4. THE Registration_Flow SHALL perform the allowlist validation before calling `supabase.auth.signUp`, at the frontend level.
5. WHEN the allowlist validation passes, THE Registration_Flow SHALL proceed with the existing signUp logic and subsequently update the allowlist row's `profile_id` with the new user's profile ID.

### Requirement 6: Row-Level Security for Allowlist

**User Story:** As a developer, I want proper access controls on the allowlist table, so that only authorized users can read or modify the data.

#### Acceptance Criteria

1. THE System SHALL enable row-level security on the `public.allowlist` table.
2. THE System SHALL allow authenticated users with the `admin` role to perform select, insert, update, and delete operations on the allowlist table.
3. THE System SHALL allow authenticated users with the `student` role to perform select operations on the allowlist table.
4. THE System SHALL deny unauthenticated users all access to the allowlist table.

---

# Design Document

## Overview

This feature adds a student registration allowlist system. Teachers manage approved nicknames via the CMS; students must provide a nickname from the allowlist during registration. The system prevents duplicate registrations and rejects unknown nicknames.

## Architecture

This feature adds a student registration allowlist system with two main surfaces:

1. **CMS Allowlist Page** — Teacher-facing CRUD interface for managing approved nicknames
2. **Registration Flow Enhancement** — Student-facing validation that checks nicknames against the allowlist before allowing sign-up

The architecture follows the existing project patterns: direct Supabase queries with `useState`/`useEffect` in CMS pages, and validation logic in `AuthProvider.tsx`.

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend                            │
│                                                          │
│  ┌──────────────────┐     ┌───────────────────────────┐ │
│  │ CMS AllowlistPage│     │  AuthProvider (signUp)     │ │
│  │  - Add/Delete    │     │  - validateAllowlist()     │ │
│  │  - Batch Import  │     │  - linkProfileToAllowlist()│ │
│  └────────┬─────────┘     └─────────────┬─────────────┘ │
│           │                              │               │
└───────────┼──────────────────────────────┼───────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL)                        │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  public.allowlist                                │    │
│  │  - id (uuid, PK)                                │    │
│  │  - nickname (text, unique, not null)             │    │
│  │  - profile_id (uuid, FK → profiles.id, nullable)│    │
│  │  - created_at (timestamptz)                      │    │
│  │  RLS: admin=full, student=select, anon=deny      │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Database Layer: `public.allowlist` Table

**Migration SQL:**

```sql
create table public.allowlist (
  id uuid primary key default gen_random_uuid(),
  nickname text unique not null,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
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
```

### 2. CMS Navigation Entry

Add to the `NAV_ITEMS` array in `CMSLayout.tsx`:

```typescript
const NAV_ITEMS = [
  { to: '/cms', label: '总览', end: true },
  { to: '/cms/stats', label: '学生统计', end: false },
  { to: '/cms/allowlist', label: '学生注册', end: false },  // NEW
  { to: '/cms/parser', label: '文件解析器', end: false },
  // ... existing items
] as const;
```

### 3. CMS Route Registration

Add to `App.tsx` under the CMS route group:

```typescript
import AllowlistPage from './pages/cms/AllowlistPage';

// Inside <Route path="/cms" ...>
<Route path="allowlist" element={<AllowlistPage />} />
```

### 4. AllowlistPage Component

**File:** `src/pages/cms/AllowlistPage.tsx`

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '../../core/auth/supabaseClient';

interface AllowlistEntry {
  id: string;
  nickname: string;
  profile_id: string | null;
  created_at: string;
  profile_email?: string;
}

export default function AllowlistPage() {
  const [entries, setEntries] = useState<AllowlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNickname, setNewNickname] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [error, setError] = useState('');
  const [batchResult, setBatchResult] = useState<{ added: number; skipped: number } | null>(null);

  useEffect(() => { fetchEntries(); }, []);

  async function fetchEntries() { /* ... */ }
  async function handleAddSingle() { /* ... */ }
  async function handleBatchImport() { /* ... */ }
  async function handleDelete(entry: AllowlistEntry) { /* ... */ }
}
```

### 5. Batch Import Parsing Utility

**File:** `src/pages/cms/utils/parseBatchNicknames.ts`

```typescript
export function parseBatchNicknames(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}
```

### 6. Allowlist Validation in Registration Flow

**File:** `src/core/auth/AuthProvider.tsx` (modified `signUp`)

```typescript
async function validateAllowlist(nickname: string): Promise<void> {
  if (!supabase) throw new Error('Supabase 尚未配置。');
  
  const { data, error } = await supabase
    .from('allowlist')
    .select('id, nickname, profile_id')
    .eq('nickname', nickname)
    .maybeSingle();

  if (error) throw new Error('允许列表查询失败，请稍后再试。');
  if (!data) throw new Error('您还不是学员，请联系睿涵老师。');
  if (data.profile_id) throw new Error('该昵称已被注册，请联系睿涵老师。');
}

async function linkProfileToAllowlist(profileId: string, nickname: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('allowlist')
    .update({ profile_id: profileId })
    .eq('nickname', nickname);
}
```

Modified `signUp` flow:

```typescript
const signUp = useCallback(async ({ email, password, nickname }) => {
  if (!supabase) throw new Error('Supabase 尚未配置，请先设置环境变量。');
  const trimmedNickname = nickname.trim();

  // Step 1: Validate against allowlist BEFORE auth
  await validateAllowlist(trimmedNickname);

  // Step 2: Proceed with existing signUp logic
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { nickname: trimmedNickname, role: 'student' } },
  });
  if (error) throw new Error(getChineseAuthError(error.message));

  // Step 3: Upsert profile and link to allowlist
  if (data.user && data.session) {
    await upsertStudentProfile(data.user.id, trimmedNickname);
    await linkProfileToAllowlist(data.user.id, trimmedNickname);
    setProfile(await fetchProfile(data.user.id));
  }

  return { needsConfirmation: Boolean(data.user && !data.session) };
}, []);
```

## Data Models

### AllowlistEntry Type

```typescript
interface AllowlistEntry {
  id: string;
  nickname: string;
  profile_id: string | null;
  created_at: string;
}
```

### Batch Import Result

```typescript
interface BatchImportResult {
  added: number;
  skipped: number;
}
```

### Allowlist Validation Outcomes

```typescript
type AllowlistStatus = 
  | { valid: true; entryId: string }
  | { valid: false; reason: 'not_found' | 'already_registered' };
```

## Data Model — Supabase Queries

### Fetch Allowlist with Profiles

```typescript
const { data } = await supabase
  .from('allowlist')
  .select(`
    id, nickname, profile_id, created_at,
    profiles!allowlist_profile_id_fkey ( id, nickname )
  `)
  .order('created_at', { ascending: false });
```

### Batch Insert Strategy

```typescript
const { data, error } = await supabase
  .from('allowlist')
  .upsert(
    nicknames.map(nickname => ({ nickname })),
    { onConflict: 'nickname', ignoreDuplicates: true }
  )
  .select();

const added = data?.length ?? 0;
const skipped = nicknames.length - added;
```

## Error Handling

| Scenario | Error Message | Handling |
|----------|---------------|----------|
| Nickname not in allowlist | "您还不是学员，请联系睿涵老师。" | Reject registration before auth call |
| Nickname already registered | "该昵称已被注册，请联系睿涵老师。" | Reject registration before auth call |
| Duplicate single add | "该昵称已存在于名单中。" | Show inline error on CMS page |
| Batch duplicates | "已添加 N 个，跳过 M 个重复昵称。" | Show info banner on CMS page |
| Network/Supabase error | "操作失败，请稍后再试。" | Generic error with retry option |
| Delete registered entry | Confirmation dialog before proceeding | Show warning with confirm/cancel |

## Correctness Properties

### Property 1: Duplicate nickname rejection
For any nickname that already exists in the allowlist, attempting to add it again SHALL result in a rejection or skip.

### Property 2: New nickname initial state
For any valid non-empty nickname not already in the allowlist, inserting it SHALL produce an entry with null `profile_id`.

### Property 3: Allowlist display completeness
For any set of allowlist entries, the rendered page SHALL display every nickname with appropriate status.

### Property 4: Unregistered entry deletion
For any entry where `profile_id` is null, delete SHALL remove it permanently.

### Property 5: Batch input parsing
For any input string, the parser SHALL produce trimmed non-empty strings with no leading/trailing whitespace.

### Property 6: Batch import deduplication correctness
For N new + M existing nicknames, batch import SHALL insert exactly N and report M skipped.

### Property 7: Allowlist registration validation
For any nickname: not found → reject; found with profile_id → reject; found without → pass.

### Property 8: Registration links profile to allowlist
After successful registration, the allowlist entry's `profile_id` SHALL equal the new user's profile ID.

---

# Implementation Plan

## Tasks

- [x] 1. Database setup and migration
  - [x] 1.1 Create the `public.allowlist` table migration SQL

- [x] 2. CMS navigation and routing
  - [x] 2.1 Add "学生注册" navigation entry to CMSLayout
  - [x] 2.2 Register the AllowlistPage route in App.tsx

- [x] 3. Batch parsing utility
  - [x] 3.1 Implement `parseBatchNicknames` utility function
  - [ ]* 3.2 Write property test for batch parsing (Property 5)
  - [ ]* 3.3 Write unit tests for `parseBatchNicknames`

- [x] 4. CMS AllowlistPage component
  - [x] 4.1 Create `AllowlistPage` component with data fetching
  - [x] 4.2 Implement single-entry add functionality
  - [x] 4.3 Implement batch import functionality
  - [x] 4.4 Implement delete functionality with confirmation

- [x] 5. Checkpoint - Verify CMS allowlist page

- [x] 6. Registration flow allowlist validation
  - [x] 6.1 Implement `validateAllowlist` function in AuthProvider
  - [x] 6.2 Implement `linkProfileToAllowlist` function in AuthProvider
  - [x] 6.3 Integrate allowlist validation into the `signUp` flow
  - [ ]* 6.4 Write unit tests for `validateAllowlist`
  - [ ]* 6.5 Write property test for allowlist validation (Property 7)

- [x] 7. Final checkpoint - All tests pass

_Tasks marked with `*` are optional._
