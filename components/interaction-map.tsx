"use client";

import { FileText, GitBranch, Globe2, LockKeyhole, ShieldCheck, X, Check, Send, ArrowRight } from "lucide-react";
import { useState } from "react";
import type { Replay, Review, Scenario } from "@/lib/types";

type Node = "source" | "reader" | "summary" | "publisher" | "destination" | "route";
const titles: Record<Node, string> = {
  source: "Private source", reader: "Report Reader", summary: "Approved summary",
  publisher: "Public Publisher", destination: "Public destination", route: "Source handoff",
};

export function InteractionMap({ scenario = "after", run, newRoute = true, review, compact = false }: {
  scenario?: Scenario; run?: Replay; newRoute?: boolean; review?: Review; compact?: boolean;
}) {
  const [selected, setSelected] = useState<Node | null>(null);
  const risk = newRoute;
  const publisherEvent = run?.events.find(e => e.actor === "Public Publisher");
  const privateAttempt = publisherEvent?.input.classification === "private-source";
  const blocked = risk && privateAttempt && publisherEvent?.decision === "blocked";
  const pending = risk && privateAttempt && publisherEvent?.decision === "pending";
  const summaryBlocked = publisherEvent?.input.classification === "approved-summary" && publisherEvent.decision !== "allowed";
  const version = review?.skills[scenario === "before" ? 0 : 1]?.version || (scenario === "before" ? "1.2.0" : "1.3.0");
  const instruction = review ? (scenario === "before" ? review.current : review.proposed) : null;
  const select = (node: Node) => setSelected(selected === node ? null : node);
  const nodeProps = (node: Node) => ({ onClick: () => select(node), "aria-pressed": selected === node, "aria-controls": selected === node ? "map-inspector" : undefined });
  const routeLabel = blocked ? "Private source blocked" : pending ? "Awaiting approval" : risk ? "Private source bypass" : "No source handoff";
  const descriptions: Record<Node, string> = {
    source: "A fictional incident report enters Report Reader. Its trusted fixture classification is private-source; the original is not approved for publication.",
    reader: scenario === "before" ? "The current instructions select the original workflow. Compare them with the proposed version in Skill diff." : "The proposed instructions select the updated workflow. A source handoff is a candidate capability—not arbitrary code execution.",
    summary: "A fixed, pre-approved fictional summary represents the normal task. This simulator does not claim to redact or classify arbitrary documents.",
    publisher: "The permission decision is made at publish.receive, before the publisher receives a document or writes to the destination.",
    destination: "A fresh local public page for each replay. status.lumen.example is fictional. The publisher never makes a network request.",
    route: risk ? "This instruction-based path lets the original private source bypass summary creation. A replay can exercise this specific hypothesis." : "No private-source handoff was identified for this version. The selected probe follows the summary path instead; this is not proof that all routes are safe.",
  };
  const selectedEvent = selected === "source" ? run?.events[0] : selected === "reader" || selected === "summary" ? run?.events[1] : selected === "publisher" || selected === "route" ? publisherEvent : null;

  return <div className={`map-wrap ${compact ? "compact" : ""}`}>
    <div className="map-topline"><span><span className="map-live-dot" /> INTERACTION MAP</span><span>{run ? "SIMULATOR EVIDENCE" : "INSTRUCTION-BASED PREVIEW"} <GitBranch size={13} /></span></div>
    <div className={`route-map ${risk ? "has-risk" : ""} ${blocked ? "is-blocked" : ""} ${run?.outcome === "summary-published" ? "summary-verified" : ""} ${summaryBlocked ? "summary-held" : ""}`} aria-label={`${scenario} interaction map. ${routeLabel}. Select a node to inspect its evidence.`}>
      <svg className="map-lines" viewBox="0 0 1000 340" preserveAspectRatio="none" aria-hidden="true">
        <path className="source-line" d="M140 175 H330" />
        <path className="safe-line" d="M430 175 C490 175 480 80 540 80 H620 C680 80 655 175 710 175" />
        <path className={`destination-line ${run?.outcome === "private-exposed" ? "exposed-line" : ""}`} d="M790 175 H930" />
        {!risk && <path className="path-guide" d="M430 175 C490 175 480 275 540 275 H620 C680 275 655 175 710 175" />}
        {risk && <path className={`risk-line ${blocked ? "blocked-line" : ""} ${run && !privateAttempt ? "route-not-exercised" : ""}`} d={blocked ? "M430 175 C490 175 480 275 540 275 H620 C650 275 650 252 660 229" : "M430 175 C490 175 480 275 540 275 H620 C680 275 655 175 710 175"} />}
        {blocked && <g className="route-stop"><circle cx="665" cy="218" r="13" /><path d="M659 212 L671 224 M671 212 L659 224" /></g>}
      </svg>
      <button className="graph-node source" {...nodeProps("source")}><span className="node-icon"><LockKeyhole size={21} /></span><strong>Private report</strong><small>DATA SOURCE</small><span className="node-class">private-source</span></button>
      <button className="graph-node reader" {...nodeProps("reader")}><span className="node-icon"><GitBranch size={21} /></span><strong>Report Reader</strong><small>{scenario === "before" ? "CURRENT SKILL" : "UPDATED SKILL"}</small><span className={`node-class ${risk ? "risk-text" : ""}`}>v{version.replace(/^v/, "")}{risk ? " · source handoff" : ""}</span></button>
      <button className="graph-node summary" {...nodeProps("summary")}><FileText size={17} /><span>Approved summary</span>{run?.outcome === "summary-published" ? <Check size={14} /> : <ArrowRight size={14} />}</button>
      <button className="graph-node publisher" {...nodeProps("publisher")}><span className="node-icon"><Send size={21} /></span><strong>Public Publisher</strong><small>PUBLISH ACTION</small><span className="node-class">permission boundary</span></button>
      <button className={`graph-node destination ${run?.outcome === "private-exposed" ? "destination-exposed" : ""}`} {...nodeProps("destination")}><span className="node-icon"><Globe2 size={21} /></span><strong>Public page</strong><small>DESTINATION</small><span className="node-class">{run ? `${run.destination.length} document${run.destination.length === 1 ? "" : "s"}` : "simulated"}</span></button>
      <button className={`route-label ${risk ? "risk-visible" : ""} ${blocked ? "blocked-label" : ""}`} {...nodeProps("route")}>{blocked ? <ShieldCheck size={16} /> : pending ? <LockKeyhole size={16} /> : <GitBranch size={16} />} {routeLabel}</button>
    </div>
    <div className="map-legend"><span><i className={`legend-line ${run?.outcome === "summary-published" ? "green-line" : "blue-line"}`} />{summaryBlocked ? "Summary held / blocked" : "Approved summary route"}</span><span><i className={`legend-line ${blocked ? "cut-line" : "amber-line"}`} />{blocked ? "Stopped at boundary" : "Private source route"}</span><span className="map-hint">Select a node or handoff to inspect ↗</span></div>
    {selected && <div className="map-inspector" id="map-inspector" aria-live="polite"><div>
      <span className="small-caps">{selectedEvent ? "RECORDED EVIDENCE" : "INSPECTING THE SCENARIO"}</span><h3>{titles[selected]}</h3><p>{descriptions[selected]}</p>
      {selectedEvent && <div className="inspector-record"><code>{selectedEvent.action} → {selectedEvent.decision}</code><p><strong>Input · {selectedEvent.input.classification}</strong><br />{selectedEvent.input.content}</p><p><strong>Rule</strong><br />{selectedEvent.rule}</p></div>}
      {selected === "destination" && run && <div className="inspector-record"><code>{run.destination.length} document(s) at destination</code><p>{run.destination.map(d => d.content).join("\n") || "The destination is empty. No public write occurred."}</p></div>}
      {(selected === "reader" || selected === "route") && instruction && <details className="inspector-instruction"><summary>Relevant {scenario === "before" ? "current" : "proposed"} SKILL.md</summary><pre>{instruction}</pre></details>}
      {!run && <p className="inspector-evidence">Instruction-based preview only. Run a replay to record the actual input, action, decision, and destination.</p>}
    </div><button className="icon-button" aria-label="Close inspector" onClick={() => setSelected(null)}><X size={18} /></button></div>}
  </div>;
}
