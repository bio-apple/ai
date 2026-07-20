#!/usr/bin/env node
/** 从 data/*.json 生成运行时 JSON（search-index、recommend-rules、analytics-config） */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withCategoryFallback } from './video-fallback.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
}

function writeOut(outDir, name, data) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readRootJson(name) {
  const p = path.join(ROOT, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function appendNewsSearchItems(items, aiNews, { limit = 50 } = {}) {
  for (const item of (aiNews?.items || []).slice(0, limit)) {
    if (!item?.title) continue;
    const isModel =
      item.category === '新模型发布' ||
      /新模型|模型发布|GPT|Claude|Gemini|DeepSeek/i.test(item.title);
    items.push({
      id: item.id,
      label: item.title,
      type: isModel ? '模型' : '资讯',
      url: item.url,
      external: true,
      keywords: [item.title, item.summary, item.source, item.category].filter(Boolean).join(' '),
    });
  }
}

function appendCoursesSearchItems(items, courses) {
  for (const item of courses?.items || []) {
    if (!item?.title || !item?.url) continue;
    items.push({
      id: item.id,
      label: item.title,
      type: '课程',
      url: item.url,
      external: true,
      keywords: [item.title, item.summary, item.platform, item.track, item.format, item.language]
        .filter(Boolean)
        .join(' '),
    });
  }
}

function appendOssSearchItems(items, oss) {
  for (const domain of oss?.domains || []) {
    for (const project of domain.projects || []) {
      if (!project?.name || !project?.url) continue;
      items.push({
        id: project.id,
        label: project.name,
        type: '开源',
        url: project.url,
        external: true,
        keywords: [
          project.name,
          project.repo,
          project.description,
          domain.label,
          project.language,
          project.badge,
        ]
          .filter(Boolean)
          .join(' '),
      });
    }
  }
}

function appendVideoSearchItems(items, dailyVideos, { limitPerCategory = 2, maxTotal = 24 } = {}) {
  const batches = dailyVideos?.batches || [];
  const merged = withCategoryFallback(batches);
  if (!merged?.categories) return;
  const seen = new Set();
  let total = 0;
  for (const [category, cat] of Object.entries(merged.categories)) {
    const videos = (cat?.videos || []).slice(0, limitPerCategory);
    for (const video of videos) {
      if (!video?.title || !video?.url || seen.has(video.url)) continue;
      seen.add(video.url);
      items.push({
        id: video.id || video.url,
        label: video.title,
        type: '视频',
        url: video.url,
        external: true,
        keywords: [video.title, video.summary, video.channel, video.platform, category]
          .filter(Boolean)
          .join(' '),
      });
      total += 1;
      if (total >= maxTotal) return;
    }
  }
}

function appendRankingSearchItems(items, rankings) {
  const seen = new Set();
  for (const board of rankings?.boards || []) {
    for (const row of board.items || []) {
      const name = row?.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const extUrl = row.url && String(row.url).startsWith('http');
      items.push({
        label: name,
        type: '模型',
        url: extUrl ? row.url : 'ai-tools-ranking.html',
        external: Boolean(extUrl),
        keywords: [name, board.label, board.title, row.description, '排行榜', 'AICPB', 'LMSYS']
          .filter(Boolean)
          .join(' '),
      });
    }
  }
}

function buildSearchIndex(site, tools, compares) {
  const items = [];
  for (const t of tools) {
    const kw = [t.id, t.name, t.description, '教程', ...(t.features || []).map((f) => f.title)]
      .filter(Boolean)
      .join(' ');
    // 标签用工具原名，便于精确匹配；URL 指向独立教程页
    items.push({
      label: t.name,
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
    keywords:
      '开源 GitHub Stars AI应用 Agent AI编程 OpenCode Claude Code OpenHands Dify LangChain n8n Ollama vLLM Open WebUI 本地大模型 AI绘画 多模态 Prompt库 每周一',
  });
  items.push({
    label: 'AI 课程资源',
    type: '频道',
    section: 'section-courses',
    keywords:
      '课程资源 免费 学习路线 入门 机器学习 深度学习 LLM Agent 微软 吴恩达 斯坦福 Google DeepLearning.AI',
  });
  items.push({
    label: 'GitHub Prompt 库 Top 5',
    type: '开源',
    section: 'section-oss',
    keywords:
      'GitHub Prompt 库 Top5 prompts.chat System Prompts Prompt Engineering Guide Get Shit Done 中文调教 开源精选',
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
  // 仅索引导航入口；各工具名已由 tools.json 指向教程页，勿再写入对比表锚点以免抢占搜索首位
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
}

function buildRecommendRules(site) {
  const options = (site.ai_picker?.options || []).map((opt) => ({
    id: opt.id,
    label: opt.label,
    tools: opt.tools || [],
    keywords: opt.keywords || [],
    examples: opt.examples || [],
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
  const compares = readJson('compares.json');
  const rankings = readJson('rankings.json');
  const searchIndex = buildSearchIndex(site, tools, compares);
  appendHubBoardSearchItems(searchIndex);
  appendNewsSearchItems(searchIndex, readRootJson('ai-news.json'));
  appendCoursesSearchItems(searchIndex, readRootJson('ai-courses.json'));
  appendOssSearchItems(
    searchIndex,
    readRootJson('oss-projects.json') || readJson('oss-projects.json'),
  );
  appendVideoSearchItems(searchIndex, readRootJson('daily-videos.json'));
  appendRankingSearchItems(searchIndex, rankings);
  const recommendRules = buildRecommendRules(site);
  const analyticsCfg = buildAnalyticsConfig();

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

  const videosSrc = path.join(ROOT, 'daily-videos.json');
  if (fs.existsSync(videosSrc)) {
    const full = JSON.parse(fs.readFileSync(videosSrc, 'utf8'));
    const batches = full.batches || [];
    // 在完整历史上做分类回退后再瘦身：仅保留 2 批时 YouTube 常因近几日抓取失败而无法回退。
    const merged = withCategoryFallback(batches);
    const slim = { ...full, batches: merged ? [merged] : [] };
    writeOut(outDir, 'daily-videos.latest.json', slim);
  }

  console.log(`✓ artifacts → ${outDir}`);
  console.log(
    `  search-index.json (${searchIndex.length}) · recommend-rules.json (${recommendRules.options.length})`,
  );
  return { searchIndex, recommendRules };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] || path.join(ROOT, 'public');
  buildArtifacts(out);
}
