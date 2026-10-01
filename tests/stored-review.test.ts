import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReview, evaluatePatch } from '../lib/engine';
import { seedInput } from '../lib/seed';
import { narrowPolicy } from '../lib/types';
import { decodeStoredReview, encodeStoredReview } from '../lib/stored-review';

test('unversioned records and versioned records retain complete evidence and extra fields', () => {
  const review = createReview(seedInput);
  const { unsafe, legitimate } = evaluatePatch(review);
  const saved = { ...review, policy: narrowPolicy, runs: [unsafe, legitimate], futureMetadata: { note: 'keep me' } };
  const persisted = JSON.parse(JSON.stringify(saved));
  assert.deepEqual(decodeStoredReview(JSON.stringify(saved)), persisted);
  const encoded = encodeStoredReview(saved);
  assert.equal(JSON.parse(encoded).storageSchemaVersion, 1);
  assert.deepEqual(decodeStoredReview(encoded), persisted);
});

test('legacy capability metadata is filled without changing original instructions or traces', () => {
  const saved = createReview(seedInput);
  const legacy = JSON.parse(JSON.stringify(saved));
  for (const skill of legacy.skills) { delete skill.tools; delete skill.destinations; }
  delete legacy.analysis.evidenceProvenance;
  delete legacy.analysis.supported;
  const migrated = decodeStoredReview(JSON.stringify(legacy));
  assert.equal(migrated.current, saved.current);
  assert.deepEqual(migrated.skills, saved.skills);
  assert.deepEqual(migrated.runs, saved.runs);
  assert.equal(migrated.analysis.supported, false);
  assert.deepEqual(migrated.analysis.evidenceProvenance, []);
});

test('corrupt data and future schema versions are rejected rather than silently changed', () => {
  const saved = createReview(seedInput);
  for (const data of ['not JSON', '{}', JSON.stringify({ ...saved, skills: [] }), JSON.stringify({ ...saved, runs: [{ outcome: 'blocked' }] }), JSON.stringify({ storageSchemaVersion: 2, review: saved })]) {
    assert.throws(() => decodeStoredReview(data), /stored data was left unchanged/);
  }
  assert.throws(() => encodeStoredReview({ ...saved, policy: { ...narrowPolicy, allowedInputs: ['unknown'] } } as never), /invalid review/);
});
