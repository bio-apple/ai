import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isVideoWithinDays, prepareVideos } from './ssr-lists';
import { isDisplayableVideo } from '../../lib/video-quality.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function loadRuntimeJson<T = unknown>(name: string): T | null {
  const candidates = [
    path.join(ROOT, name),
    path.join(ROOT, 'public', name),
    path.join(ROOT, 'data', name),
    path.join(process.cwd(), name),
    path.join(process.cwd(), 'public', name),
    path.join(process.cwd(), 'data', name),
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

const INDUSTRY_SOURCE_ALLOW = /^(openai|anthropic|机器之心|jiqizhixin)$/i;

function isIndustryNews(item: NewsItem): boolean {
  if ((item.category || '') === '行业新闻') return true;
  return INDUSTRY_SOURCE_ALLOW.test((item.source || '').trim());
}

type HomeVideoPicksPayload = { items?: VideoItem[] };

/** 首页精选：编辑白名单。缺省时才从日更里按平台各取一条（已过滤，不按播放量）。 */
export function pickHomeVideos(limit = 3, data?: VideosPayload | null): VideoItem[] {
  const picks = loadRuntimeJson<HomeVideoPicksPayload>('home-video-picks.json');
  const curated = (picks?.items || []).filter((v) => v?.url && v?.title).slice(0, limit);
  if (curated.length) return curated;

  const payload = data ?? loadRuntimeJson<VideosPayload>('daily-videos.json');
  const batch = payload?.batches?.[0];
  if (!batch) return [];
  const pool = batch.categories
    ? Object.values(prepareVideos(payload)).flat()
    : (batch.videos || []).filter((v) => isVideoWithinDays(v));
  const filtered = pool.filter((v) => isDisplayableVideo(v));
  const seen = new Set<string>();
  const out: VideoItem[] = [];
  for (const platform of ['youtube', 'bilibili']) {
    const hit = filtered.find((v) => {
      const plat = /bilibili/i.test(v.platform || v.id || '') ? 'bilibili' : 'youtube';
      return plat === platform && !seen.has(v.id);
    });
    if (hit) {
      seen.add(hit.id);
      out.push(hit);
    }
    if (out.length >= limit) return out;
  }
  for (const v of filtered) {
    if (seen.has(v.id)) continue;
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

export type OssHeatRow = {
  repo?: string;
  name?: string;
  stars?: number;
  summary?: string;
  heat_score?: number;
  stars_weekly?: number | null;
  trending_weekly_rank?: number | null;
  is_fastest?: boolean;
};

function ossWeeklyRise(fw: OssHeatRow): number {
  if (fw.trending_weekly_rank != null && Number(fw.trending_weekly_rank) > 0) {
    return 1_000_000 - Number(fw.trending_weekly_rank);
  }
  if (fw.stars_weekly) return Number(fw.stars_weekly);
  if (fw.is_fastest) return Number(fw.heat_score || 0) + 500;
  return Number(fw.heat_score || 0);
}

function loadOssHeatRows(): OssHeatRow[] {
  const payload = loadRuntimeJson<{ items?: OssHeatRow[] }>('oss-projects.json');
  if (Array.isArray(payload?.items) && payload.items.length) return payload.items;
  const site = loadRuntimeJson<{ oss_frameworks?: OssHeatRow[] }>('site.json');
  return site?.oss_frameworks || [];
}

/** 本周开源升温 Top N：优先 weekly Trending，其次周均 Star / 加热分。 */
export function pickOssWeeklyTop(limit = 3, rows?: OssHeatRow[]): NewsItem[] {
  const list = (rows || loadOssHeatRows()).filter((r) => r.repo && r.name);
  return [...list]
    .sort((a, b) => ossWeeklyRise(b) - ossWeeklyRise(a))
    .slice(0, limit)
    .map((fw) => ({
      title: String(fw.name),
      url: `https://github.com/${fw.repo}`,
      summary: fw.summary,
      source: 'GitHub',
      category: '本周升温',
    }));
}

export type AiDailyBrief = {
  updatedAt?: string;
  models: NewsItem[];
  industry: NewsItem[];
  github: NewsItem[];
  learn: VideoItem[];
};

function pickNewsBy(
  items: NewsItem[],
  pred: (item: NewsItem) => boolean,
  limit: number,
): NewsItem[] {
  return items.filter(pred).slice(0, limit);
}

/** 首页简报：1 条模型资讯 + 开源升温 + 编辑视频。行业资讯不把「中文资讯」当行业。 */
export function pickAiDailyBrief(
  limits = { models: 1, industry: 1, github: 1, learn: 1 },
): AiDailyBrief {
  const news = loadRuntimeJson<NewsPayload>('ai-news.json');
  const items = dedupeNewsItems(news?.items || []);
  const models = pickNewsBy(items, (i) => (i.category || '') === '新模型发布', limits.models);
  const industry = pickNewsBy(
    items,
    (i) => isIndustryNews(i) && !models.includes(i),
    limits.industry,
  );
  const github = pickOssWeeklyTop(Math.max(limits.github, 1));
  return {
    updatedAt: news?.updated_at,
    models: models.length ? models : [],
    industry,
    github,
    learn: pickHomeVideos(limits.learn),
  };
}
