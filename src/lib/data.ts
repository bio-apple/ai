import site from '../../data/site.json';
import tools from '../../data/tools.json';
import compares from '../../data/compares.json';
import rankings from '../../data/rankings.json';
import toolRelations from '../../data/tool-relations.json';
import { asset } from './paths';

export const BRAND = 'Bio AI Lab';
export { site, tools, compares, rankings, toolRelations };

export type Tool = (typeof tools)[number];
export type Compare = (typeof compares)[number];

export type ToolRelationEdge = {
  id: string;
  note: string;
  name: string;
  icon: string;
  href: string;
};

export type ResolvedToolRelations = {
  alternatives: ToolRelationEdge[];
  complements: ToolRelationEdge[];
};

export function toolLookup() {
  const found: Record<string, Record<string, unknown>> = {};
  for (const cat of site.home_tool_categories) {
    for (const tool of cat.tools) found[tool.id] = tool;
  }
  return found;
}

export function flattenNavLabels() {
  const labels: Record<string, string> = {};
  for (const item of site.nav.menu) {
    if (item.type === 'tab' && 'id' in item && item.id) labels[item.id] = item.label;
    else if (item.type === 'dropdown') {
      for (const sub of item.children || []) {
        if ('id' in sub && sub.id) labels[sub.id] = sub.label;
      }
    }
  }
  return labels;
}

export function toolNamesMap() {
  return Object.fromEntries(tools.map((t) => [t.id, t.name]));
}

export function stars(n: number) {
  return { filled: n, empty: 5 - n };
}

function resolveRelationEdges(
  edges: ReadonlyArray<{ id: string; note: string }> | undefined,
): ToolRelationEdge[] {
  if (!edges?.length) return [];
  const byId = Object.fromEntries(tools.map((t) => [t.id, t]));
  const resolved: ToolRelationEdge[] = [];
  for (const edge of edges) {
    const tool = byId[edge.id];
    if (!tool) {
      console.warn(`[tool-relations] unknown tool id: ${edge.id}`);
      continue;
    }
    resolved.push({
      id: tool.id,
      note: edge.note,
      name: tool.name,
      icon: tool.icon,
      href: asset(`tools/${tool.id}.html`),
    });
  }
  return resolved;
}

export function resolveToolRelations(toolId: string): ResolvedToolRelations {
  const raw = (
    toolRelations as Record<
      string,
      {
        alternatives?: Array<{ id: string; note: string }>;
        complements?: Array<{ id: string; note: string }>;
      }
    >
  )[toolId];
  return {
    alternatives: resolveRelationEdges(raw?.alternatives),
    complements: resolveRelationEdges(raw?.complements),
  };
}
