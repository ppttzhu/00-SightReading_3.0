# SightReading 2.0 — 认谱练习器

A music sight-reading practice app with a teacher CMS and student quiz interface.

## Features

- **4 Quiz Modules**: Notes (单音), Symbols (符号), Theory (乐理), Patterns (音型)
- **MusicXML Parser**: Upload `.musicxml` files to auto-extract questions across 4 dimensions
- **Smart Difficulty**: Auto-grades questions L1–L10 based on pitch range, accidentals, symbol rarity
- **Auto Stage Generation**: Groups questions into stages (5 per stage) by type and difficulty
- **Custom Stages**: Teachers can manually curate stage content
- **Cloud Sync**: Teacher publishes questions via Cloudflare KV; students see them instantly on any device
- **Progress Tracking**: Student progress persisted locally with sequential stage unlocking

## Tech Stack

- React 19 + TypeScript + Vite 8
- VexFlow 5 (music notation rendering)
- Tone.js (audio)
- Zustand (state management with localStorage persistence)
- React Router 7
- Lucide React (icons)
- Cloudflare Pages + KV (hosting & cloud storage)
- Supabase Auth + Postgres profiles (login and roles)

## Requirements

- **Node.js 20.19+ or 22.12+** (Vite 8 requirement)
- If using nvm: `nvm use 22`
- If using mise: `mise use node@22`

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure cloud sync (Cloudflare KV) and login (Supabase)

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
VITE_CMS_SECRET=your_cms_secret
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Get Supabase values from **Supabase Dashboard → Project Settings → API Keys**:

- Project URL → `VITE_SUPABASE_URL`
- Publishable key (`sb_publishable_...`) → `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not put a Supabase secret key in any `VITE_` variable. Secret keys are server-only; add `SUPABASE_SECRET_KEY` as a Cloudflare Pages secret later only if a backend function needs elevated access.

#### Cloudflare Setup:

1. Create a KV namespace: `npx wrangler kv namespace create STAGES_KV`
2. Add the namespace ID to `wrangler.toml`
3. Set `CMS_SECRET` via `npx wrangler pages secret put CMS_SECRET`
4. Set `VITE_CMS_SECRET` in your local `.env` to the same value (for teacher CMS auth)

#### Supabase Setup:

1. Create a Supabase project
2. In **Authentication → URL Configuration**, set Site URL to `https://ruihan.me`
3. Add Redirect URLs: `https://ruihan.me/**` and `http://localhost:5173/**`
4. In **Authentication → Providers**, enable Email. Enable Phone only if phone login should be live.
5. Keep third-party OAuth providers such as Google and Apple disabled.
6. Run the SQL in `docs/supabase/auth.sql` from the Supabase SQL Editor.
7. Public registration always creates `student` users. To create an admin, manually update a profile:

```sql
update public.profiles set role = 'admin' where id = '<auth-user-uuid>';
```

Find the user UUID in **Authentication → Users** in the Supabase dashboard.

Students can use `/client` without logging in. The app does not create Supabase anonymous users by default.

**Important**: `VITE_SUPABASE_URL` must not have a trailing slash. It should look like `https://yourproject.supabase.co` — not `https://yourproject.supabase.co/`.

### 3. Run the dev server

```bash
npm run dev
```

### 4. Preview with Cloudflare Functions locally

```bash
npm run build
npm run preview
```

This runs `wrangler pages dev dist` which serves the built app with the API function locally.

## Deployment

This project is deployed on **Cloudflare Pages** with Git integration:

- Push to `main` → production deployment at `https://sightreading.pages.dev`
- Push to other branches → preview deployment with unique URL

### Manual Deploy:

```bash
npm run build
npm run deploy
```

### 数据库变更 PR 检查清单

当 PR 包含数据库相关代码时，开发者需要在请求 review 前完成以下 preview 验证流程：

1. 如果修改了 table schema，需要先在 Supabase 的 `00-SightReading_3.0_preview` database 里运行对应 SQL。
2. 使用 Cloudflare 为 PR 自动生成的 preview link 进行测试。
3. 在 PR description 或 PR comments 里提交测试截图。

### Deploy Steps (first time):

1. Connect your GitHub repo to Cloudflare Pages
2. Set build command: `npm run build`, output directory: `dist`
3. Create a KV namespace and bind it in the dashboard (Settings → Functions → KV namespace bindings → `STAGES_KV`)
4. Set `CMS_SECRET` secret via `npx wrangler pages secret put CMS_SECRET`
5. Push to `main` — done!

## Usage

### Teacher (CMS): `/cms`

CMS access requires a Supabase account whose `profiles.role` is `admin`.

1. Upload MusicXML files via **文件解析器**, or add questions manually via **手动出题器**
2. Manage the question pool in **题库管理** (adjust difficulty, delete items)
3. Optionally create custom stages in **关卡编排**
4. Click **"🚀 发布到云端"** in the sidebar to publish

#### Batch Question Templates

Pre-made templates for bulk question entry are in the `templates/` folder (not included in the build):

| File | Description |
|------|-------------|
| `templates/symbols-batch.txt` | 音乐表情/符号记号，格式: `符号|答案` |

Usage: Open the template file, copy the content, paste into the CMS **批量添加** text area.

Format for Symbols (type B): one question per line, `symbol|answer`
```
pp|极弱 (pianissimo)
rit.|渐慢 (ritardando)
D.C.|从头反复 (Da Capo)
```

### Student: `/client`

1. Opens and auto-fetches the latest questions from the cloud
2. Select a module (Notes, Symbols, Theory, Patterns)
3. Play through stages — each has 5 questions
4. Stages unlock sequentially as you clear them

Login/register is optional for students in this version. Click "登录/注册" in the header to go to the auth page (`/auth`). Registration asks for email or phone number, nickname, and password. Student progress still stays local until cloud progress sync is added later.

### Auth: `/auth`

A dedicated login/register page with the following modes:

- **登录** — sign in with email/phone + password
- **注册** — create a student account with nickname
- **忘记密码** — sends a password reset link to the registered email
- **设置新密码** — landed on via the reset link in email (`/auth?mode=reset`)

The page accepts query params:
- `?mode=login|register|forgot|reset` — which form to show
- `?returnTo=/path` — where to redirect after successful auth

If the user is already logged in, the page auto-redirects to `returnTo`.

## Cloud Sync Architecture

```
Teacher (CMS) → clicks "发布到云端" → POST /api/stages → Cloudflare KV
Student (any browser) → auto-fetches on page load ← GET /api/stages ← Cloudflare KV
```

The storage layer is abstracted via a `StorageProvider` interface:

```
src/core/storage/
├── types.ts                     # StorageProvider interface
├── CloudflareStorageProvider.ts # Cloudflare KV implementation (current)
├── index.ts                     # Provider factory (swap backends here)
└── useRemoteSync.ts             # React hooks: usePublish() + useFetchRemote()

functions/api/
└── stages.ts                    # Cloudflare Pages Function (GET/POST)
```

To switch to Firebase, Supabase, or any other backend: implement the `StorageProvider` interface and change one line in `index.ts`.

## Build for Production

```bash
npm run build    # outputs to ./dist
npm run preview  # preview production build locally with wrangler
npm run deploy   # deploy to Cloudflare Pages
```

## Project Structure

```
src/
├── core/
│   ├── auth/            # Supabase client & AuthProvider context
│   ├── engine/          # MusicXML parser & 4-dimension extractor
│   ├── store/           # Zustand state management
│   └── storage/         # Cloud sync abstraction layer
├── components/
│   └── auth/            # AccountMenu, CMSAuthGate
├── pages/
│   ├── auth/            # Dedicated login/register/reset page
│   ├── client/          # Student-facing quiz UI
│   └── cms/             # Teacher-facing content management
└── main.tsx

functions/api/
└── stages.ts            # Cloudflare Pages Function for KV storage

docs/supabase/
└── auth.sql             # Database migration: profiles table, RLS, triggers

templates/
└── symbols-batch.txt    # Batch question template for Symbols (not in build)
```
