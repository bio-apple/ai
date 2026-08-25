/**
 * Cloudflare Worker：按同步码存取视频预览 JSON（KV）+ 页面 meta 抓取
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const KEY_RE = /^[\w-]{8,48}$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function decodeJsonString(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"');
}

function metaTag(html, key, attr = 'property') {
  const re1 = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["']`, 'i');
  return decodeJsonString(html.match(re1)?.[1] || html.match(re2)?.[1] || '');
}

function firstJsonThumb(html, field) {
  const re = new RegExp(
    `"${field}"\\s*:\\s*\\{[\\s\\S]{0,800}?"thumbnails"\\s*:\\s*\\[\\s*\\{\\s*"url"\\s*:\\s*"([^"]+)"`,
    'i',
  );
  return decodeJsonString(html.match(re)?.[1] || '');
}

async function youtubeChannelThumb(html, pageUrl) {
  try {
    const host = new URL(pageUrl).hostname.replace(/^www\./, '');
    if (!host.includes('youtube.com') && host !== 'youtu.be') return '';
  } catch {
    return '';
  }
  const channelId = html.match(/"channelId"\s*:\s*"(UC[^"]+)"/)?.[1] || '';
  if (!channelId) return '';
  try {
    const rssRes = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BioAIVideoPreview/2.0)' },
      },
    );
    if (!rssRes.ok) return '';
    const rss = await rssRes.text();
    return (
      rss.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1] ||
      rss.match(/<media:thumbnail url="([^"]+)"/i)?.[1] ||
      ''
    );
  } catch {
    return '';
  }
}

function parseMetaFromHtml(html) {
  let thumbnail =
    metaTag(html, 'og:image') ||
    metaTag(html, 'og:image:url') ||
    metaTag(html, 'twitter:image') ||
    metaTag(html, 'twitter:image', 'name');
  const title =
    metaTag(html, 'og:title') ||
    metaTag(html, 'title', 'name') ||
    metaTag(html, 'twitter:title', 'name');
  const author =
    metaTag(html, 'og:site_name') ||
    metaTag(html, 'author', 'name') ||
    metaTag(html, 'application-name', 'name');
  const description = metaTag(html, 'og:description') || metaTag(html, 'description', 'name');

  if (!thumbnail) thumbnail = firstJsonThumb(html, 'avatar');
  if (!thumbnail) thumbnail = firstJsonThumb(html, 'banner');
  if (!thumbnail) thumbnail = firstJsonThumb(html, 'thumbnail');

  return {
    title: title.trim(),
    author: author.trim(),
    thumbnail: thumbnail.trim(),
    description: description.trim(),
  };
}

async function handleMeta(url) {
  const target = url.searchParams.get('url') || '';
  if (!target) return json({ error: 'missing url' }, 400);
  let targetUrl;
  try {
    targetUrl = new URL(target.includes('://') ? target : `https://${target}`);
  } catch {
    return json({ error: 'invalid url' }, 400);
  }
  if (!/^https?:$/i.test(targetUrl.protocol)) {
    return json({ error: 'invalid protocol' }, 400);
  }

  try {
    const res = await fetch(targetUrl.href, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
      },
      redirect: 'follow',
    });
    if (!res.ok) return json({ error: 'upstream failed', status: res.status }, 502);
    const html = await res.text();
    if (!html || html.length < 200) {
      return json({ error: 'empty upstream body' }, 502);
    }
    const meta = parseMetaFromHtml(html);
    if (!meta.thumbnail) {
      const rssThumb = await youtubeChannelThumb(html, targetUrl.href);
      if (rssThumb) meta.thumbnail = rssThumb;
    }
    return json(meta);
  } catch (err) {
    return json({ error: 'fetch failed', message: String(err?.message || err) }, 502);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    if (url.pathname === '/meta') {
      if (request.method !== 'GET') {
        return json({ error: 'method not allowed' }, 405);
      }
      return handleMeta(url);
    }

    const syncKey = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!KEY_RE.test(syncKey)) {
      return json({ error: 'invalid sync key' }, 400);
    }

    const kvKey = `preview:${syncKey}`;

    if (request.method === 'GET') {
      const raw = await env.SYNC_KV.get(kvKey);
      return new Response(raw || '[]', {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'PUT') {
      const body = await request.text();
      if (body.length > 65536) {
        return json({ error: 'payload too large' }, 413);
      }
      try {
        const parsed = JSON.parse(body);
        if (!Array.isArray(parsed)) throw new Error('not array');
      } catch {
        return json({ error: 'invalid json array' }, 400);
      }
      await env.SYNC_KV.put(kvKey, body);
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  },
};
