import { z } from 'zod';
import { parseSkill } from './engine';
import { policySchema, type Review } from './types';

export const STORAGE_SCHEMA_VERSION = 1;

const toolName = z.enum(['vault.read', 'summary.create', 'handoff.summary', 'handoff.source', 'publish.receive']);
const destinationName = z.enum(['private-vault', 'public-publisher', 'public-page']);
const documentSchema = z.object({
  id: z.string(),
  classification: z.enum(['private-source', 'approved-summary']),
  content: z.string(),
}).passthrough();
const savedPolicy = policySchema.passthrough();
const eventSchema = z.object({
  step: z.number().int(), actor: z.string(), action: z.string(),
  input: documentSchema, decision: z.enum(['allowed', 'blocked', 'pending']),
  rule: z.string(), detail: z.string(),
  tool: toolName.optional(), destination: destinationName.optional(),
}).passthrough();
const evidenceSchema = z.object({
  source: z.enum(['current', 'proposed', 'installed']), line: z.number().int().nonnegative(),
  quote: z.string(), claim: z.enum(['source-forward', 'public-publish']),
  tool: toolName, destination: destinationName,
}).passthrough();
const skillSchema = z.object({
  id: z.string(), name: z.string(), version: z.string(), content: z.string(),
  capabilities: z.array(z.enum(['read-private', 'summarize', 'forward-summary', 'forward-source', 'publish'])),
  tools: z.array(z.object({ name: toolName, destination: destinationName.nullable(), evidence: z.array(z.string()) }).passthrough()),
  destinations: z.array(destinationName),
}).passthrough();

// Storage validation is separate from submission limits. Preserve existing text
// and additional fields rather than trimming, reanalyzing, or dropping evidence.
export const storedReviewSchema = z.object({
  documents: z.object({ privateSource: z.string().min(1).max(4000), approvedSummary: z.string().min(1).max(4000) }).optional(),
  id: z.string().min(1), createdAt: z.string(), title: z.string(),
  current: z.string(), proposed: z.string(), installed: z.string(),
  analysis: z.object({
    newRoute: z.boolean(), beforeRoute: z.boolean(), afterRoute: z.boolean(),
    publisher: z.boolean(), supported: z.boolean(), evidence: z.array(z.string()),
    evidenceProvenance: z.array(evidenceSchema), explanation: z.string(), repair: z.string(),
    origin: z.enum(['sample', 'heuristic', 'gemma']), model: z.string().nullable(), warning: z.string().nullable(),
  }).passthrough(),
  skills: z.array(skillSchema).min(3), policy: savedPolicy.nullable(),
  runs: z.array(z.object({
    id: z.string(), scenario: z.enum(['before', 'after', 'fixed']),
    task: z.enum(['unsafe-probe', 'legitimate']), at: z.string(),
    events: z.array(eventSchema), destination: z.array(documentSchema),
    outcome: z.enum(['summary-published', 'private-exposed', 'blocked', 'approval-required', 'unsupported']),
    policy: savedPolicy.nullable(),
  }).passthrough()),
}).passthrough();

const legacyReviewSchema = storedReviewSchema.extend({
  analysis: storedReviewSchema.shape.analysis.extend({
    beforeRoute: z.boolean().default(false), afterRoute: z.boolean().default(false),
    supported: z.boolean().default(false), evidenceProvenance: z.array(evidenceSchema).default([]),
  }),
  skills: z.array(skillSchema.extend({
    tools: skillSchema.shape.tools.optional(), destinations: skillSchema.shape.destinations.optional(),
  })).min(3),
});

function migrateLegacy(value: unknown): Review {
  const legacy = legacyReviewSchema.parse(value);
  return storedReviewSchema.parse({
    ...legacy,
    skills: legacy.skills.map(skill => {
      const parsed = parseSkill(skill.content, skill.id);
      return { ...skill, tools: skill.tools ?? parsed.tools, destinations: skill.destinations ?? parsed.destinations };
    }),
  });
}

export function decodeStoredReview(data: string): Review {
  try {
    const value: unknown = JSON.parse(data);
    if (value && typeof value === 'object' && 'storageSchemaVersion' in value) {
      if (value.storageSchemaVersion !== STORAGE_SCHEMA_VERSION) {
        throw new Error('Unsupported stored review schema version');
      }
      const envelope = z.object({ storageSchemaVersion: z.literal(STORAGE_SCHEMA_VERSION), review: storedReviewSchema }).parse(value);
      return envelope.review;
    }
    // Unversioned records are upgraded in memory. Reads never rewrite the DB;
    // the next explicit save writes version 1 without discarding the old traces.
    return migrateLegacy(value);
  } catch (cause) {
    throw new Error('Saved review is invalid or uses an unsupported schema version. The stored data was left unchanged.', { cause });
  }
}

export function encodeStoredReview(review: Review): string {
  const result = storedReviewSchema.safeParse(review);
  if (!result.success) throw new Error('Cannot save an invalid review', { cause: result.error });
  return JSON.stringify({ storageSchemaVersion: STORAGE_SCHEMA_VERSION, review: result.data });
}
