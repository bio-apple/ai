/* 内容漏斗：journey_id + funnel_step 贯穿全站行为分析 */
(function initContentFunnel() {
  const JOURNEY_KEY = 'bioai.journey_id';
  const ENTRY_KEY = 'bioai.funnel_entry';

  /** 漏斗阶段（与 docs/FRONTEND.md §6 对齐） */
  const STEPS = {
    DISCOVER: 1,
    BROWSE: 2,
    ENGAGE: 3,
    LEARN: 4,
    COMPLETE: 5,
  };

  const STAGE_BY_STEP = {
    1: 'discover',
    2: 'browse',
    3: 'engage',
    4: 'learn',
    5: 'complete',
  };

  /** 事件 → 默认漏斗阶段（可被 params.funnel_step 覆盖） */
  const EVENT_STEP = {
    funnel_entry: STEPS.DISCOVER,
    page_engagement: STEPS.DISCOVER,
    'hero-cta-primary': STEPS.DISCOVER,
    'hero-cta-nav': STEPS.BROWSE,
    recommend_empty_submit: STEPS.DISCOVER,
    recommend_chip: STEPS.DISCOVER,
    recommend_submit: STEPS.DISCOVER,
    'nav-tab': STEPS.BROWSE,
    section_view: STEPS.BROWSE,
    search_query: STEPS.BROWSE,
    search_hit: STEPS.BROWSE,
    'search-goto': STEPS.BROWSE,
    search_empty: STEPS.BROWSE,
    'home-filter-local': STEPS.BROWSE,
    'home-community-hub': STEPS.BROWSE,
    daily_panel_click: STEPS.BROWSE,
    recommend_query_tool: STEPS.ENGAGE,
    recommend_related_tool: STEPS.ENGAGE,
    recommend_related_alt: STEPS.ENGAGE,
    recommend_related_comp: STEPS.ENGAGE,
    'ops-tool-click': STEPS.ENGAGE,
    'course-click': STEPS.LEARN,
    'course-read': STEPS.LEARN,
    'courses-filter-track': STEPS.LEARN,
    'courses-filter-platform': STEPS.LEARN,
    'video-click': STEPS.LEARN,
    'home-video-click': STEPS.LEARN,
    knowledge_ask: STEPS.LEARN,
    roadmap_phase_toggle: STEPS.COMPLETE,
  };

  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `j-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function getJourneyId() {
    try {
      let id = sessionStorage.getItem(JOURNEY_KEY);
      if (!id) {
        id = uuid();
        sessionStorage.setItem(JOURNEY_KEY, id);
      }
      return id;
    } catch {
      return uuid();
    }
  }

  function siteBase() {
    const raw = document.documentElement?.dataset?.base || '/';
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  function pageType() {
    const path = (location.pathname || '').replace(/\/+$/, '');
    const base = siteBase().replace(/^\/|\/$/g, '');
    let rel = path;
    if (base && (rel === `/${base}` || rel.startsWith(`/${base}/`))) {
      rel = rel.slice(base.length + 1) || 'index.html';
    }
    rel = rel.replace(/^\//, '');
    if (!rel || rel === 'index.html') return 'home';
    if (rel.startsWith('tools/')) {
      if (rel === 'tools/hub.html') return 'hub';
      return 'tool';
    }
    if (rel.startsWith('compare/')) return 'compare';
    if (rel.startsWith('guides/')) return 'guide';
    if (rel.startsWith('news/')) return 'news';
    if (rel === 'ai-tools-ranking.html') return 'ranking';
    if (rel === 'ai-learning-roadmap.html') return 'roadmap';
    return 'other';
  }

  function entrySource() {
    const params = new URLSearchParams(location.search);
    if (params.get('q')) return 'search';
    if (params.get('utm_source')) return String(params.get('utm_source')).slice(0, 40);
    if (location.hash) return 'hash';
    const ref = document.referrer || '';
    if (!ref) return 'direct';
    try {
      const host = new URL(ref).hostname;
      if (host.includes('google.') || host.includes('bing.') || host.includes('baidu.')) {
        return 'search_engine';
      }
      if (host.includes('github.')) return 'github';
      return 'referral';
    } catch {
      return 'referral';
    }
  }

  function toolIdFromPath() {
    const m = location.pathname.match(/\/tools\/([^/]+)\.html$/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function enrich(name, params = {}) {
    const step =
      typeof params.funnel_step === 'number'
        ? params.funnel_step
        : EVENT_STEP[name] || inferStepFromPage();
    const stage = params.funnel_stage || STAGE_BY_STEP[step] || 'discover';
    return {
      ...params,
      journey_id: params.journey_id || getJourneyId(),
      funnel_step: step,
      funnel_stage: stage,
      page_type: params.page_type || pageType(),
    };
  }

  function inferStepFromPage() {
    const type = pageType();
    if (type === 'home') return STEPS.DISCOVER;
    if (type === 'tool' || type === 'compare') return STEPS.ENGAGE;
    if (type === 'roadmap') return STEPS.LEARN;
    return STEPS.BROWSE;
  }

  function track(name, params = {}) {
    const payload = enrich(name, params);
    if (typeof trackEvent === 'function') {
      trackEvent(name, payload);
    }
    return payload;
  }

  function recordEntryOnce() {
    try {
      if (sessionStorage.getItem(ENTRY_KEY) === '1') return;
      sessionStorage.setItem(ENTRY_KEY, '1');
    } catch {
      /* private mode */
    }
    const type = pageType();
    const payload = {
      entry_source: entrySource(),
      page_path: location.pathname,
    };
    if (type === 'tool') payload.tool = toolIdFromPath();
    track('funnel_entry', payload);
  }

  function bindSectionViews() {
    window.addEventListener('bioai:section-change', (e) => {
      const { sectionId, anchor } = e.detail || {};
      if (!sectionId) return;
      track('section_view', {
        section: sectionId,
        anchor: anchor || '',
        tool: sectionId === 'section-home' ? 'all' : sectionId.replace('section-', ''),
      });
    });
  }

  window.bioFunnel = {
    STEPS,
    STAGE_BY_STEP,
    getJourneyId,
    pageType,
    entrySource,
    enrich,
    track,
  };

  document.addEventListener('DOMContentLoaded', () => {
    recordEntryOnce();
    bindSectionViews();
  });
})();
