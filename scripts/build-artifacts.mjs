#!/usr/bin/env node
/** 从 data/*.json 生成运行时 JSON（search-index、prompts、tutorials、analytics-config） */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const BRAND = 'Bio AI Lab';

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
}

function writeOut(outDir, name, data) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function classifyPromptCategory(scenarios, title, content) {
  const blob = `${title}\n${content}`;
  if (['论文', '科研', '文献', '研究方法论', '学术'].some((k) => blob.includes(k))) return 'research';
  if (['市场', '调研', '行业', '竞品', 'Deep Research'].some((k) => blob.includes(k))) return 'market';
  if (['数据', 'Excel', '表格', '图表', 'SQL', '分析'].some((k) => blob.includes(k))) return 'data';
  if (scenarios.includes('coding')) return 'coding';
  if (scenarios.includes('productivity')) return 'productivity';
  if (scenarios.includes('writing')) return 'writing';
  if (scenarios.includes('research')) return 'market';
  return 'writing';
}

function buildPromptsPayload(cases, promptsMeta) {
  const prompts = [];
  for (const [idx, caseItem] of (cases.cases || []).entries()) {
    const caseAnchor = `case-${idx + 1}`;
    let stepNo = 0;
    for (const step of caseItem.steps || []) {
      for (const block of step.blocks || []) {
        if (block.type !== 'prompt') continue;
        stepNo += 1;
        const content = (block.content || '').trim();
        prompts.push({
          id: `${caseItem.tool}-${idx + 1}-${stepNo}`,
          title: step.title || caseItem.title,
          category: classifyPromptCategory(caseItem.scenarios || [], caseItem.title, content),
          tool: caseItem.tool,
          case_title: caseItem.title,
          content,
          case_anchor: caseAnchor,
          tags: [...new Set([...(caseItem.tags || []), ...(caseItem.scenarios || [])])],
        });
      }
    }
  }
  return { ...promptsMeta, count: prompts.length, prompts };
}

function buildTutorialsPayload(cases, tools) {
  const toolNames = Object.fromEntries(tools.map((t) => [t.id, t.name]));
  const tutorials = (cases.cases || []).map((caseItem, idx) => {
    const promptCount = (caseItem.steps || []).reduce(
      (n, step) => n + (step.blocks || []).filter((b) => b.type === 'prompt').length,
      0,
    );
    return {
      id: `case-${idx + 1}`,
      tool: caseItem.tool,
      tool_name: toolNames[caseItem.tool] || caseItem.tool,
      title: caseItem.title,
      summary: caseItem.summary || '',
      level: caseItem.level || '',
      duration: caseItem.duration || '',
      scenarios: caseItem.scenarios || [],
      prompt_count: promptCount,
    };
  });
  const header = readJson('tutorials.json').header;
  return { header, count: tutorials.length, tutorials };
}

function buildSearchIndex(site, tools, cases, compares, promptsPayload) {
  const items = [];
  for (const t of tools) {
    const kw = [t.id, t.name, t.description, ...(t.features || []).map((f) => f.title)].filter(Boolean).join(' ');
    items.push({ label: `${t.name} 教程`, section: t.section_id, keywords: kw });
    items.push({ label: `${t.name} 独立页`, url: `tools/${t.id}.html`, keywords: kw });
  }
  // 主路径仅四块：工具 / 开源 / 新闻 / 视频（+ 排行对比）；不再索引 Prompt/案例/创作/学习路线
  void cases;
  void promptsPayload;
  items.push({ label: '每日视频', section: 'section-videos', keywords: '视频 youtube bilibili 教程 每日 100天 Top10 30天 24小时 六类' });
  items.push({ label: 'AI 新闻', section: 'section-news', keywords: 'AI新闻 OpenAI Anthropic DeepMind Meta NVIDIA HuggingFace arXiv GitHub Trending 机器之心 量子位 新智元 智源 每周' });
  items.push({ label: 'GitHub 开源精选', section: 'section-oss', keywords: '开源 GitHub Stars Agent LLM 本地大模型 AI绘画 多模态 机器学习框架' });
  items.push({ label: 'AI 工具排行榜', url: 'ai-tools-ranking.html', keywords: '排行榜 ranking ChatGPT Claude Cursor DeepSeek' });
  items.push({ label: '本周 AI 热点', url: 'news/daily-ai-news.html', keywords: 'AI新闻 热点 OpenAI Anthropic arXiv 每周' });
  items.push({ label: '编程 AI 工具', section: 'section-home', keywords: '编程 写代码 开发 Cursor Copilot Codex' });
  items.push({ label: '写作翻译办公', section: 'section-home', keywords: '写作 翻译 办公 科研 视频生成 ChatGPT Claude 豆包' });
  items.push({ label: '免费 AI 工具', section: 'section-home', keywords: '免费 DeepSeek 豆包 Kimi' });
  for (const cmp of compares) {
    items.push({ label: cmp.h1 || cmp.title, url: `compare/${cmp.slug}.html`, keywords: cmp.search_keywords || cmp.title });
  }
  for (const g of site.compare_guides || []) {
    if (!items.some((x) => x.url === g.href)) {
      items.push({ label: g.title, url: g.href, keywords: g.title });
    }
  }
  return items;
}

function buildAnalyticsConfig() {
  const raw = fs.existsSync(path.join(DATA, 'analytics.json'))
    ? readJson('analytics.json')
    : {};
  return {
    ga_measurement_id: (raw.ga_measurement_id || '').trim(),
    clarity_project_id: (raw.clarity_project_id || '').trim(),
    track_engagement: raw.track_engagement !== false,
  };
}

export function buildArtifacts(outDir = path.join(ROOT, 'public')) {
  const site = readJson('site.json');
  const tools = readJson('tools.json');
  const cases = readJson('cases.json');
  const compares = readJson('compares.json');
  const promptsMeta = readJson('prompts.json');

  const promptsPayload = buildPromptsPayload(cases, promptsMeta);
  const tutorialsPayload = buildTutorialsPayload(cases, tools);
  const searchIndex = buildSearchIndex(site, tools, cases, compares, promptsPayload);
  const analyticsCfg = buildAnalyticsConfig();

  writeOut(outDir, 'prompts.json', promptsPayload);
  writeOut(outDir, 'tutorials.json', tutorialsPayload);
  writeOut(outDir, 'search-index.json', searchIndex);
  writeOut(outDir, 'analytics-config.json', analyticsCfg);

  const ossSrc = path.join(DATA, 'oss-projects.json');
  if (fs.existsSync(ossSrc)) {
    fs.copyFileSync(ossSrc, path.join(outDir, 'oss-projects.json'));
  }

  console.log(`✓ artifacts → ${outDir}`);
  console.log(`  prompts.json (${promptsPayload.count}) · tutorials.json (${tutorialsPayload.count}) · search-index.json (${searchIndex.length})`);
  return { promptsPayload, tutorialsPayload, searchIndex };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] || path.join(ROOT, 'public');
  buildArtifacts(out);
}
