/* Bio AI Lab · 同域离线缓存（GitHub Pages /ai/） */
const VERSION = 'bioai-pwa-5';
const PRECACHE = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const BASE = self.location.pathname.replace(/sw\.js$/, '');

const PRECACHE_URLS = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}oss.html`,
  `${BASE}courses.html`,
  `${BASE}tools/hub.html`,
  `${BASE}tools/shelf.html`,
  `${BASE}search-index.json`,
  `${BASE}recommend-rules.json`,
  `${BASE}ai-courses.json`,
  `${BASE}favicon.svg`,
  `${BASE}manifest.webmanifest`,
  `${BASE}knowledge.js`,
  `${BASE}vendor/fuse.min.js`,
  `${BASE}lib/search.js`,
  `${BASE}lib/navigation.js`,
  `${BASE}app.js`,
  `${BASE}style.css`,
];

function sameOrigin(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(BASE);
}

function isKnowledgeJson(url) {
  return /\/(search-index|recommend-rules|ai-courses|ai-news|local-deploy)\.json$/.test(
    url.pathname,
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) =>
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== PRECACHE && key !== RUNTIME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(RUNTIME);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      return (
        (await caches.match(`${BASE}index.html`)) ||
        (await caches.match(`${BASE}`)) ||
        Response.error()
      );
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const fetching = fetch(request)
    .then((fresh) => {
      if (fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => cached);
  return cached || fetching;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok) {
    const cache = await caches.open(RUNTIME);
    cache.put(request, fresh.clone());
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (!sameOrigin(url)) return;
  if (url.pathname.endsWith('/sw.js')) return;

  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (isKnowledgeJson(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
