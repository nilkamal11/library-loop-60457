import { collectorDatabase, collectorEnv, collectorRunExists, ensureCollectorSchema, writeCollectorBatch } from '@/lib/collector-db';
import { parseCollectorBatch } from '@/lib/collector-contract';
import { MAX_INGEST_BODY_BYTES } from '@/lib/collector-limits.mjs';

export const runtime = 'edge';

const MAX_CLOCK_SKEW_SECONDS = 300;

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function equalHex(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

async function expectedSignature(secret: string, timestamp: string, rawBody: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`)));
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > MAX_INGEST_BODY_BYTES) return Response.json({ error: 'Payload too large' }, { status: 413 });
  const timestamp = request.headers.get('x-library-loop-timestamp') ?? '';
  const signature = request.headers.get('x-library-loop-signature')?.toLowerCase() ?? '';
  const timestampNumber = Number(timestamp);
  if (!/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - timestampNumber) > MAX_CLOCK_SKEW_SECONDS) {
    return Response.json({ error: 'Stale or invalid request timestamp' }, { status: 401 });
  }
  const secret = (await collectorEnv()).LIBRARY_LOOP_INGEST_TOKEN;
  if (!secret) return Response.json({ error: 'Collector authentication is not configured' }, { status: 503 });

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_INGEST_BODY_BYTES) return Response.json({ error: 'Payload too large' }, { status: 413 });
  if (!/^[a-f0-9]{64}$/.test(signature) || !equalHex(signature, await expectedSignature(secret, timestamp, rawBody))) {
    return Response.json({ error: 'Invalid collector signature' }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const batch = parseCollectorBatch(parsed);
  if (!batch) return Response.json({ error: 'Collector payload failed validation' }, { status: 400 });
  if (Date.parse(batch.collectedAt) > (timestampNumber + MAX_CLOCK_SKEW_SECONDS) * 1000) {
    return Response.json({ error: 'Collector timestamp is too far in the future' }, { status: 400 });
  }

  try {
    const database = await collectorDatabase();
    await ensureCollectorSchema(database);
    if (await collectorRunExists(database, batch.runId)) return Response.json({ error: 'Run already received' }, { status: 409 });
    const bodyHash = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawBody)));
    const write = await writeCollectorBatch(database, batch, bodyHash);
    return Response.json({
      accepted: true,
      runId: batch.runId,
      sourceCount: batch.sourceResults.length,
      ...write,
    }, { status: 202 });
  } catch (error) {
    console.error('Collector write failed', error);
    return Response.json({ error: 'Collector write failed' }, { status: 500 });
  }
}
