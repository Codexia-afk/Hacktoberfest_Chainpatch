import { createHash } from 'node:crypto';
import type { Policy, Replay, Review } from './types';

/**
 * These artifacts are deliberately local-first. They make ChainPatch evidence
 * portable to Solana/Snowflake workflows without pretending that a wallet,
 * RPC node, account, or Snowflake connection was used.
 */
export const TRACK_ARTIFACT_SCHEMA_VERSION = 1;

export interface EvidenceSnapshot {
  schemaVersion: typeof TRACK_ARTIFACT_SCHEMA_VERSION;
  review: {
    id: string;
    title: string;
    createdAt: string;
  };
  sourceDigests: {
    current: string;
    proposed: string;
    installed: string;
  };
  analysis: {
    origin: Review['analysis']['origin'];
    model: string | null;
    supported: boolean;
    newRoute: boolean;
    beforeRoute: boolean;
    afterRoute: boolean;
    publisher: boolean;
    evidence: Review['analysis']['evidenceProvenance'];
  };
  policy: Policy | null;
  replays: Replay[];
}

export interface SolanaProof {
  schemaVersion: typeof TRACK_ARTIFACT_SCHEMA_VERSION;
  kind: 'solana-memo-proof';
  program: 'SPL Memo';
  network: 'not-submitted';
  submitted: false;
  digestAlgorithm: 'SHA-256';
  evidenceDigest: string;
  memo: string;
  limitation: string;
}

const digest = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

const json = (value: unknown): string => JSON.stringify(value);

function snapshotInput(value: Review | EvidenceSnapshot): EvidenceSnapshot {
  if ('schemaVersion' in value) return value;
  return evidenceSnapshot(value);
}

export function evidenceSnapshot(review: Review): EvidenceSnapshot {
  return {
    schemaVersion: TRACK_ARTIFACT_SCHEMA_VERSION,
    review: {
      id: review.id,
      title: review.title,
      createdAt: review.createdAt,
    },
    // The proof binds the supplied instructions without putting them into a
    // public memo. Full instructions remain available in the normal export.
    sourceDigests: {
      current: digest(review.current),
      proposed: digest(review.proposed),
      installed: digest(review.installed),
    },
    analysis: {
      origin: review.analysis.origin,
      model: review.analysis.model,
      supported: review.analysis.supported,
      newRoute: review.analysis.newRoute,
      beforeRoute: review.analysis.beforeRoute,
      afterRoute: review.analysis.afterRoute,
      publisher: review.analysis.publisher,
      evidence: review.analysis.evidenceProvenance,
    },
    policy: review.policy,
    replays: review.runs,
  };
}

export function solanaProof(
  value: Review | EvidenceSnapshot,
): SolanaProof {
  const snapshot = snapshotInput(value);
  const evidenceDigest = digest(json(snapshot));
  const safeReviewId = snapshot.review.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  return {
    schemaVersion: TRACK_ARTIFACT_SCHEMA_VERSION,
    kind: 'solana-memo-proof',
    program: 'SPL Memo',
    network: 'not-submitted',
    submitted: false,
    digestAlgorithm: 'SHA-256',
    evidenceDigest,
    memo: `chainpatch:v${TRACK_ARTIFACT_SCHEMA_VERSION}:${safeReviewId}:${evidenceDigest}`,
    limitation:
      'Local digest only. No wallet, transaction, RPC request, or on-chain Solana write was performed.',
  };
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlJson(value: unknown): string {
  return `PARSE_JSON(${sqlString(json(value))})`;
}

/**
 * Produce executable Snowflake SQL for replay rows. It only creates a table
 * and inserts the saved local trace; it does not connect to or upload to
 * Snowflake.
 */
export function snowflakeSql(value: Review | EvidenceSnapshot): string {
  const snapshot = snapshotInput(value);
  const lines = [
    '-- ChainPatch local evidence export',
    '-- No Snowflake connection or upload was performed.',
    'CREATE TABLE IF NOT EXISTS CHAINPATCH_REPLAY_EVENTS (',
    '  REVIEW_ID VARCHAR NOT NULL,',
    '  REVIEW_TITLE VARCHAR,',
    '  REPLAY_ID VARCHAR NOT NULL,',
    '  SCENARIO VARCHAR,',
    '  TASK VARCHAR,',
    '  REPLAY_AT VARCHAR,',
    '  EVENT_STEP NUMBER,',
    '  ACTOR VARCHAR,',
    '  ACTION VARCHAR,',
    '  DECISION VARCHAR,',
    '  RULE VARCHAR,',
    '  DETAIL VARCHAR,',
    '  INPUT VARIANT,',
    '  DESTINATION VARIANT,',
    '  POLICY VARIANT',
    ');',
  ];

  for (const replay of snapshot.replays) {
    for (const event of replay.events) {
      lines.push(
        'INSERT INTO CHAINPATCH_REPLAY_EVENTS (',
        '  REVIEW_ID, REVIEW_TITLE, REPLAY_ID, SCENARIO, TASK, REPLAY_AT,',
        '  EVENT_STEP, ACTOR, ACTION, DECISION, RULE, DETAIL, INPUT, DESTINATION, POLICY',
        ') SELECT ',
        [
          sqlString(snapshot.review.id),
          sqlString(snapshot.review.title),
          sqlString(replay.id),
          sqlString(replay.scenario),
          sqlString(replay.task),
          sqlString(replay.at),
          String(event.step),
          sqlString(event.actor),
          sqlString(event.action),
          sqlString(event.decision),
          sqlString(event.rule),
          sqlString(event.detail),
          sqlJson(event.input),
          sqlJson(replay.destination),
          sqlJson(replay.policy),
        ].join(', '),
        ';',
      );
    }
  }

  lines.push(
    `-- Evidence digest: ${solanaProof(snapshot).evidenceDigest}`,
    '-- Review and destination data above are the saved local simulation snapshot.',
  );
  return lines.join('\n');
}
