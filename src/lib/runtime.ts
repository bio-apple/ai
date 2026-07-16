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

export type OssProject = {
  name: string;
  repo: string;
  url: string;
  description?: string;
  language?: string;
  stars?: number;
};

export type OssDomain = {
  id: string;
  label: string;
  description?: string;
  projects?: OssProject[];
};

export type OssPayload = {
  updated_at?: string;
  domains?: OssDomain[];
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

export function pickHomeOss(limit = 6): Array<{ project: OssProject; domainLabel: string }> {
  const data = loadRuntimeJson<OssPayload>('oss-projects.json');
  const items: Array<{ project: OssProject; domainLabel: string }> = [];
  for (const domain of data?.domains || []) {
    for (const project of domain.projects || []) {
      items.push({ project, domainLabel: domain.label });
    }
  }
  return items.sort((a, b) => (b.project.stars || 0) - (a.project.stars || 0)).slice(0, limit);
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
  oss: Array<{ project: OssProject; domainLabel: string }>;
  learn: VideoItem[];
};

function pickNewsBy(
  items: NewsItem[],
  pred: (item: NewsItem) => boolean,
  limit: number,
): NewsItem[] {
  return items.filter(pred).slice(0, limit);
}

/** 首页 AI Daily：聚合新闻 / Trending / 开源 / 视频学习 */
export function pickAiDailyBrief(
  limits = { models: 3, industry: 2, github: 3, oss: 2, learn: 2 },
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
  // 不把 OSS 精选回填进 GitHub 面板，避免与首页「开源项目精选」重复
  const github = pickNewsBy(items, (i) => /GitHub/i.test(i.source || ''), limits.github);
  const oss = pickHomeOss(limits.oss);
  return {
    updatedAt: news?.updated_at,
    models: models.length ? models : items.slice(0, limits.models),
    industry: industry.length
      ? industry
      : items.filter((i) => !models.includes(i)).slice(0, limits.industry),
    github,
    oss,
    learn: pickHomeVideos(limits.learn),
  };
}
