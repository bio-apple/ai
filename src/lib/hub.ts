import hubOfficial from '../../data/hub-official.json';
import rankings from '../../data/rankings.json';
import site from '../../data/site.json';
import tools from '../../data/tools.json';
import { asset } from './paths';

/** 工具中心排行区：各 AICPB 专题榜展示条数（完整 Top10 见排行榜页） */
export const HUB_RANKING_TOP_N = 5;

/** AI 工具中心仅比较这 10 个产品 */
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
  localId: string | null;
  localHref: string | null;
  siteUrl: string | null;
  tutorialUrl: string | null;
  tutorialLabel: string;
};

export function buildHubCompareRows(): HubCompareRow[] {
  return HUB_FEATURED_TOOLS.map((featured) => {
    const compare = findCompareRow(featured.name);
    const displayName = compare?.tool || featured.name;
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

export type HubRankingItem = {
  rank: number;
  name: string;
  visits: string;
  mom: string;
  mom_bar_pct: number;
  url: string;
};

export type HubRankingBoard = {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  month: string;
  source_url: string;
  items: HubRankingItem[];
};

/** 工具中心用的 AICPB 排行摘要（各榜 Top N） */
export function buildHubRankingBoards(topN = HUB_RANKING_TOP_N): HubRankingBoard[] {
  return (rankings.boards || []).map((board) => ({
    id: board.id,
    label: board.label,
    title: board.title,
    subtitle: board.subtitle,
    month: board.month || rankings.month_label || rankings.month,
    source_url: board.source_url,
    items: (board.items || []).slice(0, topN).map((item) => ({
      rank: item.rank,
      name: item.name,
      visits: item.visits,
      mom: item.mom,
      mom_bar_pct: item.mom_bar_pct || 0,
      url: item.url,
    })),
  }));
}

export function hubRankingMeta() {
  return {
    updated_at: rankings.updated_at,
    month_label: rankings.month_label || rankings.month,
    source_name: 'AICPB（AI产品榜）',
    source_home: 'https://www.aicpb.com/',
  };
}
