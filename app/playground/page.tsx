"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Play, Pause, Download } from 'lucide-react';
import { Shell, PageHeading, ErrorBox } from '@/components/ui';
import { seedInput } from '@/lib/seed';
import type { Policy, Review } from '@/lib/types';
import { outcomeLabel, patchEvidence } from '@/components/review-state';
import { PresentationProof } from '@/components/presentation-proof';

const exampleDocuments = {
  privateSource: 'FICTIONAL • Campus robotics lab incident. Internal access code: ALIAH-42. A sensor failed during rehearsal. The team replaced it.',
  approvedSummary: 'The campus robotics lab experienced a brief interruption. The sensor has been replaced and the demonstration is ready.',
};
const stages = [
  { title: 'Before the update', description: 'The original skill passes the approved summary to the publisher.' },
  { title: 'After the update', description: 'Probe whether the updated instruction can pass the private source to the publisher.' },
  { title: 'Repair: private source', description: 'Run the same private-source probe with your chosen publishing rule.' },
  { title: 'Repair: normal task', description: 'Check whether the approved summary can still reach the destination.' },
];

export default function Playground() {
  const [instructions, setInstructions] = useState({ ...seedInput, title: 'Judge presentation' });
  const [documents, setDocuments] = useState(exampleDocuments);
  const [policyAction, setPolicyAction] = useState<Policy['action']>('allow-listed');
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setActive(step => {
      if (step >= 3) return step;
      return step + 1;
    }), 5000);
    return () => clearInterval(timer);
  }, [playing]);
  useEffect(() => { if (active === 3) setPlaying(false); }, [active]);
  async function present(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(''); setPlaying(false);
    try {
      const response = await fetch('/api/presentation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions, documents, policyAction }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Presentation could not run.');
      setReview(result); setActive(0); setPlaying(true);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) { setError(err instanceof Error ? err.message : 'Presentation could not run.'); }
    finally { setBusy(false); }
  }
  const run = review?.runs[active];
  const changed = review && (JSON.stringify(documents) !== JSON.stringify(review.documents) || JSON.stringify(instructions) !== JSON.stringify({ title: review.title, current: review.current, proposed: review.proposed, installed: review.installed }) || policyAction !== review.policy?.action);
  return <Shell><div className="page-content presentation-page">
    <PageHeading eyebrow="JUDGE PRESENTATION & HANDS-ON LAB" title="Your input. A visible result." description="ChainPatch checks whether an agent instruction update exposes a private report, then tests a publishing rule without losing the useful summary workflow." />
    <div className="create-note"><p><strong>Ready to present:</strong> click Run full presentation to execute all four scenarios and automatically walk through the saved results. Pause at any step, or replace the examples with your own fictional text. Everything runs locally; no model setup is required.</p></div>
    <form onSubmit={present}>
      <fieldset disabled={busy} className="presentation-fields">
        <div className="presentation-inputs">
          <label>Private report<textarea aria-label="Private report" required maxLength={4000} value={documents.privateSource} onChange={e => setDocuments({ ...documents, privateSource: e.target.value })} /><small>This field is explicitly labelled private in the simulator.</small></label>
          <label>Approved public summary<textarea aria-label="Approved public summary" required maxLength={4000} value={documents.approvedSummary} onChange={e => setDocuments({ ...documents, approvedSummary: e.target.value })} /><small>You supply and approve this summary. ChainPatch does not redact or classify its text.</small></label>
        </div>
        <label className="field-label" htmlFor="presentation-policy">Choose the publishing rule</label>
        <select id="presentation-policy" value={policyAction} onChange={e => setPolicyAction(e.target.value as Policy['action'])}>
          <option value="allow-listed">Allow approved summaries only</option>
          <option value="disable">Block every publication</option>
          <option value="require-approval">Require human approval</option>
        </select>
        <details className="presentation-instructions"><summary>Edit the skill instructions and presentation name</summary>
          <label>Presentation name<input required minLength={3} maxLength={100} value={instructions.title} onChange={e => setInstructions({ ...instructions, title: e.target.value })} /></label>
          {(['current', 'proposed', 'installed'] as const).map(key => <label key={key}>{key === 'current' ? 'Current skill instructions' : key === 'proposed' ? 'Proposed skill instructions' : 'Publisher instructions'}<textarea required minLength={key === 'installed' ? 20 : 30} maxLength={16000} value={instructions[key]} onChange={e => setInstructions({ ...instructions, [key]: e.target.value })} /></label>)}
          <p className="muted">Local keyword analysis supports the report → summary → publisher pattern. Other workflows are reported as outside simulation scope.</p>
        </details>
        <div className="presentation-actions"><button className="button button-dark" type="submit"><Play size={16} />{busy ? 'Running all four scenarios…' : 'Run full presentation'}</button><button className="button" type="button" onClick={() => { setDocuments(exampleDocuments); setInstructions({ ...seedInput, title: 'Judge presentation' }); setPolicyAction('allow-listed'); }}>Load example inputs</button></div>
      </fieldset>
    </form>
    {error && <ErrorBox message={error} />}
    {review && run && <section className="presentation-results" ref={resultRef} aria-label="Presentation results">
      {changed && <div className="warning-box">Inputs have changed. These results belong to the last saved run. Run the presentation again to test your edits.</div>}
      <div className="section-heading"><div><span className="eyebrow">FOUR SERVER RUNS · SAVED EVIDENCE</span><h2>{review.title}</h2><p>Analysis: local keyword rules. Documents: supplied by you. Publication: local simulator.</p></div><button className="button" onClick={() => { if (active === 3) setActive(0); setPlaying(!playing); }}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause presentation' : 'Play presentation'}</button></div>
      <div className="presentation-stages" aria-label="Presentation steps">{stages.map((stage, index) => <button key={stage.title} aria-pressed={active === index} className={active === index ? 'selected' : ''} onClick={() => { setPlaying(false); setActive(index); }}><span>0{index + 1}</span><strong>{stage.title}</strong><small>{outcomeLabel(review.runs[index])}</small></button>)}</div>
      <div className="presentation-outcome" aria-live="polite"><span className={`badge ${run.outcome === 'private-exposed' ? 'amber' : 'neutral'}`}>{outcomeLabel(run)}</span><h2>{stages[active].title}</h2><p>{stages[active].description}</p>
        <div className="presentation-inputs"><article><h3>Input at the publisher boundary</h3><pre>{run.events.find(event => event.action === 'publish.receive')?.input.content || 'No supported publisher path was simulated.'}</pre><p>{run.events.find(event => event.action === 'publish.receive')?.rule}</p></article><article><h3>Result at the public destination</h3><pre>{run.destination.map(document => document.content).join('\n') || 'Nothing published in this run.'}</pre><p>Local destination only; no external website receives this text.</p></article></div>
        <details><summary>Inspect the action trace</summary>{run.events.map(event => <div key={event.step} className="presentation-trace"><strong>{event.step}. {event.actor} · {event.action} · {event.decision}</strong><p>{event.detail}</p></div>)}</details>
      </div>
      <div className={patchEvidence(review).verified ? 'success-box' : 'warning-box'} role="status">{!review.analysis.supported ? 'Outside simulation scope. No safety verdict is available for these instructions.' : patchEvidence(review).verified ? 'Repair verified for these inputs: private source blocked and approved summary published.' : !review.analysis.afterRoute ? 'No private-source route was identified by the local analyzer. This is not a proof of safety.' : 'Repair not verified: both blocking the private source and publishing the approved summary must pass.'}</div>
      <PresentationProof review={review} />
      <div className="presentation-actions"><Link className="button" href={`/review/${review.id}`}>Open full review <ArrowRight size={15} /></Link><a className="button" href={`/api/reviews/${review.id}/export?format=md`} download><Download size={15} />Download this evidence</a><Link className="text-link" href="/workspace">Find saved presentations in the workspace</Link></div>
    </section>}
  </div></Shell>;
}
