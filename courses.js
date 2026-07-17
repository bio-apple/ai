const COURSES_DATA_URL =
  (typeof document !== 'undefined' && document.documentElement.dataset.base
    ? document.documentElement.dataset.base.replace(/\/?$/, '/')
    : '') + 'ai-courses.json';

const COURSE_CATEGORY_ORDER = [
  'Agent应用',
  'LLM应用',
  '多模态',
  '机器学习',
  '效率办公',
  '入门基础',
  '短课程',
  'MOOC',
  '开源课程',
  '视频课程',
];

let coursesDataPromise = null;
let coursesState = { category: 'all', platform: 'all', items: [] };

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
        if (!res.ok) throw new Error('无法加载学习资源数据');
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
    const catOk = coursesState.category === 'all' || item.category === coursesState.category;
    const platOk = coursesState.platform === 'all' || item.platform === coursesState.platform;
    return catOk && platOk;
  });
}

function renderCourseCard(item) {
  const badge = item.is_new ? '<span class="course-new-badge">新</span>' : '';
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
        ${badge}
      </h4>
      <p class="course-meta">
        ${item.category ? `<span>${escapeHtml(item.category)}</span>` : ''}
        ${item.format ? `<span>${escapeHtml(item.format)}</span>` : ''}
      </p>
      ${item.summary ? `<p class="course-summary">${escapeHtml(item.summary)}</p>` : ''}
      <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="course-read" data-track="course-read">打开课程 →</a>
    </article>
  `;
}

function renderCoursesGrid(items) {
  if (!items.length) {
    return '<p class="loading-hint">当前筛选下暂无课程，请切换分类或平台。</p>';
  }
  return `<div class="courses-grid">${items.map(renderCourseCard).join('')}</div>`;
}

function uniqueValues(items, key) {
  return [...new Set((items || []).map((i) => i[key]).filter(Boolean))];
}

function renderToolbar(items) {
  const toolbar = document.getElementById('courses-toolbar');
  if (!toolbar) return;
  const categories = [
    'all',
    ...COURSE_CATEGORY_ORDER.filter((c) => items.some((i) => i.category === c)),
    ...uniqueValues(items, 'category').filter((c) => !COURSE_CATEGORY_ORDER.includes(c)),
  ];
  const platforms = [
    'all',
    ...uniqueValues(items, 'platform').sort((a, b) => a.localeCompare(b, 'zh')),
  ];

  const catHtml = categories
    .map((c) => {
      const label = c === 'all' ? '全部领域' : c;
      const active = coursesState.category === c ? ' active' : '';
      return `<button type="button" class="video-filter${active}" data-course-category="${escapeHtml(c)}">${escapeHtml(label)}</button>`;
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
      <span class="video-toolbar-label">领域</span>
      ${catHtml}
    </div>
    <div class="video-toolbar-group">
      <span class="video-toolbar-label">平台</span>
      ${platHtml}
    </div>
  `;

  toolbar.querySelectorAll('[data-course-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      coursesState.category = btn.dataset.courseCategory || 'all';
      paintCourses();
      if (typeof trackEvent === 'function') {
        trackEvent('courses-filter-category', { category: coursesState.category });
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
  const windowDays = data.window_days || 180;
  const updated = data.updated_at || data.date || '';
  meta.textContent = `近 ${windowDays} 天 · ${n} 门课程${updated ? ` · 更新 ${formatCourseDate(updated)}` : ''}`;
}

async function initCoursesSection() {
  const list = document.getElementById('courses-list');
  if (!list) return;
  try {
    const data = await fetchCoursesData();
    coursesState.items = [...(data.items || [])].sort((a, b) =>
      String(b.published_at || '').localeCompare(String(a.published_at || '')),
    );
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
