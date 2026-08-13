/** 专区 SSG 列表：与 courses.js / oss.js / news.js / videos.js 展示结构对齐 */

export const OSS_CATEGORY_LABELS: Record<string, string> = {
  agent: 'Agent 框架',
  inference: '推理框架',
  vector: '向量库',
  eval: '评测工具',
  local: '本地部署',
};

export const OSS_CATEGORY_ORDER = ['agent', 'inference', 'vector', 'eval', 'local'] as const;

export type OssItem = {
  repo: string;
  name: string;
  stars: number;
  summary: string;
  category: string;
  categoryLabel: string;
  url: string;
};

export function buildOssItems(
  frameworks: Array<{
    repo: string;
    name: string;
    stars?: number;
    summary?: string;
    category?: string;
  }>,
): OssItem[] {
  return frameworks
    .map((fw) => {
      const category = fw.category ? String(fw.category) : 'agent';
      return {
        repo: fw.repo,
        name: fw.name,
        stars: Number(fw.stars || 0),
        summary: fw.summary ? String(fw.summary) : '',
        category,
        categoryLabel: OSS_CATEGORY_LABELS[category] || '开源项目',
        url: `https://github.com/${fw.repo}`,
      };
    })
    .sort((a, b) => b.stars - a.stars);
}

export function groupOssByCategory(items: OssItem[]) {
  const groups = new Map<string, OssItem[]>();
  for (const cat of OSS_CATEGORY_ORDER) groups.set(cat, []);
  for (const item of items) {
    const cat = item.category || 'other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  }
  return [...groups.entries()].filter(([, list]) => list.length);
}

export function formatStars(n: number) {
  return Number(n || 0).toLocaleString('en-US');
}

export function formatZhDate(raw?: string) {
  if (!raw) return '';
  const d = new Date(String(raw).includes('T') ? raw : `${raw}T00:00:00+08:00`);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Shanghai',
  });
}

export type CourseItem = {
  id?: string;
  title: string;
  url: string;
  summary?: string;
  platform?: string;
  track?: string;
  format?: string;
  published_at?: string;
  required?: boolean;
  hub?: boolean;
  is_new?: boolean;
  is_free?: boolean;
  official_url?: string;
};

export function dedupeCourses(items: CourseItem[]) {
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const out: CourseItem[] = [];
  for (const item of items || []) {
    const url = String(item.url || '')
      .trim()
      .replace(/\/+$/, '');
    const title = String(item.title || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (url && seenUrl.has(url)) continue;
    if (title && seenTitle.has(title)) continue;
    if (url) seenUrl.add(url);
    if (title) seenTitle.add(title);
    out.push(item);
  }
  const hubs = out.filter((i) => i.hub);
  if (!hubs.length) return out;
  const prefixes = ['https://www.deeplearning.ai/courses'];
  return out.filter((item) => {
    if (item.hub) return true;
    const url = String(item.url || '')
      .trim()
      .replace(/\/+$/, '');
    return !prefixes.some((p) => url.startsWith(p));
  });
}

export function prepareCourses(
  payload: { items?: CourseItem[]; track_order?: string[] },
  trackOrderFallback: string[] = ['入门', '机器学习', '深度学习', 'LLM 大模型', 'AI Agent'],
) {
  const trackOrder =
    Array.isArray(payload.track_order) && payload.track_order.length
      ? payload.track_order
      : trackOrderFallback;
  const orderIndex = Object.fromEntries(trackOrder.map((t, i) => [t, i]));
  const items = dedupeCourses([...(payload.items || [])]).sort((a, b) => {
    const ta = orderIndex[a.track || ''] ?? 999;
    const tb = orderIndex[b.track || ''] ?? 999;
    if (ta !== tb) return ta - tb;
    if (Boolean(a.required || a.hub) !== Boolean(b.required || b.hub)) {
      return a.required || a.hub ? -1 : 1;
    }
    return String(b.published_at || '').localeCompare(String(a.published_at || ''));
  });
  const groups = new Map<string, CourseItem[]>();
  for (const track of trackOrder) groups.set(track, []);
  for (const item of items) {
    const track = item.track || '其他';
    if (!groups.has(track)) groups.set(track, []);
    groups.get(track)!.push(item);
  }
  return {
    trackOrder,
    items,
    groups: [...groups.entries()].filter(([, list]) => list.length),
  };
}

export type NewsItem = {
  title?: string;
  url: string;
  summary?: string;
  source?: string;
  category?: string;
  published_at?: string;
};

export function prepareNewsItems(items: NewsItem[], limit = 24) {
  return (items || []).slice(0, limit);
}

export type VideoItem = {
  id: string;
  platform?: string;
  title: string;
  summary?: string;
  url: string;
  thumbnail?: string;
  channel?: string;
  author?: string;
  views?: number;
  duration?: string;
  max_height?: number;
  published_at?: string;
};

const PLATFORM_TOTAL_CAP = 10;
const PLATFORM_PRIORITY_KEYS: Record<string, string[]> = {
  youtube: [
    'youtube_recent_24h',
    'youtube_recent_30d',
    'youtube_recent_100d',
    'youtube_top_views',
    'youtube_recent_3d',
  ],
  bilibili: [
    'bilibili_recent_24h',
    'bilibili_recent_30d',
    'bilibili_recent_100d',
    'bilibili_top_views',
    'bilibili_recent_3d',
  ],
};

function bucketCap(key: string) {
  if (/_recent_24h$/.test(key)) return 3;
  if (/_recent_30d$/.test(key)) return 3;
  if (/_recent_100d$|_top_views$/.test(key)) return 4;
  return 3;
}

function sortByViews(list: VideoItem[]) {
  return [...list].sort((a, b) => (b.views || 0) - (a.views || 0));
}

function videosFromKeys(
  categories: Record<string, { videos?: VideoItem[] }>,
  keys: string[],
): VideoItem[] {
  const seen = new Set<string>();
  const items: VideoItem[] = [];
  for (const key of keys) {
    for (const v of categories[key]?.videos || []) {
      if (!v?.id || seen.has(v.id)) continue;
      seen.add(v.id);
      items.push(v);
    }
  }
  return items;
}

function buildPlatformList(
  categories: Record<string, { videos?: VideoItem[] }>,
  platform: string,
): VideoItem[] {
  const picked: VideoItem[] = [];
  const seen = new Set<string>();
  for (const key of PLATFORM_PRIORITY_KEYS[platform] || []) {
    const maxN = bucketCap(key);
    const ranked = sortByViews(videosFromKeys(categories, [key]));
    let taken = 0;
    for (const v of ranked) {
      if (picked.length >= PLATFORM_TOTAL_CAP || taken >= maxN) break;
      if (!v?.id || seen.has(v.id)) continue;
      seen.add(v.id);
      picked.push(v);
      taken += 1;
    }
    if (picked.length >= PLATFORM_TOTAL_CAP) break;
  }
  return picked;
}

export function prepareVideos(payload: {
  batches?: Array<{ categories?: Record<string, { videos?: VideoItem[] }> }>;
}) {
  const latest = payload.batches?.[0];
  const categories = latest?.categories || {};
  return {
    youtube: buildPlatformList(categories, 'youtube'),
    bilibili: buildPlatformList(categories, 'bilibili'),
  };
}

export function formatViews(n = 0) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function platformLabel(v: VideoItem) {
  if (v.platform === 'bilibili' || String(v.id || '').startsWith('bilibili:')) return 'B站';
  return 'YouTube';
}
