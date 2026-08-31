# Library Loop 60457

Library Loop is a live calendar for public-library, park, recreation, nature, and family events near ZIP 60457. It focuses on activities suitable for ages 7–16 while keeping clearly teen-only events hidden by default.

Live site: [library-loop-60457.nilkamals463352.chatgpt.site](https://library-loop-60457.nilkamals463352.chatgpt.site/)

## Architecture

Library Loop uses two collection lanes:

1. **Hosted structured feeds** run in Cloudflare Workers. These adapters read official JSON, RSS, ICS, Communico, LibraryCalendar, LibCal/CivicPlus, WordPress Events, and related public calendar formats.
2. **Local overnight browser collection** uses Node.js, Playwright Core, and an installed Microsoft Edge or Chrome browser for reviewed official pages that do not expose a dependable structured feed.

The local collector validates and signs each batch with HMAC-SHA256 before uploading it. Cloudflare D1 stores the latest accepted per-source snapshots. The public UI merges direct feeds, permitted family-event discovery, and D1 snapshots, then deduplicates events and applies the audience filters.

Unexpectedly empty, failed, blocked, equal-timestamp, or older browser results do not erase a newer last-known-good snapshot.

## Stack

- React 19, TypeScript, Next.js App Router conventions
- Vinext and Vite for a Cloudflare Workers-compatible build
- Tailwind CSS 4
- OpenAI Sites hosting with Cloudflare Workers and D1
- Node.js 22.18 or newer and pnpm 11
- Playwright Core with system Edge or Chrome for the local collector

## Local development

```powershell
pnpm install
pnpm dev
```

Validation commands:

```powershell
pnpm test:collector
pnpm lint
pnpm build
```

The collector defaults to a safe dry run and writes ignored audit artifacts under `collector/runs/`:

```powershell
node collector/run.mjs --dry-run --source justice-public-library --headed
node collector/run.mjs --dry-run
```

See [`collector/RUNBOOK.md`](collector/RUNBOOK.md) for the reviewed collection and upload workflow.

## Collector configuration

Production uploads require `LIBRARY_LOOP_INGEST_TOKEN` in the local process or the current Windows user's environment. Never add the token to a file, command argument, GitHub secret unless intentionally configuring a trusted workflow, or collector artifact.

Optional variables:

- `LIBRARY_LOOP_INGEST_URL` overrides the production ingest endpoint.
- `LIBRARY_LOOP_BROWSER_PATH` selects a system browser executable.
- `LIBRARY_LOOP_PLAYWRIGHT_PATH` selects an externally installed Playwright Core package.

The upload contract allows at most 200 events per source, 3,000 events per batch, and 1,500,000 UTF-8 bytes. Only source IDs from the reviewed collector manifest are accepted.

## Safety boundaries

The collector checks `robots.txt`, uses public HTTPS pages, and stops at sign-in requirements, CAPTCHAs, access-denied responses, or ambiguous data. It does not reuse browser credentials, solve challenges, perform OCR, enter calendar iframes, or click through every event-detail page. Visual-only or ambiguous records stay unpublished for review.

The repository contains no ingest token or browser session. Local run artifacts, environment files, Wrangler state, databases, and build outputs are ignored.

## Scheduling

Scheduling is intentionally external to the repository. The production installation runs the reviewed upload command locally overnight. A clone of this repository does not create or modify any scheduled task.

[`scripts/run-overnight-collector.ps1`](scripts/run-overnight-collector.ps1) is the noninteractive Windows entry point used by the production task. It writes ignored logs under `collector/runs/scheduled/`. The script itself does not register a task or change Windows power settings.

## Deployment

The application is built with `pnpm build` and deployed through OpenAI Sites. `.openai/hosting.json` declares the logical D1 binding; hosted runtime secrets are managed outside Git.

## License

No open-source license has been granted. All rights are reserved by the repository owner.
