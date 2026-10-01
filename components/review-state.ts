import { diffArrays } from "diff";
import type { Replay, Review } from "@/lib/types";

/** A saved run only verifies the currently applied rule, never an older repair. */
export function patchEvidence(review: Review) {
  const matches = (run: Replay) => run.scenario === "fixed" && JSON.stringify(run.policy) === JSON.stringify(review.policy);
  const latest = [...review.runs].reverse();
  const attack = latest.find(run => matches(run) && run.task === "unsafe-probe");
  const normal = latest.find(run => matches(run) && run.task === "legitimate");
  const attackBlocked = attack?.outcome === "blocked" && attack.events.some(event => event.action === "publish.receive" && event.input.classification === "private-source" && event.decision === "blocked");
  const normalSucceeded = normal?.outcome === "summary-published" && normal.destination.length === 1 && normal.destination[0].classification === "approved-summary" && normal.events.some(event => event.action === "publish.receive" && event.decision === "allowed");
  return { attack, normal, attackBlocked, normalSucceeded, verified: Boolean(review.analysis.supported && review.analysis.afterRoute && review.policy && attackBlocked && normalSucceeded) };
}

export function outcomeLabel(run: Replay) {
  if (run.outcome === "blocked") return run.events.at(-1)?.input.classification === "approved-summary" ? "Approved summary blocked" : "Private source blocked";
  return { "summary-published": "Approved summary published", "private-exposed": "Private source exposed", "approval-required": "Awaiting human approval", unsupported: "Outside simulation scope" }[run.outcome];
}

export function skillDiff(current: string, proposed: string) {
  const before: { text: string; changed: boolean }[] = [];
  const after: { text: string; changed: boolean }[] = [];
  // Bounded execution avoids pathological pasted inputs tying up the UI.
  const parts = diffArrays(current.split("\n"), proposed.split("\n"), { timeout: 100 }) || [
    { removed: true, added: false, value: current.split("\n") },
    { added: true, removed: false, value: proposed.split("\n") },
  ];
  for (const part of parts) {
    if (!part.added) before.push(...part.value.map(text => ({ text, changed: Boolean(part.removed) })));
    if (!part.removed) after.push(...part.value.map(text => ({ text, changed: Boolean(part.added) })));
  }
  return { before, after, added: after.filter(l => l.changed).length, removed: before.filter(l => l.changed).length };
}
