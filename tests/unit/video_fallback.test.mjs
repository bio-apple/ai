/**
 * 与 videos.js `withCategoryFallback` 同算法的轻量单测。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

function withCategoryFallback(batches) {
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
      const prevVideos = batches[i]?.categories?.[key]?.videos || [];
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

test('empty latest category falls back to previous batch', () => {
  const out = withCategoryFallback([
    {
      date: '2026-07-14',
      categories: {
        yt_top10: { videos: [] },
        bilibili_top10: { videos: [{ id: 'b1' }] },
      },
    },
    {
      date: '2026-07-13',
      categories: {
        yt_top10: { videos: [{ id: 'y1' }] },
        bilibili_top10: { videos: [{ id: 'b0' }] },
      },
    },
  ]);
  assert.equal(out._fallback_count, 1);
  assert.equal(out.categories.yt_top10.videos[0].id, 'y1');
  assert.equal(out.categories.yt_top10.fallback_from, '2026-07-13');
  assert.equal(out.categories.bilibili_top10.videos[0].id, 'b1');
  assert.equal(out.categories.bilibili_top10.fallback_from, undefined);
});

test('no batches returns null', () => {
  assert.equal(withCategoryFallback([]), null);
});
