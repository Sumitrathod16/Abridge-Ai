import { STAGES, STAGE_ORDER } from './stages.js';
import { createContext } from './context.js';

/**
 * Data-driven pipeline runner.
 *
 * Walks STAGE_ORDER generically: each stage reads/writes the shared context.
 * A stage failure is captured in `ctx.errors[key]` and does not abort the
 * remaining stages — but it is never silently swallowed.
 *
 * Returns the per-stage structured results consumed by the frontend.
 */
export async function runPipeline(input) {
  const ctx = createContext(input);

  for (const key of STAGE_ORDER) {
    const stage = STAGES[key];
    if (!stage) { ctx.errors[key] = `Unknown stage "${key}"`; continue; }

    try {
      ctx.results[key] = await stage.run(ctx);
    } catch (err) {
      const msg = err?.message || String(err);
      ctx.errors[key] = msg;
      console.error(`[pipeline] stage "${key}" failed:`, err);
    }
  }

  return { results: ctx.results, errors: ctx.errors, ctx };
}