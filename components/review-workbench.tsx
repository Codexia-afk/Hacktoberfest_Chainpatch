"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  Code2,
  Download,
  FileText,
  FlaskConical,
  GitBranch,
  Globe2,
  Info,
  LockKeyhole,
  Play,
  RotateCcw,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { Shell, Badge, Loading, ErrorBox, Empty } from "./ui";
import { InteractionMap } from "./interaction-map";
import { JudgeWalkthrough } from "./judge-walkthrough";
import { PresentationProof } from "./presentation-proof";
import { outcomeLabel, patchEvidence, skillDiff } from "./review-state";
import {
  narrowPolicy,
  type Replay,
  type Review,
  type Scenario,
} from "@/lib/types";
const scenarioNames: Record<Scenario, string> = {
  before: "Before Update",
  after: "After Update",
  fixed: "After Fix",
};
const tabs = [
  ["overview", "Interaction map"],
  ["diff", "Skill diff"],
  ["replay", "Replay evidence"],
  ["patch", "Patch Lab"],
  ["report", "Evidence report"],
];
export function ReviewWorkbench({ id }: { id: string }) {
  const [review, setReview] = useState<Review | null>(null),
    [error, setError] = useState(""),
    [tab, setTabState] = useState("overview"),
    [scenario, setScenario] = useState<Scenario>("before"),
    [busy, setBusy] = useState(""),
    [policyText, setPolicyText] = useState(
      JSON.stringify(narrowPolicy, null, 2),
    ),
    [notice, setNotice] = useState(""),
    [task, setTask] = useState<Replay["task"]>("unsafe-probe");
  const diff = useMemo(() => skillDiff(review?.current || "", review?.proposed || ""), [review?.current, review?.proposed]);
  function setTab(value: string) {
    setTabState(value);
    window.history.replaceState(null, "", `#${value}`);
  }
  useEffect(() => {
    const value = window.location.hash.slice(1);
    if (tabs.some(([key]) => key === value)) setTabState(value);
    const controller = new AbortController();
    fetch(`/api/reviews/${id}`, { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then((d: Review) => {
        setReview(d);
        if (d.policy) setPolicyText(JSON.stringify(d.policy, null, 2));
        const last = d.runs.at(-1);
        if (last) { setScenario(last.scenario); setTask(last.task); }
      })
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [id]);
  async function mutate(path: string, data?: unknown, method = "POST") {
    setError("");
    setNotice("");
    setBusy(path || "request");
    try {
      const response = await fetch(`/api/reviews/${id}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Request failed");
      setReview(result);
      return result as Review;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      return null;
    } finally {
      setBusy("");
    }
  }
  async function run(next = scenario, nextTask = task) {
    setScenario(next);
    setTask(nextTask);
    await mutate("/replay", { scenario: next, task: nextTask });
  }
  async function apply() {
    try {
      const policy = JSON.parse(policyText);
      const updated = await mutate("/patch", policy);
      if (updated) {
        setScenario("fixed");
        setTask("unsafe-probe");
        setNotice(
          "Policy applied. Both the unsafe probe and the legitimate task were rerun.",
        );
      }
    } catch {
      setError(
        "The policy must be valid JSON. Check commas, quotes, and brackets.",
      );
    }
  }
  async function applyJudgePolicy(policy: typeof narrowPolicy) {
    const updated = await mutate("/patch", policy);
    if (updated) {
      setPolicyText(JSON.stringify(updated.policy, null, 2));
      setScenario("fixed");
      setTask("unsafe-probe");
      setTab("overview");
      setNotice("Policy applied. Both the unsafe probe and the legitimate task were rerun.");
    }
  }
  if (!review)
    return (
      <Shell>
        <div className="page-content">
          {error ? (
            <>
              <ErrorBox message={error} />
              <Link href="/workspace" className="button">
                Back to workspace
              </Link>
            </>
          ) : (
            <Loading />
          )}
        </div>
      </Shell>
    );
  const runResult = [...review.runs]
    .reverse()
    .find((r) => r.scenario === scenario && r.task === task);
  const { attack: latestAttack, normal: latestNormal, attackBlocked, normalSucceeded, verified } = patchEvidence(review);
  const exposed = review.runs.some(r => r.scenario === "after" && r.outcome === "private-exposed");
  const draftChanged = (() => { try { return JSON.stringify(JSON.parse(policyText)) !== JSON.stringify(review.policy); } catch { return true; } })();
  const versionBefore = review.skills[0].version,
    versionAfter = review.skills[1].version;
  const changedLines = diff.added + diff.removed;
  return (
    <Shell>
      <div className="review-content">
        <div className="review-breadcrumb">
          <Link href="/workspace">Update reviews</Link>
          <span>/</span>
          <span>{id === "demo" ? "CP–001" : id.slice(0, 8).toUpperCase()}</span>
          <Badge tone="neutral">
            {id === "demo" ? "SEEDED EXAMPLE" : "CUSTOM REVIEW"}
          </Badge>
        </div>
        <div className="review-heading">
          <div>
            <h1>{review.title}</h1>
            <p>
              <GitBranch size={16} />
              {review.skills[1].name}
              <span className="version">{versionBefore}</span>
              <ArrowRight size={14} />
              <span className="version updated">{versionAfter}</span>
              <span className="heading-dot">·</span>
              {review.skills.length - 1} installed skills
            </p>
          </div>
          <div className="heading-actions">
            <button
              className="button"
              disabled={!!busy}
              onClick={async () => {
                const result = await mutate("", undefined, "DELETE");
                if (result) {
                  setScenario("before");
                  setTask("unsafe-probe");
                  setPolicyText(JSON.stringify(narrowPolicy, null, 2));
                  setNotice(
                    "Replay history and policy reset. Skill content is preserved.",
                  );
                }
              }}
            >
              <RotateCcw size={15} />
              {id === "demo" ? "Reset demo" : "Reset replays"}
            </button>
            <a
              className="button"
              href={`/api/reviews/${id}/export?format=md`}
              download
            >
              <Download size={15} />
              Export
            </a>
          </div>
        </div>
        {id === "demo" && <JudgeWalkthrough
          review={review}
          busy={!!busy}
          onReplay={(next, nextTask) => { setTab("overview"); void run(next, nextTask); }}
          onPolicy={policy => { void applyJudgePolicy(policy); }}
          onInspect={setTab}
        />}
        {id === "demo" && <PresentationProof review={review} />}
        <div className={`verdict-banner ${verified ? "verified" : ""}`}>
          <span className="verdict-icon">
            {verified ? <ShieldCheck size={22} /> : <GitBranch size={22} />}
          </span>
          <div>
            <strong>
              {verified
                ? "Narrow repair verified"
                : review.analysis.newRoute
                  ? "One update. One newly possible unsafe route."
                  : "Instructions analyzed. Manual review still matters."}
            </strong>
            <p>
              {verified
                ? "The private source was blocked, and the approved summary still reached the public page."
                : review.analysis.newRoute
                  ? "The private report can now reach Public Publisher without becoming an approved summary."
                  : review.analysis.explanation}
            </p>
          </div>
          <Badge
            tone={
              verified
                ? "green"
                : review.analysis.newRoute
                  ? "amber"
                  : "neutral"
            }
          >
            {verified
              ? "REPLAY VERIFIED"
              : review.analysis.newRoute
                ? "INVESTIGATE"
                : "UNVERIFIED"}
          </Badge>
        </div>
        <div
          className="review-tabs"
          role="tablist"
          aria-label="Review sections"
        >
          {tabs.map(([value, label]) => (
            <button
              id={`tab-${value}`}
              aria-controls="review-panel"
              role="tab"
              aria-selected={tab === value}
              tabIndex={tab === value ? 0 : -1}
              key={value}
              onClick={() => setTab(value)}
              onKeyDown={event => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const index = tabs.findIndex(([key]) => key === value);
                const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
                setTab(tabs[next][0]);
                document.getElementById(`tab-${tabs[next][0]}`)?.focus();
              }}
            >
              {value === "patch" && <FlaskConical size={15} />} {label}
              {value === "diff" && (
                <span className="tab-count">{changedLines}</span>
              )}
            </button>
          ))}
        </div>
        {error && <ErrorBox message={error} />}
        <div aria-live="polite">
          {notice && (
            <div className="success-box">
              <Check size={17} />
              {notice}
            </div>
          )}
        </div>
        <div id="review-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {(tab === "overview" || tab === "replay") && (
            <>
              <div className="replay-toolbar">
                <div>
                  <h2>
                    {tab === "overview"
                      ? "Follow the interaction."
                      : "Every action, accounted for."}
                  </h2>
                  <p>
                    {tab === "overview"
                      ? review.analysis.newRoute ? "A new instruction connects the private source to a public destination." : "Compare the instruction-based path with recorded simulator evidence."
                      : "Inspect the input, decision, rule, and resulting destination."}
                  </p>
                </div>
                <span className="small-caps">
                  {review.analysis.origin === "gemma"
                    ? "GEMMA HYPOTHESIS"
                    : review.analysis.origin === "sample"
                      ? "SAMPLE ANALYSIS"
                      : "LOCAL HEURISTIC"}{" "}
                  <Info size={13} />
                </span>
              </div>
              <div className="scenario-controls">
                {(["before", "after", "fixed"] as Scenario[]).map(
                  (value, i) => (
                    <button
                      key={value}
                      className={scenario === value ? "selected" : ""}
                      disabled={!!busy || !review.analysis.supported}
                      aria-pressed={scenario === value}
                      onClick={() => {
                        if (value === "fixed" && !review.policy) {
                          setTab("patch");
                          setNotice(
                            "Apply a rule to unlock the After Fix replay.",
                          );
                        } else void run(value);
                      }}
                    >
                      <span className="scenario-number">0{i + 1}</span>
                      <span>
                        <strong>{scenarioNames[value]}</strong>
                        <small>
                          {value === "before"
                            ? "Original skill set"
                            : value === "after"
                              ? "Proposed instructions"
                              : review.policy
                                ? "Applied permission rule"
                                : "Apply a rule to unlock"}
                        </small>
                      </span>
                      {value === "fixed" ? (
                        <ShieldCheck size={17} />
                      ) : (
                        <GitBranch size={17} />
                      )}
                    </button>
                  ),
                )}
              </div>
              {tab === "overview" && review.analysis.supported && (
                <InteractionMap
                  review={review}
                  scenario={scenario}
                  run={runResult}
                  newRoute={
                    scenario === "before"
                      ? review.analysis.beforeRoute
                      : review.analysis.afterRoute
                  }
                />
              )}
              <div className="run-bar">
                <div>
                  <Badge
                    tone={
                      runResult?.outcome === "private-exposed"
                        ? "amber"
                        : runResult?.outcome === "summary-published" ||
                            runResult?.outcome === "blocked"
                          ? "green"
                          : "neutral"
                    }
                  >
                    {runResult
                      ? outcomeLabel(runResult)
                      : "READY TO REPLAY"}
                  </Badge>
                  <span>
                    {runResult
                      ? "Simulated tools · saved evidence"
                      : "Preview only · run to collect evidence"}
                  </span>
                </div>
                <div>
                  <select
                    aria-label="Replay task"
                    value={task}
                    disabled={!!busy}
                    onChange={(e) => setTask(e.target.value as Replay["task"])}
                  >
                    <option value="unsafe-probe">Unsafe source probe</option>
                    <option value="legitimate">Legitimate summary task</option>
                  </select>
                  <button
                    disabled={!!busy || !review.analysis.supported}
                    className="button button-dark"
                    onClick={() => run()}
                  >
                    <Play size={14} />
                    {busy === "/replay" ? "Replaying…" : "Run replay"}
                  </button>
                </div>
              </div>
              {!review.analysis.supported && (
                <div className="warning-box">
                  This review does not fit the supported report/publisher
                  scenario. The diff and model analysis remain available;
                  simulated safety results are unavailable.
                </div>
              )}
              {runResult ? (
                <ReplayEvidence run={runResult} />
              ) : (
                <div className="replay-prompt">
                  <Play size={18} />
                  <p>
                    Run <strong>{scenarioNames[scenario]}</strong> to see
                    exactly what entered each skill and what reached the
                    destination.
                  </p>
                </div>
              )}
              {tab === "replay" && id !== "demo" && <PresentationProof review={review} />}
              {tab === "overview" && (
                <div className="review-insights">
                  <div>
                    <span className="small-caps">01 / THE CHANGE</span>
                    <h3>An extra instruction. A wider permission.</h3>
                    <p>{review.analysis.explanation}</p>
                    <button
                      className="text-link"
                      onClick={() => setTab("diff")}
                    >
                      Inspect the skill diff <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div>
                    <span className="small-caps">02 / THE REPAIR</span>
                    <h3>Keep the summary. Stop the source.</h3>
                    <p>{review.analysis.repair}</p>
                    <button
                      className="text-link"
                      onClick={() => setTab("patch")}
                    >
                      Open Patch Lab <ArrowUpRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {tab === "diff" && (
            <section className="diff-section">
              <div className="section-heading">
                <div>
                  <h2>Small diff. Different behavior.</h2>
                  <p>
                    Text changes are observations. Risk remains a hypothesis
                    until a replay exercises the route.
                  </p>
                </div>
                <Badge tone="blue">+{diff.added} / −{diff.removed} lines</Badge>
              </div>
              <div className="diff-columns">
                {[
                  {
                    title: "Current · installed",
                    version: versionBefore,
                    lines: diff.before,
                    kind: "removed",
                  },
                  {
                    title: "Proposed · pending",
                    version: versionAfter,
                    lines: diff.after,
                    kind: "added",
                  },
                ].map((side) => (
                  <div className="code-panel" key={side.kind}>
                    <div className="code-header">
                      <FileText size={16} />
                      <strong>{side.title}</strong>
                      <span>{side.version} / SKILL.md</span>
                    </div>
                    <pre>
                      {side.lines.map((line, i) => (
                        <div
                          className={`code-line ${line.changed ? side.kind : ""}`}
                          key={i}
                        >
                          <span className="line-number">{i + 1}</span>
                          <span className="diff-sign">
                            {line.changed ? side.kind === "added" ? "+" : "−" : " "}
                          </span>
                          <code>{line.text || " "}</code>
                        </div>
                      ))}
                    </pre>
                  </div>
                ))}
              </div>
              <div className="analysis-card">
                <div>
                  <span className="small-caps">ANALYSIS PROVENANCE</span>
                  <Badge
                    tone={
                      review.analysis.origin === "gemma" ? "blue" : "neutral"
                    }
                  >
                    {review.analysis.origin === "gemma"
                      ? "Gemma suggested this risk"
                      : review.analysis.origin === "sample"
                        ? "Curated sample analysis"
                        : "Local keyword analysis"}
                  </Badge>
                </div>
                <p>{review.analysis.explanation}</p>
                <blockquote>
                  {review.analysis.evidence.join("\n") ||
                    "No explicit source-forwarding instruction identified."}
                </blockquote>
                <p className="muted">{review.analysis.warning}</p>
                <button
                  className="button"
                  disabled={!!busy}
                  onClick={async () => {
                    const updated = await mutate("");
                    if (updated) setNotice("Analysis refreshed. Old replay evidence was cleared because its hypothesis may have changed.");
                  }}
                >
                  <Zap size={15} />
                  {busy ? "Analyzing…" : "Analyze with configured Gemma"}
                </button>
              </div>
              <details className="installed-skill">
                <summary>
                  Installed companion skill · {review.skills[2].name}
                  <ChevronDown size={17} />
                </summary>
                <pre>{review.installed}</pre>
              </details>
            </section>
          )}
          {tab === "patch" && (
            <section className="patch-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    A SMALLER PERMISSION, NOT A BROKEN WORKFLOW
                  </span>
                  <h2>Repair the boundary.</h2>
                  <p>
                    The best rule blocks the source and lets the summary
                    through.
                  </p>
                </div>
                <FlaskConical size={30} />
              </div>
              <div className="patch-layout">
                <div>
                  <div className="policy-options">
                    {[
                      {
                        key: "allow-listed",
                        title: "Allow approved summaries only",
                        description:
                          "Reject the private source at the publisher boundary.",
                        tag: "RECOMMENDED",
                        policy: narrowPolicy,
                      },
                      {
                        key: "require-approval",
                        title: "Require human approval",
                        description:
                          "Holds every publish attempt, including the normal summary.",
                        tag: "ADDS FRICTION",
                        policy: {
                          ...narrowPolicy,
                          id: "CP-002",
                          action: "require-approval",
                        },
                      },
                      {
                        key: "disable",
                        title: "Disable publication",
                        description:
                          "Stops exposure, but also stops the legitimate task.",
                        tag: "BREAKS WORKFLOW",
                        policy: {
                          ...narrowPolicy,
                          id: "CP-003",
                          action: "disable",
                        },
                      },
                    ].map((option) => (
                      <button
                        className={`policy-option ${(() => {
                          try {
                            return JSON.parse(policyText).action === option.key
                              ? "selected"
                              : "";
                          } catch {
                            return "";
                          }
                        })()}`}
                        key={option.key}
                        disabled={!!busy}
                        aria-pressed={(() => { try { return JSON.parse(policyText).action === option.key; } catch { return false; } })()}
                        onClick={() => {
                          setPolicyText(JSON.stringify(option.policy, null, 2));
                          setNotice(
                            "Rule selected. Apply and test to change the active policy.",
                          );
                        }}
                      >
                        <span className="radio-indicator" />
                        <span>
                          <span className="option-title">{option.title}</span>
                          <small>{option.description}</small>
                          <span className="small-caps">{option.tag}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="policy-explanation">
                    <LockKeyhole size={19} />
                    <p>
                      <strong>
                        Enforced before the publisher receives data.
                      </strong>{" "}
                      The simulator compares the input classification with this
                      rule. Editing a rule does not apply it until you run the
                      tests.
                    </p>
                  </div>
                </div>
                <div className="policy-editor">
                  <div className="code-header">
                    <Code2 size={16} />
                    <strong>Permission rule</strong>
                    <span>JSON · editable</span>
                  </div>
                  <label className="sr-only" htmlFor="policy-json">
                    Permission rule JSON
                  </label>
                  <textarea
                    id="policy-json"
                    disabled={!!busy}
                    spellCheck={false}
                    value={policyText}
                    onChange={(e) => setPolicyText(e.target.value)}
                  />
                  <div className="policy-editor-footer">
                    <span>Receiver: Public Publisher</span>
                    <button
                      className="button button-dark"
                      disabled={!!busy || !review.analysis.supported}
                      onClick={apply}
                    >
                      <Play size={15} />
                      {busy === "/patch"
                        ? "Testing…"
                        : "Apply & test both paths"}
                    </button>
                  </div>
                </div>
              </div>
              {draftChanged && review.policy && <div className="warning-box">Unsaved rule changes. The evidence below belongs to the currently applied rule <strong>{review.policy.id}</strong>, not this draft. Apply & test to collect new evidence.</div>}
              {!review.analysis.supported && <div className="warning-box">This review is outside the report/publisher simulator. You can inspect and edit a rule, but cannot verify it with these fixtures.</div>}
              <div className="patch-tests">
                <PatchTest
                  title="Unsafe source probe"
                  expected="Private source must be blocked"
                  run={latestAttack}
                  passes={attackBlocked}
                />
                <PatchTest
                  title="Legitimate summary task"
                  expected="Approved summary must be published"
                  run={latestNormal}
                  passes={normalSucceeded}
                />
              </div>
              {latestAttack && latestNormal && (
                <div className={`patch-result ${verified ? "good" : "bad"}`}>
                  <ShieldCheck size={22} />
                  <div>
                    <strong>
                      {verified
                        ? "Both conditions satisfied. A useful repair."
                        : "This rule does not satisfy both conditions."}
                    </strong>
                    <p>
                      {verified
                        ? "The policy blocked the selected private-source action while preserving the summary workflow."
                        : "Inspect the two outcomes above. Holding or disabling all publication is not a verified narrow repair."}
                    </p>
                  </div>
                  <button
                    className="button"
                    onClick={() => {
                      setTab("overview");
                      setScenario("fixed");
                      setTask("unsafe-probe");
                    }}
                  >
                    Inspect After Fix <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
          )}
          {tab === "report" && (
            <section className="report-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">AN AUDITABLE RECORD</span>
                  <h2>Evidence, without the overclaim.</h2>
                  <p>
                    Skill versions, hypotheses, policy decisions, and
                    destination states.
                  </p>
                </div>
                <div className="heading-actions">
                  <a
                    className="button"
                    href={`/api/reviews/${id}/export?format=json`}
                    download
                  >
                    <Download size={15} />
                    JSON
                  </a>
                  <a
                    className="button button-dark"
                    href={`/api/reviews/${id}/export?format=md`}
                    download
                  >
                    <Download size={15} />
                    Markdown
                  </a>
                  <a
                    className="button"
                    href={`/api/reviews/${id}/export?format=solana`}
                    download
                  >
                    Solana memo
                  </a>
                  <a
                    className="button"
                    href={`/api/reviews/${id}/export?format=sql`}
                    download
                  >
                    Snowflake SQL
                  </a>
                </div>
              </div>
              <dl className="report-facts">
                <div>
                  <dt>Review</dt>
                  <dd>{review.title}</dd>
                </div>
                <div>
                  <dt>Version comparison</dt>
                  <dd>
                    {versionBefore} → {versionAfter}
                  </dd>
                </div>
                <div>
                  <dt>Analysis source</dt>
                  <dd>
                    {review.analysis.origin === "gemma"
                      ? `Gemma · ${review.analysis.model}`
                      : review.analysis.origin === "sample"
                        ? "Curated sample; no live model result"
                        : "Local heuristic; no live model result"}
                  </dd>
                </div>
                <div>
                  <dt>Current policy</dt>
                  <dd>
                    {review.policy
                      ? `${review.policy.id} · ${review.policy.action}`
                      : "Baseline · no patch applied"}
                  </dd>
                </div>
                <div>
                  <dt>Evidence collected</dt>
                  <dd>
                    {review.runs.length} replay
                    {review.runs.length === 1 ? "" : "s"} ·{" "}
                    {verified
                      ? "narrow repair verified"
                      : "repair not verified"}
                  </dd>
                </div>
              </dl>
              <h3>Replay ledger</h3>
              {review.runs.length ? (
                <div className="ledger">
                  {[...review.runs].reverse().map((r) => (
                    <details key={r.id}>
                      <summary>
                        <span>
                          {scenarioNames[r.scenario]}
                          <small>
                            {r.task} · {new Date(r.at).toLocaleTimeString()}
                          </small>
                        </span>
                        <Badge
                          tone={
                            r.outcome === "private-exposed"
                              ? "amber"
                              : r.outcome === "blocked" ||
                                  r.outcome === "summary-published"
                                ? "green"
                                : "neutral"
                          }
                        >
                          {outcomeLabel(r)}
                        </Badge>
                        <ChevronDown size={16} />
                      </summary>
                      <ReplayEvidence run={r} />
                    </details>
                  ))}
                </div>
              ) : (
                <Empty>Run a replay to collect evidence for this report.</Empty>
              )}
              <div className="limits-note">
                <Info size={20} />
                <div>
                  <h3>What this report establishes</h3>
                  <p>
                    The simulator exercised selected actions with fictional
                    inputs. A policy decision applies to that input and rule
                    snapshot. Gemma’s interpretation is a hypothesis, not proof
                    of all possible behavior. Classification labels come from
                    trusted fixtures, not a production data classifier. No real
                    report was read and no external destination received data.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
        <div className="provenance-footer">
          <Info size={14} />
          <span>
            {review.analysis.origin === "gemma"
              ? "Gemma hypothesis + deterministic simulation"
              : review.analysis.origin === "sample"
                ? "Curated sample analysis + deterministic simulation"
                : "Local heuristic + deterministic simulation"}
          </span>
          <Link href="/docs">
            Method & limitations <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </Shell>
  );
}
function PatchTest({
  title,
  expected,
  run,
  passes,
}: {
  title: string;
  expected: string;
  run?: Replay;
  passes: boolean;
}) {
  return (
    <div className={`test-card ${run ? (passes ? "passed" : "failed") : ""}`}>
      <span className="test-icon">
        {run ? (
          passes ? (
            <CheckCheck size={22} />
          ) : (
            <X size={22} />
          )
        ) : (
          <FlaskConical size={22} />
        )}
      </span>
      <div>
        <h3>{title}</h3>
        <p>{expected}</p>
        <strong>{run ? outcomeLabel(run) : "Not yet tested"}</strong>
      </div>
      <Badge tone={run ? (passes ? "green" : "amber") : "neutral"}>
        {run ? (passes ? "PASS" : "FAIL") : "PENDING"}
      </Badge>
    </div>
  );
}
function ReplayEvidence({ run }: { run: Replay }) {
  return (
    <div className="evidence-grid">
      <section className="timeline">
        <div className="evidence-heading">
          <span className="small-caps">ACTION TRACE</span>
          <span>
            {run.events.length} events · {run.task}
          </span>
        </div>
        {run.events.map((event) => (
          <details
            className="trace-event"
            key={event.step}
            open={event.step === 3}
          >
            <summary>
              <span className={`trace-number ${event.decision}`}>
                {event.step}
              </span>
              <span>
                <strong>{event.actor}</strong>
                <code>{event.action}</code>
              </span>
              <Badge
                tone={
                  event.decision === "blocked"
                    ? "green"
                    : event.input.classification === "private-source" &&
                        event.step === 3
                      ? "amber"
                      : "neutral"
                }
              >
                {event.decision}
              </Badge>
              <ChevronDown size={14} />
            </summary>
            <div className="trace-detail">
              <span className="small-caps">
                INPUT · {event.input.classification}
              </span>
              <p className="input-document">{event.input.content}</p>
              <span className="small-caps">RULE</span>
              <code>{event.rule}</code>
              <p>{event.detail}</p>
            </div>
          </details>
        ))}
      </section>
      <section
        className={`destination-panel ${run.outcome === "private-exposed" ? "exposed" : ""}`}
      >
        <div className="evidence-heading">
          <span className="small-caps">
            <Globe2 size={14} /> DESTINATION STATE
          </span>
          <Badge tone="neutral">SIMULATED</Badge>
        </div>
        <div className="destination-address">
          <span />
          status.lumen.example
        </div>
        {run.destination.length ? (
          run.destination.map((doc) => (
            <article key={doc.id}>
              <Badge
                tone={
                  doc.classification === "private-source" ? "amber" : "green"
                }
              >
                {doc.classification}
              </Badge>
              <h3>
                {doc.classification === "private-source"
                  ? "An internal report is public."
                  : "An approved update is public."}
              </h3>
              <p>{doc.content}</p>
            </article>
          ))
        ) : (
          <div className="destination-empty">
            <LockKeyhole size={29} />
            <h3>No document published.</h3>
            <p>
              {run.outcome === "approval-required"
                ? "The action is waiting for approval."
                : run.outcome === "unsupported"
                  ? "This scenario is outside the simulator’s scope."
                  : "The policy stopped the document at the boundary."}
            </p>
          </div>
        )}
        <div className="destination-footer">
          {run.destination.length} document
          {run.destination.length === 1 ? "" : "s"} · Local memory only · No
          external request
        </div>
      </section>
    </div>
  );
}
