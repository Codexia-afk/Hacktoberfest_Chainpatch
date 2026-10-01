"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Server, ShieldCheck, ArrowUpRight } from "lucide-react";
import { Shell, PageHeading, Badge, ErrorBox } from "@/components/ui";
type Status = {
  endpoint: string;
  model: string;
  connected: boolean;
  message: string;
};
export default function Settings() {
  const [status, setStatus] = useState<Status | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function check() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/model");
      if (!response.ok)
        throw new Error("Could not check the model connection.");
      setStatus(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection check failed");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void check();
  }, []);
  return (
    <Shell>
      <div className="page-content">
        <PageHeading
          eyebrow="CONFIGURATION"
          title="Local by design."
          description="Your model connection, simulation boundaries, and data storage."
        />
        {error && <ErrorBox message={error} />}
        <section className="settings-card">
          <div className="settings-status">
            <Server size={25} />
            <div>
              <h3>Gemma via Ollama</h3>
              <p>{status?.message || "Checking your local model…"}</p>
            </div>
            <Badge tone={status?.connected ? "green" : "amber"}>
              {status?.connected ? "CONNECTED" : "FALLBACK AVAILABLE"}
            </Badge>
            <button className="button" disabled={busy} onClick={check}>
              <RefreshCw size={14} />
              {busy ? "Checking…" : "Check connection"}
            </button>
          </div>
          <div className="settings-fields">
            <label>
              Ollama endpoint
              <input readOnly value={status?.endpoint || "Loading…"} />
              <small>Server environment · OLLAMA_BASE_URL</small>
            </label>
            <label>
              Open-weight model
              <input readOnly value={status?.model || "Loading…"} />
              <small>Server environment · GEMMA_MODEL</small>
            </label>
          </div>
          <p>
            Set these values in <code>.env.local</code> and restart the server
            to change the connection. Connection status means the model is
            installed; a review is labelled “Gemma” only after a valid analysis
            response.
          </p>
          <pre className="settings-code">{`# Start Ollama and install the model\nollama pull gemma3:4b\nollama serve\n\n# .env.local\nOLLAMA_BASE_URL=http://127.0.0.1:11434\nGEMMA_MODEL=gemma3:4b`}</pre>
          <p>
            Open a review’s <strong>Skill diff</strong> and choose{" "}
            <strong>Analyze with configured Gemma</strong> to regenerate the
            hypothesis. New reviews try Gemma automatically. Analysis requests
            time out after 20 seconds.
          </p>
          <Link className="button button-dark" href="/gemma">
            Open the live Gemma prompt lab <ArrowUpRight size={15} />
          </Link>
        </section>
        <section className="settings-card">
          <div className="section-heading">
            <h2>Simulation & storage</h2>
            <ShieldCheck size={22} />
          </div>
          <ul>
            <li>
              SQLite stores review content, applied policies, and the latest 60
              replay records per review in <code>.data/chainpatch.sqlite</code>.
            </li>
            <li>
              Every replay uses a fresh in-memory vault and public page with
              fictional documents.
            </li>
            <li>
              The publisher never sends network requests. Supplied instructions
              are never executed as code.
            </li>
            <li>
              Ollama receives the pasted instructions when analysis is
              requested. Use non-sensitive content, particularly if you
              configure a remote model endpoint.
            </li>
            <li>
              This is a single-user local workbench. It has no authentication
              and should not be exposed as a public multi-user service.
            </li>
          </ul>
          <Link className="text-link" href="/docs">
            Read the architecture & limitations <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>
    </Shell>
  );
}
