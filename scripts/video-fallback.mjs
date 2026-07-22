/**
 * 与 videos.js `withCategoryFallback` 同算法，供构建产物与单测复用。
 */

const LEGACY_CATEGORY_ALIASES = {};

function categoryVideosFromBatch(cats, key) {
  for (const alias of LEGACY_CATEGORY_ALIASES[key] || [key]) {
    const videos = cats?.[alias]?.videos || [];
    if (videos.length) return videos;
  }
  return cats?.[key]?.videos || [];
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
    const videos = cat.videos || [];
    if (videos.length) {
      categories[key] = { ...cat, videos: [...videos] };
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
