# AbridgeAI — GitHub-Worthiness Roadmap (2026 bar)

What a 2026 réviewer screens for in a "full-stack AI" repo, in screening order:
**first 30 seconds:** README quality, demo GIF/video, live link, architecture diagram.
**first 5 minutes:** CI badge green, tests exist, no leaked secrets, LICENSE, honest
"Limits" section. **deeper:** real data, streaming/evals for AI parts, container
story, commit hygiene. This repo's gaps, ordered:

---

## Tier 1 — Credibility fasteners (do first; ≤ 1 weekend total)
1. **CI green badge** — `.github/workflows/ci.yml`: oxlint + vitest + one `/api/plan`
   smoke test (no LLM path: run with no keys). Badge in README.
2. **Demo GIF** at top of README (the pipeline timeline animating end-to-end) + the
   screenshots you already have. A 2026 reviewer watches more than reads.
3. **"Honest limitations" section** in README (deterministic fallback floor, no
   persistence, unauthenticated). Self-stated limits convert skeptics.
4. **LICENSE (MIT) + accurate `.env.example`** (remove the fields you don't read).
5. **One architecture diagram** — mermaid in README: browser → express → 7 stages →
   LLM chain → fallback. Diagrams are the #1 skimmed artifact.

## Tier 2 — The 2026 AI-native upgrade (this is what separates fresh code)
6. **Streaming pipeline** (SSE per stage) — turns the theatre timeline real; also
   fixes the 60s single-function latency pressure.
7. **Schema-validated LLM output** — pass a JSON schema with the generation request
   (Gemini supports `responseSchema`), keep the normalizer as belt-and-suspenders.
8. **Micro-evals in CI** — 10 seed ideas; eval script asserts the plan {contains
   required fields, stack matches stack section, milestones total ≈ deadline}.
   This single file screams "I understand AI systems engineering," which 99% of
   AI repos lack.
9. **Cost guardrails visible in code** — rate limit + `AbortSignal.timeout` +
   per-request provider budget. Mentionable as one system called "abuse budget".

## Tier 3 — Ops & data (only after Tier 2)
10. **Persistence behind an interface** — Supabase/SQLite for plan history with
    user accounts (GitHub OAuth is enough); stops the "localStorage cap 12" story.
11. **Docker** — one `Dockerfile` (multi-stage build of dist + backend), compose
    with a local Postgres. Not for deployment, for review-ability.
12. **Real research stage option** — replace array-pick fallback quality with a
    pluggable source (news/search API behind the same stage interface). Even one
    real source changes the "fake research" answer in Q8.
13. **OpenSSF Scorecard / Dependabot** — automated supply-chain posture; free
    signal on the README.

## What to *practice* (not repo work) so you can defend all of it
- **Testing pyramid out loud:** unit → agent contract (stubbed LLM) → e2e smoke.
- **Explain serverless economics:** cold starts, instance state, why Map cache
  doesn't survive, why rate-limit-before-LLM matters.
- **Prompt-engineering as file artifact:** why prompt files are versioned, how eval
  catches drift in them.
- **One 90-second story per Tier-2 item** in Problem→Decision→Result form.

## Skill checklist to call the project "interview-credible"
- [ ] Green CI badge + ≥8 tests
- [ ] Streaming demo GIF
- [ ] Schema-validated model output + eval file
- [ ] Rate limit + timeouts in committed code
- [ ] Architecture mermaid diagram
- [ ] LICENSE + honest-limits section
- [ ] Key rotation done & mentioned in a CHANGELOG
- [ ] Can answer Q1–Q10 of `01` without notes
