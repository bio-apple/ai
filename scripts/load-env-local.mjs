#!/usr/bin/env node
/** 本地开发：从根目录 .env.local 加载环境变量（不提交 Git；见 docs/SECURITY.md） */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnvLocal(root = ROOT) {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return false;

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const loaded = loadEnvLocal();
  console.log(loaded ? '✓ 已加载 .env.local' : '（无 .env.local，跳过）');
}
