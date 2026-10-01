"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Info, Plus, GitBranch } from "lucide-react";
import { Shell, PageHeading, ErrorBox } from "@/components/ui";
import { seedInput } from "@/lib/seed";
export default function Create() {
  const router = useRouter();
  const [values, setValues] = useState({
      title: "",
      current: "",
      proposed: "",
      installed: "",
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not create review");
      router.push(`/review/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save review");
      setBusy(false);
    }
  }
  return (
    <Shell>
      <div className="page-content create-page">
        <PageHeading
          eyebrow="NEW INVESTIGATION"
          title="What changed in the chain?"
          description="Paste the skill before and after the update. Add the skills it can work with."
          action={
            <button
              className="button"
              onClick={() =>
                setValues({
                  ...seedInput,
                  title: "My report publishing review",
                })
              }
            >
              <FileText size={16} />
              Load example
            </button>
          }
        />
        <div className="create-note">
          <Info size={19} />
          <p>
            A skill is a <strong>SKILL.md</strong> instruction package that
            teaches an agent a task. ChainPatch compares instructions, then maps
            supported report-to-publisher interactions to a local simulation.
          </p>
        </div>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="title">
            Review name <span>Make it easy to recognize later.</span>
          </label>
          <input
            id="title"
            required
            minLength={3}
            maxLength={100}
            placeholder="e.g. Incident reporting → public updates"
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
          />
          <div className="create-columns">
            {(["current", "proposed"] as const).map((key, i) => (
              <div className="form-code" key={key}>
                <label htmlFor={key}>
                  <span className="step-label">0{i + 1}</span>
                  {key === "current" ? "Current SKILL.md" : "Proposed SKILL.md"}
                  <span>
                    {key === "current" ? "Installed version" : "Pending update"}
                  </span>
                </label>
                <textarea
                  id={key}
                  required
                  minLength={30}
                  maxLength={16000}
                  spellCheck={false}
                  placeholder={
                    key === "current"
                      ? "# Report Reader\nRead the private incident report.\nCreate an approved summary…"
                      : "# Report Reader\nPaste the complete updated instructions…"
                  }
                  value={values[key]}
                  onChange={(e) =>
                    setValues({ ...values, [key]: e.target.value })
                  }
                />
                <span className="char-count">
                  {values[key].length.toLocaleString()} / 16,000 characters
                </span>
              </div>
            ))}
          </div>
          <div className="form-code">
            <label htmlFor="installed">
              <span className="step-label">03</span>Other installed skills
              <span>Instructions or capability descriptions</span>
            </label>
            <textarea
              id="installed"
              required
              minLength={20}
              maxLength={16000}
              spellCheck={false}
              placeholder="# Public Publisher\nPublish received documents to a public status page…"
              value={values.installed}
              onChange={(e) =>
                setValues({ ...values, installed: e.target.value })
              }
            />
          </div>
          {error && <ErrorBox message={error} />}
          <div className="form-footer">
            <p>
              <Info size={15} />
              Instructions are analyzed as text. Uploaded code is never
              executed.
            </p>
            <button
              className="button button-dark"
              disabled={busy}
              type="submit"
            >
              {busy ? (
                <>
                  <span className="spinner" />
                  Analyzing & saving…
                </>
              ) : (
                <>
                  <GitBranch size={17} />
                  Create review <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
          {busy && (
            <p className="muted" role="status">
              Checking the configured Gemma model. If unavailable, clearly
              labelled local analysis will be saved. This can take up to 20
              seconds.
            </p>
          )}
        </form>
      </div>
    </Shell>
  );
}
