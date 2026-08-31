import test from 'node:test';
import assert from 'node:assert/strict';
import { librarySources } from '../sources.mjs';
import { fetchOvernightEvents } from '../../lib/overnight-events.ts';

test('overnight API failures are reported as failed sources instead of a clean empty result', async () => {
  const result = await fetchOvernightEvents('2026-08-30', undefined, async () => Response.json(
    { error: 'Temporarily unavailable' },
    { status: 503 },
  ));
  assert.equal(result.events.length, 0);
  assert.equal(result.sourceStatus.attempted, librarySources.length);
  assert.equal(result.sourceStatus.connected, 0);
  assert.equal(result.sourceStatus.failed, librarySources.length);
  assert.deepEqual(result.sourceStatus.failedSources, librarySources.map((source) => source.name));
});

test('malformed and unreachable overnight responses fail visibly but remain non-throwing', async () => {
  const malformed = await fetchOvernightEvents('2026-08-30', undefined, async () => new Response('{bad json', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));
  assert.equal(malformed.sourceStatus.failed, librarySources.length);

  const unreachable = await fetchOvernightEvents('2026-08-30', undefined, async () => {
    throw new TypeError('Network unavailable');
  });
  assert.equal(unreachable.sourceStatus.failed, librarySources.length);
});

test('valid overnight responses pass through unchanged', async () => {
  const expected = {
    events: [],
    sourceStatus: { attempted: 2, connected: 2, empty: 1, failed: 0, failedSources: [] },
  };
  const result = await fetchOvernightEvents('2026-08-30', undefined, async () => Response.json(expected));
  assert.deepEqual(result, expected);
});

test('a caller abort still cancels the complete page refresh', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fetchOvernightEvents('2026-08-30', controller.signal, async () => {
      throw new DOMException('Aborted', 'AbortError');
    }),
    (error) => error instanceof DOMException && error.name === 'AbortError',
  );
});
