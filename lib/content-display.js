/** 新闻来源标记、相对时间、开源人群标签、三榜推荐理由 */

const SOURCE_MARKS = {
  量子位: { key: 'qbit', mark: '量', domain: 'qbitai.com' },
  机器之心: { key: 'sync', mark: '机', domain: 'jiqizhixin.com' },
  新智元: { key: 'lexain', mark: '新', domain: 'ainews.com' },
  智源社区: { key: 'baai', mark: '源', domain: 'hub.baai.ac.cn' },
  智源: { key: 'baai', mark: '源', domain: 'baai.ac.cn' },
  OpenAI: { key: 'openai', mark: 'O', domain: 'openai.com' },
  Anthropic: { key: 'anth', mark: 'A', domain: 'anthropic.com' },
  'Google DeepMind': { key: 'deepmind', mark: 'G', domain: 'deepmind.google' },
  DeepMind: { key: 'deepmind', mark: 'G', domain: 'deepmind.google' },
  'Google AI': { key: 'google', mark: 'G', domain: 'blog.google' },
  'NVIDIA AI': { key: 'nvidia', mark: 'N', domain: 'nvidia.com' },
  'NVIDIA Blog': { key: 'nvidia', mark: 'N', domain: 'blogs.nvidia.com' },
  'Hugging Face': { key: 'hf', mark: 'HF', domain: 'huggingface.co' },
  HuggingFace: { key: 'hf', mark: 'HF', domain: 'huggingface.co' },
  'arXiv cs.AI': { key: 'arxiv', mark: 'ar', domain: 'arxiv.org' },
  arXiv: { key: 'arxiv', mark: 'ar', domain: 'arxiv.org' },
  'GitHub Trending': { key: 'github', mark: 'GH', domain: 'github.com' },
  GitHub: { key: 'github', mark: 'GH', domain: 'github.com' },
  TechCrunch: { key: 'tc', mark: 'TC', domain: 'techcrunch.com' },
  'The Verge': { key: 'verge', mark: 'V', domain: 'theverge.com' },
  VentureBeat: { key: 'vb', mark: 'VB', domain: 'venturebeat.com' },
  'Meta AI': { key: 'meta', mark: 'M', domain: 'ai.meta.com' },
  'Microsoft AI': { key: 'ms', mark: 'MS', domain: 'microsoft.com' },
};

export function newsSourceLogoPath(key) {
  if (!key || key === 'other') return '';
  return `source-logos/${key}.svg`;
}

export function newsSourceMeta(source) {
  const label = String(source || '').trim();
  if (!label) return null;
  let known = SOURCE_MARKS[label];
  if (!known) {
    const lower = label.toLowerCase();
    for (const [name, meta] of Object.entries(SOURCE_MARKS)) {
      if (lower.includes(name.toLowerCase())) {
        known = meta;
        break;
      }
    }
  }
  const key = known?.key || 'other';
  const mark = known?.mark || Array.from(label)[0] || '?';
  return {
    label,
    key,
    mark,
    domain: known?.domain || '',
    logo: newsSourceLogoPath(key),
  };
}

export function formatRelativeTime(iso, now = Date.now()) {
  if (!iso) return '';
  const raw = String(iso).trim();
  const parsed = Date.parse(raw.includes('T') || raw.includes(' ') ? raw : `${raw}T00:00:00+08:00`);
  if (Number.isNaN(parsed)) return raw.slice(0, 10);
  const delta = now - parsed;
  if (delta < 45_000) return '刚刚';
  if (delta < 60 * 60_000) return `${Math.max(1, Math.round(delta / 60_000))}分钟前`;
  if (delta < 24 * 60 * 60_000) return `${Math.max(1, Math.round(delta / 3_600_000))}小时前`;
  if (delta < 30 * 24 * 60 * 60_000) return `${Math.max(1, Math.round(delta / 86_400_000))}天前`;
  try {
    return new Date(parsed).toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      timeZone: 'Asia/Shanghai',
    });
  } catch {
    return raw.slice(0, 10);
  }
}

const OSS_AUDIENCE = {
  agent: ['Agent', '多智能体'],
  mcp: ['MCP', '工具接入'],
  coding_agent: ['Coding Agent', '写代码'],
  agent_harness: ['Agent Harness', '编排'],
  skills: ['Skills', '给 Agent 加技能'],
  memory: ['Memory', '长期记忆'],
};

export function ossAudienceTags(item) {
  const tags = [...(OSS_AUDIENCE[item?.category || ''] || [item?.categoryLabel || '开源'].filter(Boolean))];
  if (item?.isNew) tags.push('新手可盯');
  if ((item?.stars || 0) >= 50_000) tags.push('社区主流');
  return [...new Set(tags.filter(Boolean))];
}

export function ossHeatLabel(item) {
  const daily = item?.trendingDailyRank;
  const weekly = item?.trendingWeeklyRank;
  const heated = (item?.sources || []).some((s) => String(s).startsWith('trending'));
  const score = item?.heatScore ? `热度 ${Math.round(item.heatScore)}` : '';
  if (daily != null) {
    return {
      text: score ? `日榜 #${daily} · ${score}` : `日榜 #${daily}`,
      title: 'GitHub Trending 日榜名次；热度综合名次、星速与近期提交',
    };
  }
  if (weekly != null) {
    return {
      text: score ? `周榜 #${weekly} · ${score}` : `周榜 #${weekly}`,
      title: 'GitHub Trending 周榜名次；热度综合名次、星速与近期提交',
    };
  }
  if (heated || score) {
    return {
      text: score || '升温',
      title: '综合 Trending 名次、星速与近期提交，分数只作排序参考',
    };
  }
  return null;
}

const PICK_REASONS = {
  chatgpt: '适合日常问答与写作，生态最全',
  gemini: '适合多模态与 Google 生态',
  deepseek: '性价比高，国内访问稳',
  claude: '适合长文档与严谨推理',
  copilot: '适合已在 VS Code、预算有限',
  cursor: '适合跨文件 Agent 改代码',
  kimi: '适合超长文档阅读',
  doubao: '适合国内办公与短视频',
  qwen: '适合开源可部署与中文',
  grok: '适合跟进实时信息',
  perplexity: '适合带引用的检索问答',
  midjourney: '适合出图审美与风格探索',
  suno: '适合快速出歌',
  notion: '适合笔记里直接调用模型',
  'claude-fable-5': '盲测对战领先，对话质量口碑好',
  'claude-opus-5': '公开基准综合分高，适合难推理',
  'claude-opus-4-5': '适合长上下文与稳妥写作',
  'gpt-5-4': '适合通用对话与工具调用',
};

const BOARD_REASON = {
  aicpb: '站点访问量大，大众正在用',
  lmsys: '盲测对战胜出，对话质量口碑好',
  'artificial-analysis': '公开基准综合分高',
};

function normalizeReasonKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[()]/g, '')
    .replace(/-max$/, '');
}

export function rankingPickReason(name, boardId = '') {
  const key = normalizeReasonKey(name);
  if (PICK_REASONS[key]) return PICK_REASONS[key];
  const compact = key.replace(/-?\d+(\.\d+)?.*$/, '').replace(/-+$/, '');
  if (PICK_REASONS[compact]) return PICK_REASONS[compact];
  if (key.startsWith('claude')) {
    return String(boardId).includes('lmsys') ? '盲测对战胜出，对话质量口碑好' : '适合长上下文与稳妥写作';
  }
  if (key.startsWith('gpt') || key.startsWith('chatgpt')) return '适合通用对话与工具调用';
  if (key.startsWith('gemini')) return '适合多模态与 Google 生态';
  if (key.startsWith('deepseek')) return '性价比高，国内访问稳';
  const boardKey = Object.keys(BOARD_REASON).find((id) => String(boardId).includes(id));
  return (boardKey && BOARD_REASON[boardKey]) || '榜单前列，可作选型起点';
}
