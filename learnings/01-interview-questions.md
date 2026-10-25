# AbridgeAI — Interview Question Bank

32 questions. Rounds 1–2 are what most Résumé-screeners ask; Rounds 3–5 are where
they decide whether you actually built it. Every question has:
**Key** = the strong answer outline. **Recover** = what to say if you blank.
Map key paths: `backend/src/pipeline/stages.js`, `backend/src/services/llm.js`,
`backend/src/agents/*.js`, `src/utils/storage.js`, `vercel.json`.

---

## Round 1 — Pitch & big picture (10-second answers)

**Q1. Convince me AbridgeAI isn't a ChatGPT wrapper.**
- **Key:** Most of the pipeline is deterministic code — FNV-1a hash + seeded `pick()`, weighted feasibility math, deadline parsing, scaffold generation (`backend/src/scaffold/scaffold.js`). LLMs only *upgrade()-> prose* in 4 of 7 stages via `services/llm.js`, and the app returns a complete plan with zero API keys. The LLM is an optional enhancement, not the engine.
- **Recover:** "The engine is code, not a model. If I unplug Gemini and Groq, it still produces a full plan — that's the design."

**Q2. Walk me through one HTTP request end-to-end.**
- **Key:** Browser `fetch('/api/plan')` (`src/api/client.js`) → Vite proxy → :3001 → `backend/app.js` Express route → `runPipeline()` loop over `STAGE_ORDER` (github→research→feasibility→architecture→stack→builder→brief) → context `{input, results, errors}` → JSON back → React renders + localStorage history.
- **Recover:** Draw it: browser → express route → pipeline loop → stage functions → JSON back. Name `runPipeline` and one agent file.

**Q3. Why two runners (`backend/server.js` and `api/index.js`) for one backend?**
- **Key:** `backend/app.js` exports `createApp()` with no `.listen()`. `server.js = local dev` (port 3001, `--watch --env-file-if-exists=.env`); `api/index.js = serverless entry` (Vercel function, `export default createApp()`). One app object, two lifecycles — avoids "works locally, breaks on Vercel".
- **Recover:** "App creation and app *starting* are separated so the same Express app can boot as a process locally or as a Lambda on Vercel."

**Q4. Why is Express your backend's *only* dependency?**
- **Key:** Deliberate dependency budget — native `fetch` instead of axios, Node's `--env-file` instead of dotenv, no CORS lib because same-origin/proxy, plain JSON responses. It was also a constraint exercise: fewer packages = fewer supply-chain risks.
- **Recover:** "I treated dependencies as a cost. Everything stdlib could do, stdlib did."

**Q5. What happens when there are no API keys at all?**
- **Key:** `services/llm.js` orchestrator: Gemini → Groq → **deterministic fallback** built from FNV-1a hash + curated pools. Demo still works, output is reproducible, UI never stalls.
- **Recover:** "Degradation, not failure. Same shape, worse prose."

---

## Round 2 — Pipeline & core design

**Q6. Why a stage registry (`stages.js`) instead of just calling 7 functions in sequence?**
- **Key:** Registry = array of `{id, title, run}` used by `runPipeline()` to iterate. Single source of truth also feeds `GET /api/meta`, so UI dropdowns/timeline derive from the backend — three places can't drift.
- **Recover:** "One list drives execution *and* API metadata; adding a stage means editing one file, not five."

**Q7. One stage throws mid-run. What does the caller get?**
- **Key:** Per-stage try/catch writes to `ctx.errors`; the loop continues; `/api/plan` returns `{ ok, results, errors }`. A later stage reads `ctx.errors` to degrade gracefully instead of crashing.
- **Recover:** "Failures are captured per-stage into a shared context, so a partial plan beats no plan."

**Q8. Your research stage is deterministic — including "picking sentences from arrays". Isn't that fake value?**
- **Key:** Honest answer: the deterministic fallback is *shape fidelity* (guaranteed demo), not research. The value is in the LLM path; the fallback is the floor. Then name the plan: real research needs a data source (web search API / news feed) — LLM-only research is unverifiable either way.
- **Recover:** Don't defend it as intelligence — call it the guaranteed floor, and connect shamelessly to "how I'd upgrade it" (Round 5).

**Q9. Explain the determinism trick — FNV-1a + seeded pick. Why not `Math.random()`?**
- **Key:** FNV-1a hashes the stage seed string to a 32-bit int; `pick(arr, seed)` uses that to index arrays. Same input → same hash → same output — reproducible outputs, which LLMs don't give. Also makes caching keys trivial.
- **Recover:** "Hash turns a string into a stable random-looking number. Random-looking but repeatable — that reproducibility is the point."

**Q10. Your LLM cache is an in-process `Map`. What's wrong with it on Vercel?**
- **Key:** Serverless = cold starts and multiple concurrent lambdas → the Map evaporates on every warm-up and isn't shared across like-instances; also it's unbounded (no eviction = memory growth) in long-lived processes. Verdict: useful in `server.js` (single long-lived process), near-useless on Vercel.
- **Recover:** "State in serverless is per-instance. I'd move to an external cache (Upstash Redis) — that's my first scale item."

**Q11. How do you guarantee an LLM's malformed output never breaks your UI?**
- **Key:** Every LLM-upgrading stage **normalizes**: validate → fill defaults from deterministic result → safe render (`agents/*.js` + `brief/model.js`). The deterministic result is also the *shape* template, so the UI can't distinguish "LLM wrote it" from "fallback wrote it".
- **Recover:** "The LLM output is never rendered raw. A normalizer merges it over a known-good shape — missing fields fall back to deterministic values."

**Q12. Are stages dependent on each other? In what order would you parallelize?**
- **Key:** github → research → feasibility → architecture → stack → builder → brief. research depends on github signals; brief depends on everything. Feasibility could run parallel to research; stack parallel to architecture for a tree of depth-3 → latency 7-sequential → ~4 levels.
- **Recover:** "It's a chain with a couple of parallelizable branches; I know which edges are real dependencies and which are convenience."

---

## Round 3 — The LLM layer (where "AI projects" get grilled)

**Q13. Describe your fallback chain and the Groq retry trick.**
- **Key:** `services/llm.js`: Gemini (`generativelanguage.googleapis.com`, model default `gemini-*` via env) → on failure Groq (`api.groq.com/openai/v1/chat/completions`, OpenAI-compatible). Groq quirk: retry *without* `response_format` after a JSON failure and salvage-parse instead of assuming the model can't obey JSON mode.
- **Recover:** "Primary, then an OpenAI-compatible second provider, then fully deterministic code — three rings of degradation."

**Q14. Why call the REST APIs with native `fetch` instead of the official SDKs?**
- **Key:** Smaller cold-start bundles (serverless latency + Lambda size limits), no dependency drift, and the calls are one endpoint each. SDK would buy convenience at the cost of bundle/cold-start on a 60s maxDuration function.
- **Recover:** "In serverless, bundle size is a real cost; the APIs were single-endpoint so an SDK bought me nothing."

**Q15. How do you design a prompt file? Where does prompt content live and why?**
- **Key:** Prompts live in dedicated files under `backend/src/agents/` (not inline strings). Separation lets them be reviewed/tuned as artifacts, seeded with data from prior stages (github signals, feasibility axes), and one prompt can be diffed/versioned.
- **Recover:** "Prompts are artifacts, not literals. They're versioned files that receive stage context as data."

**Q16. A Gemini failure mode you hit (the "history" in your root learnings.md). Tell me about a real bug.**
- **Key:** Use the root `learnings.md` Step 16 bug stories: markdown-fenced JSON (Model returns ```json … ``` and JSON.parse dies) → salvage-parse (strip fences, brace-slice) + normalization; empty text on safety-block. Emphasize detection → fix → prevention chain.
- **Recover:** "Models wrap JSON in markdown fences. I learned to *never* trust raw parse — inspect then salvage."

**Q17. Four sequential LLM calls inside one 60-second serverless function. Walk me through the latency and failure math.**
- **Key:** Worst case: 4 × (provider latency ~5–15s) + deterministic stages ≈ tight against 60s; if call #3 hangs (no `AbortController` today!) the function burns to the cap. Mitigations I know: per-call timeout with abort, parallelize independent stages, or split into one-call-per-stage with client-side step orchestration.
- **Recover:** "Latency compounds serially and there's currently no abort timeout — that's a known gap and I have the fix sketched."
- **Practice:** Actually implement `AbortSignal.timeout(15000)` in `gemini.js`/`groq.js` before interview season so the gap becomes a closed story.

**Q18. Is the "cache" honest? What's `pick()` doing inside a stage that also got LLM output?**
- **Key:** `pick()` only acts on the fallback path; cached results are keyed by stage-seed hash. Distinguish: cache dedupes LLM calls for the same input; determinism just makes fallback reproducible.
- **Recover:** "Two mechanisms: caching (don't re-call the model) and seed-hash determinism (same input → same fallback)."

---

## Round 4 — Frontend & state

**Q19. NoRedux, no Zuestand, no React Query. Just useState + localStorage. Why, and where does it hurt?**
- **Key:** Three data classes: ephemeral form state (useState), UI prefs (theme → localStorage), persisted history (`storage.js`, capped 12). Server state comes only from a single plan run — no cache-invalidation problem, so React Query's value is small. Hurts: history migration code, no optimistic UI, no sync across tabs/devices.
- **Recover:** "State choice should match data class. It's a read-modify-write-once app, not a collaborative dashboard."

**Q20. Explain a real migration: your localStorage schema `v0 → v1` normalize.**
- **Key:** `src/utils/storage.js`: store a `version` on each record; on load, `normalize()` upgrades old records field-by-field. This survives shipping changes without breaking users who saved data under an old build.
- **Recover:** "Persisted data outlives code versions, so every read is a normalize/migrate step. I've done exactly that once."

**Q21. Why generate zip components **client-side** with `fflate` instead of a backend zip?**
- **Key:** `builderAgent` already returns a files array as JSON; zip happens in browser via `fflate.zipSync` (`src/utils/zip.js`) — zero server CPU/bandwidth, works offline-ish, pure transfer of JSON. Reverse-argument: backend zip is better if there are secrets or huge files.
- **Recover:** "The data was already client-side; zipping it locally was cheaper than shipping bytes twice."

**Q22. What does that pipeline *timeline animation* actually show vs what the backend does?**
- **Key:** Honest answer: backend executes everything in one request; frontend plays a `setTimeout` sequence — presentation theatre, not streaming. Then: the real fix is server-sent events streaming per-stage (`text/event-stream`) and the timeline is the natural UI for it.
- **Recover:** Never pretend it's live. Say "right now it's a rendering delay; making it real is a 1-line protocol change to SSE + a small service refactor."

---

## Round 5 — Security, ops, scale (the senior round)

**Q23. Where are your API keys and what's their blast radius?**
- **Key:** `.env` locally (gitignored — verified untracked), Vercel env vars in prod. Gemini key is currently appended as **URL query param** (`?key=…`) — invisible-not-safe: proxies, access logs, browser-adjacent logging may capture it. Fix: switch Gemini auth to `x-goog-api-key` header; rotate any key that ever left the machine.
- **Recover:** Name the location, the transport, the leak risk, and the header fix. Being *aware* lands better than being innocent.

**Q24. Walk me through what happens if a stranger spams `/api/plan`.**
- **Key:** No rate limiter, no auth → they burn my Groq/Gemini quota and my Vercel function-hours; 4 LLM calls × N requests = money. Fixes in order: express middleware (`express-rate-limit` plus per-IP), then a soft-auth token, then per-function-provider budget/caps, then abuse-visible analytics.
- **Recover:** "Cost attack surface is my #1 gap; rate limiting is the first PR I'd write."
- **Practice:** Actually add `express-rate-limit` — 20 lines, shippable in one evening.

**Q25. GitHub stage: no token, 60 req/hr per IP, and a silent 3-deep fallback ending in "octocat". Defend or fix.**
- **Key:** Silent fake data is a UX honesty bug. Minimum fix: explicit UI state "using sample data — live fetch failed because X", plus small in-memory cache and optional PAT. Fix ambitions: per-request check + durable message channel.
- **Recover:** "Fallbacks must be *labeled*, never silent. I'd rather fail honestly than succeed falsely."

**Q26. How would you test a system whose stages hit live APIs?**
- **Key:** Hierarchical plan: (1) pure unit tests — feasibility math, deadline parsing (`domain/deadline.js`), custom-stack tokenizer, FNV hash/pick — no mocking needed; (2) per-stage agent contract tests with the LLM stubbed to fixed JSON; (3) one `app.js` supertest: POST `/api/plan` with no keys → assert `ok:true`, all 7 stages present, snapshot shape. Run all three in GitHub Actions.
- **Recover:** "My test plan starts with pure functions and ends with one golden `/api/plan` smoke test — the pipeline is already function-shaped for this."

**Q27. Vercel rewrites: what's in your `vercel.json` and why SPA fallback matters?**
- **Key:** Two rewrites — `/api/(.*)` → `/api` function and catch-all `/(.*)` → `/index.html` (SPA routing). `functions.api/index.js.maxDuration = 60` for LLM round-trips. Why catch-all: deep links/refresh won't 404.
- **Recover:** "Two lines: API passthrough and SPA fallback, plus one maxDuration override. I can draw it."

**Q28. What breaks at 10,000 users per month?**
- **Key:** Ordered: (1) cost — LLM spend unthrottled; (2) quota — GitHub 60/hr; (3) limits — express-the 2mb JSON should be per-route tightened; (4) cache — per-process Map; (5) history — frontend-only persistence means cross-device nothing. Then the path: rate-limit → external cache (Upstash) → queue/Jobs for long runs → persistent history (Supabase/Postgres) with per-user keys.
- **Recover:** "I know the order: abuse/cost first, then stateful storage, then per-request latency."

**Q29. If I give you a seed round, ship what first?** (Prioritization culture-fit check)
- **Key:** Pick 2–3 that show judgment: rate limiting/abort/timeouts (risk off the table), test+CI skeleton (velocity), per-stage streaming (user-visible). Skip DB until there's returning users needing history.
- **Recover:** Any ordered answer with a *reason per item* beats a laundry list.

**Q30. Why `oxlint` instead of ESLint, and does your CI actually run it?**
- **Key:** Rust-built linter — fast cold runs in CI. Reality gap: lint is a local npm script; there is **no CI anywhere in the repo** — say it plainly, then "the first CI workflow is lint + a smoke test" (`03` has the roadmap).
- **Recover:** "Docs yes, CI no — that's an intentional admission and a cheap fix."

**Q31. Tell me something in this repo you'd now do differently.**
- **Key:** Pick real ones: (a) POST /api/plan validation beyond `express.json({limit:'2mb'})` — schema-validate with zod; (b) webpack of `backend/package.json` vs root version skew (express `^4.21.2` vs `^4.22.3`) — single workspace dep; (c) URL-param Gemini key → header.
- **Recover:** Never say "nothing". Growth-readiness = self-critique with a fix name.

**Q32. What "AI-native" improvement would convince a 2026 reviewer this isn't a 2024 pattern?**
- **Key:** Per-stage **streaming** (SSE) + **structured outputs with schema-validated JSON** + a small **eval set** (10 seed ideas × expected field coverage) run in CI to catch prompt regressions. That trio (stream, validate, eval) is the current bar.
- **Recover:** "Stream the pipeline, schema-enforce the model, and make evals a CI check — that's the trio I'm building."

---

## Self-scoring rubric
| Score | Meaning |
|---|---|
| ≥28 confident | Ship-ready for interviews; go deep in Rounds 3/5 |
| 22–27 | Re-run weekly; drill Weak spots under `03` |
| <22 | Do `02-mitigation-playbook.md` drills before speaking about this project anywhere |
