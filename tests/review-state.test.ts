import assert from 'node:assert/strict';
import { test } from 'node:test';
import { patchEvidence } from '../components/review-state';
import { createReview, evaluatePatch } from '../lib/engine';
import { seedInput } from '../lib/seed';
import { narrowPolicy, type Policy } from '../lib/types';

test('verification follows the current policy and latest matching runs', () => {
  const review = createReview(seedInput);
  const good = evaluatePatch(review, narrowPolicy);
  const saved = { ...review, policy: narrowPolicy, runs: [good.unsafe, good.legitimate] };
  assert.equal(patchEvidence(saved).verified, true);
  for (const policy of [
    { ...narrowPolicy, action: 'disable' },
    { ...narrowPolicy, action: 'require-approval' },
    { ...narrowPolicy, allowedInputs: ['private-source', 'approved-summary'] },
  ] as Policy[]) {
    const bad = evaluatePatch(saved, policy);
    assert.equal(patchEvidence({ ...saved, policy, runs: [...saved.runs, bad.unsafe, bad.legitimate] }).verified, false);
    assert.equal(patchEvidence({ ...saved, policy }).verified, false);
  }
  assert.equal(patchEvidence({ ...saved, policy: null }).verified, false);
  assert.equal(patchEvidence({ ...saved, runs: [...saved.runs, { ...good.unsafe, outcome: 'private-exposed' }] }).verified, false);
});

test('verification requires a private-source block and successful summary destination', () => {
  const review = createReview(seedInput);
  const good = evaluatePatch(review, narrowPolicy);
  const saved = { ...review, policy: narrowPolicy, runs: [good.unsafe, good.legitimate] };
  assert.equal(patchEvidence({ ...saved, runs: [{ ...good.unsafe, events: [] }, good.legitimate] }).verified, false);
  assert.equal(patchEvidence({ ...saved, runs: [good.unsafe, { ...good.legitimate, destination: [] }] }).verified, false);
  assert.equal(patchEvidence({ ...saved, analysis: { ...saved.analysis, supported: false } }).verified, false);
});
