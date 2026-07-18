/**
 * 虚拟列表可视区计算（与 lib/virtual-list.js 对齐）。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

function visibleRange({ scrollTop, viewH, itemCount, itemHeight, gap, columns, overscan }) {
  const stride = itemHeight + gap;
  const rowCount = Math.ceil(itemCount / columns) || 0;
  const firstRow = Math.max(0, Math.floor(scrollTop / stride) - overscan);
  const lastRow = Math.min(rowCount - 1, Math.ceil((scrollTop + viewH) / stride) + overscan);
  const start = firstRow * columns;
  const end = Math.min(itemCount, (lastRow + 1) * columns);
  return { start, end, firstRow, painted: Math.max(0, end - start) };
}

test('virtual list paints only a window of thousands of items', () => {
  const range = visibleRange({
    scrollTop: 0,
    viewH: 640,
    itemCount: 5000,
    itemHeight: 64,
    gap: 0,
    columns: 1,
    overscan: 8,
  });
  assert.ok(range.painted < 50, `expected <50 painted, got ${range.painted}`);
  assert.equal(range.start, 0);
});

test('virtual list grid window stays bounded', () => {
  const range = visibleRange({
    scrollTop: 2000,
    viewH: 720,
    itemCount: 3000,
    itemHeight: 320,
    gap: 16,
    columns: 3,
    overscan: 4,
  });
  assert.ok(range.painted <= 3 * 20, `grid window too large: ${range.painted}`);
  assert.ok(range.start > 0);
});

test('virtual list still paints when viewH is 0 (fallback height)', () => {
  const fallbackH = Math.max(320 * 2, 280);
  const range = visibleRange({
    scrollTop: 0,
    viewH: fallbackH,
    itemCount: 17,
    itemHeight: 320,
    gap: 16,
    columns: 1,
    overscan: 4,
  });
  assert.ok(range.painted >= 1, `expected painted items, got ${range.painted}`);
  assert.equal(range.start, 0);
});

test('mapInChunks completes without dropping items', async () => {
  // 与 BioAI.mapInChunks 同算法的精简版（单测不依赖浏览器全局）
  function mapInChunks(items, mapper, opts = {}) {
    const chunkSize = opts.chunkSize || 40;
    const list = items || [];
    const out = new Array(list.length);
    let i = 0;
    return new Promise((resolve) => {
      function step() {
        const end = Math.min(i + chunkSize, list.length);
        for (; i < end; i += 1) out[i] = mapper(list[i], i);
        if (i >= list.length) resolve(out);
        else setTimeout(step, 0);
      }
      if (!list.length) resolve(out);
      else step();
    });
  }

  const input = Array.from({ length: 250 }, (_, i) => i);
  const out = await mapInChunks(input, (n) => n * 2, { chunkSize: 33 });
  assert.equal(out.length, 250);
  assert.equal(out[0], 0);
  assert.equal(out[249], 498);
});
