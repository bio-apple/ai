/** Astro `base`（形如 `/ai/`）统一拼资源与首页链接，避免子页硬编码 `../`。 */
export const BASE = import.meta.env.BASE_URL || '/';

export function asset(path: string): string {
  const cleaned = path.replace(/^\//, '');
  return `${BASE.replace(/\/?$/, '/')}${cleaned}`;
}

export function homeHref(hash = ''): string {
  return `${asset('index.html')}${hash}`;
}
