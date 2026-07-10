#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArtifacts } from './build-artifacts.mjs';
import { syncPublic } from './sync-public.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(ROOT, 'public');

syncPublic(publicDir);
buildArtifacts(publicDir);
