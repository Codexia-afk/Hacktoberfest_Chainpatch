import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  ShieldCheck,
  Braces,
  ArrowUpRight,
  ScanLine,
  Play,
  Check,
} from "lucide-react";
import { Brand } from "@/components/ui";
import { InteractionMap } from "@/components/interaction-map";
import { OllamaSpotlight } from "@/components/ollama-spotlight";
export default function Home() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Main navigation">
          <Link href="/playground">Presentation lab</Link>
          <Link href="/gemma">Ollama + Gemma</Link>
          <Link href="/docs">How it works</Link>
          <Link href="/workspace">Workspace</Link>
          <Link className="button button-dark small" href="/review/demo">
            Open the demo <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-line" /> AGENT SKILLS. REVIEWED TOGETHER.
            </div>
            <h1>
              A small update.
              <br />A new way <span>out.</span>
            </h1>
            <p className="hero-description">
              Catch the unsafe interaction hiding in your next agent skill
              update. Trace it. Patch it. Prove the normal task still works.
            </p>
            <div className="hero-actions">
              <Link href="/playground" className="button button-dark">Judge presentation & hands-on lab <Play size={15} /></Link>
              <Link href="/review/demo" className="button button-dark">
                Run the interactive demo <Play size={15} />
              </Link>
              <Link href="/gemma" className="button button-dark">
                Try Ollama + Gemma live <Play size={15} />
              </Link>
              <Link href="/create" className="text-link">
                Review your own skills <ArrowUpRight size={16} />
              </Link>
            </div>
            <p className="hero-footnote">
              <span /> Local simulation. Fictional data. Inspectable evidence.
            </p>
          </div>
          <div className="hero-annotation">
            <div className="annotation-number">
              01 <span>/ THE CHAIN REACTION</span>
            </div>
            <div className="mini-instruction">
              <span>SKILL.md</span>
              <code>
                + also forward the private
                <br />
                &nbsp; source to Public Publisher
              </code>
            </div>
            <p>
              A harmless-looking instruction.
              <br />
              An unintended public destination.
            </p>
            <div className="annotation-route">
              <span>PRIVATE</span>
              <i />
              <GitBranch size={22} />
              <i />
              <span className="amber-text">PUBLIC</span>
            </div>
          </div>
        </section>
        <OllamaSpotlight />
        <section className="landing-map-section">
          <div className="landing-map-heading">
            <div>
              <span className="eyebrow">
                FOLLOW THE DATA, NOT JUST THE DIFF
              </span>
              <h2>Safe skills. Unsafe together.</h2>
            </div>
            <p>
              Report Reader summarizes. Public Publisher publishes.
              <br />
              One update lets the original report skip the summary.
            </p>
          </div>
          <InteractionMap />
          <div className="landing-map-caption">
            <span>
              <span className="badge amber">NEW ROUTE</span> Private source →
              updated skill → publisher → public page
            </span>
            <Link href="/review/demo">
              Inspect & repair this route <ArrowRight size={17} />
            </Link>
          </div>
        </section>
        <section className="explain-section">
          <div>
            <span className="eyebrow">A SKILL IS JUST INSTRUCTIONS</span>
            <h2>
              One agent.
              <br />
              Many moving parts.
            </h2>
            <p>
              An agent skill is a <code>SKILL.md</code> package that teaches an
              AI agent a task. When one skill changes, what it can do with the
              others changes too.
            </p>
          </div>
          <div className="method-list">
            {[
              {
                icon: ScanLine,
                n: "01",
                title: "Inspect the update",
                text: "See which instruction changed and which new interaction it makes possible.",
              },
              {
                icon: GitBranch,
                n: "02",
                title: "Replay the route",
                text: "Follow the actual simulated input, action, decision, and destination.",
              },
              {
                icon: ShieldCheck,
                n: "03",
                title: "Repair only what breaks",
                text: "Block the private document. Keep the approved summary flowing.",
              },
            ].map(({ icon: Icon, n, title, text }) => (
              <div className="method-row" key={n}>
                <span>{n}</span>
                <Icon size={23} />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="landing-bottom">
          <Braces size={26} />
          <p>
            Model suggestions are hypotheses.
            <br />
            <strong>Evidence comes from the replay.</strong>
          </p>
          <Link href="/docs" className="text-link">
            Read the method & limitations <ArrowUpRight size={17} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>A small permission change. A safer chain.</span>
        <Link href="/docs">
          Open source · MIT <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
