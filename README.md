# SightReading 2.0 — 认谱练习器

A music sight-reading practice app with a teacher CMS and student quiz interface.

## Features

- **4 Quiz Modules**: Notes (单音), Symbols (符号), Theory (乐理), Patterns (音型)
- **MusicXML Parser**: Upload `.musicxml` files to auto-extract questions across 4 dimensions
- **Smart Difficulty**: Auto-grades questions L1–L10 based on pitch range, accidentals, symbol rarity
- **Auto Stage Generation**: Groups questions into stages (5 per stage) by type and difficulty
- **Custom Stages**: Teachers can manually curate stage content
- **Cloud Sync**: Teacher publishes questions to cloud; students see them instantly on any device
- **Progress Tracking**: Student progress persisted locally with sequential stage unlocking

## Tech Stack

- React 19 + TypeScript + Vite 8
- VexFlow 5 (music notation rendering)
- Tone.js (audio)
- Zustand (state management with localStorage persistence)
- React Router 7
- Lucide React (icons)

## Requirements

- **Node.js 20.19+ or 22.12+** (Vite 8 requirement)
- If using nvm: `nvm use 22`
- If using mise: `mise use node@22`

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure cloud sync (GitHub Gist)

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
VITE_GIST_ID=your_gist_id
VITE_GIST_TOKEN=your_github_pat
VITE_GIST_OWNER=your_github_username
```

#### How to set up the Gist:

1. Go to https://gist.github.com (logged in)
2. Set filename to `stages.json`, content to `{}`
3. Click **"Create public gist"**
4. Copy the Gist ID from the URL (the long string after your username)

#### How to generate a PAT:

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token (classic)"** (not fine-grained — it doesn't support gist scope)
3. Name it (e.g. `sight-reading-gist`)
4. Check only the **`gist`** scope
5. Generate and copy the token

### 3. Run the dev server

```bash
npm run dev
```

## Usage

### Teacher (CMS): `http://localhost:5173/cms`

1. Upload MusicXML files via **文件解析器**, or add questions manually via **手动出题器**
2. Manage the question pool in **题库管理** (adjust difficulty, delete items)
3. Optionally create custom stages in **关卡编排**
4. Click **"🚀 发布到云端"** in the sidebar to publish to the Gist

### Student: `http://localhost:5173/client`

1. Opens and auto-fetches the latest questions from the cloud
2. Select a module (Notes, Symbols, Theory, Patterns)
3. Play through stages — each has 5 questions
4. Stages unlock sequentially as you clear them

## Cloud Sync Architecture

```
Teacher (CMS) → clicks "发布到云端" → GitHub Gist (stages.json)
Student (any browser) → auto-fetches on page load ← GitHub Gist
```

The storage layer is abstracted via a `StorageProvider` interface:

```
src/core/storage/
├── types.ts                # StorageProvider interface
├── GistStorageProvider.ts  # GitHub Gist implementation
├── index.ts                # Provider factory (swap backends here)
└── useRemoteSync.ts        # React hooks: usePublish() + useFetchRemote()
```

To switch to Firebase, Supabase, or any other backend: implement the `StorageProvider` interface and change one line in `index.ts`.

## Build for Production

```bash
npm run build    # outputs to ./dist
npm run preview  # preview production build locally
```

Deploy the `dist/` folder to any static hosting (Vercel, Netlify, GitHub Pages, S3, etc.). Since it uses `BrowserRouter`, configure your host to redirect all paths to `index.html`.

## Project Structure

```
src/
├── core/
│   ├── engine/          # MusicXML parser & 4-dimension extractor
│   └── store/           # Zustand state management
│   └── storage/         # Cloud sync abstraction layer
├── pages/
│   ├── client/          # Student-facing quiz UI
│   └── cms/             # Teacher-facing content management
└── main.tsx
```
