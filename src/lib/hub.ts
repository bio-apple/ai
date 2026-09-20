import rankings from '../../data/rankings.json';
import { rankingPickReason } from './content-display';

/** 工具中心排行区：各榜展示条数 */
export const HUB_RANKING_TOP_N = 10;

export type HubRankingItem = {
  rank: number;
  name: string;
  description?: string;
  visits: string;
  metric_value: string;
  mom: string;
  mom_bar_pct: number;
  url: string;
  pick_reason?: string;
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
      items: (board.items || []).slice(0, topN).map((item) => {
        const metric = (item as { metric_value?: string }).metric_value || item.visits || '—';
        const reason = item.pick_reason || rankingPickReason(item.name, board.id);
        return {
          rank: item.rank,
          name: item.name,
          description: item.description || '',
          visits: metric,
          metric_value: metric,
          mom: item.mom,
          mom_bar_pct: item.mom_bar_pct || 0,
          url: item.url,
          pick_reason: reason || undefined,
        };
      }),
    };
  });
}

export function withRankingReasons<
  T extends {
    id: string;
    items?: Array<{ name: string; pick_reason?: string; visits?: string; metric_value?: string }>;
  },
>(boards: T[]): T[] {
  return boards.map((board) => ({
    ...board,
    items: (board.items || []).map((item) => {
      const metric = item.metric_value || item.visits || '—';
      const reason = item.pick_reason || rankingPickReason(item.name, board.id);
      return {
        ...item,
        visits: metric,
        pick_reason: reason || undefined,
      };
    }),
  }));
}

export function rankingUpdatedLabel(updatedAt?: string, now = Date.now()): string {
  if (!updatedAt) return '';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(updatedAt) ? `${updatedAt}T00:00:00+08:00` : updatedAt;
  const t = Date.parse(iso);
  const stale = !Number.isFinite(t) || now - t > 2 * 24 * 60 * 60 * 1000;
  return stale ? `数据停在 ${updatedAt}（未日更）` : `数据更新于 ${updatedAt}`;
}

export function hubRankingMeta() {
  return {
    updated_at: rankings.updated_at,
    updated_label: rankingUpdatedLabel(rankings.updated_at),
    month_label: rankings.month_label || rankings.month,
    source_name: 'AICPB · LMSYS Chatbot Arena Elo · Artificial Analysis Intelligence Index',
    source_home: 'https://www.aicpb.com/',
  };
}
