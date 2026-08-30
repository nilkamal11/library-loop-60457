import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createIngestSignature, uploadPayload } from '../upload.mjs';

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
  const payload = {
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
