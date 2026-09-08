/** 专区 SSG 列表：与 courses.js / oss.js / news.js / videos.js 展示结构对齐 */

export const OSS_CATEGORY_LABELS: Record<string, string> = {
  agent: 'Agent',
  mcp: 'MCP',
  coding_agent: 'Coding Agent',
  agent_harness: 'Agent Harness',
  skills: 'Skills',
  memory: 'Memory',
};

export const OSS_CATEGORY_ORDER = [
  'agent',
  'mcp',
  'coding_agent',
  'agent_harness',
  'skills',
  'memory',
] as const;

export type OssItem = {
  repo: string;
  name: string;
  stars: number;
  summary: string;
  category: string;
  categoryLabel: string;
  url: string;
  heatScore: number;
  sources: string[];
  rank?: number;
  createdAt?: string;
  starsDelta?: number | null;
  starsWeekly?: number | null;
  isNew?: boolean;
  isFastest?: boolean;
  trendingWeeklyRank?: number | null;
};

export function formatStarDelta(n: number) {
  const abs = Math.abs(n);
  const body = abs >= 10_000 ? `${(abs / 10_000).toFixed(1)}万` : abs.toLocaleString('en-US');
  if (n > 0) return `+${body}`;
  if (n < 0) return `-${body}`;
  return '0';
}

export function ossRiseScore(item: OssItem) {
  if (item.starsDelta) return item.starsDelta;
  if (item.trendingWeeklyRank != null) return 1000 - item.trendingWeeklyRank;
  return item.starsWeekly || 0;
}

export function formatOssGrowth(
  item: OssItem,
): { text: string; title: string; dir: 'up' | 'down' | 'est' } | null {
  if (item.starsDelta) {
    const up = item.starsDelta > 0;
    return {
      text: `${up ? '↑' : '↓'} ${formatStarDelta(item.starsDelta)}`,
      title: '相对上次日更快照的 Star 变化',
      dir: up ? 'up' : 'down',
    };
  }
  if (item.starsWeekly && item.starsWeekly > 0) {
    return {
      text: `约 ${formatStarDelta(item.starsWeekly)}/周`,
      title: '按仓库年龄估算的周均 Star 增长（静态）',
      dir: 'est',
    };
  }
  return null;
}

export function ossToolbarCategories(items: OssItem[]) {
  const present = new Set(items.map((i) => i.category));
  return [
    { id: 'all', label: '全部方向', count: items.length },
    ...OSS_CATEGORY_ORDER.filter((c) => present.has(c)).map((c) => ({
      id: c,
      label: OSS_CATEGORY_LABELS[c],
      count: items.filter((i) => i.category === c).length,
    })),
  ];
}

export function annotateOssTags(
  items: OssItem[],
): OssItem[] {
  const weekMs = 7 * 86_400_000;
  const now = Date.now();
  const out = items.map((item) => {
    const created = item.createdAt ? Date.parse(item.createdAt) : NaN;
    const isNew =
      item.isNew || (Number.isFinite(created) && now - created <= weekMs);
    const ageDays = Number.isFinite(created) ? Math.max((now - created) / 86_400_000, 1) : null;
    const starsWeekly =
      item.starsWeekly != null
        ? item.starsWeekly
        : ageDays
          ? Math.round(item.stars / ageDays * 7)
          : null;
    return { ...item, isNew, starsWeekly, isFastest: Boolean(item.isFastest) };
  });
  const byCat = new Map<string, OssItem[]>();
  for (const item of out) {
    if (!byCat.has(item.category)) byCat.set(item.category, []);
    byCat.get(item.category)!.push(item);
  }
  const already = out.some((i) => i.isFastest);
  if (!already) {
    for (const list of byCat.values()) {
      const scored = [...list].sort((a, b) => ossRiseScore(b) - ossRiseScore(a));
      if (scored[0] && ossRiseScore(scored[0]) > 0) {
        scored[0].isFastest = true;
      }
    }
  }
  return out;
}

export function buildOssItems(
  frameworks: Array<{
    repo: string;
    name: string;
    stars?: number;
    summary?: string;
    category?: string;
    heat_score?: number;
    sources?: string[];
    rank?: number;
    created_at?: string;
    stars_delta?: number | null;
    stars_weekly?: number | null;
    is_new?: boolean;
    is_fastest?: boolean;
    trending_weekly_rank?: number | null;
  }>,
): OssItem[] {
  const items = frameworks
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
        heatScore: Number(fw.heat_score || 0),
        sources: Array.isArray(fw.sources) ? fw.sources.map(String) : [],
        rank: fw.rank != null ? Number(fw.rank) : undefined,
        createdAt: fw.created_at ? String(fw.created_at) : undefined,
        starsDelta: fw.stars_delta != null ? Number(fw.stars_delta) : null,
        starsWeekly: fw.stars_weekly != null ? Number(fw.stars_weekly) : null,
        isNew: Boolean(fw.is_new),
        isFastest: Boolean(fw.is_fastest),
        trendingWeeklyRank: fw.trending_weekly_rank != null ? Number(fw.trending_weekly_rank) : null,
      };
    })
    .sort((a, b) => {
      const oa = OSS_CATEGORY_ORDER.indexOf(a.category as (typeof OSS_CATEGORY_ORDER)[number]);
      const ob = OSS_CATEGORY_ORDER.indexOf(b.category as (typeof OSS_CATEGORY_ORDER)[number]);
      const ia = oa === -1 ? 999 : oa;
      const ib = ob === -1 ? 999 : ob;
      if (ia !== ib) return ia - ib;
      if ((a.rank || 99) !== (b.rank || 99)) return (a.rank || 99) - (b.rank || 99);
      if (b.heatScore !== a.heatScore) return b.heatScore - a.heatScore;
      return b.stars - a.stars;
    });
  return annotateOssTags(items);
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

export const COURSE_TRACK_SLUGS: Record<string, string> = {
  入门: 'intro',
  机器学习: 'ml',
  深度学习: 'dl',
  'LLM 大模型': 'llm',
  'AI Agent': 'agent',
};

export function courseTrackSlug(track: string) {
  return COURSE_TRACK_SLUGS[track] || String(track || '').toLowerCase().replace(/\s+/g, '-');
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
