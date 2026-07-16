import hubOfficial from '../../data/hub-official.json';
import rankings from '../../data/rankings.json';
import tools from '../../data/tools.json';
import { asset } from './paths';

/** AI 工具中心仅介绍这 10 个产品（展示名与 AICPB 对齐） */
export const HUB_FEATURED_TOOLS = [
  { name: 'ChatGPT', categoryId: 'assistant', localId: 'chatgpt' },
  { name: 'New Bing', categoryId: 'assistant', localId: 'new-bing' },
  { name: 'Gemini', categoryId: 'assistant', localId: 'gemini' },
  { name: 'Claude｜Anthropic', categoryId: 'assistant', localId: 'claude' },
  { name: 'DeepSeek', categoryId: 'assistant', localId: 'deepseek' },
  { name: '豆包｜抖音', categoryId: 'assistant', localId: 'doubao' },
  { name: 'Kimi｜月之暗面', categoryId: 'assistant', localId: 'kimi' },
  { name: 'Github Copilot', categoryId: 'coding', localId: 'copilot' },
  { name: 'cursor', categoryId: 'coding', localId: 'cursor' },
  { name: '即梦 AI｜剪映', categoryId: 'video', localId: null },
] as const;

export const HUB_APP_CATEGORIES = [
  {
    id: 'assistant',
    label: 'AI 助手',
    description: '通用对话、搜索与多模态助手',
  },
  {
    id: 'coding',
    label: 'AI 编程',
    description: '编码助手与 AI 原生 IDE',
  },
  {
    id: 'video',
    label: 'AI 视频',
    description: '短视频与生成式创作',
  },
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
  boardId: string;
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
  const n = normalizeName(name).replace(/｜/g, '|');
  const nPipe = normalizeName(name);
  const baseName = nPipe.split('｜')[0].trim();
  const aliases = catalog.aliases || {};
  return (
    aliases[nPipe] ||
    aliases[n] ||
    aliases[baseName] ||
    aliases[`${baseName}｜${nPipe.split('｜')[1] || ''}`.replace(/｜$/, '')] ||
    nPipe
  );
}

export function localToolId(name: string, preferred?: string | null): string | null {
  if (preferred) return preferred;
  const featured = HUB_FEATURED_TOOLS.find((t) => namesMatch(t.name, name));
  if (featured?.localId) return featured.localId;
  const n = normalizeName(name);
  const baseName = n.split('｜')[0].trim();
  const hit = tools.find((t) => {
    const tn = normalizeName(t.name);
    return tn === n || tn === baseName || t.id === n || t.id === baseName;
  });
  return hit?.id || null;
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

/** 在全榜中为指定工具找最佳 AICPB 条目（优先同名、排名更靠前） */
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
        boardId: board.id,
      };
      if (!best || hit.rank < best.rank) best = hit;
    }
  }
  return best;
}

export type HubToolCard = {
  rank: number | null;
  name: string;
  visits: string;
  mom: string;
  aicpbUrl: string | null;
  boardLabel: string;
  localId: string | null;
  localHref: string | null;
  siteUrl: string | null;
  tutorialUrl: string | null;
  tutorialLabel: string;
};

export type HubAppCategory = {
  id: string;
  label: string;
  description: string;
  items: HubToolCard[];
};

export function buildHubAppCategories(): HubAppCategory[] {
  const cards = HUB_FEATURED_TOOLS.map((featured) => {
    const hit = findRankingHit(featured.name);
    const displayName = hit?.name || featured.name;
    const localId = localToolId(displayName, featured.localId);
    const official = officialFor(displayName, localId);
    const siteUrl = official.site || null;
    const tutorialUrl = official.tutorial || siteUrl;
    return {
      categoryId: featured.categoryId,
      card: {
        rank: hit?.rank ?? null,
        name: displayName,
        visits: hit?.visits || '—',
        mom: hit?.mom || '—',
        aicpbUrl: hit?.url || null,
        boardLabel: hit?.boardLabel || 'AICPB',
        localId,
        localHref: localId ? asset(`tools/${localId}.html`) : null,
        siteUrl,
        tutorialUrl,
        tutorialLabel: official.tutorial_label || '官方教程',
      } satisfies HubToolCard,
    };
  });

  return HUB_APP_CATEGORIES.map((cat) => ({
    id: cat.id,
    label: cat.label,
    description: cat.description,
    items: cards.filter((c) => c.categoryId === cat.id).map((c) => c.card),
  })).filter((cat) => cat.items.length > 0);
}

export function hubFeaturedCount() {
  return HUB_FEATURED_TOOLS.length;
}
