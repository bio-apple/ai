#!/usr/bin/env node
/**
 * 扫描 content/local-deploy/*.md → data/local-deploy-guides.json
 * 放入 Markdown 后执行 npm run build（或 prebuild）即可出现在「实战案例」专区。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'local-deploy');
const OUT_FILE = path.join(ROOT, 'data', 'local-deploy-guides.json');

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 极简 YAML frontmatter（仅支持本目录约定字段） */
export function parseFrontmatter(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '');
  if (!text.startsWith('---')) {
    return { meta: {}, body: text };
  }
  const end = text.indexOf('\n---', 3);
  if (end < 0) {
    return { meta: {}, body: text };
  }
  const fm = text.slice(3, end).replace(/^\r?\n/, '');
  const body = text.slice(end + 4).replace(/^\r?\n/, '');
  const meta = {};
  let listKey = null;
  for (const line of fm.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && listKey) {
      if (!Array.isArray(meta[listKey])) meta[listKey] = [];
      meta[listKey].push(stripQuotes(listItem[1].trim()));
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    listKey = null;
    const key = m[1];
    let val = m[2].trim();
    if (val === '' || val === '|' || val === '>') {
      listKey = key;
      meta[key] = [];
      continue;
    }
    if (val === 'true' || val === 'false') {
      meta[key] = val === 'true';
      continue;
    }
    if (/^-?\d+(\.\d+)?$/.test(val)) {
      meta[key] = Number(val);
      continue;
    }
    if (val.startsWith('[') && val.endsWith(']')) {
      meta[key] = val
        .slice(1, -1)
        .split(',')
        .map((x) => stripQuotes(x.trim()))
        .filter(Boolean);
      continue;
    }
    meta[key] = stripQuotes(val);
  }
  return { meta, body };
}

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function inlineMarkdown(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return s;
}

/** 支持：标题、段落、围栏代码、无序/有序列表、引用 */
export function markdownToHtml(md) {
  const lines = String(md || '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const out = [];
  let i = 0;
  let inCode = false;
  let codeLang = '';
  let codeLines = [];
  let listType = null; // ul | ol
  let listItems = [];

  const flushList = () => {
    if (!listType) return;
    out.push(`<${listType}>`);
    for (const item of listItems) {
      out.push(`<li>${inlineMarkdown(item)}</li>`);
    }
    out.push(`</${listType}>`);
    listType = null;
    listItems = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    if (inCode) {
      if (line.startsWith('```')) {
        out.push(
          `<pre class="local-guide-code"><code class="language-${escapeHtml(codeLang || 'text')}">${escapeHtml(codeLines.join('\n'))}</code></pre>`,
        );
        inCode = false;
        codeLang = '';
        codeLines = [];
      } else {
        codeLines.push(line);
      }
      i += 1;
      continue;
    }

    const fence = line.match(/^```([\w-]*)\s*$/);
    if (fence) {
      flushList();
      inCode = true;
      codeLang = fence[1] || 'text';
      codeLines = [];
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = Math.min(heading[1].length + 2, 6); // # → h3（专区内）
      out.push(
        `<h${level} class="local-guide-heading">${inlineMarkdown(heading[2].trim())}</h${level}>`,
      );
      i += 1;
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushList();
      const parts = [quote[1]];
      i += 1;
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        parts.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      out.push(
        `<blockquote class="local-guide-notes"><p>${inlineMarkdown(parts.join(' '))}</p></blockquote>`,
      );
      continue;
    }

    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(ul[1]);
      i += 1;
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(ol[1]);
      i += 1;
      continue;
    }

    if (!line.trim()) {
      flushList();
      i += 1;
      continue;
    }

    flushList();
    const para = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|```|[-*]\s|\d+\.\s|>)/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    out.push(`<p class="local-guide-body">${inlineMarkdown(para.join(' ').trim())}</p>`);
  }

  flushList();
  if (inCode) {
    out.push(
      `<pre class="local-guide-code"><code class="language-${escapeHtml(codeLang || 'text')}">${escapeHtml(codeLines.join('\n'))}</code></pre>`,
    );
  }
  return out.join('\n');
}

function slugFromFilename(name) {
  return name
    .replace(/\.md$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff_-]+/g, '-');
}

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString().slice(0, 10);
  }
  const s = String(value || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function fileCreatedDate(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return normalizeDate(stat.birthtime || stat.mtime) || normalizeDate(stat.mtime);
  } catch {
    return '';
  }
}

export function buildGuideFromMarkdown(
  filename,
  raw,
  sourcePrefix = 'content/local-deploy',
  filePath = '',
) {
  const { meta, body } = parseFrontmatter(raw);
  if (meta.draft === true) return null;
  const id = String(meta.id || slugFromFilename(filename)).trim();
  if (!id) return null;
  const title = String(meta.title || id).trim();
  let stack = meta.stack;
  if (typeof stack === 'string') {
    stack = stack
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(stack)) stack = undefined;
  return {
    id,
    title,
    lead: meta.lead ? String(meta.lead) : undefined,
    created_at: normalizeDate(meta.created_at) || fileCreatedDate(filePath) || undefined,
    audience: meta.audience ? String(meta.audience) : undefined,
    stack,
    order: typeof meta.order === 'number' ? meta.order : 100,
    source: `${sourcePrefix}/${filename}`,
    html: markdownToHtml(body),
  };
}

export function scanGuidesInDir(dir = CONTENT_DIR, sourcePrefix = 'content/local-deploy') {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return [];
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort((a, b) => a.localeCompare(b, 'en'));
  const guides = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const guide = buildGuideFromMarkdown(file, raw, sourcePrefix, filePath);
    if (guide) guides.push(guide);
  }
  guides.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return guides;
}

/** @deprecated 使用 scanGuidesInDir */
export function scanLocalDeployGuides(dir = CONTENT_DIR) {
  return scanGuidesInDir(dir, 'content/local-deploy');
}

export function writeGuidesFromDir({
  dir,
  outFile,
  source_dir: sourceDir = 'content/local-deploy',
}) {
  const guides = scanGuidesInDir(dir, sourceDir);
  const payload = {
    generated_at: new Date().toISOString(),
    source_dir: sourceDir,
    guides,
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

export function writeLocalDeployGuides(outFile = OUT_FILE, dir = CONTENT_DIR) {
  return writeGuidesFromDir({
    dir,
    outFile,
    source_dir: 'content/local-deploy',
  });
}

export function writeAgentHubGuides(
  outFile = path.join(ROOT, 'data', 'agent-hub-guides.json'),
  dir = path.join(ROOT, 'content', 'agent-hub'),
) {
  return writeGuidesFromDir({
    dir,
    outFile,
    source_dir: 'content/agent-hub',
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const payload = writeLocalDeployGuides();
  console.log(`✓ local-deploy guides → ${OUT_FILE} (${payload.guides.length} 篇)`);
}
