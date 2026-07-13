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

export function pickHomeNews(limit = 4): NewsItem[] {
  const data = loadRuntimeJson<NewsPayload>('ai-news.json');
  return (data?.items || []).slice(0, limit);
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
