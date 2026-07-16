import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Astro `base`（形如 `/ai/`）统一拼资源与首页链接，避免子页硬编码 `../`。 */
export const BASE = import.meta.env.BASE_URL || '/';

/**
 * 将站点内相对路径拼到 base 上。
 * 已带 base 前缀（`/ai/...` 或 `ai/...`）时不重复拼接。
 */
export function asset(path: string): string {
  const base = BASE.replace(/\/?$/, '/');
  let cleaned = String(path || '').replace(/^\//, '');
  const baseSeg = base.replace(/^\/|\/$/g, '');
  if (baseSeg && (cleaned === baseSeg || cleaned.startsWith(`${baseSeg}/`))) {
    cleaned = cleaned.slice(baseSeg.length).replace(/^\//, '');
  }
  return `${base}${cleaned}`;
}

/** 静态 JS/CSS 加内容哈希，避免 CDN/浏览器继续用旧脚本。 */
export function assetVersioned(path: string): string {
  const href = asset(path);
  const cleaned = String(path || '').replace(/^\//, '');
  const candidates = [join(process.cwd(), cleaned), join(process.cwd(), 'public', cleaned)];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const hash = createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 8);
    return `${href}?v=${hash}`;
  }
  return href;
}

export function homeHref(hash = ''): string {
  return `${asset('index.html')}${hash}`;
}
