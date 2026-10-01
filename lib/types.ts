import { z } from 'zod';

export const reviewInput = z
  .object({
    title: z.string().trim().min(3).max(100),
    current: z.string().trim().min(30).max(16000),
    proposed: z.string().trim().min(30).max(16000),
    installed: z.string().trim().min(20).max(16000),
  })
  .refine((value) => value.current !== value.proposed, {
    message: 'The proposed skill must differ from the current skill.',
    path: ['proposed'],
  });

export type ReviewInput = z.infer<typeof reviewInput>;
export type Classification = 'private-source' | 'approved-summary';
export type Scenario = 'before' | 'after' | 'fixed';
export type SkillCapability =
  | 'read-private'
  | 'summarize'
  | 'forward-summary'
  | 'forward-source'
  | 'publish';
export type ToolName =
  | 'vault.read'
  | 'summary.create'
  | 'handoff.summary'
  | 'handoff.source'
  | 'publish.receive';
export type DestinationName =
  | 'private-vault'
  | 'public-publisher'
  | 'public-page';

export interface ToolCapability {
  name: ToolName;
  destination: DestinationName | null;
  evidence: string[];
}

export type EvidenceSource = 'current' | 'proposed' | 'installed';
export type EvidenceClaim = 'source-forward' | 'public-publish';

export interface EvidenceRecord {
  source: EvidenceSource;
  line: number;
  quote: string;
  claim: EvidenceClaim;
  tool: ToolName;
  destination: DestinationName;
}

export const policySchema = z
  .object({
    id: z.string().min(1).max(64),
    receiver: z.literal('public-publisher'),
    allowedInputs: z
      .array(z.enum(['approved-summary', 'private-source']))
      .max(2),
    action: z.enum(['allow-listed', 'require-approval', 'disable']),
  })
  .strict();

export type Policy = z.infer<typeof policySchema>;

export interface Skill {
  id: string;
  name: string;
  version: string;
  content: string;
  // Kept as stable, human-readable labels for existing API/UI consumers.
  capabilities: SkillCapability[];
  tools: ToolCapability[];
  destinations: DestinationName[];
}

export interface Candidate {
  newRoute: boolean;
  beforeRoute: boolean;
  afterRoute: boolean;
  publisher: boolean;
  supported: boolean;
  // Kept flat for the existing evidence panel; provenance carries the source.
  evidence: string[];
  evidenceProvenance: EvidenceRecord[];
  explanation: string;
  repair: string;
  origin: 'sample' | 'heuristic' | 'gemma';
  model: string | null;
  warning: string | null;
}

export interface Document {
  id: string;
  classification: Classification;
  content: string;
}

export interface Event {
  step: number;
  actor: string;
  action: string;
  input: Document;
  decision: 'allowed' | 'blocked' | 'pending';
  rule: string;
  detail: string;
  // Optional keeps replay JSON/API compatibility with older saved records.
  tool?: ToolName;
  destination?: DestinationName;
}

export interface Replay {
  id: string;
  scenario: Scenario;
  task: 'unsafe-probe' | 'legitimate';
  at: string;
  events: Event[];
  destination: Document[];
  outcome:
    | 'summary-published'
    | 'private-exposed'
    | 'blocked'
    | 'approval-required'
    | 'unsupported';
  policy: Policy | null;
}

export interface Review extends ReviewInput {
  documents?: { privateSource: string; approvedSummary: string };
  id: string;
  createdAt: string;
  analysis: Candidate;
  skills: Skill[];
  policy: Policy | null;
  runs: Replay[];
}

export const narrowPolicy: Policy = {
  id: 'CP-001',
  receiver: 'public-publisher',
  allowedInputs: ['approved-summary'],
  action: 'allow-listed',
};
