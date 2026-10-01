import Link from "next/link";
import { Shell, PageHeading } from "@/components/ui";
import { ArrowUpRight } from "lucide-react";
export default function Docs() {
  return (
    <Shell>
      <div className="page-content">
        <PageHeading
          eyebrow="FIELD NOTES / 01"
          title="Understand the whole chain."
          description="What ChainPatch does, what the evidence means, and how to run it yourself."
        />
        <div className="docs-grid">
          <article className="docs-article">
            <section id="concept">
              <h2>A skill is an instruction package.</h2>
              <p>
                An agent skill is a <code>SKILL.md</code> file that tells an AI
                agent how to perform a task. Report Reader knows how to turn a
                private incident report into an approved summary. Public
                Publisher knows how to publish it.
              </p>
              <p>
                Those skills can be reasonable separately. But an update that
                tells the reader to forward the original report creates a new
                interaction. ChainPatch reviews that change in context.
              </p>
            </section>
            <section id="method">
              <h2>Three layers. Three different claims.</h2>
              <ol>
                <li>
                  <strong>Analysis suggests a route.</strong> A configured
                  open-weight Gemma model interprets the supplied instructions,
                  suggests a source handoff, and explains a repair. Its JSON
                  schema and exact supporting quotations are validated. Without
                  Gemma, the seeded example uses curated sample analysis; custom
                  reviews use a conservative keyword parser.
                </li>
                <li>
                  <strong>The simulator exercises that route.</strong> Typed
                  fixtures represent a private report and an approved summary. A
                  selected scenario chooses an input and passes it through a
                  local reader and publisher. Each input, action, and decision
                  is saved.
                </li>
                <li>
                  <strong>The policy decides an action.</strong> Deterministic
                  code checks the input classification at the publisher
                  boundary. The recommended rule permits approved summaries
                  only. It is tested against both the source probe and the
                  normal task.
                </li>
              </ol>
              <p>
                “Before Update,” “After Update,” and “After Fix” use the same
                engine and fresh destinations. Selecting a scenario executes it.
                The preview graph alone is not replay evidence.
              </p>
            </section>
            <section id="limits">
              <h2>Evidence has a boundary.</h2>
              <p>
                A successful replay does not prove every possible real-world
                agent behavior safe. The simulator covers a report-to-publisher
                pattern, not arbitrary tools. Custom reviews outside that
                pattern retain their diff and analysis, but do not receive
                simulated safety verdicts.
              </p>
              <p>
                Classification labels come from the fixtures or the user’s input fields.
                In the judge lab, you supply both the private report and its approved
                summary; the simulator does not redact or classify text automatically.
                A production system would need trustworthy classification,
                tool-side enforcement, authentication, isolation, and broader
                scenario coverage.
              </p>
              <p>
                Keyword interpretation can miss paraphrases and subtle
                negations. Model quotations being present does not prove that
                their interpretation is correct. Inspect the evidence and the
                assumptions.
              </p>
            </section>
            <section id="setup">
              <h2>Run it locally.</h2>
              <pre>{`# Node.js 22.13+ recommended\nnpm install\ncp .env.example .env.local\nnpm run dev\n\n# Open http://127.0.0.1:3000\n# Validate the implementation\nnpm test\nnpm run typecheck\nnpm run build`}</pre>
              <h3>Connect Gemma</h3>
              <pre>{`ollama pull gemma3:4b\nollama serve\n\n# .env.local\nOLLAMA_BASE_URL=http://127.0.0.1:11434\nGEMMA_MODEL=gemma3:4b`}</pre>
              <p>
                Check the connection in Settings. Analyze an existing review
                from Skill diff, or create a new one. Ollama receives only the
                supplied instructions; no real secrets or files are read by the
                simulated tools.
              </p>
              <h3>Architecture</h3>
              <p>
                Next.js and TypeScript power the UI and API. Zod validates
                reviews, policies, and model output. A typed analysis engine is
                separate from UI components. SQLite persists reviews and replay
                evidence. JSON and Markdown exports serialize those same
                records.
              </p>
            </section>
            <section id="demo">
              <h2>A 90-second judge walkthrough.</h2>
              <ol>
                <li>
                  <strong>0–15 seconds:</strong> Open the interactive demo.
                  Explain that a skill is an instruction package. Run Before
                  Update: the public page receives only an approved summary.
                </li>
                <li>
                  <strong>15–35 seconds:</strong> Inspect Skill diff. Select
                  After Update: the source-forwarding instruction now lets the
                  private document reach the public destination. Expand the
                  action trace.
                </li>
                <li>
                  <strong>35–65 seconds:</strong> Open Patch Lab. Apply “Allow
                  approved summaries only.” The unsafe probe is blocked; the
                  legitimate task succeeds. Try disabling publication to see why
                  that alternative fails the normal task.
                </li>
                <li>
                  <strong>65–90 seconds:</strong> Restore the recommended rule.
                  Inspect After Fix and export the Evidence report. Note the
                  analysis provenance and bounded simulation limits.
                </li>
              </ol>
              <Link href="/review/demo" className="button button-dark">
                Run the interactive demo <ArrowUpRight size={15} />
              </Link>
            </section>
            <section id="challenges">
              <h2>Built for open investigation.</h2>
              <p>
                <strong>OWASP:</strong> ChainPatch demonstrates review of
                excessive tool permissions and unsafe data flows across agent
                skills. It is an educational prototype, not an OWASP
                certification or a complete security assessment.
              </p>
              <p>
                <strong>Google Gemma:</strong> The optional local open-weight
                model interprets natural-language instructions, proposes
                interaction hypotheses, and explains a constrained repair.
                Deterministic policy enforcement remains separate.
              </p>
              <p>
                <strong>Solana:</strong> Evidence exports include a SHA-256
                digest formatted as an SPL Memo-compatible payload. It is
                clearly marked not submitted; no wallet, RPC request, or
                transaction is made.
              </p>
              <p>
                <strong>Snowflake:</strong> Evidence exports include a local
                SQL script for replay events using <code>PARSE_JSON</code>.
                The script is portable but is not uploaded to Snowflake.
              </p>
              <p>
                <strong>GitHub Copilot:</strong> Repository instructions in
                <code>.github/copilot-instructions.md</code> give Copilot the
                same local-first and evidence-boundary rules. The project does
                not claim that Copilot generated its code.
              </p>
              <p>
                These are honest integration points, not substitutes for a
                track&apos;s published requirement to use a live service or SDK.
                The MIT-licensed application includes its simulator, adapters,
                schemas, tests, and sample scenario. Gemma model weights remain
                subject to their own terms; no award qualification is claimed.
              </p>
            </section>
          </article>
          <nav className="docs-index" aria-label="On this page">
            <span className="small-caps">ON THIS PAGE</span>
            {[
              ["concept", "The idea"],
              ["method", "How it works"],
              ["limits", "Safety limits"],
              ["setup", "Local setup"],
              ["demo", "Judge walkthrough"],
              ["challenges", "Challenge context"],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </Shell>
  );
}
