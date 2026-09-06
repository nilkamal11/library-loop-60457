import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAudience,
  extractJsonLdEvents,
  jsonLdToCandidate,
  normalizeCandidates,
  parseDateValue,
  validateIngestPayload,
} from '../normalize.mjs';
import { findSource, librarySources } from '../sources.mjs';

const source = {
  ...findSource('justice-public-library'),
  url: 'https://example.org/events',
};
const window = { start: '2026-08-30', end: '2026-10-30' };

test('nested JSON-LD Event becomes a child-safe LiveEvent', () => {
  const scripts = [JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'Event',
      name: 'Family Coding Workshop',
      startDate: '2026-09-12T10:00:00-05:00',
      endDate: '2026-09-12T11:30:00-05:00',
      description: 'Kids ages 8-12 can build a small robot with a caregiver.',
      url: '/events/family-coding',
      location: {
        '@type': 'Place',
        name: 'Youth Room',
        address: { streetAddress: '1 Main St', addressLocality: 'Example', addressRegion: 'IL', postalCode: '60000' },
      },
    }],
  })];
  const candidates = extractJsonLdEvents(scripts).map((record) => jsonLdToCandidate(record, source.url));
  const normalized = normalizeCandidates(candidates, source, window);
  assert.equal(normalized.events.length, 1);
  assert.equal(normalized.review.length, 0);
  assert.equal(normalized.events[0].teenOnly, false);
  assert.equal(normalized.events[0].sourceKind, 'Library');
  assert.equal(normalized.events[0].ages, 'Ages 8–12');
  assert.equal(normalized.events[0].dateKey, '2026-09-12');
  assert.equal(normalized.events[0].category, 'Build');
});

test('the future window includes day 0 through day 59 and excludes day 60', () => {
  const candidate = (dateKey) => ({
    title: `Family activity ${dateKey}`,
    start: `${dateKey}T10:00:00-05:00`,
    description: 'A family activity for kids ages 7-12.',
    url: `https://example.org/events/${dateKey}`,
  });
  const normalized = normalizeCandidates([
    candidate('2026-08-30'),
    candidate('2026-10-28'),
    candidate('2026-10-29'),
    candidate('2026-10-30'),
  ], source, { start: '2026-08-30', end: '2026-10-29' });
  assert.deepEqual(normalized.events.map((item) => item.dateKey), ['2026-08-30', '2026-10-28']);
});

test('teen-only events remain explicit and adult/unknown events are not accepted', () => {
  const teen = classifyAudience('Teen studio for ages 13+');
  assert.equal(teen.decision, 'accepted');
  assert.equal(teen.teenOnly, true);

  const adult = classifyAudience('Adults only retirement planning lecture');
  assert.equal(adult.decision, 'excluded');

  const unknown = classifyAudience('Local history discussion');
  assert.equal(unknown.decision, 'review');
});

test('an explicit ages 10-13 range is not hidden by a teen label', () => {
  const mixed = classifyAudience('Teen skyscraper club for ages 10-13');
  assert.equal(mixed.decision, 'accepted');
  assert.equal(mixed.ages, 'Ages 10–13');
  assert.equal(mixed.teenOnly, false);

  const teenGrades = classifyAudience('Teen volunteering for grades 6-12');
  assert.equal(teenGrades.decision, 'accepted');
  assert.equal(teenGrades.teenOnly, true);
});

test('recognizes bounded and years-based age formats consistently', () => {
  assert.equal(classifyAudience('At least 6 years but less than 13').ages, 'Ages 6–12');
  assert.equal(classifyAudience('Designed for 7 to 12 years').ages, 'Ages 7–12');
  assert.equal(classifyAudience('Open studio', '10 and up').ages, 'Ages 10+');
  assert.equal(classifyAudience('Adults only; materials fee $12+').decision, 'excluded');
});

test('only semantic local or offset-bearing dates are accepted', () => {
  assert.deepEqual(parseDateValue('2026-09-12'), { localIso: '2026-09-12T00:00:00', allDay: true });
  assert.deepEqual(parseDateValue('2026-09-12T10:15:00'), { localIso: '2026-09-12T10:15:00', allDay: false });
  assert.equal(parseDateValue('2026-02-31T10:15:00'), null);
  assert.equal(parseDateValue('next Saturday morning'), null);
});

test('early-childhood-only language and non-HTTPS URLs are withheld', () => {
  assert.equal(classifyAudience('Toddler storytime for children').decision, 'excluded');
  const normalized = normalizeCandidates([{
    title: 'Family Game Night',
    start: '2026-09-18T18:00:00-05:00',
    description: 'Games for all ages.',
    url: 'http://example.org/events/game-night',
  }], source, window);
  assert.equal(normalized.events.length, 0);
  assert.equal(normalized.review[0]?.reason, 'missing safe official event URL');
});

test('ingest validation requires explicit teenOnly and the exact source contract', () => {
  const candidate = {
    title: 'Teen Game Night',
    start: '2026-09-18T18:00:00-05:00',
    description: 'For teens ages 13-17.',
    url: 'https://example.org/events/teen-game-night',
  };
  const event = normalizeCandidates([candidate], source, window).events[0];
  const payload = {
    runId: 'library-loop-test-0001',
    collectedAt: '2026-08-30T20:00:00.000Z',
    adapterVersion: 'library-loop-browser-v1',
    sourceResults: [{ sourceId: source.id, sourceName: source.name, status: 'success', complete: false, events: [event] }],
  };
  assert.equal(event.teenOnly, true);
  assert.equal(validateIngestPayload(payload), true);
  assert.throws(() => validateIngestPayload({ ...payload, sourceResults: [] }), /must contain 1 to/);
  const invalid = structuredClone(payload);
  delete invalid.sourceResults[0].events[0].teenOnly;
  assert.throws(() => validateIngestPayload(invalid), /teenOnly/);
  const invalidCompleteness = structuredClone(payload);
  invalidCompleteness.sourceResults[0].complete = 'sometimes';
  assert.throws(() => validateIngestPayload(invalidCompleteness), /complete must be a boolean/);
});

test('local validation enforces the same 3000-event batch cap as the server', () => {
  const template = normalizeCandidates([{
    title: 'Family Game Night',
    start: '2026-09-18T18:00:00-05:00',
    description: 'Games for all ages.',
    url: 'https://example.org/events/family-game-night',
  }], source, window).events[0];
  const sourceResult = (configuredSource, sourceIndex, count) => ({
    sourceId: configuredSource.id,
    sourceName: configuredSource.name,
    status: 'success',
    events: Array.from({ length: count }, (_, eventIndex) => ({
      ...template,
      id: `collector-${configuredSource.id}-${eventIndex}`,
      source: configuredSource.name,
      distance: configuredSource.distance,
      registrationUrl: `https://example.org/events/${sourceIndex}-${eventIndex}`,
      url: `https://example.org/events/${sourceIndex}-${eventIndex}`,
    })),
  });
  const sourceResults = librarySources.slice(0, 15).map((configuredSource, sourceIndex) => sourceResult(configuredSource, sourceIndex, 200));
  const payload = {
    runId: 'library-loop-batch-limit-test',
    collectedAt: '2026-08-30T20:00:00.000Z',
    adapterVersion: 'library-loop-browser-v1',
    sourceResults,
  };
  assert.equal(validateIngestPayload(payload), true);

  const overLimit = structuredClone(payload);
  overLimit.sourceResults.push(sourceResult(librarySources[15], 15, 1));
  assert.throws(() => validateIngestPayload(overLimit), /cannot exceed 3000 events/);
});
