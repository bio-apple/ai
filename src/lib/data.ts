import site from '../../data/site.json';
import tools from '../../data/tools.json';
import cases from '../../data/cases.json';
import compares from '../../data/compares.json';
import promptsMeta from '../../data/prompts.json';

export const BRAND = 'Bio AI Lab';
export { site, tools, cases, compares, promptsMeta };

export type Tool = (typeof tools)[number];
export type Compare = (typeof compares)[number];

export function toolLookup() {
  const found: Record<string, Record<string, unknown>> = {};
  for (const cat of site.home_tool_categories) {
    for (const tool of cat.tools) found[tool.id] = tool;
  }
  return found;
}

export function buildHotToolCards() {
  const lookup = toolLookup();
  return site.hot_tools.map((id) => lookup[id]).filter(Boolean);
}

export function buildCreateToolCards() {
  const lookup = toolLookup();
  return site.create_tools.map((id) => lookup[id]).filter(Boolean);
}

export function flattenNavLabels() {
  const labels: Record<string, string> = {};
  for (const item of site.nav.menu) {
    if (item.type === 'tab') labels[item.id] = item.label;
    else if (item.type === 'dropdown') {
      for (const sub of item.children || []) labels[sub.id] = sub.label;
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
