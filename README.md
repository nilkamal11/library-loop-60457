# Library Loop 60457

Library Loop is a rolling seven-day calendar of public library, park, recreation, nature, and family events within 15 miles of ZIP 60457. The default view is for children and families whose interests overlap ages 7–16; clearly teen-only events are opt-in.

Live site: [library-loop-60457.nilkamals463352.chatgpt.site](https://library-loop-60457.nilkamals463352.chatgpt.site/)

Sources and technology: [public source directory](https://library-loop-60457.nilkamals463352.chatgpt.site/sources) · [`docs/SOURCES_AND_TECH.md`](docs/SOURCES_AND_TECH.md)

The complete product, data, safety, operations, and acceptance requirements are recorded in [`REQUIREMENTS.md`](REQUIREMENTS.md).

## How it works

Normal page loads read one persisted calendar from Cloudflare D1. They never wait for or trigger a live fan-out to dozens of external sites.

Two reviewed collection lanes update that saved calendar:

1. An authenticated hosted refresh reads configured official structured feeds, applies strict youth/family evidence rules, validates HTTPS and same-origin redirects, honors robots.txt, and preserves last-known-good records when a source fails or unexpectedly returns no usable events.
2. A local overnight Playwright collector covers configured official public pages that do not offer dependable structured feeds. It validates and signs each batch before uploading it to the production ingest endpoint.

The visitor read model selects the newest saved structured snapshot that overlaps the requested dates, merges the current overnight snapshot, removes duplicates, filters the requested seven-day window, and reports partial or stale coverage honestly.

## Local development

The Cloudflare-bound application must be previewed with the Sites development runtime:

```powershell
pnpm install
pnpm dev
```

Run the complete validation set before publishing:

```powershell
pnpm test:collector
pnpm test:calendar
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

`pnpm start` is also safe for a production-bundle smoke test. Without Cloudflare bindings it renders the explicit unavailable state instead of querying D1.

## Collection safety

Only reviewed HTTPS sources in the configured manifests are allowed. The collectors stop on blocked robots paths, cross-origin redirects, login or access-denied pages, CAPTCHAs, challenge HTML, stale writes, or ambiguous content. Generic activity words are not enough to classify an event as appropriate for children or families.

Production refreshes and uploads require `LIBRARY_LOOP_INGEST_TOKEN`. The token is read from the runtime or current Windows user environment and must never be written to the repository, command arguments, logs, or collector artifacts.

The upload contract allows at most 200 events per source, 3,000 events per batch, and 1,500,000 UTF-8 bytes. Only source IDs from the reviewed collector manifest are accepted. Empty, failed, blocked, and stale source writes do not erase newer last-known-good events.

## Scheduling

Scheduling is external to the repository. The primary Windows task runs the overnight upload at 2:15 AM. The separate 4:00 AM fallback checks the current-night audit and task state first, and runs only when there is no accepted upload and no collector already running.

[`scripts/run-overnight-collector.ps1`](scripts/run-overnight-collector.ps1) is the noninteractive task entry point. It writes ignored logs under `collector/runs/scheduled/`, keeps routine native stderr from aborting the wrapper, and performs the authenticated structured refresh only after an accepted overnight upload.

## Deployment

The site is built with `pnpm build`, packaged from that exact Git commit, and published with OpenAI Sites. [`.openai/hosting.json`](.openai/hosting.json) identifies the existing Sites project and D1 binding. Runtime secrets remain outside Git.

No open-source license has been granted. All rights are reserved by the repository owner.
