# Library Loop overnight collector runbook

This folder is a local, low-frequency collector for official library pages that need a real browser. It is intentionally separate from the public Site and does not build, commit, deploy, schedule, or change Site configuration.

The collector uses conservative JSON-LD and semantic DOM extraction. It does not click through calendars, submit forms, sign in, solve CAPTCHAs, bypass robots rules, inspect browser credentials, or perform OCR. Ambiguous records are written to the audit file for review and are not uploaded as events.

## What is included

- `sources.mjs` contains the 17 current `page` and `manual` libraries from `app/sources/page.tsx`, using only URLs verified in the follow-up source audit.
- All 17 sources are in the overnight browser queue. Forest Park is included because its official calendar opens in a normal browser but blocks the hosted runtime. Chicago Public Library is intentionally excluded because its verified, audience-filtered BiblioCommons RSS belongs in the normal direct-feed path.
- `run.mjs` collects sources sequentially, normalizes child/family/teen events, and writes an exact ingest batch plus a separate audit record.
- `upload.mjs` signs and uploads a validated batch.
- `tests/` covers source routing, robots behavior, normalization, teen classification, payload validation, and signing.

## Prerequisites

Run commands from the `dashboard` directory.

1. Node.js 22.18 or newer.
2. Install the project dependencies with `pnpm install`; `playwright-core` is included. To use an existing external Playwright Core package instead, set `LIBRARY_LOOP_PLAYWRIGHT_PATH` or pass `--playwright-path` with its package directory. Do not hardcode a machine-specific cache path into source or a schedule.
3. A system installation of Microsoft Edge or Google Chrome.

The collector checks common Windows locations for Edge first and then Chrome. To use a different executable, set `LIBRARY_LOOP_BROWSER_PATH` or pass `--browser-path`.

List the manifest without starting a browser:

```powershell
node collector/run.mjs --list-sources
```

## First dry run

Start with one source and a visible browser:

```powershell
node collector/run.mjs --dry-run --source justice-public-library --headed
```

Then test the full enabled browser queue:

```powershell
node collector/run.mjs --dry-run
```

Dry-run is the default even when no mode flag is supplied. It always writes artifacts and never calls the ingest endpoint.

Every run creates two files under `collector/runs/`:

- `<runId>.batch.json` is the exact body that would be uploaded.
- `<runId>.audit.json` records the window, source outcome, robots decision, counts, review candidates, exclusions, and safe error text.

Keep `collector/runs/` out of Git. The files contain public event metadata, but they are operational records rather than Site source.

## Review gates

Before enabling upload, review at least the first few runs source by source.

- Confirm dates and times against the official page.
- Confirm every accepted event is clearly for children, families, tweens, or teens.
- Confirm teen-only events contain `"teenOnly": true`.
- Inspect `review` entries in the audit file. The collector deliberately withholds events with ambiguous dates, unsafe URLs, or no audience signal.
- Treat `empty` as “the page was reached but no confidently uploadable events were found,” not proof that the library has no events. Production storage preserves the last-known-good snapshot for this outcome.
- A `blocked` result is expected when robots disallow collection, a login or CAPTCHA appears, or HTTP 401/403 is returned.

Do not weaken a block just to increase event counts. Add a reviewed, source-specific adapter instead.

## Upload contract

The default endpoint is:

`https://library-loop-60457.nilkamals463352.chatgpt.site/api/collector/ingest`

The raw JSON body is exactly:

```text
{
  runId,
  collectedAt,
  adapterVersion,
  sourceResults: [
    {
      sourceId,
      sourceName,
      status: "success" | "empty" | "failed" | "blocked",
      complete: boolean,
      error?,
      events: LiveEvent[]
    }
  ]
}
```

Each event uses the dashboard’s `LiveEvent` shape and must explicitly contain a boolean `teenOnly` field. `complete` is true only when an adapter proves it covered the whole requested window; incomplete successful reads merge into the saved source instead of deleting later last-known-good events. Each source is capped at 200 events, a batch at 3,000 events, and the signed UTF-8 body at 1,500,000 bytes.

The uploader sends:

- `x-library-loop-timestamp`: current epoch seconds.
- `x-library-loop-signature`: lowercase hex HMAC-SHA256 using `LIBRARY_LOOP_INGEST_TOKEN` over `${timestamp}.${rawBody}`.

The secret is read from the current process environment. On Windows, if it is not inherited by the process, the uploader also checks the current user’s `HKCU\Environment` value. It is never written to artifacts, request logs, console output, or command arguments by the collector.

Prefer setting the token through the Windows **User environment variables** interface, then restart the desktop app or scheduled process so it inherits the value. A temporary PowerShell session can set `$env:LIBRARY_LOOP_INGEST_TOKEN`, but do not paste the value into a shared transcript or script.

Run the complete overnight workflow, including the independent 60-day structured refresh:

```powershell
pnpm collect:overnight
```

For a deliberate browser-lane-only upload, use `pnpm collect:browser`.

Or upload an already reviewed batch:

```powershell
node collector/upload.mjs collector/runs/<runId>.batch.json
```

Use `LIBRARY_LOOP_INGEST_URL` or `--url` only for a deliberate endpoint override. HTTPS is required except for an HTTP loopback development endpoint.

## Source-specific expectations

- Justice, Hometown, and William Leonard publish programs in general page content; they may need small reviewed adapters because generic JSON-LD is not necessarily Event-shaped.
- Bedford Park and Lyons may reject basic HTTP clients; the system browser path is intentional. Do not add header spoofing intended to defeat access controls.
- Hodgkins, Summit, Palos Park, and Melrose Park rely partly on PDFs or event flyers. This scaffold does not OCR them. Expect `empty` or review records until a supervised visual adapter is approved.
- Maywood and Berkeley use Wix event content. The generic semantic pass may find server-rendered tiles, but it does not inspect private hydration state or hidden network calls.
- Markham uses an official events page with a WhoFi calendar option. The collector starts at the official page and does not probe undocumented vendor endpoints.
- La Grange Park is collected from its official event pages because its older RSS path is blocked. Bellwood uses its official events page because the listed RSS feed is failing.
- Harvey is a freshness-audit source. An `empty` result does not make older Squarespace calendar material current enough to publish.
- Crestwood currently disallows the future-events path in `robots.txt`; a `blocked` result there is the intended safety behavior.

## Safety behavior

- `robots.txt` is checked before every page. A timeout, unverifiable response, cross-origin redirect, or disallow rule blocks collection.
- Sources are visited sequentially with one tab at a time.
- Navigation uses public pages only and never reuses login state intentionally.
- Login forms, sign-in redirects, CAPTCHAs, and common anti-bot challenge pages stop that source immediately.
- The generic collector does not follow event-detail links or cross-origin calendar frames.
- Only HTTPS official links accepted by the Site ingest contract are retained. HTML is stripped, descriptions are bounded, and ambiguous prose dates are not guessed.
- Adult-only, administrative, and out-of-range programs are excluded. Records with no clear youth/family/teen signal require review.
- Teen programs may be collected, but they are always labeled explicitly so the Site’s default-hidden teen filter remains effective.

## Exit behavior

- Exit `0`: collection produced at least one successful or reachable-but-empty source, and any requested upload succeeded.
- Exit `1`: setup, validation, artifact writing, or upload failed.
- Exit `2`: every selected source failed or was blocked. Artifacts are still retained when collection reached the artifact step.

Individual source failures do not cancel later sources. A production ingest retains the last-known-good snapshot for empty, failed, or blocked sources, and ignores equal-timestamp or older source results.

## Validation

Run the collector’s dependency-free tests:

```powershell
node --test collector/tests/*.test.mjs
```

Check syntax without launching a browser:

```powershell
Get-ChildItem collector -Recurse -Filter *.mjs | ForEach-Object { node --check $_.FullName }
```

Scheduling is intentionally external to the repository. The production installation may schedule the reviewed `--upload` command after the token, endpoint, browser dependency, power settings, and first source runs are verified; cloning this repository never creates or modifies a scheduled task.

On Windows, `scripts/run-overnight-collector.ps1` is the supported noninteractive entry point. It uses the system Node/Corepack installation and writes ignored logs under `collector/runs/scheduled/`. Running the script alone does not register a scheduled task or change power settings.
