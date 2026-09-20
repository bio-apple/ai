import assert from 'node:assert/strict';
import test from 'node:test';
import { isDisplayableVideo } from '../../lib/video-quality.js';

test('rejects adult / jailbreak / mojibake titles even if they mention DeepSeek', () => {
  assert.equal(
    isDisplayableVideo({ title: 'DeepSeek还能生成涉黄内容 1块钱就能买到教程绕过审核' }),
    false,
  );
  assert.equal(
    isDisplayableVideo({
      title: '这视频要是火了我就锟斤拷锟斤拷 | 豆包工作和我的爱恨情仇 | AI教程',
    }),
    false,
  );
});

test('does not treat every Bilibili page as AI-related', () => {
  assert.equal(isDisplayableVideo({ title: '哔哩哔哩每周必看 汽车预售' }), false);
  assert.equal(isDisplayableVideo({ title: 'available now on the main site' }), false);
});

test('keeps real AI tutorials', () => {
  assert.equal(
    isDisplayableVideo({ title: 'Learn 95% of ChatGPT Work in Under 20 Minutes' }),
    true,
  );
  assert.equal(isDisplayableVideo({ title: '当我用豆包工作agent做个背单词游戏' }), true);
});
