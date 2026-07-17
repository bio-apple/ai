/**
 * 与 videos.js `withCategoryFallback` 同算法的轻量单测。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { withCategoryFallback } from '../../scripts/video-fallback.mjs';

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

test('two empty YouTube days still backfill when full history is available at build', () => {
  const out = withCategoryFallback([
    {
      date: '2026-07-17',
      categories: {
        youtube_top_views: { videos: [] },
        bilibili_top_views: { videos: [{ id: 'b1' }] },
      },
    },
    {
      date: '2026-07-16',
      categories: {
        youtube_top_views: { videos: [] },
        bilibili_top_views: { videos: [{ id: 'b0' }] },
      },
    },
    {
      date: '2026-07-13',
      categories: {
        youtube_top_views: { videos: [{ id: 'y1' }, { id: 'y2' }] },
        bilibili_top_views: { videos: [{ id: 'b-old' }] },
      },
    },
  ]);
  assert.equal(out.categories.youtube_top_views.videos.length, 2);
  assert.equal(out.categories.youtube_top_views.fallback_from, '2026-07-13');
});
