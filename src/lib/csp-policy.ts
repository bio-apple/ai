import cspConfig from '../../config/csp.json';

type CspConfig = {
  directives: Record<string, string[]>;
  metaOmit?: string[];
};

const cfg = cspConfig as CspConfig;

function videoSyncConnectOrigins(): string[] {
  const origins = new Set<string>();
  const raw =
    (typeof process !== 'undefined' && process.env.VIDEO_SYNC_API_URL?.trim()) || '';
  if (raw) {
    try {
      origins.add(new URL(raw.replace(/\/$/, '')).origin);
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

export function buildCspPolicy(opts: { forMeta?: boolean } = {}): string {
  const omit = new Set(opts.forMeta ? cfg.metaOmit || [] : []);
  const extraConnect = videoSyncConnectOrigins();
  const parts: string[] = [];
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
