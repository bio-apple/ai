import hubOfficial from '../../data/hub-official.json';
import rankings from '../../data/rankings.json';
import tools from '../../data/tools.json';
import { asset } from './paths';

export const HUB_TOP_N = 5;

/** 应用分类：由 AICPB 各榜 Top5 归并 */
export const HUB_APP_CATEGORIES = [
  {
    id: 'assistant-global',
    label: '全球 AI 助手',
    description: '通用对话、多模态与全球主流助手',
    boardId: 'global-ai',
  },
  {
    id: 'assistant-china',
    label: '国内 AI 助手',
    description: '中文场景、搜索与国内大模型产品',
    boardId: 'china-ai',
  },
  {
    id: 'coding',
    label: 'AI 编程',
    description: '编码助手、Agent 与开发平台',
    boardId: 'vibe-coding',
  },
  {
    id: 'video',
    label: 'AI 视频',
    description: '脚本、生成与创作工具',
    boardId: 'video-generators',
  },
  {
    id: 'ppt',
    label: 'AI PPT',
    description: '演示文稿与汇报生成',
    boardId: 'ppt',
  },
] as const;

const NAME_ALIASES: Record<string, string> = {
  chatgpt: 'chatgpt',
  'new bing': 'new-bing',
  gemini: 'gemini',
  'google gemini': 'gemini',
  claude: 'claude',
  'claude｜anthropic': 'claude',
  'claude|anthropic': 'claude',
  deepseek: 'deepseek',
  'github copilot': 'copilot',
  'microsoft copilot': 'copilot',
  copilot: 'copilot',
  cursor: 'cursor',
  kimi: 'kimi',
  'kimi｜月之暗面': 'kimi',
  通义千问: 'qwen',
  qwen: 'qwen',
  豆包: 'doubao',
  '豆包｜抖音': 'doubao',
  'openai codex': 'codex',
  codex: 'codex',
};

type OfficialEntry = {
  site?: string;
  tutorial?: string;
  tutorial_label?: string;
};

type OfficialCatalog = {
  aliases?: Record<string, string>;
  tools?: Record<string, OfficialEntry>;
};

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function catalogKey(name: string, catalog: OfficialCatalog) {
  const n = normalizeName(name);
  const baseName = n.split(/[|｜]/)[0].trim();
  const aliases = catalog.aliases || {};
  return aliases[n] || aliases[baseName] || n;
}

export function localToolId(name: string): string | null {
  const n = normalizeName(name);
  const baseName = n.split(/[|｜]/)[0].trim();
  const aliased = NAME_ALIASES[n] || NAME_ALIASES[baseName];
  if (aliased) return aliased;
  const hit = tools.find((t) => {
    const tn = normalizeName(t.name);
    return tn === n || tn === baseName || t.id === n || t.id === baseName;
  });
  return hit?.id || null;
}

function officialFor(name: string): OfficialEntry {
  const catalog = hubOfficial as OfficialCatalog;
  const key = catalogKey(name, catalog);
  const direct = catalog.tools?.[key] || catalog.tools?.[normalizeName(name)];
  if (direct) return direct;

  // 站内工具：回退到官方资源 / 官网
  const id = localToolId(name);
  if (!id) return {};
  const tool = tools.find((t) => t.id === id) as
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
    site: undefined,
    tutorial: officialRes?.href,
    tutorial_label: officialRes?.title || officialRes?.type || '官方教程',
  };
}

export type HubToolCard = {
  rank: number;
  name: string;
  visits: string;
  mom: string;
  aicpbUrl: string;
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
  boardId: string;
  boardLabel: string;
  sourceUrl: string;
  month: string;
  items: HubToolCard[];
};

export function buildHubAppCategories(topN = HUB_TOP_N): HubAppCategory[] {
  const boards = rankings.boards || [];
  const byId = Object.fromEntries(boards.map((b) => [b.id, b]));

  return HUB_APP_CATEGORIES.map((cat) => {
    const board = byId[cat.boardId];
    const items = (board?.items || []).slice(0, topN).map((item) => {
      const localId = localToolId(item.name);
      const official = officialFor(item.name);
      const siteUrl = official.site || null;
      const tutorialUrl = official.tutorial || siteUrl;
      return {
        rank: item.rank,
        name: item.name,
        visits: item.visits,
        mom: item.mom,
        aicpbUrl: item.url,
        boardLabel: board?.label || cat.label,
        localId,
        localHref: localId ? asset(`tools/${localId}.html`) : null,
        siteUrl,
        tutorialUrl,
        tutorialLabel: official.tutorial_label || '官方教程',
      } satisfies HubToolCard;
    });

    return {
      id: cat.id,
      label: cat.label,
      description: cat.description,
      boardId: cat.boardId,
      boardLabel: board?.label || cat.boardId,
      sourceUrl: board?.source_url || 'https://www.aicpb.com/',
      month: board?.month || rankings.month_label || rankings.month,
      items,
    };
  });
}
