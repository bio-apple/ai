import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function loadRuntimeJson<T = unknown>(name: string): T | null {
  const candidates = [
    path.join(ROOT, name),
    path.join(ROOT, 'public', name),
    path.join(ROOT, 'data', name),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  }
  return null;
}

export type NewsItem = {
  title: string;
  url: string;
  summary?: string;
  source?: string;
  category?: string;
  published_at?: string;
};

export type NewsPayload = {
  updated_at?: string;
  items?: NewsItem[];
};

export type VideoItem = {
  id: string;
  title: string;
  url: string;
  summary?: string;
  thumbnail?: string;
  views?: number;
  duration?: string;
  max_height?: number;
  platform?: string;
  author?: string;
  channel?: string;
  published_at?: string;
};

export type VideosPayload = {
  updated_at?: string;
  batches?: Array<{
    date?: string;
    categories?: Record<string, { videos?: VideoItem[] }>;
    videos?: VideoItem[];
  }>;
};

export function formatStars(n?: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatNumber(n = 0): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatNewsDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch {
    return iso;
  }
}

export function formatPublishDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch {
    return iso.slice(0, 10);
  }
}

const KNOWN_TRAILING_SOURCES = [
  'OpenAI',
  'Anthropic',
  '量子位',
  '机器之心',
  '新智元',
  '智源社区',
  '智源',
  'Google DeepMind',
  'DeepMind',
  'Google AI',
  'NVIDIA AI',
  'NVIDIA Blog',
  'Hugging Face',
  'HuggingFace',
  'TechCrunch',
  'The Verge',
  'VentureBeat',
  'arXiv cs.AI',
  'arXiv',
  'GitHub Trending',
  'GitHub',
] as const;

function sourceAliases(source: string): string[] {
  const raw = (source || '').normalize('NFKC').trim();
  if (!raw) return [];
  const aliases = new Set<string>([raw]);
  const parts = raw.split(/\s+/);
  if (parts.length > 1) {
    aliases.add(parts[0]);
    aliases.add(parts[parts.length - 1]);
  }
  for (const suffix of [' Blog', ' News', ' 社区']) {
    if (raw.endsWith(suffix) && raw.length > suffix.length + 1) {
      aliases.add(raw.slice(0, -suffix.length).trim());
    }
  }
  return [...aliases].sort((a, b) => b.length - a.length);
}

/** 去掉标题尾部粘连的源站名（「… | OpenAI」「…量子位」） */
export function stripTrailingSource(title: string, source = ''): string {
  // 不整串 NFKC，避免全角标点被改成半角
  let text = (title || '').replace(/\u3000/g, ' ').trim();
  if (!text) return text;

  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const alias of [...sourceAliases(source), ...KNOWN_TRAILING_SOURCES]) {
    const key = alias.toLowerCase();
    if (!alias || seen.has(key)) continue;
    seen.add(key);
    candidates.push(alias);
  }

  const trimEnd = (s: string) => s.replace(/[\s|/·•・\-–—｜：:]+$/u, '').trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const alias of candidates) {
      const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const sepRe = new RegExp(`(?:[\\s|/·•・\\-–—｜：:]+)${esc}\\s*$`, 'i');
      let m = text.match(sepRe);
      if (m && m.index != null) {
        text = trimEnd(text.slice(0, m.index));
        changed = true;
        break;
      }
      if (/[\u4e00-\u9fff]/u.test(alias)) {
        const cjkRe = new RegExp(`(?<=[\\u4e00-\\u9fff\\W])${esc}\\s*$`, 'u');
        m = text.match(cjkRe);
        if (m && m.index != null) {
          text = trimEnd(text.slice(0, m.index));
          changed = true;
          break;
        }
      }
    }
  }
  return text.trim();
}

export function displayNewsTitle(item: Pick<NewsItem, 'title' | 'source'>): string {
  return stripTrailingSource(item.title || '', item.source || '');
}

export function dedupeNewsItems(items: NewsItem[]): NewsItem[] {
  const sorted = [...items].sort((a, b) => {
    const ta = a.published_at ? Date.parse(a.published_at) : 0;
    const tb = b.published_at ? Date.parse(b.published_at) : 0;
    return tb - ta;
  });
  const seenTitle = new Set<string>();
  const seenUrl = new Set<string>();
  const out: NewsItem[] = [];
  for (const item of sorted) {
    const titleKey = (item.title || '')
      .normalize('NFKC')
      .replace(/\u3000/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    const url = (item.url || '').trim();
    if (url && seenUrl.has(url)) continue;
    if (titleKey && seenTitle.has(titleKey)) continue;
    if (url) seenUrl.add(url);
    if (titleKey) seenTitle.add(titleKey);
    out.push(item);
  }
  return out;
}

export function pickHomeNews(limit = 4): NewsItem[] {
  const data = loadRuntimeJson<NewsPayload>('ai-news.json');
  return dedupeNewsItems(data?.items || []).slice(0, limit);
}

export function pickHomeVideos(limit = 3): VideoItem[] {
  const data = loadRuntimeJson<VideosPayload>('daily-videos.json');
  const batch = data?.batches?.[0];
  if (!batch) return [];
  const seen = new Set<string>();
  const flat: VideoItem[] = [];
  if (batch.categories) {
    for (const cat of Object.values(batch.categories)) {
      for (const v of cat.videos || []) {
        if (seen.has(v.id)) continue;
        seen.add(v.id);
        flat.push(v);
      }
    }
  } else {
    for (const v of batch.videos || []) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      flat.push(v);
    }
  }
  return flat
    .sort((a, b) => {
      const ta = a.published_at ? Date.parse(a.published_at) : 0;
      const tb = b.published_at ? Date.parse(b.published_at) : 0;
      return tb - ta;
    })
    .slice(0, limit);
}

export type AiDailyBrief = {
  updatedAt?: string;
  models: NewsItem[];
  industry: NewsItem[];
  github: NewsItem[];
  /** 全量 GitHub 源资讯（供虚拟列表，可远大于 github 预览条数） */
  githubAll?: NewsItem[];
  learn: VideoItem[];
};

function pickNewsBy(
  items: NewsItem[],
  pred: (item: NewsItem) => boolean,
  limit: number,
): NewsItem[] {
  return items.filter(pred).slice(0, limit);
}

/** 首页 AI Daily：聚合新闻 / Trending / 视频学习 */
export function pickAiDailyBrief(
  limits = { models: 3, industry: 2, github: 3, learn: 2 },
): AiDailyBrief {
  const news = loadRuntimeJson<NewsPayload>('ai-news.json');
  const items = dedupeNewsItems(news?.items || []);
  const models = pickNewsBy(
    items,
    (i) => /新模型|模型|发布/.test(`${i.category || ''}${i.title || ''}`),
    limits.models,
  );
  const industry = pickNewsBy(
    items,
    (i) => /行业|中文|工具/.test(i.category || '') && !models.includes(i),
    limits.industry,
  );
  const githubAll = items.filter((i) => /GitHub/i.test(i.source || ''));
  const github = githubAll.slice(0, limits.github);
  return {
    updatedAt: news?.updated_at,
    models: models.length ? models : items.slice(0, limits.models),
    industry: industry.length
      ? industry
      : items.filter((i) => !models.includes(i)).slice(0, limits.industry),
    github,
    githubAll,
    learn: pickHomeVideos(limits.learn),
  };
}
