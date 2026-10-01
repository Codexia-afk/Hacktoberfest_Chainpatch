# ChainPatch contributor instructions

- Keep the application local-first. Do not add a network call, credential, wallet, or paid-service dependency just to make a demo appear integrated.
- Preserve the evidence boundary: Gemma suggestions are hypotheses, deterministic replay is the only simulated observation, and no supplied skill text is executable code.
- Never claim a Solana transaction, Snowflake upload, GitHub Copilot generation, or OWASP certification unless the repository contains and tests the real operation. The current exports are explicitly local-only artifacts.
- Keep policy enforcement deterministic and at the publisher boundary. Test both the unsafe private-source probe and the legitimate approved-summary task after policy changes.
- Use the existing stack and scripts: `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
- Keep model prompts compact and bounded. Do not send replay history or unrelated workspace data to Ollama.
- Validate user input with the existing Zod schemas and preserve same-origin checks, body-size limits, and no-store security headers on mutation/export routes.
