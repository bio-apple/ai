const COURSES_DATA_URL =
  (typeof document !== 'undefined' && document.documentElement.dataset.base
    ? document.documentElement.dataset.base.replace(/\/?$/, '/')
    : '') + 'ai-courses.json';

const DEFAULT_TRACK_ORDER = [
  '入门',
  '机器学习',
  '深度学习',
  'LLM 大模型',
  'AI Agent',
  'AI 工程实践',
];

let coursesDataPromise = null;
let coursesState = { track: 'all', platform: 'all', items: [], trackOrder: DEFAULT_TRACK_ORDER };

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
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
    coursesDataPromise = fetch(COURSES_DATA_URL, { cache: 'default' })
      .then((res) => {
        if (!res.ok) throw new Error('无法加载课程资源数据');
        return res.json();
      })
      .catch((err) => {
        coursesDataPromise = null;
        throw err;
      });
  }
  return coursesDataPromise;
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
  return `
    <article class="course-card">
      <div class="course-card-head">
        <span class="course-platform">${escapeHtml(item.platform || '')}</span>
        <span class="course-date">${escapeHtml(formatCourseDate(item.published_at))}</span>
      </div>
      <h4>
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" data-track="course-click">
          ${escapeHtml(item.title || '')}
        </a>
        ${badges}
      </h4>
      <p class="course-meta">
        ${item.track ? `<span>${escapeHtml(item.track)}</span>` : ''}
        ${item.format ? `<span>${escapeHtml(item.format)}</span>` : ''}
      </p>
      ${item.summary ? `<p class="course-summary">${escapeHtml(item.summary)}</p>` : ''}
      <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="course-read" data-track="course-read">打开课程 →</a>
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
        <h3 class="courses-track-title">${escapeHtml(track)}</h3>
        <div class="courses-grid">${list.map(renderCourseCard).join('')}</div>
      </section>
    `,
    )
    .join('');
}

function uniqueValues(items, key) {
  return [...new Set((items || []).map((i) => i[key]).filter(Boolean))];
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
      const active = coursesState.track === t ? ' active' : '';
      return `<button type="button" class="video-filter${active}" data-course-track="${escapeHtml(t)}">${escapeHtml(label)}</button>`;
    })
    .join('');
  const platHtml = platforms
    .map((p) => {
      const label = p === 'all' ? '全部平台' : p;
      const active = coursesState.platform === p ? ' active' : '';
      return `<button type="button" class="video-filter${active}" data-course-platform="${escapeHtml(p)}">${escapeHtml(label)}</button>`;
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
  });
  toolbar.querySelectorAll('[data-course-platform]').forEach((btn) => {
    btn.addEventListener('click', () => {
      coursesState.platform = btn.dataset.coursePlatform || 'all';
      paintCourses();
      if (typeof trackEvent === 'function') {
        trackEvent('courses-filter-platform', { platform: coursesState.platform });
      }
    });
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
  meta.textContent = `免费 · 路线编排 · ${n} 门（必学 ${required}）${updated ? ` · 更新 ${formatCourseDate(updated)}` : ''}`;
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
    coursesState.items = [...(data.items || [])].sort((a, b) => {
      const ta = orderIndex[a.track] ?? 999;
      const tb = orderIndex[b.track] ?? 999;
      if (ta !== tb) return ta - tb;
      if (Boolean(a.required) !== Boolean(b.required)) return a.required ? -1 : 1;
      return String(b.published_at || '').localeCompare(String(a.published_at || ''));
    });
    renderCoursesMeta(data);
    paintCourses();
  } catch (err) {
    list.innerHTML = `<p class="loading-hint error-hint">${escapeHtml(err.message || '加载失败')}</p>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCoursesSection);
} else {
  initCoursesSection();
}
