export const STACKS = {
  typescript: { label: 'TypeScript / JavaScript', app: 'TypeScript 5 + Node 22 (or Bun)', ui: 'React 18 + Vite', api: 'Hono (lightweight, edge-ready)', data: 'SQLite via better-sqlite3 → Postgres when needed', test: 'Vitest', lint: 'Biome', why: 'Strong typing, one language across CLI + web.' },
  python:     { label: 'Python',                   app: 'Python 3.12 + uv',                 ui: 'Starlette + server-rendered templates', api: 'FastAPI', data: 'SQLite via stdlib sqlite3 → Postgres when needed', test: 'pytest', lint: 'Ruff', why: 'Fast to iterate, rich stdlib for parsing and data work.' },
  go:         { label: 'Go',                        app: 'Go 1.22',                          ui: 'net/http + static assets', api: 'net/http stdlib (or chi)', data: 'SQLite via modernc.org/sqlite → Postgres when needed', test: 'go test', lint: 'golangci-lint', why: 'Single static binary, trivial to deploy.' },
  rust:       { label: 'Rust',                      app: 'Rust 2021 edition',                ui: 'axum + serve static', api: 'axum', data: 'rusqlite → Postgres via sqlx when needed', test: 'cargo test', lint: 'clippy', why: 'Maximum correctness; compile-time safety.' },
  unsure:     { label: 'Not sure yet',              app: 'TypeScript 5 + Node 22',           ui: 'React 18 + Vite', api: 'Hono', data: 'SQLite via better-sqlite3', test: 'Vitest', lint: 'Biome', why: 'Recommended default: one language, huge ecosystem, fastest path to a working demo.' },
};

export function resolveStackLabel({ stack, customStack }) {
  if (customStack) return customStack;
  return (stack && STACKS[stack] && stack !== 'unsure') ? STACKS[stack].label : 'default stack';
}