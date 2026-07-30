import rankings from '../../data/rankings.json';

/** 工具中心排行区：各榜展示条数 */
export const HUB_RANKING_TOP_N = 10;

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
