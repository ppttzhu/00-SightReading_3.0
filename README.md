# SightReading 2.0 — 认谱练习器

A music sight-reading practice app with a teacher CMS and student quiz interface.

## Next step
1. Fix responsive in mobile phone
2. Student can save stage

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

## Requirements

- **Node.js 20.19+ or 22.12+** (Vite 8 requirement)
- If using nvm: `nvm use 22`
- If using mise: `mise use node@22`

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure cloud sync (Cloudflare KV)

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
VITE_CMS_SECRET=your_cms_secret
```

#### Cloudflare Setup:

1. Create a KV namespace: `npx wrangler kv namespace create STAGES_KV`
2. Add the namespace ID to `wrangler.toml`
3. Set `CMS_SECRET` via `npx wrangler pages secret put CMS_SECRET`
4. Set `VITE_CMS_SECRET` in your local `.env` to the same value (for teacher CMS auth)

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

### Deploy Steps (first time):

1. Connect your GitHub repo to Cloudflare Pages
2. Set build command: `npm run build`, output directory: `dist`
3. Create a KV namespace and bind it in the dashboard (Settings → Functions → KV namespace bindings → `STAGES_KV`)
4. Set `CMS_SECRET` secret via `npx wrangler pages secret put CMS_SECRET`
5. Push to `main` — done!

## Usage

### Teacher (CMS): `/cms`

1. Upload MusicXML files via **文件解析器**, or add questions manually via **手动出题器**
2. Manage the question pool in **题库管理** (adjust difficulty, delete items)
3. Optionally create custom stages in **关卡编排**
4. Click **"🚀 发布到云端"** in the sidebar to publish

### Student: `/client`

1. Opens and auto-fetches the latest questions from the cloud
2. Select a module (Notes, Symbols, Theory, Patterns)
3. Play through stages — each has 5 questions
4. Stages unlock sequentially as you clear them

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
├── GistStorageProvider.ts       # GitHub Gist implementation (legacy)
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
│   ├── engine/          # MusicXML parser & 4-dimension extractor
│   ├── store/           # Zustand state management
│   └── storage/         # Cloud sync abstraction layer
├── pages/
│   ├── client/          # Student-facing quiz UI
│   └── cms/             # Teacher-facing content management
└── main.tsx

functions/api/
└── stages.ts            # Cloudflare Pages Function for KV storage
```
