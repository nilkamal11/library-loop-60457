import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedByRobots, parseRobots } from '../robots.mjs';

test('robots uses the longest matching allow/disallow rule', () => {
  const groups = parseRobots(`
    User-agent: *
    Disallow: /private/
    Allow: /private/events/
  `);
  assert.equal(isAllowedByRobots('https://example.org/private/account', groups), false);
  assert.equal(isAllowedByRobots('https://example.org/private/events/today', groups), true);
  assert.equal(isAllowedByRobots('https://example.org/events', groups), true);
});

test('collector-specific group takes precedence over wildcard', () => {
  const groups = parseRobots(`
    User-agent: *
    Allow: /

    User-agent: LibraryLoopCollector
    Disallow: /calendar
  `);
  assert.equal(isAllowedByRobots('https://example.org/calendar', groups), false);
  assert.equal(isAllowedByRobots('https://example.org/news', groups), true);
});

test('empty disallow is treated as unrestricted', () => {
  const groups = parseRobots('User-agent: *\nDisallow:\n');
  assert.equal(isAllowedByRobots('https://example.org/anything', groups), true);
});

