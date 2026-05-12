# SightReading 2.0 — 认谱练习器

A music sight-reading practice app with a teacher CMS and student quiz interface.

## Next step
1. Fix responsive in mobile phone
2. Fix only ppttzhu's commit can trigger Vercel auto build
3. Student can save stage

## Features

- **4 Quiz Modules**: Notes (单音), Symbols (符号), Theory (乐理), Patterns (音型)
- **MusicXML Parser**: Upload `.musicxml` files to auto-extract questions across 4 dimensions
- **Smart Difficulty**: Auto-grades questions L1–L10 based on pitch range, accidentals, symbol rarity
- **Auto Stage Generation**: Groups questions into stages (5 per stage) by type and difficulty
- **Custom Stages**: Teachers can manually curate stage content
- **Cloud Sync**: Teacher publishes questions via Vercel Blob; students see them instantly on any device
- **Progress Tracking**: Student progress persisted locally with sequential stage unlocking

## Tech Stack

- React 19 + TypeScript + Vite 8
- VexFlow 5 (music notation rendering)
- Tone.js (audio)
- Zustand (state management with localStorage persistence)
- React Router 7
- Lucide React (icons)
- Vercel Blob (cloud storage)

## Requirements

- **Node.js 20.19+ or 22.12+** (Vite 8 requirement)
- If using nvm: `nvm use 22`
- If using mise: `mise use node@22`

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure cloud sync (Vercel Blob)

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
VITE_CMS_SECRET=your_cms_secret
```

#### Vercel Blob Setup:

1. Deploy the project to Vercel (connect your GitHub repo)
2. In Vercel dashboard → **Storage** → **Create** → **Blob** → Connect to your project
   - This auto-adds `BLOB_READ_WRITE_TOKEN` to your project environment variables
3. (Optional) Add `CMS_SECRET` in Vercel **Settings → Environment Variables** to protect write access
4. Set `VITE_CMS_SECRET` in your local `.env` to the same value (for teacher CMS auth)

### 3. Run the dev server

```bash
npm run dev
```

> Note: Cloud sync requires deployment to Vercel since the API route (`/api/stages`) runs as a serverless function. In local dev, the student side will fall back to local data.

## Deployment

This project is deployed on **Vercel** with automatic CI/CD:

- Push to `main` → production deployment
- Push to other branches → preview deployment with unique URL
- Pull requests get automatic preview links

### Deploy Steps:

1. Connect your GitHub repo to Vercel
2. Vercel auto-detects Vite and configures build settings
3. Create a Blob store in Vercel Storage and connect it to the project
4. (Optional) Set `CMS_SECRET` environment variable for write protection
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
Teacher (CMS) → clicks "发布到云端" → POST /api/stages → Vercel Blob
Student (any browser) → auto-fetches on page load ← GET /api/stages ← Vercel Blob
```

The storage layer is abstracted via a `StorageProvider` interface:

```
src/core/storage/
├── types.ts                  # StorageProvider interface
├── VercelStorageProvider.ts  # Vercel Blob implementation (current)
├── GistStorageProvider.ts    # GitHub Gist implementation (legacy)
├── index.ts                  # Provider factory (swap backends here)
└── useRemoteSync.ts          # React hooks: usePublish() + useFetchRemote()

api/
└── stages.ts                 # Vercel serverless function (GET/POST)
```

To switch to Firebase, Supabase, or any other backend: implement the `StorageProvider` interface and change one line in `index.ts`.

## Build for Production

```bash
npm run build    # outputs to ./dist
npm run preview  # preview production build locally
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

api/
└── stages.ts            # Vercel serverless function for Blob storage
```
