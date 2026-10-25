# AbridgeAI — Mitigation Playbook

Two parts: **A) universal recovery moves** (use in *any* interview), **B) drills that
patch this repo's actual weak spots** so "I can't answer that" stops happening.

---

## A. Universal recovery moves (memorize 5)

1. **Bridge to structure:** "I haven't hit that exact case, but here's how I'd reason
   about it…" → then reason *out loud* from first principles (latency, cost, state,
   failure). Interviewers grade reasoning order, not trivia recall.
2. **Anchor to what you built:** "In my pipeline I solved the same class of problem
   with X" — always have one mapping ready from `learnings.md` (e.g., LLM JSON
   fragility → normalization layer).
3. **Name a concrete artifact instead of a concept:** instead of "I'd add a DB",
   say "a `plans` table with user_id, stage statuses, created_at" — specificity
   reads as seniority.
4. **Admit, quantified:** "I do not know the exact flag, but I know which class of
   setting it is and how I'd find it in 60 seconds." Honest + fast, never bluff.
5. **Ask a clarifying question before answering scale/design Qs:** "How many
   requests per minute, per user or anonymous?" — buying time *and* showing
   product sense.

**If blanking completely (20 seconds in):** "Let me park that for one second and
come back with one thing I'm sure about…" → start with anything adjacent ([the
HTTP flow], [the stage order], [the fallback chain]) and the forgotten detail
usually surfaces mid-sentence. If it doesn't: "I'll look it up tonight and write
it into my notes — can I move to the part I'm strongest on?"

## B. Weak-spot drills (found by code review of this repo)

| # | Weak spot in the code | Mitigation drill (hands-on, do before you claim otherwise) |
|---|---|---|
| 1 | **Zero tests / zero CI** | One evening: `vitest` in root, 6 unit tests (FNV hash, deadline parsing, stack tokenizer, feasibility scoring) + one supertest on `/api/plan` and then a `.github/workflows/ci.yml` running lint+tests on push. Then this becomes a *talking point*, not a landmine. |
| 2 | **No request timeouts anywhere** (GitHub/Gemini/Groq fetches) | Add `AbortSignal.timeout(15000)` in `backend/src/services/github.js`, `gemini.js`, `groq.js`. One line each. Practice explaining why you chose 15s (budget math across a 60s function). |
| 3 | **No rate limiting → quota/cost burn** | Add `express-rate-limit` on `/api/plan` (e.g. 10/hour/IP). Be ready to explain window vs burst and why per-IP is weak alone (NAT, proxies) but proportional to effort. |
| 4 | **Gemini key in URL query param** | Switch to the `x-goog-api-key` header in `backend/src/services/gemini.js`. Rotate the key once. Now you can *tell the story*. |
| 5 | **`ctx.errors` visited silently, GitHub fallback is invisible "octocat"** | Plumb a `degraded: ["github"]` field into `/api/plan` response and render a banner in `src/`. Makes honesty a code reality. |
| 6 | **localStorage `JSON.parse` –style fragility on the record shapes** | Guard every `JSON.parse` of stored values with try/catch + version check (search `storage.js` for the one place it's safe and copy that pattern everywhere). |
| 7 | **Version skew** root vs `backend/package.json` (express `^4.22.3` vs `^4.21.2`) | Move to workspace hoisting or pin one; be able to say why one source of truth matters. |
| 8 | **Timeline is theatre (setTimeout), not streaming** | Ship SSE: `GET /api/plan/stream` emits one chunk per stage. This is the single most visible 2026 upgrade — half a weekend. |

### A 5-day "de-fragilize" sprint (fits before interview season)
- **D1:** Tests skeleton + first 3 unit tests.
- **D2:** `AbortSignal.timeout` everywhere + express-rate-limit.
- **D3:** Gemini header fix + key rotation + `.env.example` audit.
- **D4:** CI workflow + coverage badge; Depenabot on.
- **D5:** SSE streaming prototype; record a 30s demo GIF of it.

### Memorized data you should know cold
- 7 stages, in order: **github → research → feasibility → architecture → stack → builder → brief**
- Feasibility 5 axes & weights: **clarity 30, stack-fit 25, scope 20, time 15, builder-fit 10**; verdicts ≥70 GO / ≥50 caution / else rethink.
- LLM chain: **Gemini → Groq → deterministic** (FNV-1a seeded `pick`).
- Ports: **Vite 5173, Express 3001**, Vercel `maxDuration 60`.
