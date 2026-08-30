import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DEFAULT_INGEST_URL, INGEST_TOKEN_ENV, INGEST_URL_ENV } from './constants.mjs';
import { validateIngestPayload } from './normalize.mjs';

function windowsUserEnvironmentValue(name) {
  if (process.platform !== 'win32') return '';
  const result = spawnSync('reg.exe', ['query', 'HKCU\\Environment', '/v', name], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0 || !result.stdout) return '';
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = result.stdout.match(new RegExp(`^\\s*${escapedName}\\s+REG_(?:SZ|EXPAND_SZ)\\s+(.+?)\\s*$`, 'mi'));
  return match?.[1]?.trim() ?? '';
}

export function readIngestSecret() {
  const processValue = process.env[INGEST_TOKEN_ENV]?.trim();
  if (processValue) return processValue;
  const userValue = windowsUserEnvironmentValue(INGEST_TOKEN_ENV);
  if (userValue) return userValue;
  throw new Error(`${INGEST_TOKEN_ENV} is not set in the process or Windows user environment.`);
}

export function createIngestSignature(secret, timestamp, rawBody) {
  if (typeof secret !== 'string' || !secret) throw new TypeError('A non-empty ingest secret is required');
  if (!/^\d{10,}$/.test(String(timestamp))) throw new TypeError('Timestamp must be epoch seconds');
  if (typeof rawBody !== 'string' || !rawBody) throw new TypeError('Raw body must be a non-empty JSON string');
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
}

function validateEndpoint(value) {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
    throw new Error('The ingest URL must use HTTPS, except for a loopback development URL.');
  }
  return url.toString();
}

export async function uploadPayload(payload, options = {}) {
  validateIngestPayload(payload);
  const rawBody = JSON.stringify(payload);
  if (Buffer.byteLength(rawBody, 'utf8') > 5_000_000) throw new Error('Collector ingest payload exceeds the 5 MB local safety limit.');
  const secret = options.secret ?? readIngestSecret();
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1_000));
  const signature = createIngestSignature(secret, timestamp, rawBody);
  const endpoint = validateEndpoint(options.endpoint ?? process.env[INGEST_URL_ENV] ?? DEFAULT_INGEST_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        'x-library-loop-timestamp': timestamp,
        'x-library-loop-signature': signature,
      },
      body: rawBody,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Collector ingest returned HTTP ${response.status}.`);
    return {
      status: response.status,
      requestId: response.headers.get('x-request-id') ?? response.headers.get('cf-ray') ?? '',
    };
  } finally {
    clearTimeout(timer);
  }
}

function usage() {
  return [
    'Usage: node collector/upload.mjs <batch.json> [--url https://.../api/collector/ingest]',
    '',
    `Reads ${INGEST_TOKEN_ENV} from the process environment or Windows user environment.`,
    'The secret and signature are never printed.',
  ].join('\n');
}

function parseCli(argv) {
  const args = [...argv];
  let file = '';
  let endpoint = '';
  while (args.length) {
    const arg = args.shift();
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--url') {
      endpoint = args.shift() ?? '';
      if (!endpoint) throw new Error('--url requires a value');
    } else if (!file) {
      file = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  if (!file) throw new Error('A batch JSON path is required');
  return { help: false, file, endpoint };
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  if (cli.help) {
    console.log(usage());
    return;
  }
  const raw = await readFile(path.resolve(cli.file), 'utf8');
  const payload = JSON.parse(raw);
  const result = await uploadPayload(payload, { ...(cli.endpoint ? { endpoint: cli.endpoint } : {}) });
  const requestNote = result.requestId ? ` Request ${result.requestId}.` : '';
  console.log(`Upload accepted (HTTP ${result.status}).${requestNote}`);
}

const invokedDirectly = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Collector upload failed.');
    process.exitCode = 1;
  });
}
