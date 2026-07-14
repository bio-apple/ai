#!/usr/bin/env node
/**
 * E2E 专用静态服：把 dist 挂到 /ai/，避免依赖 astro preview。
 * 用法：node scripts/e2e-static-server.mjs [port]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'dist');
const BASE = '/ai';
const PORT = Number(process.env.E2E_PORT || process.argv[2] || 8766);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = decoded.replace(/^\/+/, '');
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(root)) return null;
  return full;
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  if (url === '/' || url === '') {
    send(res, 302, '', { Location: `${BASE}/` });
    return;
  }
  if (!url.startsWith(`${BASE}/`) && url !== BASE) {
    send(res, 404, 'Not Found');
    return;
  }
  let rel = url.slice(BASE.length) || '/';
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel.endsWith('/')) rel += 'index.html';

  let filePath = safeJoin(ROOT, rel);
  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // pretty fallbacks
    const asHtml = `${filePath}.html`;
    if (fs.existsSync(asHtml)) filePath = asHtml;
    else {
      send(res, 404, `Not Found: ${rel}`);
      return;
    }
  }
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(filePath)
    .on('error', () => {
      res.destroy();
    })
    .pipe(res);
});

if (!fs.existsSync(ROOT)) {
  console.error(`dist missing: ${ROOT} — run npm run build first`);
  process.exit(1);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`e2e-static-server ready http://127.0.0.1:${PORT}${BASE}/`);
});
