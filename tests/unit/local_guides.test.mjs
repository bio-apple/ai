/**
 * content/local-deploy Markdown → guides JSON
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGuideFromMarkdown,
  markdownToHtml,
  parseFrontmatter,
} from '../../scripts/build-local-guides.mjs';

test('parseFrontmatter reads title order stack draft', () => {
  const { meta, body } = parseFrontmatter(`---
title: Demo
order: 3
stack: [A, B]
draft: false
---

# Hello
`);
  assert.equal(meta.title, 'Demo');
  assert.equal(meta.order, 3);
  assert.deepEqual(meta.stack, ['A', 'B']);
  assert.equal(meta.draft, false);
  assert.match(body, /# Hello/);
});

test('markdownToHtml renders code fence and heading', () => {
  const html = markdownToHtml('## Install\n\n```bash\necho hi\n```\n');
  assert.match(html, /<h4 class="local-guide-heading">Install<\/h4>/);
  assert.match(html, /language-bash/);
  assert.match(html, /echo hi/);
  assert.doesNotMatch(html, /<script/);
});

test('markdownToHtml escapes raw html in text', () => {
  const html = markdownToHtml('Hello <script>alert(1)</script>');
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('draft guides are skipped', () => {
  const g = buildGuideFromMarkdown(
    'draft-demo.md',
    `---
title: Hidden
draft: true
---

body
`,
  );
  assert.equal(g, null);
});

test('buildGuideFromMarkdown uses filename as id', () => {
  const g = buildGuideFromMarkdown(
    'ollama-open-webui.md',
    `---
title: Ollama Guide
lead: demo
---

## Step
`,
  );
  assert.equal(g.id, 'ollama-open-webui');
  assert.equal(g.title, 'Ollama Guide');
  assert.equal(g.lead, 'demo');
  assert.match(g.html, /Step/);
});
