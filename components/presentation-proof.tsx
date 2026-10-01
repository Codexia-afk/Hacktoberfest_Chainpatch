import type { Review } from '@/lib/types';

export const defaultPrivateDocument =
  'FICTIONAL • Lumen Observatory incident 042. Internal recovery phrase: paper-moon-47. Private responder notes: the north relay needs replacement.';
export const defaultApprovedSummary =
  'Lumen Observatory experienced a brief service interruption. Service is restored. No customer action is needed.';

export function PresentationProof({ review }: { review: Review }) {
  const source =
    review.documents?.privateSource ||
    (review.id === 'demo' ? defaultPrivateDocument : undefined);
  const summary =
    review.documents?.approvedSummary ||
    (review.id === 'demo' ? defaultApprovedSummary : undefined);
  const cases = [
    { title: '1. Exposure without the guardrail', scenario: 'after', task: 'unsafe-probe' },
    { title: '2. Same probe with the guardrail', scenario: 'fixed', task: 'unsafe-probe' },
    { title: '3. Useful workflow with the guardrail', scenario: 'fixed', task: 'legitimate' },
  ] as const;
  const unsafe = review.runs.find(run => run.scenario === 'after' && run.task === 'unsafe-probe');
  const fixed = review.runs.find(run => run.scenario === 'fixed' && run.task === 'unsafe-probe');
  const unsafeInput = unsafe?.events.find(event => event.action === 'publish.receive')?.input;
  const fixedInput = fixed?.events.find(event => event.action === 'publish.receive')?.input;
  const sameInput = !!unsafeInput && !!fixedInput && unsafeInput.classification === 'private-source' && fixedInput.classification === 'private-source' && unsafeInput.content === fixedInput.content;

  return <section className="technical-proof" aria-labelledby="proof-title">
    <span className="eyebrow">TECHNICAL PROOF · READ THE RECORDED INPUTS AND OUTPUTS</span>
    <h2 id="proof-title">Where did the private text actually go?</h2>
    <p>Each panel below reads a saved server replay. “Exposed” means the local public destination contains the exact private report you supplied. The highlighted text is the copied report.</p>
    <div className="proof-source">
      <h3>Original private input</h3>
      <pre>{source || 'No user-supplied private input recorded.'}</pre>
      <p>Declared classification: <code>private-source</code></p>
    </div>
    {source === summary && source && <div className="warning-box">Your approved summary is identical to the private report. The guardrail checks document labels, so it will allow that same text when labelled approved-summary. Use a genuinely safe summary to demonstrate confidentiality.</div>}
    <div className="proof-columns">
      {cases.map(item => {
        const run = review.runs.find(run => run.scenario === item.scenario && run.task === item.task);
        const event = run?.events.find(event => event.action === 'publish.receive');
        const exactPrivateCopy = !!source && !!run?.destination.some(document => document.content === source);
        const exactSummaryCopy = !!summary && !!run?.destination.some(document => document.content === summary);
        const membership = event && run?.policy ? run.policy.allowedInputs.includes(event.input.classification) : null;
        return <article key={item.title} className={`proof-case ${exactPrivateCopy ? 'proof-exposed' : ''}`}>
          <h3>{item.title}</h3>
          <dl>
            <dt>Tool being called</dt><dd><code>{event?.action || 'No supported tool call'}</code></dd>
            <dt>Input classification</dt><dd><code>{event?.input.classification || 'Not observed'}</code></dd>
            <dt>Guardrail evaluation</dt><dd>{!event ? 'Outside simulation scope' : !run?.policy ? 'No input restriction. Baseline trusts the calling skill.' : run.policy.action === 'disable' ? 'Publication disabled → reject every input.' : run.policy.action === 'require-approval' ? 'Approval required → hold the request.' : <><code>allowedInputs.includes(&quot;{event.input.classification}&quot;) = {String(membership)}</code><br />{membership ? 'Allowed input → permit the write.' : 'Input not allowed → reject before the write.'}</>}</dd>
            <dt>Recorded decision</dt><dd><strong>{event?.decision.toUpperCase() || 'NOT RUN'}</strong></dd>
          </dl>
          <div className="proof-destination"><span className="small-caps">PUBLIC DESTINATION · LOCAL SIMULATOR</span>
            {run?.destination.length ? run.destination.map((document, index) => <pre key={index}>{document.content === source ? <mark>{document.content}</mark> : document.content}</pre>) : <pre>∅ Empty — no document written.</pre>}
          </div>
          <p className="proof-check">Exact private-report copy in destination: <strong>{event ? exactPrivateCopy ? 'YES' : 'NO' : 'NOT TESTED'}</strong></p>
          {item.task === 'legitimate' && <p className="proof-check">Exact approved-summary copy in destination: <strong>{event ? exactSummaryCopy ? 'YES' : 'NO' : 'NOT TESTED'}</strong></p>}
          <details><summary>Inspect saved JSON for this run</summary><pre>{JSON.stringify(run, null, 2)}</pre></details>
          <small>Run ID: {run?.id || 'Not recorded'}</small>
        </article>;
      })}
    </div>
    <div className="proof-rule">
      <div><h3>The guardrail used in these runs</h3><pre>{JSON.stringify(review.policy, null, 2)}</pre></div>
      <div><h3>What changed at the boundary?</h3><p>{sameInput ? 'Confirmed: the unguarded and guarded probes presented exactly the same private text and classification to the publisher boundary. The publishing rule changed.' : 'These records do not establish a same-private-input comparison. Inspect the instructions and replay JSON before claiming the guardrail blocked a leak.'}</p><p>The engine checks the document classification before writing to the destination. It does not detect secrets inside text. Labels and the approved summary come from your inputs.</p><h3>Instruction evidence for the source handoff</h3>{review.analysis.evidenceProvenance.filter(evidence => evidence.source === 'proposed' && evidence.claim === 'source-forward').map((evidence, index) => <blockquote key={index}>Line {evidence.line}: {evidence.quote}</blockquote>)}{!review.analysis.afterRoute && <p>No source-forwarding route identified by the local analyzer.</p>}</div>
    </div>
    <p className="muted">This is evidence of a tool-boundary decision in the local simulator. No real external website received the report, and no live AI agent executed these instructions.</p>
  </section>;
}
