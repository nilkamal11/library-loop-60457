import test from 'node:test';
import assert from 'node:assert/strict';
import { librarySources } from '../collector/sources.mjs';
import { structuredSources } from './source-catalog.ts';

test('public source catalog matches the 102 configured operational sources', () => {
  assert.equal(structuredSources.length, 85);
  assert.equal(librarySources.length, 17);
  const ids = [...structuredSources.map((source) => source.id), ...librarySources.map((source) => source.id)];
  assert.equal(ids.length, 102);
  assert.equal(new Set(ids).size, 102);
});

test('every configured source has a reviewed HTTPS location', () => {
  for (const source of structuredSources) assert.match(source.endpoint, /^https:\/\//);
  for (const source of librarySources) assert.match(source.url, /^https:\/\//);
});
