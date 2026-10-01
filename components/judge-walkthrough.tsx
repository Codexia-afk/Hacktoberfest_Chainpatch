"use client";

import { Check, Play, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { narrowPolicy, type Policy, type Replay, type Review } from "@/lib/types";
import { outcomeLabel, patchEvidence } from "./review-state";

export function JudgeWalkthrough({ review, busy, onReplay, onPolicy, onInspect }: {
  review: Review;
  busy: boolean;
  onReplay: (scenario: Replay["scenario"], task: Replay["task"]) => void;
  onPolicy: (policy: Policy) => void;
  onInspect: (tab: string) => void;
}) {
  const evidence = patchEvidence(review);
  const baseline = review.runs.some(run => run.scenario === "before" && run.outcome === "summary-published");
  const exposed = review.runs.some(run => run.scenario === "after" && run.outcome === "private-exposed");
  const latest = review.runs.at(-1);
  const steps = [
    { title: "Show the normal workflow", text: "The reader turns a private report into an approved summary. Only the summary reaches the public page.", button: "1. Publish the safe summary", done: baseline, action: () => onReplay("before", "legitimate") },
    { title: "Introduce the skill update", text: "One extra instruction forwards the original private report. Run it and inspect what reaches the destination.", button: "2. Run the unsafe update", done: exposed, action: () => onReplay("after", "unsafe-probe") },
    { title: "Repair the publishing boundary", text: "Accept approved summaries only. The server tests both the private source and the normal summary against this rule.", button: "3. Apply the narrow repair", done: evidence.verified, action: () => onPolicy(narrowPolicy) },
    { title: "Prove the useful task survives", text: "Publish the approved summary with the repair active. The private source stays blocked while the useful workflow continues.", button: "4. Publish with the repair", done: evidence.verified && latest?.scenario === "fixed" && latest.task === "legitimate" && latest.outcome === "summary-published", action: () => onReplay("fixed", "legitimate") },
  ];

  return (
    <section className="judge-walkthrough" aria-labelledby="judge-title">
      <div className="judge-heading">
        <div>
          <span className="eyebrow">LIVE WALKTHROUGH · YOU CONTROL EACH RUN</span>
          <h2 id="judge-title">Show the judges how ChainPatch works.</h2>
          <p>Click a step to execute the local simulator and save its evidence. Fictional documents; no external publication. No model connection needed for this example.</p>
        </div>
        <span className="badge neutral">{review.runs.length} saved runs</span>
      </div>
      <div className="judge-steps">
        {steps.map((step, index) => (
          <article key={step.title}>
            <span className="small-caps">{step.done ? <><Check size={14} /> OBSERVED</> : `STEP 0${index + 1}`}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            <button className="button" disabled={busy || !review.analysis.supported || (index === 3 && !review.policy)} onClick={step.action}>
              <Play size={14} />{step.button}
            </button>
          </article>
        ))}
      </div>
      <div className="judge-result" role="status" aria-live="polite" aria-atomic="true">
        <ShieldCheck size={20} />
        <div>
          <strong>{busy ? "Executing on the server…" : latest ? `Latest run: ${outcomeLabel(latest)}` : "Ready. Start by publishing the safe summary."}</strong>
          {latest && <p>{latest.destination.length ? `Public destination contains: ${latest.destination.map(document => document.classification === "private-source" ? "the private original report" : "the approved summary").join(", ")}.` : "Public destination is empty for this run."} Repair checks: private source {evidence.attack ? evidence.attackBlocked ? "blocked" : "not blocked" : "untested"}; normal summary {evidence.normal ? evidence.normalSucceeded ? "published" : "not published" : "untested"}.</p>}
        </div>
      </div>
      <div className="judge-challenge">
        <p><strong>Let a judge challenge the repair.</strong> Try blocking every publication. The private source is stopped, but the normal task fails. Reapply step 3 to restore the useful repair.</p>
        <button className="button" disabled={busy || !review.analysis.supported} onClick={() => onPolicy({ ...narrowPolicy, id: "CP-003", action: "disable" })}>Try blocking everything</button>
      </div>
      <div className="judge-links">
        <Link className="button button-dark" href="/playground">Present automatically with your own inputs</Link>
        <button className="text-link" disabled={busy} onClick={() => onInspect("diff")}>Inspect the changed instruction</button>
        <button className="text-link" disabled={busy} onClick={() => onInspect("patch")}>Edit the rule yourself</button>
        <button className="text-link" disabled={busy} onClick={() => onInspect("report")}>Inspect & download saved evidence</button>
      </div>
    </section>
  );
}
