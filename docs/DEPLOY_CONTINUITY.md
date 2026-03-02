# Deploy Continuity Runbook

Use this document when you need to continue deployment work after switching projects or chat contexts.

## Fixed Project Context

- Local path: `C:\Users\bobo\Desktop\inopnc_sw\inopnc-sw4-publish`
- GitHub repo: `https://github.com/ceo-droid/inopnc-sw4.git`
- Default branch: `main`
- Vercel project name: `inopnc-sw4-publish`
- Vercel project ID: `prj_exCqRjCgA3rg76AhfgZ2rUgEXyOo`
- Vercel org/team ID: `team_2Z9tFmBMiqtuJxFxAoXww8RI`

## GitHub Upload Checklist

Run from repo root.

```powershell
git status -sb
npm run test
npm run build
git add -A
git commit -m "your commit message"
git push origin main
git rev-parse --short HEAD
```

Notes:
- If tests are not ready, still run `npm run build` before push.
- Save the short commit hash in `docs/SESSION_HANDOFF.md`.

## Vercel Production Overwrite (Redeploy)

Run from repo root.

```powershell
vercel whoami
vercel link
vercel --prod --yes
```

Notes:
- `vercel link` can be skipped after initial link, but it is safe to re-run.
- This redeploys to the same Vercel project (`inopnc-sw4-publish`) in production.
- Save the deployment URL in `docs/SESSION_HANDOFF.md`.

## Context Handoff Prompt Template

Copy and paste this block when you return after switching projects.

```text
[Project Context]
Project: inopnc-sw4-publish
Repo: https://github.com/ceo-droid/inopnc-sw4.git
Branch: main
Vercel Project: inopnc-sw4-publish
Last Commit: <fill>
Last Production Deploy: <fill>
Current State (3 lines):
1) <fill>
2) <fill>
3) <fill>
Do Now (1-3 tasks):
1) <fill>
2) <fill>
3) <fill>
Do Not Touch:
- <fill>
```

## Before Switching to Another Project

1. Update `docs/SESSION_HANDOFF.md` with latest commit/deploy and pending tasks.
2. Keep pending tasks to max 3 items.
3. Copy the handoff block and use it in the next chat when you come back.
