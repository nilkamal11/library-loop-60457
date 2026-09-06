import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveAudience } from './event-audience.ts';

test('does not hide an ages 10-13 event just because its feed also says teen', () => {
  const result = deriveAudience('Skyscraper Club', 'Ages 10-13', ['Teen']);
  assert.equal(result.include, true);
  assert.equal(result.ages, 'Ages 10–13');
  assert.equal(result.teenOnly, false);
});

test('keeps clearly teen-only ages hidden by default', () => {
  const result = deriveAudience('Teen Movie Night', 'Ages 13-19', ['Teen']);
  assert.equal(result.include, true);
  assert.equal(result.teenOnly, true);
});

test('honors a teen-labeled grade range even when sixth grade overlaps age 11', () => {
  const result = deriveAudience('Teen Volunteering', 'Grades 6-12', ['Teen']);
  assert.equal(result.include, true);
  assert.equal(result.teenOnly, true);
});

test('allows ambiguous events only from a reviewed family guide', () => {
  const ordinary = deriveAudience('Composting Demonstration', 'Learn how compost is made.', []);
  const guide = deriveAudience('Composting Demonstration', 'Learn how compost is made.', [], { curatedFamilyGuide: true });
  assert.equal(ordinary.include, false);
  assert.deepEqual(guide, { include: true, ages: 'Family / all ages', teenOnly: false, family: true });
});

test('accepts family-shaped nature programs from the reviewed Forest Preserves feed', () => {
  const result = deriveAudience('Autumn Wings', 'Learn about native butterflies and their migration.', ['Education', 'Fall Color']);
  const trusted = deriveAudience('Autumn Wings', 'Learn about native butterflies and their migration.', ['Education', 'Fall Color'], { curatedNatureProgram: true });
  assert.equal(result.include, false);
  assert.deepEqual(trusted, { include: true, ages: 'Family nature program — verify age', teenOnly: false, family: true });
});

test('does not turn adult nature wellness programs into family events', () => {
  const result = deriveAudience('Forest Therapy Walk', 'A guided forest therapy experience for adults.', ['Education'], { curatedNatureProgram: true });
  assert.equal(result.include, false);
});

test('understands Chicago Park District bounded and open-ended age labels', () => {
  const child = deriveAudience('Art and Dance', '', ['At least 6 but less than 13']);
  const teen = deriveAudience('Teen activity', '', ['13 and up']);
  const adult = deriveAudience('Fitness class', '', ['18 and up']);
  assert.deepEqual({ ages: child.ages, teenOnly: child.teenOnly, include: child.include }, { ages: 'Ages 6–12', teenOnly: false, include: true });
  assert.deepEqual({ ages: teen.ages, teenOnly: teen.teenOnly, include: teen.include }, { ages: 'Ages 13+', teenOnly: true, include: true });
  assert.equal(adult.include, false);
});

test('never interprets a price ending in plus as an age', () => {
  assert.deepEqual(
    deriveAudience('Adult workshop', 'Adults only; materials fee $12+', []),
    { include: false, ages: '', teenOnly: false, family: false },
  );
});

test('still understands a bare age value in a structured audience label', () => {
  const result = deriveAudience('Open studio', '', ['10 and up']);
  assert.equal(result.include, true);
  assert.equal(result.ages, 'Ages 10+');
  assert.equal(result.teenOnly, false);
});
