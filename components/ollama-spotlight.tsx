"use client";

import Link from "next/link";
import { ArrowUpRight, Bot, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";

type ModelStatus = {
  model: string;
  connected: boolean;
  message: string;
  state?: "ready" | "model-missing" | "offline" | "invalid-model";
};

export function OllamaSpotlight() {
  const [status, setStatus] = useState<ModelStatus | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/model", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not check Ollama status.");
        return (await response.json()) as ModelStatus;
      })
      .then(setStatus)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== "AbortError") {
          setStatus({
            model: "gemma3:latest",
            connected: false,
            state: "offline",
            message: "Ollama status could not be checked.",
          });
        }
      });
    return () => controller.abort();
  }, []);

  const ready = status?.connected === true;
  const stateLabel = !status
    ? "CHECKING LOCAL RUNTIME"
    : ready
      ? "OLLAMA CONNECTED"
      : "OLLAMA SETUP NEEDED";

  return (
    <section className={`ollama-spotlight ${ready ? "ready" : ""}`} aria-label="Ollama local AI">
      <div className="ollama-spotlight-icon" aria-hidden="true"><Bot size={25} /></div>
      <div className="ollama-spotlight-copy">
        <div className="small-caps"><span className={`status-dot ${ready ? "live" : ""}`} /> LOCAL AI · OLLAMA + GEMMA</div>
        <h2>Keep the model on your machine.</h2>
        <p>ChainPatch uses Ollama for optional Gemma analysis and live answers. The safety replay stays deterministic, so model suggestions never become proof.</p>
        <div className="ollama-spotlight-status" role="status" aria-live="polite">
          <strong>{stateLabel}</strong>
          <span>{status ? `${status.message} · ${status.model}` : "Checking the configured model…"}</span>
        </div>
      </div>
      <div className="ollama-spotlight-actions">
        <Link className="button button-dark" href="/gemma"><ArrowUpRight size={15} /> Try Ollama live</Link>
        <Link className="text-link" href="/settings">Model setup <Settings2 size={14} /><ArrowUpRight size={14} /></Link>
      </div>
    </section>
  );
}
