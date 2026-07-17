#!/usr/bin/env node
/** 从 config/csp.json 生成 Content-Security-Policy 字符串（_headers 与 SecurityMeta 共用） */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'csp.json');

/** @param {{ forMeta?: boolean }} [opts] */
export function buildCspPolicy(opts = {}) {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const omit = new Set(opts.forMeta ? cfg.metaOmit || [] : []);
  const parts = [];
  for (const [name, sources] of Object.entries(cfg.directives || {})) {
    if (omit.has(name)) continue;
    if (!sources?.length) {
      parts.push(name);
      continue;
    }
    parts.push(`${name} ${sources.join(' ')}`);
  }
  return parts.join('; ');
}

export function syncHeadersCsp(headersPath = path.join(ROOT, '_headers')) {
  const csp = buildCspPolicy();
  const line = `  Content-Security-Policy: ${csp}`;
  const raw = fs.readFileSync(headersPath, 'utf8');
  if (!/^ {2}Content-Security-Policy:/m.test(raw)) {
    throw new Error('_headers 中未找到 Content-Security-Policy 行');
  }
  const next = raw.replace(/^ {2}Content-Security-Policy:.*$/m, line);
  if (next !== raw) {
    fs.writeFileSync(headersPath, next, 'utf8');
  }
  return csp;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncHeadersCsp();
  console.log('✓ _headers CSP 已同步自 config/csp.json');
}
