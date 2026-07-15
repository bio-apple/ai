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

export function homeHref(hash = ''): string {
  return `${asset('index.html')}${hash}`;
}
