# AbridgeAI — Learnings & Interview Walkthrough

A step-by-step account of the entire project: what we built, in what order, why
each design decision was made, the bugs we hit and how we fixed them, and — for
each step — **the interview answer you can give**. Read it top to bottom once;
then use the [Interview cheat-sheet](#interview-cheat-sheet-quick-talking-points) at the end for last-minute revisions.

> Accuracy note: this document describes the **current** state of the code
> (deadline-aware plans, Groq fallback, custom-stack parsing, Vercel
> serverless). Older learnings (the early Gemini bugs) are kept because they are
> exactly the kinds of stories interviewers want to hear — but they are
> presented as history, not current behavior.

---

## Table of contents

1. [Step 0 — What the project actually is](#step-0--what-the-project-actually-is)
2. [Step 1 — The big picture: two programs talking over HTTP](#step-1--the-big-picture-two-programs-talking-over-http)
3. [Step 2 — How you start it (npm scripts decoded)](#step-2--how-you-start-it-npm-scripts-decoded)
4. [Step 3 — The click-to-result journey](#step-3--the-click-to-result-journey)
5. [Step 4 — The 7-stage pipeline and the stage registry](#step-4--the-7-stage-pipeline-and-the-stage-registry)
6. [Step 5 — Deterministic logic: hash + pick](#step-5--deterministic-logic-hash--pick)
7. [Step 6 — The GitHub stage (live API with graceful fallback)](#step-6--the-github-stage-live-api-with-graceful-fallback)
8. [Step 7 — Feasibility: scoring axes + deadline parsing](#step-7--feasibility-scoring-axes--deadline-parsing)
9. [Step 8 — The LLM upgrade (Gemini → Groq → deterministic)](#step-8--the-llm-upgrade-gemini--groq--deterministic)
10. [Step 9 — The prompt file: where the LLM gets its instructions](#step-9--the-prompt-file-where-the-llm-gets-its-instructions)
11. [Step 10 — Normalization: why AI output never breaks the UI](#step-10--normalization-why-ai-output-never-breaks-the-ui)
12. [Step 11 — Deadline-aware milestone planning](#step-11--deadline-aware-milestone-planning)
13. [Step 12 — Custom-stack parsing (C++, C#, multi-runtime)](#step-12--custom-stack-parsing-c-c-multi-runtime)
14. [Step 13 — The scaffold: deterministic by design](#step-13--the-scaffold-deterministic-by-design)
15. [Step 14 — The data contracts (page 1 of shapes)](#step-14--the-data-contracts-page-1-of-shapes)
16. [Step 15 — Frontend rendering (badges, cards, zip)](#step-15--frontend-rendering-badges-cards-zip)
17. [Step 16 — The three early bugs (interview gold)](#step-16--the-three-early-bugs-interview-gold)
18. [Step 17 — The two leaks we caught by testing](#step-17--the-two-leaks-we-caught-by-testing)
19. [Step 18 — How we tested everything](#step-18--how-we-tested-everything)
20. [Step 19 — Deployment to Vercel (serverless)](#step-19--deployment-to-vercel-serverless)
21. [Step 20 — Git workflow & the two-repo PR dance](#step-20--git-workflow--the-two-repo-pr-dance)
22. [Glossary of beginner concepts](#glossary-of-beginner-concepts)
23. [Gotchas we learned the hard way](#gotchas-we-learned-the-hard-way)
24. [Interview cheat-sheet (quick talking points)](#interview-cheat-sheet-quick-talking-points)

---

## Step 0 — What the project actually is

**The one-liner:** AbridgeAI turns a rough project idea ("I want an app that…")
into a structured, build-ready plan: a feasibility score, market research, an
architecture blueprint, a tech stack, a downloadable starter scaffold (.zip),
and a written implementation plan.

**The clever bit:** most of the pipeline is **deterministic** (same inputs →
byte-identical output, like a math function), and content-writing stages are
**upgraded with LLMs** (Gemini first, Groq as fallback) so the writing is
tailored to your specific idea instead of generic — but the app **always**
returns a complete plan, even with zero API keys.

**Interview answer (10 seconds):**
> "It's a project-planning studio. You type an idea, it runs a 7-stage
> pipeline — research, feasibility, architecture, stack, build plan, brief —
> and produces a scored plan and a starter code scaffold. The pipeline is
> deterministic so it always works, but LLM stages upgrade the prose when an
> API key is configured, with automatic fallback to the deterministic version."

---

## Step 1 — The big picture: two programs talking over HTTP

The project is split into two separate Node.js programs:

```
                    ┌────────────────────────────────────────────┐
   Browser          │  Frontend (React + Vite)   port 5173       │
   (you)            │  src/  — what you see and click            │
     │              └───────────────────┬────────────────────────┘
     │  HTTP request to /api/plan       │   (fetch from the browser)
     ▼                                  ▼
  http://localhost:5173        http://localhost:3001/api/plan
                                       ┌────────────────────────────┐
                                       │  Backend (Express) port 3001│
                                       │  backend/  — ALL the logic  │
                                       └────────────────────────────┘
```

- **Backend** (`backend/`): an Express server that owns all the "thinking".
  The user never talks to Gemini/Groq directly — the backend does, with the API
  keys that must **stay server-side** (never shipped to the browser).
- **Frontend** (`src/`): a React app that just draws the form and renders the
  backend's answers. It is intentionally *thin* — no planning logic lives here.
- **Why split?** (a) security — secrets stay on the server, (b) one backend API
  can power any frontend (web, CLI, mobile), (c) the heavy pipeline stays off
  the user's device.

In development, Vite runs on **5173** and *proxies* `/api/*` to **3001** (the
rule lives in `vite.config.js`). If the backend isn't running you see this in
the Vite terminal:

```
[vite] http proxy error: /api/meta  →  AggregateError [ECONNREFUSED]
```

`ECONNREFUSED` = nothing is listening on 3001. Fix: start the backend (two
terminals, see Step 2). This is the #1 "why isn't it working" moment for new
developers.

**Interview angle:** client/server separation, proxies in dev, ports, secrets.

---

## Step 2 — How you start it (npm scripts decoded)

```jsonc
"scripts": {
  "dev":      "vite",                                                     // frontend only, port 5173
  "server":   "node --env-file-if-exists=.env backend/server.js",         // backend only, port 3001
  "dev:api":  "node --watch --env-file-if-exists=.env backend/server.js", // backend, auto-restart on change
  "start":    "npm run build && node --env-file-if-exists=.env backend/server.js" // prod: build + serve all on one port
}
```

Decoded:

- `node` runs JavaScript on your machine (backend uses ESM — `import`, see
  Glossary).
- `--env-file-if-exists=.env` tells Node "load `.env` into `process.env` if the
  file exists; don't crash if it doesn't." That's how secrets arrive without a
  `dotenv` dependency.
- The `.env` path is relative to the **current working directory** — so `.env`
  must sit at the project root, and you must launch the backend from the root.
- `--watch` (in `dev:api`) restarts the backend whenever a file changes.
- `start` is the production path: build the React app into `dist/`, then serve
  the API *and* the static files on one port.

**Standard dev routine = TWO terminals:**

1. Terminal A: `npm run server` (or `npm run dev:api`)
2. Terminal B: `npm run dev`

Then open http://localhost:5173.

**Interview answer:** know that `--env-file-if-exists` is Node's built-in env
file flag (Node ≥ 20.6), how `.env` is resolved relative to the CWD, and why a
prod server serves both API and static files.

---

## Step 3 — The click-to-result journey

1. You type an idea and press Run (`ProjectForm.jsx`).
2. `App.jsx` calls `runPlan(input)` → `src/api/client.js` → `fetch('/api/plan', …)`.
3. Vite proxies it to `http://localhost:3001/api/plan`.
4. `backend/server.js` → `createApp()` (from `backend/app.js`) → `runPipeline(input)`.
5. `runPipeline` loops over the 7 stages. Each stage reads a shared **context**
   and writes its result into it.
6. The response `{ results, errors }` goes back to the browser.
7. `App.jsx` saves it as a history record (`localStorage`) and renders 7 cards.

The shared context (`pipeline/context.js`):

```js
{ input: <your form>, results: { github, research, feasibility, … }, errors: {} }
```

Each stage reads what earlier stages produced (research reads the GitHub
result; the brief reads *everything*). If a stage throws, its error lands in
`errors[key]` and the pipeline **keeps going** — the app never dies because one
provider was down. That resilience decision is a good interview point.

**Interview answer:** walk through the sequence; emphasize the context object as
a "typed blackboard" shared by stages, and the errors-never-crash contract.

---

## Step 4 — The 7-stage pipeline and the stage registry

Stages live in `backend/src/pipeline/stages.js` — the **single source of
truth**. The frontend even fetches this list at runtime (`GET /api/meta`) so the
UI timeline can never disagree with the backend. Adding, reordering, or
removing a stage = editing one file; the runner is a generic loop.

| # | Stage key    | Files                              | Produces                                        | AI?         |
|---|--------------|------------------------------------|-------------------------------------------------|-------------|
| 1 | github       | `services/github.js`, `githubAgent.js` | Builder signals from public GitHub data     | no          |
| 2 | research     | `agents/researchAgent.js`          | opportunities, risks, directions                | **LLM**     |
| 3 | feasibility  | `agents/feasibilityAgent.js`       | /100 score, verdict, risks, estimate            | no          |
| 4 | architecture | `agents/architectureAgent.js`      | shape, modules, flow, principles                | **LLM**     |
| 5 | stack        | `agents/techStackAgent.js`         | recommended stack + per-item reasons            | no          |
| 6 | builder      | `agents/builderAgent.js`           | milestone plan + scaffold files (.zip)          | **LLM**     |
| 7 | brief        | `agents/briefAgent.js`             | the written implementation plan                 | **LLM**     |

A stage is just an object `{ key, index, label, nextHint, run(ctx) }`. The
stage *metadata* (label, hint) is what powers the animated timeline.

**Design reason worth stating in interviews:** the pipeline is *data-driven*,
not a hardcoded sequence — a registry + a generic runner. That means UI labels,
exported docs, and stage order all come from one file (no drift), and adding a
stage is declarative.

---

## Step 5 — Deterministic logic: hash + pick

This is the concept that makes *most* of the app reproducible (and it's why,
before LLMs, every plan felt "hardcoded" — it was!)

**A hash** (`utils/hash.js`) turns any string into a fixed 32-bit number
(FNV-1a — a simple, reproducible algorithm, not cryptographic):

```js
hash("idea")        // same number every time, on any machine
hash("idea")        // always identical
hash("other")       // a different number
```

**A pick** (`pick(seed, pool, n)`) uses that number as a "starting coin flip"
to choose `n` items from a fixed list.

Together: `sameInput → sameSeed → samePicks`. Change nothing → identical
output. Change one input → a completely different (but still deterministic)
selection.

**Why this was a *feature*, not a bug:**

- The app works with **zero keys, zero network, zero cost**.
- Tests are easy: same input → assert identical output.
- Users get stable plans for the same idea.

**The downside (and the motivation for LLMs):** the pools are tiny and static —
12 opportunity sentences, 10 risks, 8 directions. `researchAgent.js` just
reordered a handful of canned sentences per project. Every idea looked the
same. Enter the LLM upgrade (Step 8).

**Interview answer:** explain seeded determinism, FNV-1a, and *why* "same input
→ same output" matters, plus the honest tradeoff: reproducible but generic ⇒
that's exactly what we upgraded with AI.

---

## Step 6 — The GitHub stage (live API with graceful fallback)

`services/github.js` calls the **unauthenticated** GitHub API:

```
GET https://api.github.com/users/{username}
GET https://api.github.com/users/{username}/repos?per_page=100&sort=updated
```

- Parses the profile, tallies repo languages, summarizes top repos.
- **No OAuth, no tokens** — public data only (60 req/hour/IP rate limit).
- On *any* failure (network, 404, rate-limit) it falls back to a bundled sample
  file — and if that file can't even be read (e.g. excluded from the deploy),
  it uses a **built-in sample object embedded in the source**, so the stage
  literally cannot crash.
- The card is labeled `live · github.com` vs `sample data` so the user (and
  the developer) always knows which data they're looking at.

**Interview point — defense in depth:** live data → static file → embedded
constant, three cascading fallbacks. And the "sample data" badge: *label the
honest source of every piece of data*.

---

## Step 7 — Feasibility: scoring axes + deadline parsing

`feasibilityAgent.js` computes a /100 score from five axes (all hardcoded
heuristics, no AI — good for tests):

| Axis           | Max | Logic                                                                                             |
|----------------|-----|---------------------------------------------------------------------------------------------------|
| Idea clarity   | 30  | `0.5 × word count` + 3 if an audience is named                                                    |
| Stack fit      | 25  | advanced=25, intermediate=20, beginner=15                                                         |
| Scope          | 20  | tool=20, data-pipeline=18, service=15, web-app=14, unsure=10                                      |
| Time realism   | 15  | from `deadlineScore(parseDeadline(deadline))` — see table below                                   |
| Builder fit    | 10  | 10 if a stack was chosen (or custom stack), else 6                                               |

Score bands pick the verdict: **GO (≥70)**, **Proceed with caution (≥50)**,
**Rethink / reshape (<50)** — each with a canned recommendation and severity
class (`good`/`warn`/`bad`) for the UI.

**Deadline parsing is the interesting part** (`domain/deadline.js`):

- `parseDeadline("5 days")` → `{ days: 5, label: "5 days", kind: "days" }`
- `parseDeadline("4 weeks")` → `{ days: 28, kind: "weeks" }`
- `parseDeadline("3 months")` → `{ days: 90, kind: "months" }`
- `parseDeadline("")` → `{ days: null, kind: "empty" }`
- Anything unparseable → `kind: "vague"` (explicitly *not* silently assigned a
  number — honesty over guessing).

`deadlineScore` turns that into the Time Realism sub-score:
≤7d→6, 8–14d→9, 15–31d→12, 32–90d→14, >90d→13, empty→8, vague→10.

Then the effort estimate changes shape based on the deadline — this is where
the deadline-awareness lives:

```js
tight = days != null && days <= 14
→ "fits your 5-day deadline as a tight MVP (full version ~6-10 weeks)"
→ otherwise "Large — ~6-10 weeks (Solo)"
```

And a sprint warning is appended when `days <= 7`:
> "This reads as a sprint, not a buildout — cut scope to one vertical slice that ships inside the window."

Risks are hash-picked (deterministic) from a 10-row risk register, each with a
concrete mitigation.

**Interview answer:** explain the axis weights as a *transparent, testable*
heuristic, the parser returning a structured `{ days, label, kind }` instead of
a number (so "vague" is distinguishable from "no answer"), and how the same
parsed value feeds both scoring and milestone sizing (Step 11).

---

## Step 8 — The LLM upgrade (Gemini → Groq → deterministic)

This was the centerpiece change. The whole idea in one sentence:

> When a key is configured, the *content-writing* stages (research,
> architecture, builder, brief) ask an LLM for idea-specific text; when there's
> no key, or the provider fails, the code silently falls back to the
> deterministic agents. The app always returns a complete plan.

### The orchestrator: `services/llm.js`

All four AI stages call one runner, `runLLMStage(seedKey, prompt)`:

```js
1. seed = hash(seedKey)
2. if cache has seed  → return cached result, mode 'cached-llm'
3. try Gemini         → if ok: cache + return, mode 'llm'
4. else try Groq      → if ok: cache + return, mode 'groq'
5. else               → return { ok:false }, caller uses deterministic, mode stays 'deterministic'
```

`MODE` constants: `{ LLM:'llm', GROQ:'groq', CACHED:'cached-llm', DETERMINISTIC:'deterministic' }`.

**Why a chain of providers?** Gemini's free tier is ~20 requests/day. When it
exhausts (HTTP 429), the app would degrade to canned text unless a second
provider exists. Groq is OpenAI-compatible, fast, cheap — perfect as a
redundant tier. Order matters: Gemini is primary (better prose), Groq is the
resilience tier.

### Provider 1: `services/gemini.js`

- Key + model read once at startup from `process.env`.
- Default model `gemini-3.6-flash`, overridable with `GEMINI_MODEL`.
- POST to `generativelanguage.googleapis.com/v1beta/models/<MODEL>:generateContent?...`.
- The **key travels in the URL** as `?key=...` (Google's REST API requirement).
  *This was the fix for the biggest early bug — see Step 16.*
- `generationConfig.responseMimeType: 'application/json'` forces structured
  JSON output; we then strip markdown fences and `JSON.parse`.
- Any HTTP error → `{ ok:false, error:'gemini HTTP <status>' }` — **fast fail**,
  no backoff sleeps, so the fallback chain isn't slowed down.

### Provider 2: `services/groq.js`

- OpenAI-compatible chat completions: `POST https://api.groq.com/openai/v1/chat/completions`
  with `Authorization: Bearer <GROQ_API_KEY>`, default model
  `openai/gpt-oss-120b` (set `GROQ_MODEL` to override).
- Uses `messages: [{ role:'user', content: prompt }]` (OpenAI style) and asks
  for `response_format: { type: 'json_object' }`.
- **A real-world tolerance lesson:** some Groq models *reject*
  `response_format` with HTTP 400. So `runGroqStage` wraps the call in an
  `attempt(withJsonMode)` helper and **retries once without json mode**, then
  extracts JSON from plain text. One bad assumption about a third-party API →
  hard-won degradation logic.

### Caching

```js
const cache = new Map();            // in-process only
const seed = hash(String(seedKey)); // e.g. "research:hash cracker|tool|custom|5 days|..."
if (cache.has(seed)) return { ok:true, data: cache.get(seed), mode: 'cached-llm' };
```

- Same idea re-run in the same process → served from memory, **never re-billed**.
- Change any input → new hash → fresh provider call.
- Cache dies on process restart (`clearLLMCache()` exists for tests).
- Why cache: money, speed, and stability (README promises identical inputs →
  identical output; cache enforces it within a session).

**Interview answer:** explain the fallback ladder as a *degradation chain*, the
money/speed/stability case for a cache, both provider SDK differences
(Gemini URL-key vs Groq Bearer), and why fast-fail matters for the chain.

---

## Step 9 — The prompt file: where the LLM gets its instructions

Everything the model reads lives in **`backend/src/prompts/prompts.js`**.
It exports four prompt *builders*:

```js
buildResearchPrompt(input, gh)      // situation, market risks, direction
buildArchitecturePrompt(input, ctx) // modules, data-flow, principles
buildBuilderPrompt(input, ctx)      // overview + 4 milestones (deadline-sized)
buildBriefPrompt(ctx)               // story, next steps, MVP scope
```

Each prompt does three deliberate things:

1. **Gives the model real context** — it interpolates the idea, type, audience,
   deadline, comfort, chosen stack, and *results from earlier stages*
   (architecture prompt reads the research direction; brief prompt reads all
   four earlier stages).
2. **Shows the exact JSON shape** via `jsonShape(name, example)` — a JSON
   skeleton printed into the prompt so the model knows the keys, counts, and
   types we expect back. "Return ONLY strict JSON matching this shape."
3. **Sets hard rules.** Examples worth quoting in interviews:
   - "Exactly 3 opportunities, 3 risks, 2 directions, 1 builderSignal."
   - "Every item MUST reference THIS idea... one sentence, max 24 words."
   - "Forbidden filler phrases: 'build a vertical slice', 'scope carefully'…"
   - "**STACK IS A HARD CONSTRAINT**: every recommendation MUST assume the
     chosen stack and its languages. Never suggest switching language families
     (no Node.js/commander.js steps for a Python/C++ idea)."
   - The builder prompt gets a **unit hint** computed from the deadline:
     ≤14 days → "size the milestones as DAY ranges… never weeks"; otherwise →
     "size the milestones to fit it."
   - The brief prompt is told "Never mention 'this plan was generated
     deterministically'."

`jsonShape` is essentially a hand-rolled *function-calling schema / guardrail*
before the model returns content. This is what kills generic output.

**Interview answer:** "I gave the model (1) context, (2) a strict output schema
inlined as JSON, and (3) explicit behavioral rules — including forbidding
placeholder phrases and hard-constraining the stack." This is a strong,
concrete "prompt engineering in production" story.

---

## Step 10 — Normalization: why AI output never breaks the UI

LLMs are unreliable. Every AI-capable agent therefore follows the same pattern:

```
try LLM → get JSON
  ├─ if ok      → clean/normalize the LLM data (clamp arrays, trim text, validate)
  └─ if failed  → run the deterministic version (hash-picked pools / templates)
always return the SAME structured shape + a mode label
```

Concrete normalization examples, each worth an interview mention:

- **research (`researchAgent.js`)**: `clamp(arr, 3, fallback)` — if the model
  returns 1 opportunity instead of 3, pads back up to 3 with a fallback line and
  cuts to at most 3. The shape never breaks.
- **architecture**: at most 4 modules, 3 principles; garbage arrays → null →
  deterministic pools.
- **builder (`builderAgent.js`)**: `normalizeMilestones` is *lenient* — it keeps
  every valid milestone the model returned and pads from the fallback template
  (`while (cleaned.length < fallback.length)`), instead of throwing everything
  away because one milestone was malformed. **Tradeoff worth explaining:**
  strict discard = always correct but often generic; lenient keep-valid =
  usually specific, occasionally mixed. We chose lenient.
  - If the LLM milestones were unusable, `overview` is discarded too (so text
    and plan can't contradict each other — coherence rule).
- **brief (`brief/model.js`)**: LLM text is optional; `clampList` falls back to
  fixed `NEXT_STEPS` / `MVP_GUIDANCE` lists.

**Critical design decision:** the **scaffold** (the .zip) is deliberately *not*
AI-generated — `scaffold/scaffold.js` builds real, valid project files. The LLM
writes narrative around deterministic artifacts, never the artifacts
themselves.

**Interview answer:** "Every AI integration has a normalize step because models
lie. I clamp to expected counts, validate types before use, keep-valid-and-pad
for milestones, and always return a shape the UI can render — with a mode
label so you can tell AI output from fallback."

---

## Step 11 — Deadline-aware milestone planning

**The problem (found by testing):** a 5-day cybersecurity tool brief still
showed a "3–5 weeks" effort and "Week 1…Week 4" milestones. The deterministic
and LLM codepaths both assumed weeks — a deadline-agnostic bug.

**The fix, in layers:**

1. `milestoneSlots(days, n)` in `deadline.js` — spreads `n` milestones across a
   window and returns display labels:
   - `milestoneSlots(null, 4)` → `Week 1..4`
   - `milestoneSlots(30, 4)` → `Week 1..4` (deadline > 14)
   - `milestoneSlots(5, 4)` → `Day 1, Day 3, Day 4, Day 5`
   - `milestoneSlots(1, 4)` → `Day 1 × 4` (a one-day window is four same-day
     slices — the sprint note tells you to cut scope instead)
2. `builderAgent` parses the deadline first, sets `ctx.deadlineDays` (the
   prompt builder reads it to emit the "size milestones as DAY ranges" hint),
   runs the LLM, and **applies slot labels to milestones after the fact**:
   ```js
   milestones = milestones.map((m, i) => ({ ...m, slot: milestoneSlots(days, milestones.length)[i] }));
   ```
   So the *labels* are always deadline-correct even if the model spoke in weeks.
3. `feasibilityAgent` recomputes the estimate line ("fits your 5-day deadline
   as a tight MVP") and appends the sprint warning at ≤7 days.
4. The rendered builder text and the scaffold README/PLAN use `m.slot || 'Week ' + m.week`
   everywhere, so the fix reaches every surface.

**Interview answer:** trace a 5-day deadline through parse → prompt hint →
LLM → post-labelling → render. The lesson: *enforce invariants at the final
rendering layer, not just in prompts* — prompts are advice, code is law.

---

## Step 12 — Custom-stack parsing (C++, C#, multi-runtime)

**The problem:** the form lets users type a free-form combination like
`cpp + python` or `FastAPI + React + PostgreSQL + Docker`. Early on we just
displayed the blob; plans ignored it, and the scaffold assumed TypeScript.

**The fix — `domain/techs.js`:**

- A `TECH_MAP` (≈ 100 entries) mapping tokens → `{ label, category }`, where
  category is one of `runtime | ui | api | data | test | infra`.
- `parseCustomStack(str)` tokenizes on `\s , + / | ;` and returns
  `{ components, unknown }` — structured per-component info instead of one blob.
- **A real escaping bug:** `C++` and `C#` contain the characters we *split on*
  (`+` and `#`). So we normalize first:
  ```js
  text.replace(/c\+\+/gi, ' cpp ').replace(/c#/gi, ' csharp ')
  ```
  That's a classic "your delimiter appeared in user data" story.
- `starterLanguageFor(input)` maps a custom stack to the best bundled starter:
  python/runtime tokens → python starter; Go/Gin/Echo → go; Rust/Axum/Actix →
  rust; anything else → TypeScript.

The **stack agent** (`techStackAgent.js`) then groups parsed components by
category and prints a tidy breakdown (Runtime / UI / API / Data / …), lists
unrecognized tokens honestly ("Not yet recognized"), and generates a starter
note:

> "The starter scaffold matches your stack (Python base)."
> or
> "No bundled starter for C++ — the scaffold uses the TypeScript default; adapt the files to match."

**Interview answer:** "I built a small named-entity-recognizer for tech tokens.
The two interesting details: escaping delimiters that appear in user input
(`c++`, `c#`), and returning `unknown[]` so we *show* what we didn't understand
instead of pretending." Handling unknown input explicitly is a strong signal.

---

## Step 13 — The scaffold: deterministic by design

`scaffold/scaffold.js` generates the actual starter project:

- **Per-language real file sets** with real configs:
  - TypeScript → `package.json`, `tsconfig.json` (strict), `index.ts`, `core.ts`,
    `core.test.ts`, `test/fixtures/sample-input.txt`
  - Python → `pyproject.toml` (typer, pytest, ruff), `src/main.py`, `src/core.py`,
    `tests/test_core.py`
  - Go → `go.mod` + stdlib only; Rust → `Cargo.toml`, `main.rs`, `core.rs`.
- Every starter has **idiomatic tooling docs** in `STACK_DOCS` — real install
  and run commands (`uv sync`, `cargo build`, `go mod tidy`) so a downloaded zip
  is actually runnable (this fixed a review complaint that scaffolds lacked
  real dependencies in the README).
- **Custom-stack awareness:** for a custom stack the scaffold README includes
  a stack table broken down by category, an honest note ("Components planned
  but not yet scaffolded — C++ + Python — need their own toolchain below"), and
  a **native toolchain block** (`NATIVE_TOOLCHAINS`):
  - C/C++ → `C++17 compiler + CMake >= 3.16`
  - C# / .NET → `.NET SDK 8+ (LTS)`
  - Rust → `Rust toolchain (rustup)`
  plus the guidance that the seeded slice runs *without* the native toolchain
  (call the native piece as a subprocess later).
- Milestones in README/PLAN use `m.slot` (deadline-sized labels) — same
  invariant as Step 11.
- Architecture shape is rendered into an ASCII flow diagram.

**Interview answer:** "The scaffold is the one thing we *don't* let AI touch —
LLMs hallucinate file systems. We generate real, runnable files deterministically
and let the LLM write narrative around them. And the scaffold adapts to the
parsed stack: right files, right toolchain notice."

---

## Step 14 — The data contracts (page 1 of shapes)

Stages feed each other and the frontend, so shapes are stable and documented
(the frontend reads these same fields):

- **github**   → `{ text, badge, source:'live'|'sample', profile, languages[], repos[] }`
- **research** → `{ opportunities[], risks[], directions[], builderSignal, text, mode }`
- **feasibility** → `{ score, verdict, verdictClass, estimate, axes[{label,value,max}], text }`
- **architecture** → `{ shape, modules[], flow, principles[], text, mode }`
- **stack**    → `{ label, custom, components[], starterNote, pace, text }`
  (bundled stacks additionally carry `app, ui, api, data, test, lint, why`)
- **builder**  → `{ text, folder, files[{path,?content}], overview, milestones[{week,slot,title,tasks,accept}], mode }`
- **brief**    → `{ header, context[], nextSteps[], mvpGuidance[], footer, story?, deadline, stackLabel, … text, mode }`

`brief/model.js` reads earlier stages **structurally** (`arch.shape`,
`research.directions[0]`) — it never scrapes rendered text, so the two can't
drift apart. `render.js` renders that one model to both screen text and the
Markdown export (`export/markdown.js`).

**Interview answer:** "I treat the JSON contracts like API schemas between
stages. Consumers read fields, never rendered text, which kills whole classes
of formatting bugs."

---

## Step 15 — Frontend rendering (badges, cards, zip)

- `App.jsx` maps backend results to cards; `OutputCard.jsx` renders title +
  `pre` text + optional badge + Copy button.
- **Mode badges are the debugger's best friend:**

  ```js
  'llm'            → 'Gemini · live'
  'groq'           → 'Groq · live'
  'cached-llm'     → 'LLM · cached'
  'deterministic'  → 'fallback'
  ```
  Seeing which card used which provider tells you instantly whether a key is
  working — we shipped this as a feature (honesty) and used it as diagnostics.
- `BuilderCard.jsx` adds "Download scaffold (.zip)" — `utils/zip.js` builds the
  ZIP in-browser with **fflate** (no server round-trip, no extra dependency
  weight).
- `BriefCard.jsx` renders the plan in a read-only textarea.
- History (`abridgeai.history.v1`), draft autosave (`abridgeai.draft.v1`), and
  theme (`abridgeai.theme.v1`) all live in `localStorage`.
- Export: `App.jsx` posts the saved record to `/api/export`, the backend
  re-renders it as Markdown for download.

**Gotcha (interview-worthy):** during development you edit the React *source*,
but `npm run start` serves the prebuilt `dist/` — stale until you `npm run
build`. Dev = `npm run dev`.

---

## Step 16 — The three early bugs (interview gold)

These are the most quotable stories. They're all "classic" failure modes.

### Bug 1 — The `.env` file was never loaded (or in the wrong place)

The old code read `process.env.GEMINI_API_KEY`, but nothing ever put the file
into `process.env`:

- The backend's own scripts (`cd backend && npm run dev`) load **no** `.env`.
- The root scripts load `.env` relative to the **working directory** — so a
  key in `backend/.env` was silently ignored.

**Lesson:** Node doesn't read `.env` automatically. Use
`--env-file-if-exists=.env` (or `dotenv`), and remember the path is relative to
where you run the command, not where the file is.

### Bug 2 — The API key was never sent to Google

Even with the key loaded, the request had **no key** — no `?key=` and no auth
header. Google returned 400, the code logged and returned null, and the stage
fell back to canned text. *This is why "I added the key but still get
hardcoded responses."*

**Lesson:** verify the request you think you're sending actually carries
authentication. Log status codes; don't assume.

### Bug 3 — The default model no longer existed (model rot)

`.env.example` pinned a model that was **deprecated** — in 2026 the model list
no longer contains it. The API returned 404 naming the exact problem. The
`console.error('[gemini] … API 404: …')` log line is what exposed it.

**Lesson:** LLM model names rot. Always list available models
(`GET /v1beta/models?key=…`) and trust the API's own error text. Also: your
personal `.env` overrides code defaults — stale `.env` = stale behavior.

**Fix for all three:** move `.env` to root, send the key in the URL/header
properly, and set a valid default model (`gemini-3.6-flash`) while letting
`GEMINI_MODEL` override.

**Interview framing:** "The app appeared broken at every layer — config (env),
auth (key not sent), and platform (deprecated model). Each was a one-line fix,
but each was invisible because the fallback quietly returned canned text. That's
why we added mode badges and status-code logging."

---

## Step 17 — The two leaks we caught by testing

Two review-found problems that show how we test with real inputs:

### Leak 1 — "Node.js" leaking into a `cpp + python` plan

A cybersecurity tool with stack `cpp + python` produced a plan/README talking
about node.js, commander.js, a "Node native addon", and the "Node event loop."
The LLM hallucinated a Node stack because the scaffold defaulted to TypeScript.

**Fix (3 layers):**
1. **Prompts** — "STACK IS A HARD CONSTRAINT: never suggest switching language
   families (no Node.js… for a Python/C++ idea)." Every prompt builder carries
   it.
2. **Parsing** — `techs.js` gives the pipeline a structured, per-language view
   of the stack (Step 12); the builder prompt receives the actual parsed stack.
3. **Scaffold** — `NATIVE_TOOLCHAINS` emits the real C++/CMake toolchain and an
   honest "not yet scaffolded" note instead of pretending it's a Node project.

**Verification:** after the fix, grep the generated plan + README for
`node|js|commander|event loop` → 0 matches for a `cpp + python` input.

### Leak 2 — Week-based milestones for a 5-day deadline

Covered in Step 11: `deadlineSlots`, prompt unit-hints, and post-hoc slot
labelling.

**Interview framing:** "I found both by generating a brief with a real edge-case
input and reading the output for cross-domain leakage. Then I fixed at prompt
level, parsing level, and render level — and re-ran the probe to prove 0
leaks."

---

## Step 18 — How we tested everything

Everything below ran without writing source changes — black-box with probes.

1. **Lint + build** — `npm run lint` (oxlint) and `npm run build` (vite). Fast
   gates before any run.
2. **Health** — `GET /api/health` → `{ ok: true }`.
3. **Meta** — `GET /api/meta` returns 7 stages, 5 stacks, 5 types, 3 teams
   (proves the registry + UI contract is alive).
4. **End-to-end plan** — `POST /api/plan` with a real idea, then inspect
   `results.<stage>`:
   - `errors: {}` → no stage crashed.
   - `mode` per LLM stage → `groq`/`llm`/`cached-llm`/`deterministic` tells you
     exactly which path ran (this is how we confirmed **live Groq** worked —
     all four stages came back `groq`).
   - milestone slots read as `Day 1 / Day 3 / Day 4 / Day 5` for a 5-day
     deadline.
   - scaffold filename list contains the right per-language files.
5. **Standalone probes** (kept under a temp dir): `deadline_probe.mjs`,
   `scaffold_probe.mjs`, `customstack_probe.mjs`, `groq_probe.mjs` — run the
   pipeline functions in isolation with crafted inputs and print structured
   checks.
6. **Cache check** — POST the identical idea twice; second run must be
   `cached-llm`.
7. **Export** — POST `/api/export` with a saved record → returns valid Markdown.
8. **The no-key/degraded path** — run with `GEMINI_API_KEY`/`GROQ_API_KEY`
   unset and assert every stage works with `mode: 'deterministic'` and
   `errors: {}`. The app must never require a key.

**Log lines are debugging superpowers:** `[gemini] …` and `[groq] …` tell you
the *real* failure reason (401 vs 404 vs 429 vs unparseable JSON) instead of
guessing why output looks canned.

---

## Step 19 — Deployment to Vercel (serverless)

To host API + frontend on one Vercel deploy we restructured the backend into an
exportable Express "app factory":

- **`backend/app.js`** exports `createApp()` — builds the Express app (API +
  static) but doesn't `listen()`. It's the shared brain for both running modes.
- **`backend/server.js`** is now a thin entry: `createApp().listen(PORT)` for
  local/dev.
- **`api/index.js`** — `export default createApp();` — a Vercel serverless
  function. Same app, no listen.
- **`vercel.json`**:
  ```json
  { "functions": { "api/index.js": { "maxDuration": 60, "memory": 1024 } },
    "rewrites": [
      { "source": "/api/(.*)", "destination": "/api" },
      { "source": "/(.*)",     "destination": "/index.html" }
    ] }
  ```
  API calls → the function; everything else → the SPA fallback. `maxDuration:
  60` gives the 4 LLM calls room — and we made sure Gemini **fails fast** (no
  backoff sleep) so a quota-exhausted 429 still reaches Groq well within the
  limit.
- **Root `package.json` needs `"type": "module"`** (it has it) and Express in
  dependencies (moved from `backend/package.json` to the root) so the
  serverless function resolves it.
- **Env vars** are set in Vercel dashboard (never committed): `GEMINI_API_KEY`,
  `GEMINI_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`. Without any key the deploy still
  works — fully deterministic (`fallback` badges).
- **Secret hygiene:** `.env` is in `.gitignore`; `.vercelignore` excludes
  `.env`, `node_modules`, `dist`, logs, and the sample data file. And because
  `data/sample-github-analysis.json` may be excluded from the deploy, `github.js`
  has the embedded fallback — deployment-safe by construction.

**Interview answer:** "I extracted an Express app factory so the exact same app
runs as a long-lived server locally and as a Vercel function — no duplicated
routes. I also set the function budget to 60s for the LLM chain and made
providers fail fast so fallback always fits."

---

## Step 20 — Git workflow & the two-repo PR dance

This project is split across **two GitHub repos** (co-creators):
`origin` → Suzanne's repo, `upstream` → Ruchira's repo. Every feature ships as
a PR to **both** repos, with the same squash-merged history.

Workflow per feature:

1. Branch from `main`: `git checkout -b feat/<name>`.
2. Commit focused changes; keep the branch tree identical to the last main
   state so it rebases trivially.
3. Push: `git push -u origin feat/<name>`.
4. Raise a PR **in the origin repo** (`gh pr create --repo suzannet-menon/AbridgeAI …`)
   and **merge it** (the owner's main).
5. Raise the **same branch** as a PR in the co-creator's repo
   (`--repo ruchirajags/Abridge_AI --head suzannet-menon:feat/<name>`) and leave
   it for review.
6. Sync local: `git fetch origin && git branch -f main origin/main`.

Squash-merging keeps each PR as **one clean commit** on main — history stays
linear and readable. Evidence in the log:

```
3d98ba4 feat: Groq fallback, deadline-sized milestones, stack-aware plans, Vercel serverless (#3)
1060949 feat: Gemini-powered planning stages with idea-aware fallbacks (#2)
0653931 feat: data-driven pipeline (stage registry, structured IO, Gemini research, canonical brief) (#1)
26a1bc4 refactor: improve agent pipeline and project data handling
```

**The wrinkle that made us understand GitHub better:** PR #2 came back
*"not mergeable: the merge commit cannot be cleanly created"* — even though the
tree would merge fine. Cause: a rename (deleted + re-added files) confused
GitHub's merge heuristics. Fix: **rebase the PR branch onto the new main**
(so head contains main exactly + one diff), force-push, and squash-merge again —
crafts and conflict-free.

**Interview name-drops to use:** squash-merge, rebase-before-PR,
fork/cross-repo PRs (`owner:branch` head syntax), force-push etiquette (never
on shared branches without care), `gh pr` CLI.

---

## Glossary of beginner concepts

- **Node.js** — runs JavaScript outside the browser. The backend is Node.
- **Express** — a tiny Node library for HTTP endpoints (`GET /api/health`).
- **Port** — a numbered door on your machine. 5173 = dev frontend, 3001 =
  backend.
- **HTTP / fetch** — how one program asks another. Request (`POST /api/plan`)
  → response (JSON).
- **JSON** — structured text `{ "idea": "…" }`; the whole app talks JSON.
- **process.env** — a dictionary of environment variables available to the
  process. Secrets read from here.
- **.env file** — `KEY=value` text; Node only loads it if told to
  (`--env-file-if-exists=.env`) or via `dotenv`.
- **ES modules (import/export)** — modern JS file-sharing: `export function x()`
  / `import { x } from './file.js'`.
- **Map (cache)** — an in-memory `key → value` store used to avoid re-billing
  / recomputation.
- **Hash** — `string → number`, same string → same number (seeding + cache
  keys).
- **Seeded pick** — hash as a seed to pick items deterministically from a list.
- **Probe** — a small standalone script that runs a function and prints and/or
  asserts on the result (black-box testing).
- **LLM / prompt** — a large language model; a prompt is its instruction text.
- **OpenAI-compatible** — an API that mirrors OpenAI's `/chat/completions`
  shape (`messages`, Bearer auth), which Groq exposes.
- **Serverless function** — code that runs on-demand in the cloud per request
  (Vercel's `api/` functions) instead of a long-lived server.
- **SPA fallback / rewrites** — server rules that send any non-API route to
  `index.html` so React's client routing works on refresh.
- **Squash merge** — collapsing a PR's many commits into one before merging.
- **Rename detection** — git/GitHub's heuristic for matching deleted + new
  files as a "move"; it can be confused and cause merge blockers.

---

## Gotchas we learned the hard way

1. **`.env` is resolved from the folder you run the command from**, not the
   file you execute. Always launch the backend from the project root.
2. **LLM model names rot.** Trust the API's own 404 message and re-list
   available models. A stale `GEMINI_MODEL` in your personal `.env` silently
   overrides a fixed default.
3. **Never print raw API keys** — log only length/prefix, keep secrets out of
   issue tracker, logs, and PR bodies.
4. **AI output is unpredictable** — clamp, validate, and pad before use so the
   UI shape can never break.
5. **Prompt constraints are advice; rendering code is law.** Enforce deadline
   labels and stack integrity at the final render/normalize step too.
6. **The `dist/` folder is only as fresh as your last build.** Dev with
   `npm run dev`; if the UI looks stale after source edits, rebuild.
7. **Determinism by design** is why plans felt "hardcoded" — it's the fallback,
   not a bug. The cure is better prompts + a resilient provider chain, not
   removing the fallback.
8. **Stages never kill the pipeline** — errors go to `errors[]` and the run
   completes. That resilience is also why failures can be *silent*; the
   `[gemini]`/`[groq]` log lines carry the "why".
9. **Thor's hammer of client/server doc tests:** a review found the README's
   tree claiming an old prompt file path and missing the new `llm.js`/`groq.js`/
   `techs.js`/`app.js`/`api/`. Docs drift as code changes — keep the
   architecture tree next to the code it describes and re-verify after each
   milestone.
10. **Vite proxy errors (`ECONNREFUSED on /api/*`) almost always mean the
    backend isn't running** — two terminals: `npm run server` + `npm run dev`.

---

## Interview cheat-sheet (quick talking points)

**Tell me about your project.**
> "A 7-stage planning pipeline: research → feasibility → architecture → stack →
> builder → brief → scaffold. Deterministic by default, LLM-upgraded when keys
> are set, with a Gemini → Groq → deterministic fallback chain so it never
> fails."

**Why did you segment the LLM work the way you did?**
> "An orchestrator (`llm.js`) owns provider fallback and an in-memory
> per-input-hash cache; two thin provider clients (`gemini.js`, `groq.js`)
> fast-fail and return `{ ok, error }`; agents normalize, then pad; prompts
> carry the schema. Every layer has one job."

**How did you handle unreliable LLM output?**
> "Three things: strict JSON schema in the prompt, lenient normalization in the
> agent (keep valid items, pad from fallback templates), and `mode` labels so
> AI vs fallback is visible. The scaffold files are never AI-generated."

**How do you make same input → same output?**
> "FNV-1a hash of the input picks from fixed pools (deterministic agents), and
> the LLM cache keys on the same hash, so repeat runs don't re-bill."

**What's the most interesting bug you fixed?**
> Pick one: (a) key parsed but never sent → auth 400s, (b) deprecated default
> model → 404s, both invisible because fallback masked them — "we added status
> logging and mode badges to make failure visible"; or (c) rename-detection
> making GitHub's squash-merge impossible → "rebased the PR onto main".

**How would you make it production-ready beyond this?**
> "Persist the cache (Redis/DB) across instances; add auth/rate-limiting on the
> API; move pipeline jobs to a queue with job status for long builds; track
> provider token usage/cost; add `fetch` timeouts with `AbortController`;
> validate schema with zod; add unit tests per agent with fixed inputs."

**What's the tech stack?** React 19 + Vite, Node + Express, ESM, fflate (client
ZIP), oxlint, hosted on Vercel serverless. Providers: Google Gemini
(generativelanguage REST) and Groq (OpenAI-compatible).

---

*Last stitch: if you say nothing else in an interview, remember the core
narrative — a deterministic pipeline that LLMs upgrade, a fallback chain that
keeps it alive, normalization that keeps AI output safe, and honest `mode`
labels that make debugging visible.*