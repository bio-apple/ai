/**
 * 与 videos.js `withCategoryFallback` 同算法，供构建产物与单测复用。
 */

const LEGACY_CATEGORY_ALIASES = {
  youtube_recent_100d: ['youtube_recent_100d', 'youtube_top_views'],
  bilibili_recent_100d: ['bilibili_recent_100d', 'bilibili_top_views'],
};

/** 与 config/video-fetch.yaml 对齐；回填/展示时丢弃未达门槛的历史脏数据 */
export const CATEGORY_MIN_VIEWS = {
  youtube_recent_3d: 1_000_000,
  youtube_recent_30d: 1_000_000,
  youtube_recent_100d: 1_000_001,
  youtube_top_views: 1_000_001,
  bilibili_recent_3d: 1_000_000,
  bilibili_recent_30d: 1_000_000,
  bilibili_recent_100d: 1_000_001,
  bilibili_top_views: 1_000_001,
};

export const CATEGORY_MAX_DAYS = {
  youtube_recent_3d: 3,
  youtube_recent_30d: 30,
  youtube_recent_100d: 100,
  youtube_top_views: 100,
  bilibili_recent_3d: 3,
  bilibili_recent_30d: 30,
  bilibili_recent_100d: 100,
  bilibili_top_views: 100,
};

export function categoryMinViews(key) {
  if (Object.prototype.hasOwnProperty.call(CATEGORY_MIN_VIEWS, key)) {
    return CATEGORY_MIN_VIEWS[key];
  }
  if (/_recent_3d$|_recent_30d$/.test(key)) return 1_000_000;
  if (/_recent_100d$|_top_views$/.test(key)) return 1_000_001;
  return 0;
}

export function categoryMaxDays(key) {
  if (Object.prototype.hasOwnProperty.call(CATEGORY_MAX_DAYS, key)) {
    return CATEGORY_MAX_DAYS[key];
  }
  if (/_recent_3d$/.test(key)) return 3;
  if (/_recent_30d$/.test(key)) return 30;
  if (/_recent_100d$|_top_views$/.test(key)) return 100;
  return null;
}

function intViews(v) {
  return Number.parseInt(String(v?.views ?? 0), 10) || 0;
}

function publishedMs(v) {
  const raw = v?.published_at;
  if (!raw) return NaN;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : NaN;
}

export function filterVideosForCategory(videos, key, nowMs = Date.now()) {
  const min = categoryMinViews(key);
  const days = categoryMaxDays(key);
  const maxAgeMs = days == null ? null : days * 24 * 60 * 60 * 1000;
  return (videos || []).filter((v) => {
    if (intViews(v) < min) return false;
    if (maxAgeMs == null) return true;
    const t = publishedMs(v);
    if (!Number.isFinite(t)) return false;
    return nowMs - t <= maxAgeMs;
  });
}

/** @deprecated use filterVideosForCategory */
export function filterVideosByMinViews(videos, key) {
  return filterVideosForCategory(videos, key);
}

function categoryVideosFromBatch(cats, key) {
  for (const alias of LEGACY_CATEGORY_ALIASES[key] || [key]) {
    const videos = filterVideosForCategory(cats?.[alias]?.videos || [], key);
    if (videos.length) return videos;
  }
  return filterVideosForCategory(cats?.[key]?.videos || [], key);
}

/** @param {Array<Record<string, unknown>> | null | undefined} batches */
export function withCategoryFallback(batches) {
  if (!Array.isArray(batches) || !batches.length) return null;
  const latest = batches[0];
  if (!latest?.categories) return latest;

  const categories = {};
  let fallbackCount = 0;
  for (const key of Object.keys(latest.categories)) {
    const cat = latest.categories[key] || {};
    const videos = filterVideosForCategory(cat.videos || [], key);
    if (videos.length) {
      categories[key] = { ...cat, videos: videos.map((v) => ({ ...v })) };
      continue;
    }
    let filled = null;
    let fromDate = null;
    for (let i = 1; i < batches.length; i += 1) {
      const prevVideos = categoryVideosFromBatch(batches[i]?.categories || {}, key);
      if (prevVideos.length) {
        filled = prevVideos;
        fromDate = batches[i].date || null;
        break;
      }
    }
    if (filled) {
      fallbackCount += 1;
      categories[key] = {
        ...cat,
        videos: filled.map((v) => ({ ...v })),
        fallback_from: fromDate,
      };
    } else {
      categories[key] = { ...cat, videos: [] };
    }
  }
  return { ...latest, categories, _fallback_count: fallbackCount };
}
