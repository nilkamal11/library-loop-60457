import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { MAX_INGEST_BODY_BYTES } from '../constants.mjs';
import { assertIngestBodySize, createIngestSignature, uploadPayload } from '../upload.mjs';

function validPayload() {
  return {
    runId: 'library-loop-upload-test',
    collectedAt: '2026-08-30T20:00:00.000Z',
    adapterVersion: 'library-loop-browser-v1',
    sourceResults: [{
      sourceId: 'justice-public-library',
      sourceName: 'Justice Public Library District',
      status: 'success',
      events: [{
        id: 'collector-justice-public-library-1234567890',
        title: 'Family Game Night',
        startLocal: '2026-09-01T18:00:00',
        dateKey: '2026-09-01',
        allDay: false,
        source: 'Justice Public Library District',
        sourceKind: 'Library',
        venue: 'Community Room',
        address: '1 Main St',
        distance: 1,
        ages: 'Family / all ages',
        teenOnly: false,
        family: true,
        category: 'Play',
        tone: 'plum',
        mark: 'PLAY',
        description: 'Games for the whole family.',
        registrationStatus: 'Check official listing',
        registrationUrl: 'https://example.org/events/family-game-night',
        url: 'https://example.org/events/family-game-night',
      }],
    }],
  };
}

test('signature is lowercase HMAC-SHA256 of timestamp dot raw body', () => {
  const secret = 'test-secret';
  const timestamp = '1788120000';
  const rawBody = '{"runId":"library-loop-test"}';
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const signature = createIngestSignature(secret, timestamp, rawBody);
  assert.equal(signature, expected);
  assert.match(signature, /^[0-9a-f]{64}$/);
});

test('uploader signs and sends the exact raw JSON contract', async () => {
  const payload = validPayload();
  const secret = 'another-test-secret';
  const timestamp = '1788123456';
  let request;
  const fetchImpl = async (url, init) => {
    request = { url, init };
    return new Response(null, { status: 204, headers: { 'x-request-id': 'test-request' } });
  };
  const result = await uploadPayload(payload, {
    secret,
    timestamp,
    endpoint: 'https://example.org/api/collector/ingest',
    fetchImpl,
  });
  assert.equal(result.status, 204);
  assert.equal(request.url, 'https://example.org/api/collector/ingest');
  assert.equal(request.init.body, JSON.stringify(payload));
  assert.equal(request.init.headers['x-library-loop-timestamp'], timestamp);
  assert.equal(
    request.init.headers['x-library-loop-signature'],
    createHmac('sha256', secret).update(`${timestamp}.${request.init.body}`).digest('hex'),
  );
});

test('local payload size guard exactly matches the server byte limit', () => {
  assert.equal(assertIngestBodySize('a'.repeat(MAX_INGEST_BODY_BYTES)), MAX_INGEST_BODY_BYTES);
  assert.throws(
    () => assertIngestBodySize('a'.repeat(MAX_INGEST_BODY_BYTES + 1)),
    /1,500,000 byte server limit/,
  );
  assert.throws(
    () => assertIngestBodySize('é'.repeat(Math.floor(MAX_INGEST_BODY_BYTES / 2) + 1)),
    /1,500,000 byte server limit/,
  );
});

test('uploader reports the bounded server error detail', async () => {
  await assert.rejects(
    uploadPayload(validPayload(), {
      secret: 'test-secret',
      timestamp: '1788123456',
      endpoint: 'https://example.org/api/collector/ingest',
      fetchImpl: async () => Response.json({ error: 'Collector timestamp is too far in the future' }, { status: 400 }),
    }),
    /HTTP 400: Collector timestamp is too far in the future/,
  );
});

test('uploader returns the bounded successful write receipt', async () => {
  const result = await uploadPayload(validPayload(), {
    secret: 'test-secret',
    timestamp: '1788123456',
    endpoint: 'https://example.org/api/collector/ingest',
    fetchImpl: async () => Response.json({
      accepted: true,
      eventCount: 1,
      sourceCount: 1,
      appliedSourceCount: 0,
      staleSourceIds: ['justice-public-library'],
      ignored: 'not copied',
    }, { status: 202, headers: { 'x-request-id': 'receipt-test' } }),
  });
  assert.deepEqual(result, {
    status: 202,
    requestId: 'receipt-test',
    eventCount: 1,
    sourceCount: 1,
    appliedSourceCount: 0,
    staleSourceIds: ['justice-public-library'],
  });
});
