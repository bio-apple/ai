const API = window.location.origin;
const TOKEN_KEY = 'ai_guide_token';
const USER_KEY = 'ai_guide_user';

let communityTab = 'all';

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
  if (!res.ok) throw new Error(data.detail || data.message || '请求失败');
  return data;
}

function renderUserArea() {
  const area = document.getElementById('user-area');
  const uploadPanel = document.getElementById('upload-panel');
  const user = getUser();
  if (!area) return;

  if (user) {
    area.innerHTML = `
      <span class="user-name">👤 ${escapeHtml(user.username)}</span>
      <button class="auth-btn" id="btn-logout">退出</button>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      clearAuth();
      if (communityTab === 'mine') loadResources();
    });
    uploadPanel?.classList.remove('hidden');
  } else {
    area.innerHTML = `
      <button class="auth-btn" id="btn-login">登录</button>
      <button class="auth-btn primary" id="btn-register">注册</button>
    `;
    bindAuthButtons();
    uploadPanel?.classList.add('hidden');
  }
}

function bindAuthButtons() {
  document.getElementById('btn-login')?.addEventListener('click', () => openModal('modal-login'));
  document.getElementById('btn-register')?.addEventListener('click', () => openModal('modal-register'));
}

function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
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
  const canDelete = user && user.username === r.username;
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
    openModal('modal-preview');
  } catch (err) {
    alert(err.message);
  }
}

/* Modals */
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal')?.classList.add('hidden');
  });
});

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.add('hidden');
  });
});

/* Login */
document.getElementById('form-login')?.addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  const fd = new FormData(e.target);
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }),
    });
    setAuth(data.token, data.user);
    closeModal('modal-login');
    e.target.reset();
    loadResources();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

/* Register */
document.getElementById('form-register')?.addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  errEl.textContent = '';
  const fd = new FormData(e.target);
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: fd.get('username'),
        email: fd.get('email'),
        password: fd.get('password'),
      }),
    });
    setAuth(data.token, data.user);
    closeModal('modal-register');
    e.target.reset();
    loadResources();
  } catch (err) {
    errEl.textContent = err.message;
  }
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
      openModal('modal-login');
      return;
    }
    document.querySelectorAll('.community-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    communityTab = tab.dataset.tab;
    loadResources();
  });
});

/* Init */
document.addEventListener('DOMContentLoaded', () => {
  renderUserArea();
  const observer = new MutationObserver(() => {
    const section = document.getElementById('section-community');
    if (section?.classList.contains('active')) loadResources();
  });
  const section = document.getElementById('section-community');
  if (section) {
    observer.observe(section, { attributes: true, attributeFilter: ['class'] });
    if (section.classList.contains('active')) loadResources();
  }
});

window.addEventListener('section-change', (e) => {
  if (e.detail === 'community') loadResources();
});
