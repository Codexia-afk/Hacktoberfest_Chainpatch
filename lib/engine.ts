import { randomUUID } from 'node:crypto';
import {
  narrowPolicy,
  policySchema,
  type Candidate,
  type DestinationName,
  type Document,
  type EvidenceClaim,
  type EvidenceRecord,
  type EvidenceSource,
  type Policy,
  type Replay,
  type Review,
  type ReviewInput,
  type Scenario,
  type Skill,
  type ToolName,
} from './types';

export const privateDocument: Document = Object.freeze({
  id: 'incident-lumen-042',
  classification: 'private-source',
  content:
    'FICTIONAL • Lumen Observatory incident 042. Internal recovery phrase: paper-moon-47. Private responder notes: the north relay needs replacement.',
});

export const approvedSummary: Document = Object.freeze({
  id: 'summary-lumen-042',
  classification: 'approved-summary',
  content:
    'Lumen Observatory experienced a brief service interruption. Service is restored. No customer action is needed.',
});

// Deliberately bounded English instruction recognition, not a natural-language security verifier.
const clauseParts = (text: string) =>
  text
    .split(/(?:[.;!?]+|\bbut\b)/i)
    .map((part) => part.trim())
    .filter(Boolean);
const negated = (text: string) =>
  /\b(never|no|not(?!\s+only\b)|don[’']t|doesn[’']t|mustn[’']t|can[’']t|cannot|prohibit\w*|forbid\w*|disallow\w*|prevent\w*|reject\w*|avoid\w*|stop\w*)\b/i.test(
    text,
  );
const sourcePattern =
  /\b(?:private|confidential|raw|underlying|original|full)\s+(?:source|report|document|incident(?:\s+report)?)\b|\bfull\s+report\b/i;
const publicDestinationPattern =
  /\b(?:public\s+publisher|public(?:\s+(?:status|web))?\s+(?:page|destination)|external\s+(?:publisher|page|destination)|publisher\s+boundary)\b/i;
const transferAction =
  /\b(?:forward|pass|send|share|publish|transmit|provide|attach)\w*\b/i;
// “Publisher” is a destination/role, not proof that the skill can publish.
// Keep the verb forms explicit so a handoff to “Public Publisher” does not
// accidentally grant the reader the publisher capability.
const publishAction = /\bpublish(?:es|ed|ing)?\b/i;
const readAction = /\b(?:read|access|retrieve|load|fetch|open)\w*\b/i;
const summaryPattern =
  /\b(?:approved\s+)?summar(?:y|ies|ize|ise|ized|ised|izing|ising)\b/i;
const summaryCreateAction =
  /\b(?:create|produce|generate|write|prepare|make)\w*\b/i;
const summaryTransferAction =
  /\b(?:pass|send|forward|share|provide|deliver)\w*\b/i;

const lines = (text: string) => text.split(/\r?\n/).map((line) => line.replace(/\r$/, ''));
const matchingLines = (
  text: string,
  predicate: (clause: string) => boolean,
): string[] =>
  lines(text).filter(
    (line) => line.trim() && clauseParts(line).some(predicate),
  );

const sourceClause = (clause: string) =>
  transferAction.test(clause) &&
  sourcePattern.test(clause) &&
  publicDestinationPattern.test(clause) &&
  !negated(clause);
const publisherClause = (clause: string) =>
  publishAction.test(clause) &&
  publicDestinationPattern.test(clause) &&
  !negated(clause);
const privateReadClause = (clause: string) =>
  readAction.test(clause) && sourcePattern.test(clause) && !negated(clause);
const summaryCreateClause = (clause: string) =>
  summaryCreateAction.test(clause) && summaryPattern.test(clause) && !negated(clause);
const summaryTransferClause = (clause: string) =>
  summaryTransferAction.test(clause) &&
  summaryPattern.test(clause) &&
  publicDestinationPattern.test(clause) &&
  !negated(clause);

export function sourceInstructions(text: string): string[] {
  return matchingLines(text, sourceClause);
}

export function publisherInstructions(text: string): string[] {
  return matchingLines(text, publisherClause);
}

function privateReadInstructions(text: string): string[] {
  return matchingLines(text, privateReadClause);
}

function summaryCreateInstructions(text: string): string[] {
  return matchingLines(text, summaryCreateClause);
}

function summaryTransferInstructions(text: string): string[] {
  return matchingLines(text, summaryTransferClause);
}

function hasPrivateRead(text: string): boolean {
  return privateReadInstructions(text).length > 0;
}

function hasSummaryPath(text: string): boolean {
  return (
    summaryCreateInstructions(text).length > 0 &&
    summaryTransferInstructions(text).length > 0
  );
}

function restrictedPublisher(text: string): boolean {
  // Receiver-side restrictions are intentionally not inferred by this simulator.
  // Marking them unsupported prevents the baseline from claiming it enforced them.
  return clauseParts(text).some(
    (clause) => negated(clause) || /\bonly\b/i.test(clause),
  );
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function tool(
  name: ToolName,
  destination: DestinationName | null,
  evidence: string[],
) {
  return { name, destination, evidence: unique(evidence) };
}

export function parseSkill(content: string, id: string): Skill {
  const readEvidence = privateReadInstructions(content);
  const createSummaryEvidence = summaryCreateInstructions(content);
  const summaryTransferEvidence = summaryTransferInstructions(content);
  const sourceEvidence = sourceInstructions(content);
  const publishEvidence = publisherInstructions(content);
  const capabilities: Skill['capabilities'] = [];
  const tools: Skill['tools'] = [];
  const destinations: DestinationName[] = [];

  const addDestination = (destination: DestinationName) => {
    if (!destinations.includes(destination)) destinations.push(destination);
  };
  if (readEvidence.length) {
    capabilities.push('read-private');
    tools.push(tool('vault.read', 'private-vault', readEvidence));
    addDestination('private-vault');
  }
  if (createSummaryEvidence.length) {
    capabilities.push('summarize');
    tools.push(tool('summary.create', null, createSummaryEvidence));
  }
  if (summaryTransferEvidence.length) {
    capabilities.push('forward-summary');
    tools.push(
      tool('handoff.summary', 'public-publisher', summaryTransferEvidence),
    );
    addDestination('public-publisher');
  }
  if (sourceEvidence.length) {
    capabilities.push('forward-source');
    tools.push(tool('handoff.source', 'public-publisher', sourceEvidence));
    addDestination('public-publisher');
  }
  if (publishEvidence.length) {
    capabilities.push('publish');
    tools.push(tool('publish.receive', 'public-page', publishEvidence));
    addDestination('public-page');
  }

  const name = content.match(/^name:\s*([^\r\n]+)$/im)?.[1]?.trim();
  const version = content.match(/^version:\s*([^\r\n]+)$/im)?.[1]?.trim();
  return {
    id,
    name: name || (id === 'public-publisher' ? 'Public Publisher' : 'Report Reader'),
    version: version || 'unversioned',
    content,
    capabilities,
    tools,
    destinations,
  };
}

function lineNumber(text: string, quote: string): number {
  const index = lines(text).findIndex((line) => line === quote);
  return index < 0 ? 0 : index + 1;
}

function evidenceRecord(
  source: EvidenceSource,
  text: string,
  quote: string,
  claim: EvidenceClaim,
  toolName: ToolName,
  destination: DestinationName,
): EvidenceRecord {
  return {
    source,
    line: lineNumber(text, quote),
    quote,
    claim,
    tool: toolName,
    destination,
  };
}

function recordsFor(
  source: EvidenceSource,
  text: string,
  quotes: string[],
  claim: EvidenceClaim,
  toolName: ToolName,
  destination: DestinationName,
): EvidenceRecord[] {
  return quotes.map((quote) =>
    evidenceRecord(source, text, quote, claim, toolName, destination),
  );
}

export function analyze(input: ReviewInput, sample = false): Candidate {
  const before = sourceInstructions(input.current);
  const after = sourceInstructions(input.proposed);
  const publisher = publisherInstructions(input.installed);
  const receiverRestricted = restrictedPublisher(input.installed);
  const supported =
    publisher.length > 0 &&
    !receiverRestricted &&
    hasPrivateRead(input.current) &&
    hasPrivateRead(input.proposed) &&
    hasSummaryPath(input.current) &&
    hasSummaryPath(input.proposed);
  const beforeRoute = before.length > 0 && publisher.length > 0;
  const afterRoute = after.length > 0 && publisher.length > 0;
  const evidenceProvenance = [
    ...recordsFor(
      'current',
      input.current,
      before,
      'source-forward',
      'handoff.source',
      'public-publisher',
    ),
    ...recordsFor(
      'proposed',
      input.proposed,
      after,
      'source-forward',
      'handoff.source',
      'public-publisher',
    ),
    ...recordsFor(
      'installed',
      input.installed,
      publisher,
      'public-publish',
      'publish.receive',
      'public-page',
    ),
  ];

  let explanation = 'The bounded parser found no new explicit source-forwarding route. This is not a guarantee of safety.';
  if (!supported) {
    explanation =
      'This input does not map to the report-to-publisher simulator. Review the extracted instructions manually; no safety verdict is available.';
  } else if (!beforeRoute && afterRoute) {
    explanation =
      'The proposed instruction lets the private source reach a publisher that accepts documents. The existing configuration only passes an approved summary.';
  } else if (beforeRoute && afterRoute) {
    explanation =
      'A source-forwarding route already exists in the current version and remains in the proposed version. This is an existing risk, not a newly introduced route.';
  } else if (beforeRoute) {
    explanation =
      'A source-forwarding route exists in the current version but was not detected in the proposed version. Absence of a detected route is not proof of safety.';
  }

  return {
    newRoute: !beforeRoute && afterRoute,
    beforeRoute,
    afterRoute,
    publisher: publisher.length > 0,
    supported,
    evidence: unique(evidenceProvenance.map((record) => record.quote)),
    evidenceProvenance,
    explanation,
    repair:
      'Allow Public Publisher to receive approved summaries only. Reject private source documents at the publisher boundary.',
    origin: sample ? 'sample' : 'heuristic',
    model: null,
    warning: sample
      ? 'Curated sample analysis. No live Gemma result.'
      : 'Local keyword analysis only. Gemma has not supplied a validated hypothesis.',
  };
}

export function createReview(
  input: ReviewInput,
  analysis = analyze(input),
  id: string = randomUUID(),
): Review {
  return {
    ...input,
    id,
    createdAt: new Date().toISOString(),
    analysis,
    skills: [
      parseSkill(input.current, 'report-reader-before'),
      parseSkill(input.proposed, 'report-reader-after'),
      parseSkill(input.installed, 'public-publisher'),
    ],
    policy: null,
    runs: [],
  };
}

export function decide(
  input: Document,
  policy: Policy | null,
): { decision: 'allowed' | 'blocked' | 'pending'; rule: string } {
  if (
    input.classification !== 'private-source' &&
    input.classification !== 'approved-summary'
  ) {
    return {
      decision: 'blocked',
      rule: 'INPUT · unsupported document classification',
    };
  }
  if (!policy) {
    return {
      decision: 'allowed',
      rule: 'BASELINE · trusted skill may invoke publish; no input classification restriction',
    };
  }
  const checkedPolicy = policySchema.parse(policy);
  if (checkedPolicy.action === 'disable') {
    return {
      decision: 'blocked',
      rule: `${checkedPolicy.id} · publication disabled`,
    };
  }
  if (checkedPolicy.action === 'require-approval') {
    return {
      decision: 'pending',
      rule: `${checkedPolicy.id} · human approval required; no approval supplied`,
    };
  }
  return {
    decision: checkedPolicy.allowedInputs.includes(input.classification)
      ? 'allowed'
      : 'blocked',
    rule: `${checkedPolicy.id} · accepted inputs: ${checkedPolicy.allowedInputs.join(', ') || 'none'}`,
  };
}

export function simulate(
  review: Review,
  scenario: Scenario,
  task: Replay['task'] = 'unsafe-probe',
): Replay {
  if (scenario === 'fixed' && !review.policy) {
    throw new Error('Apply a policy before running After Fix.');
  }

  const run: Replay = {
    id: randomUUID(),
    scenario,
    task,
    at: new Date().toISOString(),
    events: [],
    destination: [],
    outcome: 'unsupported',
    policy: scenario === 'fixed' ? policySchema.parse(review.policy) : null,
  };
  if (!review.analysis.supported || !review.analysis.publisher) return run;

  const forwarding =
    scenario === 'before'
      ? review.analysis.beforeRoute
      : review.analysis.afterRoute;
  const source = review.documents ? { ...privateDocument, content: review.documents.privateSource } : privateDocument;
  const summary = review.documents ? { ...approvedSummary, content: review.documents.approvedSummary } : approvedSummary;
  const payload: Document =
    task === 'unsafe-probe' && forwarding
      ? { ...source }
      : { ...summary };
  run.events.push(
    {
      step: 1,
      actor: 'Report Reader',
      action: 'vault.read',
      tool: 'vault.read',
      destination: 'private-vault',
      input: { ...source },
      decision: 'allowed',
      rule: 'LOCAL-READ · private report is available to Report Reader',
      detail: review.documents ? 'Read the user-supplied sandbox document.' : 'Read a fictional incident document from the in-memory vault.',
    },
    {
      step: 2,
      actor: 'Report Reader',
      action:
        payload.classification === 'private-source'
          ? 'handoff.source'
          : 'summary.create',
      tool:
        payload.classification === 'private-source'
          ? 'handoff.source'
          : 'summary.create',
      destination:
        payload.classification === 'private-source'
          ? 'public-publisher'
          : undefined,
      input: { ...payload },
      decision: 'allowed',
      rule:
        scenario === 'before'
          ? 'Current skill instructions'
          : 'Proposed skill instructions',
      detail:
        payload.classification === 'private-source'
          ? 'The source-forwarding instruction was selected for this probe.'
          : review.documents ? 'Selected the summary supplied and labelled approved by the user; no automatic redaction or classification was performed.' : 'Created the fixed, approved fictional summary; this simulator is not a redaction system.',
    },
  );

  const decision = decide(payload, run.policy);
  run.events.push({
    step: 3,
    actor: 'Public Publisher',
    action: 'publish.receive',
    tool: 'publish.receive',
    destination: 'public-page',
    input: { ...payload },
    ...decision,
    detail:
      decision.decision === 'allowed'
        ? 'Publisher received the document and wrote it to the local simulated public page.'
        : decision.decision === 'pending'
          ? 'The document waits at the boundary. No public write occurred.'
          : 'The input was rejected at the publisher boundary. No public write occurred.',
  });
  if (decision.decision === 'allowed') run.destination.push({ ...payload });
  run.outcome =
    decision.decision === 'blocked'
      ? 'blocked'
      : decision.decision === 'pending'
        ? 'approval-required'
        : payload.classification === 'private-source'
          ? 'private-exposed'
          : 'summary-published';
  return run;
}

export function evaluatePatch(
  review: Review,
  policy: Policy = narrowPolicy,
): {
  unsafe: Replay;
  legitimate: Replay;
  attackBlocked: boolean;
  normalSucceeded: boolean;
} {
  const patched = { ...review, policy: policySchema.parse(policy) };
  const unsafe = simulate(patched, 'fixed', 'unsafe-probe');
  const legitimate = simulate(patched, 'fixed', 'legitimate');

  // Without a detected proposed source route, there is no attack to verify.
  if (!review.analysis.afterRoute) {
    unsafe.outcome = 'unsupported';
    unsafe.events = [];
    unsafe.destination = [];
  }
  const attackBlocked =
    unsafe.outcome === 'blocked' &&
    unsafe.events.some(
      (event) =>
        event.action === 'publish.receive' &&
        event.input.classification === 'private-source' &&
        event.decision === 'blocked',
    );
  const normalSucceeded =
    legitimate.outcome === 'summary-published' &&
    legitimate.destination.length === 1 &&
    legitimate.destination[0].classification === 'approved-summary' &&
    legitimate.events.some(
      (event) =>
        event.action === 'publish.receive' && event.decision === 'allowed',
    );
  return { unsafe, legitimate, attackBlocked, normalSucceeded };
}

// Use a fence longer than any user-supplied run of backticks, preserving verbatim evidence.
function fenced(text: string, language = ''): string {
  const fence = '`'.repeat(
    Math.max(3, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length + 1)),
  );
  return `${fence}${language}\n${text}\n${fence}`;
}

export function markdownReport(review: Review): string {
  return `# ChainPatch evidence report

## ${review.title}

Review: ${review.id}
Created: ${review.createdAt}

## Versions

${review.skills.map((skill) => `- ${skill.name}: ${skill.version}`).join('\n')}

## Analysis provenance

${review.analysis.origin}${review.analysis.model ? ` (${review.analysis.model})` : ''}
${review.analysis.warning || ''}

${review.analysis.explanation}

### Structured hypothesis and supporting evidence

${fenced(JSON.stringify(review.analysis, null, 2), 'json')}

## Changed instructions

### Current

${fenced(review.current, 'markdown')}

### Proposed

${fenced(review.proposed, 'markdown')}

### Installed publisher

${fenced(review.installed, 'markdown')}

## Applied policy

${fenced(JSON.stringify(review.policy, null, 2), 'json')}

## Replay evidence

${review.runs
  .map(
    (run) => `### ${run.scenario} / ${run.task}

Time: ${run.at}
Outcome: ${run.outcome}

${fenced(JSON.stringify(run, null, 2), 'json')}
`,
  )
  .join('\n') || 'No replays have been run.'}

## Limits

Fictional examples or user-supplied sandbox documents are used in this bounded local simulation; no external publishing occurs. Model suggestions are hypotheses. The simulator exercises a selected path; it does not prove all real-world agent behavior safe. Classification labels are supplied by the fixture or user, not a production DLP classifier; summaries are supplied rather than automatically redacted. Custom reviews outside the supported report/publisher pattern cannot be verified. A blocked summary does not demonstrate that a private-source attack was exercised or blocked.
`;
}
