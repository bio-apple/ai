#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvLocal } from './load-env-local.mjs';
import { buildArtifacts } from './build-artifacts.mjs';
import { syncPublic } from './sync-public.mjs';
import { bundleCss } from './bundle-css.mjs';
import { syncHeadersCsp } from './csp-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(ROOT, 'public');

loadEnvLocal(ROOT);

syncHeadersCsp(path.join(ROOT, '_headers'));
syncPublic(publicDir);
bundleCss({
  entry: path.join(ROOT, 'style.css'),
  outFile: path.join(publicDir, 'style.css'),
});
buildArtifacts(publicDir);
