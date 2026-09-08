import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatRelativeTime,
  newsSourceMeta,
  ossAudienceTags,
  ossHeatLabel,
  rankingPickReason,
} from '../../lib/content-display.js';

test('formatRelativeTime uses hours/days then calendar date', () => {
  const now = Date.parse('2026-09-08T13:00:00+08:00');
  assert.equal(formatRelativeTime('2026-09-08T11:00:00+08:00', now), '2小时前');
  assert.equal(formatRelativeTime('2026-09-07T13:00:00+08:00', now), '1天前');
  assert.equal(formatRelativeTime('2026-08-29T13:00:00+08:00', now), '10天前');
  assert.equal(formatRelativeTime(''), '');
});

test('newsSourceMeta keeps source off the title and maps a mark', () => {
  const qbit = newsSourceMeta('量子位');
  assert.equal(qbit.key, 'qbit');
  assert.equal(qbit.mark, '量');
  assert.equal(qbit.label, '量子位');
  assert.match(qbit.logo, /source-logos\/qbit\.svg/);
  assert.equal(newsSourceMeta(''), null);
  const unknown = newsSourceMeta('Unknown Blog');
  assert.equal(unknown.logo, '');
  assert.equal(unknown.mark, 'U');
});

test('ossAudienceTags and heat label make heating concrete', () => {
  const tags = ossAudienceTags({
    category: 'coding_agent',
    stars: 252684,
    isNew: false,
  });
  assert.ok(!tags.includes('Coding Agent'));
  assert.ok(tags.includes('写代码'));
  assert.ok(tags.includes('社区主流'));
  const heat = ossHeatLabel({
    trendingDailyRank: 6,
    heatScore: 205,
    sources: ['trending:daily'],
  });
  assert.match(heat.text, /日榜 #6/);
  assert.match(heat.text, /热度 205/);
});

test('rankingPickReason covers known tools and board fallback', () => {
  assert.equal(rankingPickReason('Cursor', 'aicpb'), '适合跨文件 Agent 改代码');
  assert.equal(rankingPickReason('DeepSeek', 'aicpb'), '性价比高，国内访问稳');
  assert.match(rankingPickReason('claude-fable-5', 'lmsys-text'), /盲测|对话质量/);
  assert.match(rankingPickReason('Unknown Model X', 'artificial-analysis'), /基准|选型/);
});
