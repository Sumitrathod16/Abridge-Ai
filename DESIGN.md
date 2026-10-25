# AbridgeAI — Design

> Living design document for AbridgeAI's architecture.
> Covers the current implementation (frontend/backend split) and the remaining
> refactors planned on top of it. Behavior stays identical at every migration step,
> unless a step explicitly changes product behavior.

---

## 1. What AbridgeAI is

AbridgeAI turns a rough project idea into a structured, build-ready plan:

- **Feasibility assessment** — the idea scored `/100` across five weighted axes.
- **Architecture direction** — module breakdown and data-flow blueprint.
- **Tech stack recommendation** — matched to comfort level and project type.
- **Starter scaffold** — downloadable `.zip` with file tree, starter files, and milestones.
- **Implementation plan** — a complete brief with next steps and MVP guidance.

All stage logic runs in the **backend** (Node.js + Express). The **frontend**
(React + Vite) is a thin client that submits the project inputs and renders the
structured results the backend returns.

Still **no LLM and no third-party AI calls** — the pipeline is a deterministic
scheduler with seeded selection from fixed content pools.

---

## 2. Current architecture (implemented)

```
AbridgeAI/
├── backend/                      # ALL pipeline logic lives here
│   ├── server.js                 # Express: /api/* + statically serves built frontend
│   ├── package.json              # express (the only new runtime dependency)
│   └── src/
│       ├── pipeline/
│       │   └── runPipeline.js    # 7-stage orchestrator (single pipeline entry point)
│       ├── agents/               # pure stage logic, one exported fn each
│       │   ├── githubAgent.js
│       │   ├── researchAgent.js
│       │   ├── feasibilityAgent.js
│       │   ├── architectureAgent.js
│       │   ├── techStackAgent.js
│       │   ├── builderAgent.js
│       │   └── briefAgent.js
│       ├── domain/               # shared data constants + parsers
│       │   ├── stacks.js         # STACKS + resolveStackLabel()
│       │   ├── types.js          # PROJECT_TYPES, TEAM_SIZES
│       │   └── deadline.js       # parseDeadline(str) + deadlineScore()
│       ├── scaffold/             # starter generators + tree/file-purpose metadata
│       ├── services/
│       │   └── github.js         # GitHub fetch + bundled sample fallback
│       ├── utils/
│       │   └── hash.js           # FNV-1a hash + seeded pick (only randomness source)
│       └── export/
│           └── markdown.js       # record → { filename, markdown } brief export
│
├── src/                          # Frontend (React + Vite) — thin client
│   ├── api/client.js             # runPlan(input), exportBrief(record)
│   ├── components/               # UI: Header, Sidebar, Landing, Pipeline, ProjectForm,
│   │                             #     OutputCard, FeasibilityCard, BuilderCard, BriefCard, Toast
│   ├── utils/
│   │   ├── storage.js            # localStorage: versioned history, draft, theme
│   │   ├── export.js             # downloadFile helper
│   │   └── zip.js                # fflate ZIP for scaffold download (browser only)
│   ├── App.jsx                   # state + calls backend + view routing
│   ├── main.jsx
│   └── index.css
│
├── public/data/                  # sample-github-analysis.json (read by the backend)
├── vite.config.js                # dev proxy: /api → http://localhost:3001
├── package.json                  # root workspace deps + scripts
└── DESIGN.md / README.md
```

### 2.1 API contract

| Method | Path          | Purpose                                        |
|--------|---------------|------------------------------------------------|
| GET    | `/api/health` | Liveness probe                                |
| POST   | `/api/plan`   | `{ ...input }` → `{ ok, results }`            |
| POST   | `/api/export` | `{ record }` → `{ ok, filename, markdown }`   |

`results` is a per-stage map:

```js
{
  github:      { text, badge },                     // 'live · github.com' | 'sample data'
  research:    string,                              // rendered text
  feasibility: { score, verdict, verdictClass, estimate, axes, text },
  architecture: string,                             // rendered text
  stack:       string,                              // rendered text
  builder:     { text, folder, files },             // files → frontend zips for download
  brief:       { text, nextSteps, mvpGuidance, ... }
}
```

### 2.2 How a run flows

1. `ProjectForm` submits inputs → `App.jsx` calls `POST /api/plan`.
2. Backend: `runPipeline(input)` fetches GitHub (falls back to sample data),
   runs the 7 agents in order, generates the scaffold files, returns one JSON.
3. Frontend reveals the completed stages in the timeline, renders the result
   cards, and saves the record to localStorage history.
4. Export: frontend posts the saved record to `/api/export`; the backend returns
   the markdown + filename, the frontend triggers the download.

---

## 3. Design principles

- **All logic on the backend.** Agents, scaffold generation, domain constants,
  hashing and exports live server-side. The frontend never re-implements logic.
- **Render at the edges, structured behind it.** Agents compute structured
  results; rendered text is derived for display/export only. Text is never
  parsed back into logic (exceptions still exist — see §5).
- **Deterministic and pure.** Stage functions are pure relative to `(input)`.
  The only randomness is the seeded `hash`/`pick` pairs. Same inputs → same
  outputs, every run, on every machine.
- **Versioned storage on the client.** History records carry a schema version;
  `storage.normalize()` migrates older shapes on read. No agent re-runs at load.
- **Zero external AI.** No backend LLM calls, no cloud inference — local, fast,
  offline-capable (GitHub optional, falls back to sample data).

---

## 4. Stage registry — next step (not yet done)

The 7 stages are still declared in multiple places: `backend/src/pipeline/runPipeline.js`
(the runner), `src/components/Pipeline.jsx`, `src/components/Landing.jsx`,
`backend/src/export/markdown.js` (section list), and README copy. Adding a stage
touches several files.

Target: one registry that is the single source of truth.

```js
// backend/src/pipeline/stages.js
export const STAGES = {
  github: {
    key: 'github', index: 1, label: 'Builder Signals',
    nextHint: 'Research & opportunity scan — market signals, risks, and recommended direction.',
    async run(ctx) { /* fetch + agent */ },
  },
  // ...research, feasibility, architecture, stack, builder, brief
};

export const STAGE_ORDER = ['github', 'research', 'feasibility', 'architecture', 'stack', 'builder', 'brief'];
```

- `runPipeline` becomes a generic loop over `STAGE_ORDER`.
- `Pipeline.jsx` and `Landing.jsx` import labels/hints/order from a shared
  endpoint or module instead of local `STEP_LABELS`/`STEPS` arrays.
- The export section list derives from the registry too.

---

## 5. Structured stage IO — next step (not yet done)

Today several agents still return **rendered text only** (`research`,
`architecture`, `techStack`), and `runPipeline.js` slices the first line of text
to feed the brief (`githubFirstLine`, `architectureFirstLine`, ...). Target:

```js
// research
{ opportunities: [...], risks: [...], directions: [...], builderSignal: '...', text: '...' }

// architecture
{ shape, modules: [...], flow: [...], principles: [...], text }

// stack
{ label, app, ui, api, data, test, lint, why, pace, text }
```

- The brief consumes structured fields directly (e.g. `feasibility.score`,
  `gh.profile.name`, `research.directions[0]`), never `split('\n')[0]`.
- Rendering helpers live next to each agent (or in `backend/src/export/markdown.js`).

---

## 6. Config-driven feasibility — next step (not yet done)

Axis math is still inline magic (`backend/src/agents/feasibilityAgent.js`).
Target: everything becomes data.

```js
// backend/src/domain/feasibilityConfig.js
export const FEASIBILITY_CONFIG = {
  axes: [
    { key: 'clarity',    max: 30, weight: 0.30, score: ({ words, hasAudience }) => ... },
    { key: 'stackFit',   max: 25, weight: 0.25, score: ({ comfort }) => ... },
    { key: 'scope',      max: 20, weight: 0.20, score: ({ type }) => ... },
    { key: 'time',       max: 15, weight: 0.15, score: ({ deadline }) => deadlineScore(deadline) },
    { key: 'builderFit', max: 10, weight: 0.10, score: ({ hasStack }) => ... },
  ],
  verdicts:    [{ min: 70, verbatim: 'GO', class: 'good', ... }, ...],
  effortBands: [{ min: 75, estimate: 'Lean', weeks: '1–2' }, ...],
  riskPools:   { tool: [...], 'web-app': [...], ..., default: [...] },   // scoped by project type
};
```

Explicit behavior changes when this lands (decisions, not accidents):

1. **Risk register becomes project-type-aware** — today every type samples the
   same global list.
2. **Deadline scoring is already time-aware** (see `domain/deadline.js`) —
   `parseDeadline('6 days')` ≠ `parseDeadline('next spring')`. This is done.
3. **Milestones scale with the effort estimate** — today `builderAgent.js` always
   emits a fixed M1–M4 (4 week) plan while feasibility may estimate 1–2 weeks.
   Target: milestones derive from the effort band.
4. **Brief composition uses structured context** so future stages appear in the
   brief automatically.

---

## 7. Shared domain constants — done

- `backend/src/domain/stacks.js` — `STACKS` + `resolveStackLabel()`.
- `backend/src/domain/types.js` — `PROJECT_TYPES`, `TEAM_SIZES`.
- `backend/src/domain/deadline.js` — time-aware `parseDeadline()` + `deadlineScore()`.
- These live on the backend; the frontend only mirrors the dropdown options in
  `ProjectForm.jsx` (pure UI). If a shared module is ever needed, expose them via
  a `GET /api/meta` style endpoint instead of duplicating the data.

---

## 8. Canonical brief model — next step (not yet done)

`briefAgent` and `export/markdown.js` are still separate twin implementations.
Target: one `buildBriefModel(ctx)` returning a canonical object, then two thin
renderers — `renderText()` (used by BriefCard) and `renderMarkdown()` (used by
export). The brief model is the only place stage context is composed, so a brief
can be re-rendered for any record at any time.

---

## 9. Versioned storage — done

`src/utils/storage.js`:

- `HISTORY_KEY = 'abridgeai.history.v1'`; `RECORD_VERSION = 1`.
- `normalize(record)` migrates v0 → v1 (backfills `feasibility.axes`, wraps
  string `brief` into `{ text }`) on every read.
- `saveToHistory` stamps `version: 1` and caps history at 12 entries.
- Serialize failures are non-fatal; `readHistory` never throws.

---

## 10. Scaffold / ZIP — partially done

- **ZIP**: decision **B** — `fflate` (frontend dep) replaced the hand-rolled
  `buildZip`; the browser only packs the files the backend generated.
- **Starter generators**: `backend/src/scaffold/scaffold.js` is still an
  `else if` chain over TS/Python/Go/Rust (+ custom → TS default). If starter
  count grows, refactor to a `starters/` map of `{ key, files(slug, name, desc) }`
  selected by stack key so a new stack is a one-file addition.

---

## 11. Component consolidation

Fully done as part of the frontend/backend split:

- `App.jsx` is the thin shell: state + `runPlan()` call + view routing.
- `OutputCard` is the single card primitive; `FeasibilityCard`, `BuilderCard`,
  and `BriefCard` wrap it.
- Copy logic is still duplicated in `OutputCard.jsx` (and toast plumbing); a
  shared `useCopy(text, onToast)` hook is a small future cleanup.

---

## 12. How to run

```bash
npm install
cd backend && npm install && cd ..

npm run server    # terminal 1 — Express API on :3001
npm run dev       # terminal 2 — Vite dev server (proxies /api → :3001)

# Production (single port)
npm run start     # build + serve everything on http://localhost:3001
```

---

## 13. Verification checklist

- `npm run lint` — oxlint, no errors.
- `npm run build` — Vite build succeeds.
- Determinism / golden check: run `POST /api/plan` on 2–3 fixed inputs and diff
  the rendered text before/after any refactor. Same inputs must produce
  byte-identical outputs until a step explicitly changes behavior (§6).
- Browser end-to-end: run a project, check all 7 cards render, scaffold `.zip`
  downloads, markdown exports, history load survives reload.

---

## 14. Non-goals

- **No auth, no multi-user, no database** — history stays in the client's
  `localStorage`.
- **No third-party AI calls** — the pipeline is deterministic and local.
- **No new runtime dependencies beyond `express`** (server) and `fflate`
  (client ZIP) already in use.
- **No UI redesign** — layout, styling, and copy stay intact.