import express from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageMeta } from './src/pipeline/stages.js';
import { STACKS } from './src/domain/stacks.js';
import { PROJECT_TYPES, TEAM_SIZES } from './src/domain/types.js';
import { buildBriefMarkdown } from './src/export/markdown.js';
import { getTemporalClient } from './src/temporal/client.js';
import { TEMPORAL_TASK_QUEUE } from './src/temporal/config.js';
import {
  PLAN_PROGRESS_QUERY,
  PLAN_WORKFLOW_TYPE,
  WORKFLOW_EXECUTION_TIMEOUT,
} from './src/temporal/workflowConstants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');

/**
 * Builds the full Express app (API + production static serving).
 *
 * Exportable (not listening) so it can run as:
 *  - a long-lived local server  → node backend/server.js
 *  - a Vercel serverless function → api/index.js (imports this)
 */
export function createApp({ temporalClientFactory = getTemporalClient } = {}) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // ── API ───────────────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'abridgeai-backend' });
  });

  // Stage/domain metadata → drives the timeline, landing preview, and form
  // dropdowns so stage names/order never drift across the UI (single source).
  app.get('/api/meta', (_req, res) => {
    res.json({
      stages: stageMeta(),
      stacks: Object.entries(STACKS).map(([key, s]) => ({ key, label: s.label })),
      projectTypes: Object.entries(PROJECT_TYPES).map(([key, value]) => ({ key, label: value })),
      teamSizes: Object.entries(TEAM_SIZES).map(([key, value]) => ({ key, label: value })),
    });
  });

  app.post('/api/plan', async (req, res) => {
    try {
      const input = req.body || {};
      const client = await temporalClientFactory();
      const workflowId = `abridgeai-${randomUUID()}`;
      await client.workflow.start(PLAN_WORKFLOW_TYPE, {
        workflowId,
        taskQueue: TEMPORAL_TASK_QUEUE,
        workflowExecutionTimeout: WORKFLOW_EXECUTION_TIMEOUT,
        args: [input],
      });
      res.status(202).json({ ok: true, workflowId, status: 'running' });
    } catch (err) {
      console.error('[api/plan] failed to start Temporal workflow:', err);
      res.status(503).json({ ok: false, error: 'Unable to start the planning workflow. Check Temporal connectivity.' });
    }
  });

  app.get('/api/workflows/:workflowId', async (req, res) => {
    try {
      const client = await temporalClientFactory();
      const handle = client.workflow.getHandle(req.params.workflowId);
      const [description, progress] = await Promise.all([
        handle.describe(),
        handle.query(PLAN_PROGRESS_QUERY),
      ]);
      res.json({
        ok: true,
        workflowId: req.params.workflowId,
        status: description.status.name.toLowerCase(),
        stages: progress.stages,
        results: progress.results,
        errors: progress.errors,
      });
    } catch (err) {
      if (err?.name === 'WorkflowNotFoundError') {
        return res.status(404).json({ ok: false, error: 'Workflow not found.' });
      }
      console.error('[api/workflows] failed to retrieve workflow status:', err);
      res.status(503).json({ ok: false, error: 'Unable to retrieve workflow status. Check Temporal connectivity.' });
    }
  });

  app.post('/api/export', (req, res) => {
    try {
      const record = req.body;
      if (!record) {
        return res.status(400).json({ ok: false, error: 'Missing record.' });
      }
      const { filename, markdown } = buildBriefMarkdown(record);
      res.json({ ok: true, filename, markdown });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Export failed. Please try again.' });
    }
  });

  // ── Serve the built frontend (production / single-port mode) ─────────────
  app.use(express.static(DIST));

  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });

  return app;
}