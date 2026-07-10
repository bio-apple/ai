const API = window.location.origin;
const TOKEN_KEY = 'ai_guide_token';
const USER_KEY = 'ai_guide_user';

let communityTab = 'all';
let authEmail = '';
let authIsLogin = false;

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  renderUserArea();
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  renderUserArea();
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    throw new Error(typeof detail === 'string' ? detail : '请求失败');
  }
  return data;
}

/* ── Claude 风格认证 UI ── */

function openAuth() {
  resetAuthFlow();
  document.getElementById('modal-auth')?.classList.remove('hidden');
}

function closeAuth() {
  document.getElementById('modal-auth')?.classList.add('hidden');
  resetAuthFlow();
}

function resetAuthFlow() {
  authEmail = '';
  authIsLogin = false;
  showAuthStep('welcome');
  document.getElementById('form-email')?.reset();
  document.getElementById('form-password')?.reset();
  clearAuthErrors();
}

function showAuthStep(step) {
  document.querySelectorAll('.auth-step').forEach(el => el.classList.remove('active'));
  document.getElementById(`auth-step-${step}`)?.classList.add('active');
}

function clearAuthErrors() {
  ['email-error', 'password-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function renderUserArea() {
  const area = document.getElementById('user-area');
  const uploadPanel = document.getElementById('upload-panel');
  const user = getUser();
  if (!area) return;

  if (user) {
    area.innerHTML = `
      <span class="user-name">${escapeHtml(user.email)}</span>
      <button class="auth-btn" id="btn-logout">退出</button>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      clearAuth();
      if (communityTab === 'mine') loadResources();
    });
    uploadPanel?.classList.remove('hidden');
  } else {
    area.innerHTML = `<button class="auth-btn claude-login-btn" id="btn-auth">登录</button>`;
    document.getElementById('btn-auth')?.addEventListener('click', openAuth);
    uploadPanel?.classList.add('hidden');
  }
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const TYPE_LABEL = { markdown: 'Markdown', word: 'Word', video: '视频' };

function renderResourceCard(r) {
  const user = getUser();
  const canDelete = user && user.id === r.user_id;
  return `
    <article class="res-card" data-id="${r.id}">
      <div class="res-type ${r.file_type}">${TYPE_LABEL[r.file_type] || r.file_type}</div>
      <h4>${escapeHtml(r.title)}</h4>
      ${r.description ? `<p class="res-desc">${escapeHtml(r.description)}</p>` : ''}
      <div class="res-meta">
        <span>@${escapeHtml(r.username)}</span>
        <span>${formatSize(r.file_size)}</span>
        <span>${r.created_at.slice(0, 10)}</span>
      </div>
      <div class="res-actions">
        <button class="res-btn preview-btn" data-id="${r.id}">预览</button>
        <a class="res-btn" href="${API}/api/resources/${r.id}/file" download>下载</a>
        ${canDelete ? `<button class="res-btn danger delete-btn" data-id="${r.id}">删除</button>` : ''}
      </div>
    </article>
  `;
}

async function loadResources() {
  const list = document.getElementById('resource-list');
  if (!list) return;
  list.innerHTML = '<p class="loading-hint">加载中…</p>';

  try {
    const data = communityTab === 'mine'
      ? await api('/api/resources/mine')
      : await api('/api/resources');
    if (!data.length) {
      list.innerHTML = `<p class="loading-hint">${communityTab === 'mine' ? '你还没有上传资料' : '暂无社区资料，成为第一个上传者吧！'}</p>`;
      return;
    }
    list.innerHTML = data.map(renderResourceCard).join('');
    bindResourceActions();
  } catch (err) {
    list.innerHTML = `<p class="loading-hint error-hint">无法加载资料。请通过 <code>./start.sh</code> 启动本地服务后访问。<br><small>${escapeHtml(err.message)}</small></p>`;
  }
}

function bindResourceActions() {
  document.querySelectorAll('.preview-btn').forEach(btn => {
    btn.addEventListener('click', () => previewResource(Number(btn.dataset.id)));
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('确定删除此资料？')) return;
      try {
        await api(`/api/resources/${btn.dataset.id}`, { method: 'DELETE' });
        loadResources();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function previewResource(id) {
  try {
    const detail = await api(`/api/resources/${id}`);
    const preview = await api(`/api/resources/${id}/preview`);
    document.getElementById('preview-title').textContent = detail.title;
    document.getElementById('preview-meta').textContent =
      `${detail.username} · ${TYPE_LABEL[detail.file_type]} · ${formatSize(detail.file_size)}`;
    const body = document.getElementById('preview-body');
    const dl = document.getElementById('preview-download');
    dl.href = `${API}/api/resources/${id}/file`;

    if (preview.type === 'markdown' && window.marked) {
      body.innerHTML = `<div class="md-preview">${marked.parse(preview.content)}</div>`;
    } else if (preview.type === 'word') {
      body.innerHTML = `<pre class="word-preview">${escapeHtml(preview.content)}</pre>`;
    } else if (preview.type === 'video') {
      body.innerHTML = `<video controls src="${preview.url}" class="video-preview"></video>`;
    } else {
      body.innerHTML = '<p>无法预览，请下载原文件。</p>';
    }
    document.getElementById('modal-preview')?.classList.remove('hidden');
  } catch (err) {
    alert(err.message);
  }
}

/* Auth event listeners */
document.getElementById('btn-auth')?.addEventListener('click', openAuth);

document.querySelectorAll('[data-close-auth]').forEach(btn => {
  btn.addEventListener('click', closeAuth);
});

document.getElementById('modal-auth')?.addEventListener('click', e => {
  if (e.target.id === 'modal-auth') closeAuth();
});

document.getElementById('btn-email-continue')?.addEventListener('click', () => {
  showAuthStep('email');
  document.querySelector('#form-email input[name=email]')?.focus();
});

document.getElementById('btn-back-email')?.addEventListener('click', () => showAuthStep('welcome'));
document.getElementById('btn-back-password')?.addEventListener('click', () => showAuthStep('email'));

document.getElementById('btn-google')?.addEventListener('click', async () => {
  try {
    const { enabled } = await api('/api/auth/google/status');
    if (!enabled) {
      alert('Google 登录尚未配置。\n\n请在 config.yaml 中填写 google_oauth.client_id 和 client_secret，详见 README。');
      return;
    }
    window.location.href = `${API}/api/auth/google/login`;
  } catch {
    window.location.href = `${API}/api/auth/google/login`;
  }
});

document.getElementById('form-email')?.addEventListener('submit', async e => {
  e.preventDefault();
  clearAuthErrors();
  const email = new FormData(e.target).get('email').trim();
  const errEl = document.getElementById('email-error');
  try {
    const { exists } = await api('/api/auth/check-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    authEmail = email;
    authIsLogin = exists;
    document.getElementById('password-title').textContent = exists ? '欢迎回来' : '创建密码';
    document.getElementById('password-submit').textContent = exists ? '登录' : '创建账户';
    document.getElementById('auth-email-display').textContent = email;
    document.querySelector('#form-password input').autocomplete = exists ? 'current-password' : 'new-password';
    showAuthStep('password');
    document.querySelector('#form-password input[name=password]')?.focus();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('form-password')?.addEventListener('submit', async e => {
  e.preventDefault();
  clearAuthErrors();
  const password = new FormData(e.target).get('password');
  const errEl = document.getElementById('password-error');
  const endpoint = authIsLogin ? '/api/auth/login' : '/api/auth/register';
  try {
    const data = await api(endpoint, {
      method: 'POST',
      body: JSON.stringify({ email: authEmail, password }),
    });
    setAuth(data.token, data.user);
    closeAuth();
    loadResources();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

/* Preview modal close */
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => btn.closest('.modal')?.classList.add('hidden'));
});

document.getElementById('modal-preview')?.addEventListener('click', e => {
  if (e.target.id === 'modal-preview') e.target.classList.add('hidden');
});

/* Upload */
document.getElementById('upload-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const status = document.getElementById('upload-status');
  status.textContent = '上传中…';
  status.className = 'form-status';
  const fd = new FormData(e.target);
  try {
    await api('/api/resources/upload', { method: 'POST', body: fd, headers: {} });
    status.textContent = '上传成功！';
    status.className = 'form-status ok';
    e.target.reset();
    communityTab = 'mine';
    document.querySelectorAll('.community-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === 'mine');
    });
    loadResources();
  } catch (err) {
    status.textContent = err.message;
    status.className = 'form-status err';
  }
});

/* Community tabs */
document.querySelectorAll('.community-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.tab === 'mine' && !getToken()) {
      openAuth();
      return;
    }
    document.querySelectorAll('.community-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    communityTab = tab.dataset.tab;
    loadResources();
  });
});

document.addEventListener('DOMContentLoaded', () => {
  handleAuthCallback();
  renderUserArea();
  const section = document.getElementById('section-community');
  if (section?.classList.contains('active')) loadResources();
});

async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('auth_token');
  const error = params.get('auth_error');
  const cleanUrl = () => history.replaceState({}, '', window.location.pathname);

  if (error) {
    alert(decodeURIComponent(error.replace(/\+/g, ' ')));
    cleanUrl();
    return;
  }
  if (!token) return;

  try {
    const user = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    setAuth(token, user);
    cleanUrl();
    loadResources();
  } catch {
    alert('Google 登录失败，请重试');
    cleanUrl();
  }
}

window.addEventListener('section-change', (e) => {
  if (e.detail === 'community') loadResources();
});
