import { buildBriefModel } from '../brief/model.js';
import { renderMarkdown } from '../brief/render.js';
import { slugify } from '../scaffold/scaffold.js';

/**
 * Reconstruct a pipeline context from a saved history record so the canonical
 * brief model can be re-rendered (markdown) for old and new records alike.
 */
function recordToContext(record) {
  const outputs = record?.outputs || {};
  const norm = v => (v && typeof v === 'object' ? v : v != null ? { text: v } : null);

  return {
    input: {
      name: record?.name, idea: record?.idea, deadline: record?.deadline,
      comfort: record?.comfort, stack: record?.stack, customStack: record?.customStack,
      type: record?.type, team: record?.team, audience: record?.audience, github: record?.github,
    },
    results: {
      github: norm(outputs.github) || null,
      research: norm(outputs.research),
      feasibility: norm(outputs.feasibility),
      architecture: norm(outputs.architecture),
      stack: norm(outputs.stack),
      builder: norm(outputs.builder),
      brief: norm(outputs.brief),
    },
    errors: {},
  };
}

export function buildBriefMarkdown(record) {
  const brief = buildBriefModel(recordToContext(record));
  const markdown = renderMarkdown(brief, record);

  const filename = `${slugify(record?.name || record?.idea) || 'project'}-abridgeai-brief.md`;
  return { filename, markdown };
}