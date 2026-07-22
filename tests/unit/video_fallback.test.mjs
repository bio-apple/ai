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
        youtube_recent_100d: { videos: [] },
        bilibili_recent_100d: { videos: [{ id: 'b1', views: 2_000_000, published_at: '2026-05-01T00:00:00+08:00' }] },
      },
    },
    {
      date: '2026-07-13',
      categories: {
        youtube_recent_100d: { videos: [{ id: 'y1', views: 1_500_000, published_at: '2026-05-01T00:00:00+08:00' }] },
        bilibili_recent_100d: { videos: [{ id: 'b0', views: 1_200_000, published_at: '2026-05-01T00:00:00+08:00' }] },
      },
    },
  ]);
  assert.equal(out._fallback_count, 1);
  assert.equal(out.categories.youtube_recent_100d.videos[0].id, 'y1');
  assert.equal(out.categories.youtube_recent_100d.fallback_from, '2026-07-13');
  assert.equal(out.categories.bilibili_recent_100d.videos[0].id, 'b1');
  assert.equal(out.categories.bilibili_recent_100d.fallback_from, undefined);
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
        bilibili_top_views: { videos: [{ id: 'b1', views: 2_000_000, published_at: '2026-05-01T00:00:00+08:00' }] },
      },
    },
    {
      date: '2026-07-16',
      categories: {
        youtube_top_views: { videos: [] },
        bilibili_top_views: { videos: [{ id: 'b0', views: 1_500_000, published_at: '2026-05-01T00:00:00+08:00' }] },
      },
    },
    {
      date: '2026-07-13',
      categories: {
        youtube_top_views: {
          videos: [
            { id: 'y1', views: 2_000_000, published_at: '2026-05-01T00:00:00+08:00' },
            { id: 'y2', views: 1_500_000, published_at: '2026-05-10T00:00:00+08:00' },
          ],
        },
        bilibili_top_views: { videos: [{ id: 'b-old', views: 1_200_000, published_at: '2026-05-01T00:00:00+08:00' }] },
      },
    },
  ]);
  assert.equal(out.categories.youtube_top_views.videos.length, 2);
  assert.equal(out.categories.youtube_top_views.fallback_from, '2026-07-13');
});

test('fallback skips historical videos below current min views', () => {
  const out = withCategoryFallback([
    {
      date: '2026-07-22',
      categories: {
        bilibili_recent_3d: { videos: [] },
        bilibili_recent_100d: {
          videos: [{ id: 'ok', views: 1_200_000, published_at: '2026-05-01T00:00:00+08:00' }],
        },
      },
    },
    {
      date: '2026-07-21',
      categories: {
        bilibili_recent_3d: {
          videos: [
            { id: 'low1', views: 4065, title: 'RAG', published_at: '2026-07-20T00:00:00+08:00' },
            { id: 'low2', views: 3075, title: '漫剧', published_at: '2026-07-20T00:00:00+08:00' },
            { id: 'low3', views: 2358, title: 'Claude', published_at: '2026-07-20T00:00:00+08:00' },
          ],
        },
        bilibili_recent_100d: { videos: [] },
      },
    },
  ]);
  assert.equal(out.categories.bilibili_recent_3d.videos.length, 0);
  assert.equal(out.categories.bilibili_recent_3d.fallback_from, undefined);
  assert.equal(out.categories.bilibili_recent_100d.videos[0].id, 'ok');
});

test('fallback skips historical videos outside 100d window', () => {
  const out = withCategoryFallback([
    {
      date: '2026-07-22',
      categories: {
        bilibili_recent_100d: { videos: [] },
      },
    },
    {
      date: '2026-07-21',
      categories: {
        bilibili_recent_100d: {
          videos: [
            {
              id: 'ancient',
              views: 18_700_000,
              published_at: '2020-10-01T20:06:22+08:00',
              title: '即梦',
            },
            {
              id: 'ok',
              views: 1_500_000,
              published_at: '2026-05-01T00:00:00+08:00',
              title: '新片',
            },
          ],
        },
      },
    },
  ]);
  assert.deepEqual(
    out.categories.bilibili_recent_100d.videos.map((v) => v.id),
    ['ok'],
  );
});

test('latest dirty low-view videos are stripped by min views', () => {
  const out = withCategoryFallback([
    {
      date: '2026-07-22',
      categories: {
        bilibili_recent_3d: {
          videos: [
            { id: 'low1', views: 4065, published_at: '2026-07-21T00:00:00+08:00' },
            { id: 'hot', views: 1_500_000, published_at: '2026-07-21T00:00:00+08:00' },
          ],
        },
      },
    },
  ]);
  assert.deepEqual(
    out.categories.bilibili_recent_3d.videos.map((v) => v.id),
    ['hot'],
  );
});
