import test from 'node:test';
import assert from 'node:assert/strict';
import { enabledSources, librarySources } from '../sources.mjs';

test('manifest contains the 16 overnight page/manual libraries with stable unique IDs', () => {
  assert.equal(librarySources.length, 16);
  assert.equal(librarySources.filter((source) => source.status === 'page').length, 9);
  assert.equal(librarySources.filter((source) => source.status === 'manual').length, 7);
  assert.equal(new Set(librarySources.map((source) => source.id)).size, librarySources.length);
  for (const source of librarySources) {
    assert.match(source.id, /^[a-z0-9-]+$/);
    assert.ok(source.url === null || source.url.startsWith('https://'));
  }
});

test('overnight inventory excludes Chicago and contains only browser-page sources', () => {
  assert.equal(librarySources.some((source) => /chicago public/i.test(source.name)), false);
  assert.equal(enabledSources().length, 16);
  assert.ok(enabledSources().every((source) => source.collectionMode === 'browser-page'));
});
