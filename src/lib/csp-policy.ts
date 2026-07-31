import cspConfig from '../../config/csp.json';

type CspConfig = {
  directives: Record<string, string[]>;
  metaOmit?: string[];
};

const cfg = cspConfig as CspConfig;

export function buildCspPolicy(opts: { forMeta?: boolean } = {}): string {
  const omit = new Set(opts.forMeta ? cfg.metaOmit || [] : []);
  const parts: string[] = [];
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
