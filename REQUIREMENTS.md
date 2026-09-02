# Library Loop rebuild requirements

## Product

- Help parents and caregivers find public library, park, recreation, nature, and permitted family events suitable for ages 7–16 near ZIP 60457.
- Make the first screen an event-discovery surface. It must show a useful rolling 60-day agenda immediately, not an empty single-day view or a marketing page.
- Use America/Chicago dates and times. Default to kids and family events, with clearly teen-only listings hidden until enabled.
- Provide real controls for a 7-, 30-, or 60-day horizon, month, exact event date, keyword, distance (5, 10, or 15 miles), category, and teen events. All filters must be clearable.
- Show date/time, title, audience, source, venue, distance, and registration state on every event card. Details add address, duration, description, schedule warnings, and the official organizer link.
- Sort by start time and distance, deduplicate across collection lanes, and never silently switch the selected date.
- Provide bounded loading, honest partial/stale/error states, retry, keyboard access, touch targets, focus styles, safe external links, and responsive desktop/mobile layouts.

## Data and trust

- Normal page loads read one persisted D1 view and never fan out to external calendars.
- Merge the newest usable structured snapshot with the overnight browser-source snapshots, then filter to the requested range.
- Persist structured calendars as indexed event rows with bounded run retention so a 60-day run does not depend on one oversized database record.
- A missed exact date-key snapshot must not collapse the product to the 17-source overnight lane. Serve the newest overlapping saved snapshot and label partial or stale coverage honestly.
- Keep operational coverage (80 structured plus 17 overnight sources) separate from the larger researched directory inventory.
- Preserve last-known-good events for empty, failed, or blocked sources. Ignore equal-timestamp and older writes.
- A successful browser-page read that cannot prove complete horizon coverage must merge into, rather than replace, that source's later last-known-good events.
- Show snapshot time, snapshot coverage dates, attempted sources, responding sources, empty sources, failed/blocked sources, and retained sources with consistent denominators.
- Only publish events with explicit youth/family/tween/teen evidence or an age range overlapping 7–16. Exclude adult-only, senior-only, early-childhood-only, administrative, closure, private, ambiguous, or out-of-radius records.
- Keep stable event IDs, Chicago-local timestamps, safe HTTPS URLs, bounded plain-text descriptions, registration/cancellation signals, and canonical deduplication.

## Collection and safety

- Use reviewed official HTTPS sources and explicitly permitted guides only. Never guess source URLs.
- Honor robots.txt and stop at login, password fields, CAPTCHA, anti-bot challenges, 401/403, access-denied, unverifiable redirects, stale material, or ambiguous dates/audiences.
- Do not reuse credentials, solve challenges, spoof access controls, inspect private state, OCR flyers, probe undocumented endpoints, or weaken a safety block to increase counts.
- Keep HMAC-authenticated uploads, five-minute timestamp tolerance, exact source allowlists, idempotent run IDs, atomic D1 updates, and limits of 200 events per source, 3,000 per batch, and 1.5 MB.
- Never write or print the ingest token. It may be read only from the process or current Windows user environment.
- Preserve exact batch and audit artifacts with source outcomes, decisions, counts, review items, exclusions, timings, stale writes, and upload receipt.

## Operations and acceptance

- Preserve the existing Sites project, D1 binding, reviewed source manifests, signed ingestion, collector tests, and external 2:15 AM / 4:00 AM schedule behavior.
- The Windows wrapper must not treat routine package-manager stderr as a failed collector. A successful upload must proceed to the structured-snapshot refresh.
- The structured refresh action must require authorization; a public visitor must not be able to trigger an 80-source fan-out.
- Keep Node 22.18+, pnpm 11, Cloudflare-compatible Vinext output, runtime secrets outside Git, and CI checks for tests, lint, TypeScript, and build.
- Acceptance requires a fresh deployed load with real events, truthful coverage, working filters, event details and official links, a retryable degraded state, desktop and 390px mobile verification, and no browser console errors.
