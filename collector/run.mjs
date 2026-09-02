import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectSourcePage, openBrowserSession } from './browser.mjs';
import { ADAPTER_VERSION, CHICAGO_TIME_ZONE, DEFAULT_WINDOW_DAYS } from './constants.mjs';
import {
  extractJsonLdEvents,
  jsonLdToCandidate,
  normalizeCandidates,
  validateIngestPayload,
} from './normalize.mjs';
import { findSource, librarySources } from './sources.mjs';
import { uploadPayload } from './upload.mjs';

const collectorDirectory = path.dirname(fileURLToPath(import.meta.url));
const runsDirectory = path.join(collectorDirectory, 'runs');

function chicagoTodayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDays(dateKey, amount) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function makeRunId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `library-loop-${stamp}-${randomBytes(4).toString('hex')}`;
}

function safeError(error) {
  const message = error instanceof Error ? error.message : 'Unknown collection error';
  return message.replace(/\s+/g, ' ').slice(0, 500);
}

function usage() {
  return [
    'Library Loop local page collector',
    '',
    'Usage:',
    '  node collector/run.mjs --dry-run [options]',
    '  node collector/run.mjs --upload [options]',
    '  node collector/run.mjs --list-sources',
    '',
    'Options:',
    '  --source <id>            Collect one source; repeat for more than one.',
    `  --window-days <n>        Future window, 1–180 days (default ${DEFAULT_WINDOW_DAYS}).`,
    '  --browser-path <path>    System Chrome or Edge executable.',
    '  --playwright-path <path> Playwright Core package directory or index.mjs.',
    '  --headed                 Show the browser for a supervised test.',
    '  --timeout-ms <n>         Per-page navigation timeout.',
    '  --settle-ms <n>          Brief wait after DOMContentLoaded.',
    '  --url <https-url>        Override the ingest endpoint in upload mode.',
    '',
    'Dry-run is the default and never calls the ingest endpoint.',
  ].join('\n');
}

function positiveInteger(value, name, min, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${name} must be between ${min} and ${max}`);
  return number;
}

function parseCli(argv) {
  const options = {
    mode: 'dry-run',
    explicitMode: false,
    sourceIds: [],
    windowDays: DEFAULT_WINDOW_DAYS,
    headed: false,
    browserPath: '',
    playwrightPath: '',
    endpoint: '',
    listSources: false,
  };
  const args = [...argv];
  while (args.length) {
    const arg = args.shift();
    if (arg === '--help' || arg === '-h') return { ...options, help: true };
    if (arg === '--dry-run' || arg === '--upload') {
      const requested = arg === '--upload' ? 'upload' : 'dry-run';
      if (options.explicitMode && options.mode !== requested) throw new Error('--dry-run and --upload cannot be combined');
      options.mode = requested;
      options.explicitMode = true;
    } else if (arg === '--source') {
      const value = args.shift();
      if (!value) throw new Error('--source requires an ID');
      options.sourceIds.push(value);
    } else if (arg === '--window-days') {
      options.windowDays = positiveInteger(args.shift(), '--window-days', 1, 180);
    } else if (arg === '--browser-path') {
      options.browserPath = args.shift() ?? '';
      if (!options.browserPath) throw new Error('--browser-path requires a value');
    } else if (arg === '--playwright-path') {
      options.playwrightPath = args.shift() ?? '';
      if (!options.playwrightPath) throw new Error('--playwright-path requires a value');
    } else if (arg === '--headed') {
      options.headed = true;
    } else if (arg === '--timeout-ms') {
      options.navigationTimeoutMs = positiveInteger(args.shift(), '--timeout-ms', 1_000, 120_000);
    } else if (arg === '--settle-ms') {
      options.settleMs = positiveInteger(args.shift(), '--settle-ms', 0, 15_000);
    } else if (arg === '--url') {
      options.endpoint = args.shift() ?? '';
      if (!options.endpoint) throw new Error('--url requires a value');
    } else if (arg === '--list-sources') {
      options.listSources = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return { ...options, help: false };
}

function selectSources(options) {
  if (options.sourceIds.length) {
    const selected = [];
    for (const id of [...new Set(options.sourceIds)]) {
      const source = findSource(id);
      if (!source) throw new Error(`Unknown source ID: ${id}`);
      selected.push(source);
    }
    return selected;
  }
  return [...librarySources];
}

function printSources() {
  for (const source of librarySources) {
    const state = source.enabled ? 'browser' : 'disabled';
    console.log(`${source.id}\t${state}\t${source.name}\t${source.url ?? 'no verified URL'}`);
  }
}

async function collectOne(session, source, window, options) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  if (!source.enabled) {
    const reason = 'No verified browser source URL is configured';
    return {
      sourceResult: { sourceId: source.id, sourceName: source.name, status: 'blocked', complete: false, error: reason, events: [] },
      audit: { sourceId: source.id, sourceName: source.name, startedAt, completedAt: new Date().toISOString(), durationMs: Date.now() - startedMs, outcome: 'blocked', reason, accepted: 0, review: [], excludedCount: 0 },
    };
  }

  try {
    const pageResult = await collectSourcePage(session, source, options);
    if (pageResult.outcome === 'blocked') {
      return {
        sourceResult: { sourceId: source.id, sourceName: source.name, status: 'blocked', complete: false, error: pageResult.error, events: [] },
        audit: { ...pageResult.audit, sourceName: source.name, startedAt, completedAt: new Date().toISOString(), durationMs: Date.now() - startedMs, outcome: 'blocked', reason: pageResult.error, accepted: 0, review: [], excludedCount: 0 },
      };
    }

    const jsonLdCandidates = extractJsonLdEvents(pageResult.rawJsonLd).map((record) => jsonLdToCandidate(record, pageResult.audit.finalUrl || source.url));
    const candidates = [...jsonLdCandidates, ...pageResult.domCandidates];
    const normalized = normalizeCandidates(candidates, source, window);
    const status = normalized.events.length ? 'success' : 'empty';
    const emptyReason = 'No confidently publishable events were found; retain the last-known-good snapshot.';
    return {
      sourceResult: {
        sourceId: source.id,
        sourceName: source.name,
        status,
        // The generic browser pass reads one public page. It cannot prove that
        // a paged, framed, or month-based calendar exposed its full window.
        complete: false,
        ...(status === 'empty' ? { error: emptyReason } : {}),
        events: normalized.events,
      },
      audit: {
        ...pageResult.audit,
        sourceName: source.name,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        outcome: status,
        requiresVisualReview: source.requiresVisualReview,
        parsedJsonLdEvents: jsonLdCandidates.length,
        accepted: normalized.events.length,
        review: normalized.review.slice(0, 100),
        reviewCount: normalized.review.length,
        excluded: normalized.excluded.slice(0, 50),
        excludedCount: normalized.excluded.length,
      },
    };
  } catch (error) {
    const message = safeError(error);
    return {
      sourceResult: { sourceId: source.id, sourceName: source.name, status: 'failed', complete: false, error: message, events: [] },
      audit: { sourceId: source.id, sourceName: source.name, startedAt, completedAt: new Date().toISOString(), durationMs: Date.now() - startedMs, outcome: 'failed', reason: message, accepted: 0, review: [], excludedCount: 0 },
    };
  }
}

async function writeArtifacts(payload, audit) {
  await mkdir(runsDirectory, { recursive: true });
  const batchPath = path.join(runsDirectory, `${payload.runId}.batch.json`);
  const auditPath = path.join(runsDirectory, `${payload.runId}.audit.json`);
  await writeFile(batchPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { batchPath, auditPath };
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (options.listSources) {
    printSources();
    return;
  }

  const selected = selectSources(options);
  if (!selected.length) throw new Error('No sources were selected');
  const runId = makeRunId();
  const startedAt = new Date().toISOString();
  const start = chicagoTodayKey();
  const window = { start, end: addDays(start, options.windowDays) };
  const needsBrowser = selected.some((source) => source.enabled);
  let session = null;
  const collected = [];
  try {
    if (needsBrowser) session = await openBrowserSession({ browserPath: options.browserPath, playwrightPath: options.playwrightPath, headless: !options.headed });
    for (const source of selected) {
      console.log(`Collecting ${source.name}…`);
      collected.push(await collectOne(session, source, window, options));
    }
  } finally {
    if (session) await session.close();
  }

  const collectedAt = new Date().toISOString();
  const payload = {
    runId,
    collectedAt,
    adapterVersion: ADAPTER_VERSION,
    sourceResults: collected.map((item) => item.sourceResult),
  };
  validateIngestPayload(payload);
  const summary = Object.fromEntries(['success', 'empty', 'failed', 'blocked'].map((status) => [status, payload.sourceResults.filter((result) => result.status === status).length]));
  const audit = {
    runId,
    mode: options.mode,
    adapterVersion: ADAPTER_VERSION,
    startedAt,
    completedAt: collectedAt,
    window,
    browser: session ? { executablePath: session.executablePath, headless: !options.headed } : null,
    summary,
    totalEvents: payload.sourceResults.reduce((sum, result) => sum + result.events.length, 0),
    sources: collected.map((item) => item.audit),
  };
  const artifacts = await writeArtifacts(payload, audit);
  console.log(`Batch: ${artifacts.batchPath}`);
  console.log(`Audit: ${artifacts.auditPath}`);
  console.log(`Sources: ${summary.success} success, ${summary.empty} empty, ${summary.failed} failed, ${summary.blocked} blocked. Events: ${audit.totalEvents}.`);

  if (options.mode === 'upload') {
    const upload = await uploadPayload(payload, { ...(options.endpoint ? { endpoint: options.endpoint } : {}) });
    const requestNote = upload.requestId ? ` Request ${upload.requestId}.` : '';
    const appliedNote = Number.isInteger(upload.appliedSourceCount) ? ` Applied ${upload.appliedSourceCount} sources.` : '';
    const staleNote = upload.staleSourceIds?.length ? ` Ignored ${upload.staleSourceIds.length} stale source writes.` : '';
    audit.upload = {
      accepted: true,
      acceptedAt: new Date().toISOString(),
      status: upload.status,
      requestId: upload.requestId,
      eventCount: upload.eventCount,
      sourceCount: upload.sourceCount,
      appliedSourceCount: upload.appliedSourceCount,
      staleSourceIds: upload.staleSourceIds ?? [],
    };
    await writeFile(artifacts.auditPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
    console.log(`Upload accepted (HTTP ${upload.status}).${requestNote}${appliedNote}${staleNote}`);
  } else {
    console.log('Dry run complete; upload was not attempted.');
  }

  if (summary.success + summary.empty === 0) process.exitCode = 2;
}

const invokedDirectly = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Collector run failed.');
    process.exitCode = 1;
  });
}
