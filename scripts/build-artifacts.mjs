#!/usr/bin/env node
/** 从 data/*.json 生成运行时 JSON（search-index、prompts、tutorials、analytics-config） */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
}

function writeOut(outDir, name, data) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function classifyPromptCategory(scenarios, title, content) {
  const blob = `${title}\n${content}`;
  if (['论文', '科研', '文献', '研究方法论', '学术'].some((k) => blob.includes(k)))
    return 'research';
  if (['市场', '调研', '行业', '竞品', 'Deep Research'].some((k) => blob.includes(k)))
    return 'market';
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
    const kw = [t.id, t.name, t.description, ...(t.features || []).map((f) => f.title)]
      .filter(Boolean)
      .join(' ');
    items.push({ label: `${t.name} 教程`, type: '工具', section: t.section_id, keywords: kw });
    items.push({
      label: `${t.name} 独立页`,
      type: '工具',
      url: `tools/${t.id}.html`,
      keywords: kw,
    });
  }
  items.push({
    label: '每日视频',
    type: '频道',
    section: 'section-videos',
    keywords: '视频 youtube bilibili 教程 每日 100天 Top10 30天 24小时 六类',
  });
  items.push({
    label: 'AI 新闻',
    type: '频道',
    section: 'section-news',
    keywords:
      'AI新闻 OpenAI Anthropic DeepMind Meta NVIDIA HuggingFace arXiv GitHub Trending 机器之心 量子位 新智元 智源 每周',
  });
  items.push({
    label: 'GitHub 开源精选',
    type: '频道',
    section: 'section-oss',
    keywords: '开源 GitHub Stars Agent LLM 本地大模型 AI绘画 多模态 机器学习框架',
  });
  items.push({
    label: '实战案例库',
    type: '案例',
    url: 'cases/index.html',
    keywords: '案例 教程 实战 Prompt 工作流',
  });
  items.push({
    label: 'Prompt 提示词库',
    type: 'Prompt',
    url: 'prompts/library.html',
    keywords: 'Prompt 提示词 模板 写作 编程 科研',
  });
  items.push({
    label: 'AI 工具中心',
    type: '导航',
    url: 'tools/hub.html',
    keywords:
      '工具中心 对比表 AICPB AI产品榜 排行 ChatGPT New Bing Gemini Claude DeepSeek 豆包 Kimi Copilot cursor 即梦 官方教程',
  });
  items.push({
    label: 'AI 学习路线图',
    type: '学习',
    url: 'ai-learning-roadmap.html',
    keywords: '学习路线 入门 进阶 roadmap',
  });
  items.push({
    label: '零基础入门指南',
    type: '学习',
    url: 'guides/beginner.html',
    keywords: '零基础 入门 指南',
  });
  items.push({
    label: '进阶应用指南',
    type: '学习',
    url: 'guides/advanced.html',
    keywords: '进阶 编程 API 工作流',
  });
  items.push({
    label: 'AI 工具排行榜',
    type: '导航',
    url: 'ai-tools-ranking.html',
    keywords: '排行榜 ranking ChatGPT Claude Cursor DeepSeek',
  });
  items.push({
    label: '一周内 AI 热点',
    type: '频道',
    url: 'news/daily-ai-news.html',
    keywords: 'AI新闻 热点 一周内 每天更新 OpenAI Anthropic arXiv',
  });
  items.push({
    label: '编程 AI 工具',
    type: '场景',
    section: 'section-home',
    keywords: '编程 写代码 开发 Cursor Copilot Codex',
    anchor: 'home-tools',
  });
  items.push({
    label: '写作翻译办公',
    type: '场景',
    section: 'section-home',
    keywords: '写作 翻译 办公 科研 视频生成 ChatGPT Claude 豆包',
    anchor: 'home-recommend',
  });
  items.push({
    label: '免费 AI 工具',
    type: '场景',
    section: 'section-home',
    keywords: '免费 DeepSeek 豆包 Kimi',
    anchor: 'home-tools',
  });
  items.push({
    label: '今日 AI 简报',
    type: '简报',
    section: 'section-home',
    keywords: 'AI Daily 简报 模型 GitHub 新闻',
    anchor: 'home-daily',
  });
  items.push({
    label: 'AI 推荐助手',
    type: '推荐',
    section: 'section-home',
    keywords: '推荐助手 场景 选型',
    anchor: 'home-recommend',
  });

  for (const [idx, caseItem] of (cases.cases || []).entries()) {
    const anchor = `case-${idx + 1}`;
    items.push({
      label: caseItem.title,
      type: '案例',
      url: `cases/index.html#${anchor}`,
      keywords: [
        caseItem.title,
        caseItem.summary,
        caseItem.tool,
        ...(caseItem.tags || []),
        ...(caseItem.scenarios || []),
      ]
        .filter(Boolean)
        .join(' '),
    });
  }
  for (const p of promptsPayload.prompts || []) {
    items.push({
      label: `Prompt：${p.title}`,
      type: 'Prompt',
      url: `prompts/library.html#${p.id}`,
      keywords: [p.title, p.content, p.tool, p.category, ...(p.tags || [])]
        .filter(Boolean)
        .join(' ')
        .slice(0, 400),
    });
  }
  for (const cmp of compares) {
    items.push({
      label: cmp.h1 || cmp.title,
      type: '对比',
      url: `compare/${cmp.slug}.html`,
      keywords: cmp.search_keywords || cmp.title,
    });
  }
  return items;
}

function appendHubBoardSearchItems(items) {
  const featured = [
    'ChatGPT',
    'New Bing',
    'Gemini',
    'Claude｜Anthropic',
    'DeepSeek',
    '豆包｜抖音',
    'Kimi｜月之暗面',
    'Github Copilot',
    'cursor',
    '即梦 AI｜剪映',
  ];
  items.push({
    label: '工具中心：对比表',
    type: '导航',
    url: 'tools/hub.html#hub-compare',
    keywords: ['对比表', '选型', ...featured, '官方教程'].join(' '),
  });
  items.push({
    label: '工具中心：AICPB 排行',
    type: '导航',
    url: 'tools/hub.html#hub-ranking',
    keywords: 'AICPB AI产品榜 排行 Global China Vibe Coding Video PPT Top5',
  });
  for (const name of featured) {
    items.push({
      label: name,
      type: '工具',
      url: 'tools/hub.html#hub-compare',
      keywords: [name, '工具中心', '对比表', '官方教程'].join(' '),
    });
  }
}

function buildRecommendRules(site) {
  const options = (site.ai_picker?.options || []).map((opt) => ({
    id: opt.id,
    label: opt.label,
    tools: opt.tools || [],
    keywords: opt.keywords || [],
    guide: opt.guide || null,
    path_title: opt.path_title || null,
    steps: opt.steps || [],
  }));
  let relations = {};
  try {
    relations = readJson('tool-relations.json');
  } catch {
    relations = {};
  }
  return {
    schema_version: 1,
    updated_from: 'data/site.json',
    options,
    relations,
    fallback: site.recommend_fallback || {
      tools: ['chatgpt', 'claude', 'cursor'],
      guide: 'guides/beginner.html',
      path_title: '零基础入门',
      steps: [],
    },
  };
}

function buildAnalyticsConfig() {
  const raw = fs.existsSync(path.join(DATA, 'analytics.json')) ? readJson('analytics.json') : {};
  // Secrets / CI：优先环境变量，避免把 Measurement ID 写进仓库
  const ga = (
    process.env.GA_MEASUREMENT_ID ||
    process.env.PUBLIC_GA_MEASUREMENT_ID ||
    raw.ga_measurement_id ||
    ''
  ).trim();
  const clarity = (
    process.env.CLARITY_PROJECT_ID ||
    process.env.PUBLIC_CLARITY_PROJECT_ID ||
    raw.clarity_project_id ||
    ''
  ).trim();
  const umamiScript = (
    process.env.UMAMI_SCRIPT_URL ||
    process.env.PUBLIC_UMAMI_SCRIPT_URL ||
    raw.umami_script_url ||
    ''
  ).trim();
  const umamiId = (
    process.env.UMAMI_WEBSITE_ID ||
    process.env.PUBLIC_UMAMI_WEBSITE_ID ||
    raw.umami_website_id ||
    ''
  ).trim();
  const cfBeacon = (
    process.env.CLOUDFLARE_BEACON_TOKEN ||
    process.env.PUBLIC_CLOUDFLARE_BEACON_TOKEN ||
    raw.cloudflare_beacon_token ||
    ''
  ).trim();
  const privacyOn = Boolean((umamiScript && umamiId) || cfBeacon);
  const cfg = {
    ga_measurement_id: ga,
    clarity_project_id: clarity,
    umami_script_url: umamiScript,
    umami_website_id: umamiId,
    cloudflare_beacon_token: cfBeacon,
    track_engagement: raw.track_engagement !== false,
    analytics_enabled: Boolean(ga || clarity || privacyOn),
  };
  if (!cfg.analytics_enabled) {
    console.warn(
      '⚠ analytics: 未配置 Umami / Cloudflare / GA / Clarity（Secrets 或 data/analytics.json）。本地仍可用 window.__clickStats。',
    );
  } else {
    console.log(
      `✓ analytics → Umami=${umamiScript && umamiId ? 'on' : 'off'} CF=${cfBeacon ? 'on' : 'off'} GA=${ga ? 'on' : 'off'} Clarity=${clarity ? 'on' : 'off'}`,
    );
  }
  return cfg;
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
  appendHubBoardSearchItems(searchIndex);
  const recommendRules = buildRecommendRules(site);
  const analyticsCfg = buildAnalyticsConfig();

  writeOut(outDir, 'prompts.json', promptsPayload);
  writeOut(outDir, 'tutorials.json', tutorialsPayload);
  writeOut(outDir, 'search-index.json', searchIndex);
  writeOut(outDir, 'recommend-rules.json', recommendRules);
  writeOut(outDir, 'analytics-config.json', analyticsCfg);

  const engagementSrc = path.join(DATA, 'engagement.json');
  if (fs.existsSync(engagementSrc)) {
    fs.copyFileSync(engagementSrc, path.join(outDir, 'engagement.json'));
  }

  const ossSrc = path.join(DATA, 'oss-projects.json');
  if (fs.existsSync(ossSrc)) {
    fs.copyFileSync(ossSrc, path.join(outDir, 'oss-projects.json'));
  }

  console.log(`✓ artifacts → ${outDir}`);
  console.log(
    `  prompts.json (${promptsPayload.count}) · tutorials.json (${tutorialsPayload.count}) · search-index.json (${searchIndex.length}) · recommend-rules.json (${recommendRules.options.length})`,
  );
  return { promptsPayload, tutorialsPayload, searchIndex, recommendRules };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] || path.join(ROOT, 'public');
  buildArtifacts(out);
}
