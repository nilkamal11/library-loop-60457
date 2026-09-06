# Library Loop sources and technical reference

This document mirrors the public [Sources & technology page](https://library-loop-60457.nilkamals463352.chatgpt.site/sources). The live page renders its complete 102-source directory from the same manifests used by the collectors, rather than maintaining a second handwritten list.

## Source manifests

- `lib/source-catalog.ts`: 85 reviewed structured-feed sources. This module is imported by both the structured collector and the public source directory.
- `collector/sources.mjs`: 17 reviewed browser-page sources. This module is imported by the overnight collector, the server write allowlist, and the public source directory.
- Total: 102 unique configured sources. “Configured” does not imply that every source responds on every run.

The structured lane currently contains 53 libraries, 16 park districts, 13 recreation sources, 2 forest-preserve sources, and 1 attributed family guide. Its active adapters are 27 LibraryCalendar JSON, 24 iCalendar/ICS, 20 WordPress Events API, 7 Communico JSON, 2 Squarespace JSON, 1 BiblioCommons RSS, 1 My Calendar API, 1 community-event RSS feed, 1 Socrata open-data feed, and 1 KiddoChicago JSON feed. The second lane contains 17 official public library pages collected with a browser.

The public directory also links to Kidlist, Mommy Poppins, Macaroni KID, Chicago Parent, and the Brookfield Zoo daily schedule as manual research leads. They are intentionally not counted as collected sources because their current terms, robots rules, or lack of a dependable event feed do not support this automated use.

## Public calendar parameters

- Home area: ZIP 60457; reference center 41.7244, -87.8273.
- Visitor window: 60 days; the saved API accepts 1–60 days. The interface offers 7-, 30-, and 60-day views plus month and exact-date selectors.
- Distance filters: 5, 10, and 15 miles; uploaded events validate at 15.5 miles or less.
- Time zone: America/Chicago.
- Default audience: events with explicit age/family evidence overlapping ages 7–16; clearly teen-only events are opt-in.
- Page size: 24 event cards.
- Merged saved API cache: 120 seconds plus 600 seconds stale-while-revalidate.
- Stale-data threshold: 36 hours.

## Structured collection parameters

- 85 reviewed feeds, collected 5 at a time. These now include the Chicago Park District's public Chicago Data Portal dataset, an attributed KiddoChicago discovery feed whose links point back to organizers, Willow Springs Village Events, Riverside Parks & Recreation, and Beverly Arts Center.
- 60-day collection horizon. Window-aware WordPress and BiblioCommons adapters paginate until they cover the requested range or fail safely at a reviewed cap.
- KiddoChicago responses fail safely above 8 MB or 10,000 raw records before normalization.
- The 60 days are the collection target, not a promise that every organizer has published that far ahead. The public page reports the latest dates actually saved.
- 12-second request timeout and 8-second robots.txt timeout.
- HTTPS only, same-origin redirects only, at most 3 redirects.
- Supported adapters: LibraryCalendar JSON, WordPress Events REST, ICS, Communico JSON, RSS/BiblioCommons, My Calendar REST, and Squarespace JSON.
- The saved structured endpoint uses a 300-second public cache for non-refresh reads.

## Overnight browser collection parameters

- 17 reviewed official pages, processed sequentially and headlessly by default.
- 60-day future collection window; command range 1–180 days.
- System Edge or Chrome through Playwright Core.
- 30-second page navigation timeout; command range 1–120 seconds.
- 1.5-second settle delay; command range 0–15 seconds.
- 10-second robots.txt timeout and 30-second upload timeout.
- Browser locale en-US, America/Chicago time zone, and service workers blocked.
- External cadence: 2:15 AM primary and a duplicate-safe 4:00 AM fallback.

## Validation and persistence

- HMAC-SHA256 signed uploads with a 5-minute timestamp tolerance.
- Exact reviewed source allowlist and idempotent run IDs.
- Maximum 200 events per source, 3,000 events per batch, and 1,500,000 UTF-8 bytes per upload.
- Overnight descriptions are capped at 420 characters.
- D1 writes are atomic. Structured events are stored as indexed rows, with the three newest runs plus the newest widest-window run retained for fallback instead of storing an entire 60-day calendar in one database row.
- Empty, failed, blocked, or stale source results preserve newer last-known-good events. Successful browser reads that cannot prove complete-window coverage merge into the prior source snapshot rather than deleting later events.
- The collectors honor robots.txt and stop at login, password fields, CAPTCHA, anti-bot challenges, 401/403, access-denied pages, cross-origin redirects, stale material, and ambiguous content.
- Browser page scans consider up to 240 semantic event nodes and emit at most 151 DOM candidates per page, including the source-specific dated-list fallback.
- Event field bounds are 240 characters for title, 180 for source, 240 for venue, 360 for address, 1,200 for HTTPS URLs, and 180 for schedule notices. Source error text is capped at 500 characters.
- Browser-normalized descriptions are capped at 420 characters; the server contract allows up to 600.
- Per-source audit samples retain up to 100 review items and 50 excluded examples.
- Collector identities are `library-loop-browser-v1`, `LibraryLoopCollector/1.0` for the browser lane, and `LibraryLoop/1.0` for the structured lane.

Secret values, production credentials, and internal deployment identifiers are deliberately not documented here.

## Technology stack

- Next 16.2.6, React 19.2.6, and TypeScript 5.9.3.
- Vinext 1.0.0-beta.3 and Vite 8.0.13.
- OpenAI Sites, Cloudflare Workers, and Cloudflare D1.
- OpenAI Sites plugin 0.2.0, Cloudflare Vite plugin 1.37.1, and Wrangler 4.92.0.
- Vite React plugin 6.0.2, React Server Components plugin 0.5.26, and a custom responsive CSS layer processed through Tailwind/PostCSS 4.2.1.
- Node.js 22.18 or newer, pnpm 11.19.0, JavaScript ES modules, and Playwright Core 1.62.1.
- Windows Task Scheduler and PowerShell for the local overnight entry point.
- Node test runner, ESLint 9.39.4, and GitHub Actions for validation.
