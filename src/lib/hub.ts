import hubOfficial from '../../data/hub-official.json';
import rankings from '../../data/rankings.json';
import site from '../../data/site.json';
import tools from '../../data/tools.json';
import { asset } from './paths';

/** AI 工具中心仅比较这 10 个产品（展示名与 AICPB 对齐） */
export const HUB_FEATURED_TOOLS = [
  { name: 'ChatGPT', localId: 'chatgpt' },
  { name: 'New Bing', localId: 'new-bing' },
  { name: 'Gemini', localId: 'gemini' },
  { name: 'Claude｜Anthropic', localId: 'claude' },
  { name: 'DeepSeek', localId: 'deepseek' },
  { name: '豆包｜抖音', localId: 'doubao' },
  { name: 'Kimi｜月之暗面', localId: 'kimi' },
  { name: 'Github Copilot', localId: 'copilot' },
  { name: 'cursor', localId: 'cursor' },
  { name: '即梦 AI｜剪映', localId: null },
] as const;

type OfficialEntry = {
  site?: string;
  tutorial?: string;
  tutorial_label?: string;
};

type OfficialCatalog = {
  aliases?: Record<string, string>;
  tools?: Record<string, OfficialEntry>;
};

type RankingItem = {
  rank: number;
  name: string;
  visits: string;
  mom: string;
  url: string;
  boardLabel: string;
};

type CompareRow = {
  tool: string;
  type: string;
  strength: string;
  scenario: string;
  pricing: string;
};

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[|｜]/g, '｜');
}

function namesMatch(a: string, b: string) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  const baseA = na.split('｜')[0].trim();
  const baseB = nb.split('｜')[0].trim();
  return baseA === baseB || na === baseB || nb === baseA;
}

function catalogKey(name: string, catalog: OfficialCatalog) {
  const nPipe = normalizeName(name);
  const n = nPipe.replace(/｜/g, '|');
  const baseName = nPipe.split('｜')[0].trim();
  const aliases = catalog.aliases || {};
  return aliases[nPipe] || aliases[n] || aliases[baseName] || nPipe;
}

function officialFor(name: string, localId: string | null): OfficialEntry {
  const catalog = hubOfficial as OfficialCatalog;
  const key = catalogKey(name, catalog);
  const direct = catalog.tools?.[key] || catalog.tools?.[normalizeName(name)];
  if (direct) return direct;

  if (!localId) return {};
  const tool = tools.find((t) => t.id === localId) as
    | {
        text_resources?: Array<{
          type_class?: string;
          href?: string;
          title?: string;
          type?: string;
        }>;
      }
    | undefined;
  const officialRes = (tool?.text_resources || []).find(
    (r) => r.type_class === 'official' && r.href,
  );
  return {
    tutorial: officialRes?.href,
    tutorial_label: officialRes?.title || officialRes?.type || '官方教程',
  };
}

function findRankingHit(name: string): RankingItem | null {
  let best: RankingItem | null = null;
  for (const board of rankings.boards || []) {
    for (const item of board.items || []) {
      if (!namesMatch(item.name, name)) continue;
      const hit: RankingItem = {
        rank: item.rank,
        name: item.name,
        visits: item.visits,
        mom: item.mom,
        url: item.url,
        boardLabel: board.label,
      };
      if (!best || hit.rank < best.rank) best = hit;
    }
  }
  return best;
}

function findCompareRow(name: string): CompareRow | null {
  const rows = (site.compare_table?.rows || []) as CompareRow[];
  return rows.find((row) => namesMatch(row.tool, name)) || null;
}

export type HubCompareRow = {
  name: string;
  type: string;
  strength: string;
  scenario: string;
  pricing: string;
  rank: number | null;
  visits: string;
  boardLabel: string;
  aicpbUrl: string | null;
  localId: string | null;
  localHref: string | null;
  siteUrl: string | null;
  tutorialUrl: string | null;
  tutorialLabel: string;
};

export function buildHubCompareRows(): HubCompareRow[] {
  return HUB_FEATURED_TOOLS.map((featured) => {
    const hit = findRankingHit(featured.name);
    const compare = findCompareRow(featured.name);
    const displayName = hit?.name || compare?.tool || featured.name;
    const localId = featured.localId;
    const official = officialFor(displayName, localId);
    const siteUrl = official.site || null;
    const tutorialUrl = official.tutorial || siteUrl;

    return {
      name: displayName,
      type: compare?.type || '—',
      strength: compare?.strength || '—',
      scenario: compare?.scenario || '—',
      pricing: compare?.pricing || '—',
      rank: hit?.rank ?? null,
      visits: hit?.visits || '—',
      boardLabel: hit?.boardLabel || '—',
      aicpbUrl: hit?.url || null,
      localId,
      localHref: localId ? asset(`tools/${localId}.html`) : null,
      siteUrl,
      tutorialUrl,
      tutorialLabel: official.tutorial_label || '官方教程',
    };
  });
}

export function hubFeaturedCount() {
  return HUB_FEATURED_TOOLS.length;
}
