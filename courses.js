const COURSES_JSON = 'ai-courses.json';

const DEFAULT_TRACK_ORDER = ['入门', '机器学习', '深度学习', 'LLM 大模型', 'AI Agent'];

let coursesDataPromise = null;
let coursesState = { track: 'all', platform: 'all', items: [], trackOrder: DEFAULT_TRACK_ORDER };

function html(s) {
  return window.BioAI?.escapeHtml ? window.BioAI.escapeHtml(s) : String(s ?? '');
}

function extRel() {
  return window.BioAI?.externalRel ? window.BioAI.externalRel() : 'noopener noreferrer';
}

function formatCourseDate(raw) {
  if (!raw) return '';
  try {
    const d = new Date(String(raw).includes('T') ? raw : `${raw}T00:00:00+08:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: 'Asia/Shanghai',
      });
    }
  } catch {
    /* fall through */
  }
  return String(raw).slice(0, 10);
}

function fetchCoursesData() {
  if (!coursesDataPromise) {
    if (!window.BioAI?.fetchJson) {
      return Promise.reject(new Error('加载器未就绪，请稍后重试'));
    }
    coursesDataPromise = window.BioAI.fetchJson(COURSES_JSON, { label: '课程资源' });
  }
  return coursesDataPromise;
}

function resetCoursesFetch() {
  window.BioAI?.invalidateFetch?.(COURSES_JSON);
  coursesDataPromise = null;
}

function filterCourses(items) {
  return (items || []).filter((item) => {
    const trackOk = coursesState.track === 'all' || item.track === coursesState.track;
    const platOk = coursesState.platform === 'all' || item.platform === coursesState.platform;
    return trackOk && platOk;
  });
}

function renderCourseCard(item) {
  const badges = [
    item.required ? '<span class="course-required-badge">必学</span>' : '',
    '<span class="course-free-badge">免费</span>',
    item.is_new ? '<span class="course-new-badge">新</span>' : '',
  ]
    .filter(Boolean)
    .join('');
  const primaryIsYoutube = /youtube\.com|youtu\.be/i.test(String(item.url || ''));
  const primaryLabel = primaryIsYoutube ? 'YouTube 讲座 →' : '打开课程 →';
  const official = String(item.official_url || '').trim();
  const officialLink = official
    ? `<a href="${html(official)}" target="_blank" rel="${extRel()}" class="course-read course-read-secondary" data-track="course-official"
        data-course-title="${html(item.title || '')}" data-course-track="${html(item.track || '')}">官方主页 →</a>`
    : '';
  return `
    <article class="course-card">
      <div class="course-card-head">
        <span class="course-platform">${html(item.platform || '')}</span>
        <span class="course-date">${html(formatCourseDate(item.published_at))}</span>
      </div>
      <h4>
        <a href="${html(item.url)}" target="_blank" rel="${extRel()}" data-track="course-click"
          data-course-title="${html(item.title || '')}" data-course-track="${html(item.track || '')}">
          ${html(item.title || '')}
        </a>
        ${badges}
      </h4>
      <p class="course-meta">
        ${item.track ? `<span>${html(item.track)}</span>` : ''}
        ${item.format ? `<span>${html(item.format)}</span>` : ''}
      </p>
      ${item.summary ? `<p class="course-summary">${html(item.summary)}</p>` : ''}
      <div class="course-actions">
        <a href="${html(item.url)}" target="_blank" rel="${extRel()}" class="course-read" data-track="course-read"
          data-course-title="${html(item.title || '')}" data-course-track="${html(item.track || '')}">${primaryLabel}</a>
        ${officialLink}
      </div>
    </article>
  `;
}

function groupByTrack(items) {
  const order = coursesState.trackOrder || DEFAULT_TRACK_ORDER;
  const groups = new Map();
  for (const track of order) groups.set(track, []);
  for (const item of items) {
    const track = item.track || '其他';
    if (!groups.has(track)) groups.set(track, []);
    groups.get(track).push(item);
  }
  return [...groups.entries()].filter(([, list]) => list.length);
}

function renderCoursesGrid(items) {
  if (!items.length) {
    return '<p class="loading-hint">当前筛选下暂无课程，请切换路线或平台。</p>';
  }
  if (coursesState.track !== 'all') {
    return `<div class="courses-grid">${items.map(renderCourseCard).join('')}</div>`;
  }
  return groupByTrack(items)
    .map(
      ([track, list]) => `
      <section class="courses-track-block">
        <h3 class="courses-track-title">${html(track)}</h3>
        <div class="courses-grid">${list.map(renderCourseCard).join('')}</div>
      </section>
    `,
    )
    .join('');
}

function uniqueValues(items, key) {
  return [...new Set((items || []).map((i) => i[key]).filter(Boolean))];
}

/** URL / 标题去重，避免合集与单课或近重复同时渲染 */
function dedupeCourseItems(items) {
  const seenUrl = new Set();
  const seenTitle = new Set();
  const out = [];
  for (const item of items || []) {
    const url = String(item.url || '')
      .trim()
      .replace(/\/+$/, '');
    const title = String(item.title || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (url && seenUrl.has(url)) continue;
    if (title && seenTitle.has(title)) continue;
    if (url) seenUrl.add(url);
    if (title) seenTitle.add(title);
    out.push(item);
  }
  // 合集优先：若同时存在合集与下属路径，丢掉下属
  const hubs = out.filter((i) => i.hub);
  if (!hubs.length) return out;
  const prefixes = ['https://www.deeplearning.ai/courses'];
  return out.filter((item) => {
    if (item.hub) return true;
    const url = String(item.url || '')
      .trim()
      .replace(/\/+$/, '');
    return !prefixes.some((p) => url.startsWith(p));
  });
}

function renderToolbar(items) {
  const toolbar = document.getElementById('courses-toolbar');
  if (!toolbar) return;
  const present = new Set(uniqueValues(items, 'track'));
  const tracks = [
    'all',
    ...(coursesState.trackOrder || DEFAULT_TRACK_ORDER).filter((t) => present.has(t)),
    ...uniqueValues(items, 'track').filter(
      (t) => !(coursesState.trackOrder || DEFAULT_TRACK_ORDER).includes(t),
    ),
  ];
  const platforms = [
    'all',
    ...uniqueValues(items, 'platform').sort((a, b) => a.localeCompare(b, 'zh')),
  ];

  const trackHtml = tracks
    .map((t) => {
      const label = t === 'all' ? '全部路线' : t;
      const active = coursesState.track === t;
      return `<button type="button" class="video-filter${active ? ' active' : ''}" data-course-track="${html(t)}" aria-pressed="${active}">${html(label)}</button>`;
    })
    .join('');
  const platHtml = platforms
    .map((p) => {
      const label = p === 'all' ? '全部平台' : p;
      const active = coursesState.platform === p;
      return `<button type="button" class="video-filter${active ? ' active' : ''}" data-course-platform="${html(p)}" aria-pressed="${active}">${html(label)}</button>`;
    })
    .join('');

  toolbar.innerHTML = `
    <div class="video-toolbar-group">
      <span class="video-toolbar-label">路线</span>
      ${trackHtml}
    </div>
    <div class="video-toolbar-group">
      <span class="video-toolbar-label">平台</span>
      ${platHtml}
    </div>
  `;

  toolbar.querySelectorAll('[data-course-track]').forEach((btn) => {
    btn.addEventListener('click', () => {
      coursesState.track = btn.dataset.courseTrack || 'all';
      paintCourses();
      if (typeof trackEvent === 'function') {
        trackEvent('courses-filter-track', { track: coursesState.track });
      }
    });
    btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
  });
  toolbar.querySelectorAll('[data-course-platform]').forEach((btn) => {
    btn.addEventListener('click', () => {
      coursesState.platform = btn.dataset.coursePlatform || 'all';
      paintCourses();
      if (typeof trackEvent === 'function') {
        trackEvent('courses-filter-platform', { platform: coursesState.platform });
      }
    });
    btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
  });
}

function paintCourses() {
  const list = document.getElementById('courses-list');
  if (!list) return;
  const filtered = filterCourses(coursesState.items);
  list.innerHTML = renderCoursesGrid(filtered);
  renderToolbar(coursesState.items);
}

function renderCoursesMeta(data) {
  const meta = document.getElementById('courses-update-meta');
  if (!meta) return;
  const n = (data.items || []).length;
  const required = (data.items || []).filter((i) => i.required).length;
  const updated = data.updated_at || data.date || '';
  meta.textContent = `免费 · 每段最多 5 门 · ${n} 门（必学 ${required}）${updated ? ` · 更新 ${formatCourseDate(updated)}` : ''}`;
}

async function initCoursesSection() {
  const list = document.getElementById('courses-list');
  if (!list) return;
  try {
    const data = await fetchCoursesData();
    coursesState.trackOrder =
      Array.isArray(data.track_order) && data.track_order.length
        ? data.track_order
        : DEFAULT_TRACK_ORDER;
    const orderIndex = Object.fromEntries(coursesState.trackOrder.map((t, i) => [t, i]));
    coursesState.items = dedupeCourseItems([...(data.items || [])]).sort((a, b) => {
      const ta = orderIndex[a.track] ?? 999;
      const tb = orderIndex[b.track] ?? 999;
      if (ta !== tb) return ta - tb;
      if (Boolean(a.required || a.hub) !== Boolean(b.required || b.hub)) {
        return a.required || a.hub ? -1 : 1;
      }
      return String(b.published_at || '').localeCompare(String(a.published_at || ''));
    });
    renderCoursesMeta(data);
    paintCourses();
  } catch (err) {
    list.innerHTML = window.BioAI?.renderErrorBlock
      ? window.BioAI.renderErrorBlock(err.message || '加载失败')
      : `<p class="loading-hint error-hint">${html(err.message || '加载失败')}</p>`;
    window.BioAI?.bindRetry?.(list, () => {
      resetCoursesFetch();
      initCoursesSection();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCoursesSection);
} else {
  initCoursesSection();
}
