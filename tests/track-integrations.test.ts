import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyze, createReview, simulate } from '../lib/engine';
import { seedInput } from '../lib/seed';
import {
  evidenceSnapshot,
  snowflakeSql,
  solanaProof,
} from '../lib/track-integrations';

test('track artifacts are deterministic and explicitly local-only', () => {
  const review = createReview(
    { ...seedInput, title: "O'Reilly incident review" },
    analyze({ ...seedInput, title: "O'Reilly incident review" }),
    'review-track-test',
  );
  review.runs = [simulate(review, 'after')];
  const snapshot = evidenceSnapshot(review);
  const proof = solanaProof(snapshot);
  const sql = snowflakeSql(snapshot);

  assert.equal(proof.submitted, false);
  assert.equal(proof.network, 'not-submitted');
  assert.match(proof.memo, /^chainpatch:v1:review-track-test:[a-f0-9]{64}$/);
  assert.doesNotMatch(proof.memo, /paper-moon-47/);
  assert.equal(proof.evidenceDigest, solanaProof(snapshot).evidenceDigest);
  assert.match(sql, /No Snowflake connection or upload was performed/);
  assert.match(sql, /O''Reilly incident review/);
  assert.match(sql, /PARSE_JSON\(/);
  assert.match(sql, /paper-moon-47/);
});

test('empty evidence still yields valid connector artifacts without invented rows', () => {
  const review = createReview(
    { ...seedInput, title: 'No replay review' },
    analyze({ ...seedInput, title: 'No replay review' }),
    'empty-track-test',
  );
  const sql = snowflakeSql(evidenceSnapshot(review));

  assert.match(sql, /CREATE TABLE IF NOT EXISTS CHAINPATCH_REPLAY_EVENTS/);
  assert.doesNotMatch(sql, /INSERT INTO CHAINPATCH_REPLAY_EVENTS/);
});
