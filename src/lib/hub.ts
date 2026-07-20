import rankings from '../../data/rankings.json';
import site from '../../data/site.json';

/** 工具中心排行区：各榜展示条数（完整 Top10 见排行榜页） */
export const HUB_RANKING_TOP_N = 5;

/** AI 工具中心仅比较这 10 个产品（localId → 站内教程页 tools/{id}.html） */
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
  { name: '即梦 AI｜剪映', localId: 'jimeng' },
] as const;

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
  /** 站内教程页相对路径（经 asset()），无教程时为空 */
  tutorialHref: string | null;
  localId: string | null;
};

export function buildHubCompareRows(): HubCompareRow[] {
  return HUB_FEATURED_TOOLS.map((featured) => {
    const compare = findCompareRow(featured.name);
    const displayName = compare?.tool || featured.name;
    const localId = featured.localId;

    return {
      name: displayName,
      type: compare?.type || '—',
      strength: compare?.strength || '—',
      scenario: compare?.scenario || '—',
      pricing: compare?.pricing || '—',
      localId,
      tutorialHref: localId ? `tools/${localId}.html` : null,
    };
  });
}

export function hubFeaturedCount() {
  return HUB_FEATURED_TOOLS.length;
}

export type HubRankingItem = {
  rank: number;
  name: string;
  description?: string;
  visits: string;
  mom: string;
  mom_bar_pct: number;
  url: string;
};

export type HubRankingColumns = {
  name: string;
  primary: string;
  secondary: string;
};

export type HubRankingBoard = {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  month: string;
  source_url: string;
  source_name: string;
  columns: HubRankingColumns;
  show_bar: boolean;
  items: HubRankingItem[];
};

const DEFAULT_COLUMNS: HubRankingColumns = {
  name: '产品名',
  primary: '访问量',
  secondary: '月环比',
};

/** 工具中心排行摘要（各榜 Top N） */
export function buildHubRankingBoards(topN = HUB_RANKING_TOP_N): HubRankingBoard[] {
  return (rankings.boards || []).map((board) => {
    const cols = (board as { columns?: HubRankingColumns }).columns || DEFAULT_COLUMNS;
    const showBar = (board as { show_bar?: boolean }).show_bar !== false;
    const sourceName =
      (board as { source_name?: string }).source_name ||
      (board.id?.startsWith('lmsys')
        ? 'LMSYS Chatbot Arena'
        : board.id === 'artificial-analysis'
          ? 'Artificial Analysis'
          : 'AICPB');
    return {
      id: board.id,
      label: board.label,
      title: board.title,
      subtitle: board.subtitle,
      month: board.month || rankings.month_label || rankings.month,
      source_url: board.source_url,
      source_name: sourceName,
      columns: cols,
      show_bar: showBar,
      items: (board.items || []).slice(0, topN).map((item) => ({
        rank: item.rank,
        name: item.name,
        description: item.description || '',
        visits: item.visits,
        mom: item.mom,
        mom_bar_pct: item.mom_bar_pct || 0,
        url: item.url,
      })),
    };
  });
}

export function hubRankingMeta() {
  return {
    updated_at: rankings.updated_at,
    month_label: rankings.month_label || rankings.month,
    source_name: 'AICPB · LMSYS Chatbot Arena Elo · Artificial Analysis Intelligence Index',
    source_home: 'https://www.aicpb.com/',
  };
}
