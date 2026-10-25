/**
 * Typed context that flows through every stage.
 * Stages write structured results to `ctx.results`; `ctx.errors` records
 * per-stage failures so the pipeline never silently swallows a crash.
 */
export function createContext(input) {
  return {
    input,
    results: {},
    errors: {},
  };
}