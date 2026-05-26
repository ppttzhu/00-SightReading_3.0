# Codex Repository Administrator Handoff

Last updated: 2026-05-25

## Role

Codex acts as the repository administrator and continuity keeper for this project.

The goal of this role is to make sure future collaborators, future Codex windows, and other AI assistants can safely continue work without losing project context.

## Repository

- GitHub repository: `ppttzhu/00-SightReading_3.0`
- Local working copy: `D:\Codex-GitHub\00-SightReading_3.0`
- Primary branch: `main`
- App type: React 19 + TypeScript + Vite sight-reading practice app
- Hosting/deployment: Cloudflare Pages with Git integration
- Backend services: Cloudflare KV, Supabase Auth/Postgres

## Remote Safety And Ownership

- The repository belongs to the user's student, Peng Tuxiang, under `ppttzhu/00-SightReading_3.0`.
- Work local-first in `D:\Codex-GitHub\00-SightReading_3.0`.
- Do not push, deploy, or otherwise upload changes to the original GitHub repository unless the user explicitly approves it in the current conversation.
- If upload is approved, create a review branch instead of pushing directly to `main`.
- Default branch prefix for Codex-created branches: `ruihancodex/`.
- Treat Peng Tuxiang as the repository reviewer for uploaded branches.

## Operating Rules

1. Read `AGENTS.md` first.
2. If the task mentions proposals, specs, architecture changes, breaking changes, or major behavior changes, read `openspec/AGENTS.md` before editing.
3. Protect user work. Do not discard local edits unless the user explicitly asks.
4. Before changing code, inspect the relevant files and follow existing patterns.
5. Prefer small, reviewable changes.
6. Run the most relevant checks before handing work back.
7. Never commit secrets. Keep `.env` local and use `.env.example` for placeholders only.

## Common Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

Notes:

- `npm run dev` starts the local Vite app.
- `npm run build` is the main production build check.
- `npm run preview` builds and runs Cloudflare Pages locally through Wrangler.

## Environment Notes

Create `.env` from `.env.example` when local configuration is needed.

Required public/client variables currently include:

```text
VITE_CMS_SECRET=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Secrets that must not be exposed in `VITE_` variables belong in Cloudflare Pages secrets or service dashboards.

## Deployment Notes

The project README states:

- Pushes to `main` deploy production through Cloudflare Pages.
- Other branches create preview deployments.
- Manual deploy is available with `npm run build` and `npm run deploy`.

Before production-impacting changes:

1. Confirm build passes.
2. For database-related changes, follow the README database PR checklist.
3. Use preview deployment/testing when possible.

## Current Local Setup

This working copy was cloned for the user on 2026-05-25 into:

```text
D:\Codex-GitHub\00-SightReading_3.0
```

Source:

```text
https://github.com/ppttzhu/00-SightReading_3.0.git
```

## Continuity Checklist For Future Assistants

When taking over:

1. Check `git status`.
2. Read the latest user request.
3. Read `AGENTS.md` and this file.
4. Read `README.md` for setup/deployment details.
5. If the task is architectural or spec-related, read `openspec/AGENTS.md`.
6. Inspect only the files relevant to the requested change.
7. Make changes, run checks, and report exactly what changed.

## Current Product Discussion

As of 2026-05-25, the user is evaluating a new Duolingo/TikTok-style learning mode for the student client. The source idea document is:

```text
C:\Users\littl\Documents\xwechat_files\wxid_hcr969u2mes122_a9e8\msg\file\2026-05\
```

Look for the latest DOCX in that folder whose title mentions Duolingo/TikTok learning mode.

The first local assessment report is:

```text
docs\pm\duolingo-tiktok-learning-mode-assessment.md
```

The user later approved direct local implementation without a proposal gate. A local MVP was implemented on branch:

```text
ruihancodex/add-adventure-learning-mode
```

Implemented scope:

- `/client` now shows two main entries: Adventure and Free Practice.
- `/client/adventure` shows the linear adventure path.
- `/client/free` hosts the four free-practice/module entries.
- Adventure progress uses `studentProgress.adventure` locally and does not sync that module to Supabase.
- `InteractiveQuiz` can resolve `adventure_level_*` stages from the adventure path.
- Existing module stage locking was restored in `StageSelector`.

Still out of scope:

- GitHub push, deploy, database schema migration, leaderboard, three-minute sessions, and TikTok-style immersive swipe practice.

## Human Collaboration Notes

When another person joins:

- Point them to this file, `README.md`, and `AGENTS.md`.
- Ask them to work on branches rather than directly on `main` unless the owner explicitly approves.
- Require screenshots or clear test notes for UI-facing changes.
- Require build/test output before merging meaningful code changes.
