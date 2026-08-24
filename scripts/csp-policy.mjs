#!/usr/bin/env node
/** 从 config/csp.json 生成 Content-Security-Policy 字符串（_headers 与 SecurityMeta 共用） */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'csp.json');

function videoSyncConnectOrigins() {
  const origins = new Set();
  const raw = process.env.VIDEO_SYNC_API_URL?.trim() || '';
  if (raw) {
    try {
      origins.add(new URL(raw.replace(/\/$/, '')).origin);
    } catch {
      /* ignore */
    }
  }
  if (!origins.size) {
    try {
      const site = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'),
      );
      const api = site?.video_preview_sync?.api_url?.trim();
      if (api) origins.add(new URL(api.replace(/\/$/, '')).origin);
    } catch {
      /* ignore */
    }
  }
  for (const origin of [...origins]) {
    try {
      const host = new URL(origin).hostname;
      const nested = host.match(/^[^.]+\.([^.]+)\.workers\.dev$/i);
      if (nested) origins.add(`https://*.${nested[1]}.workers.dev`);
    } catch {
      /* ignore */
    }
  }
  return [...origins];
}

/** @param {{ forMeta?: boolean }} [opts] */
export function buildCspPolicy(opts = {}) {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const omit = new Set(opts.forMeta ? cfg.metaOmit || [] : []);
  const extraConnect = videoSyncConnectOrigins();
  const parts = [];
  for (const [name, sources] of Object.entries(cfg.directives || {})) {
    if (omit.has(name)) continue;
    const list = name === 'connect-src' ? [...(sources || []), ...extraConnect] : sources;
    if (!list?.length) {
      parts.push(name);
      continue;
    }
    parts.push(`${name} ${list.join(' ')}`);
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
