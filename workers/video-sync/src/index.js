/**
 * Cloudflare Worker：按同步码存取视频预览 JSON（KV）
 * 部署：cd workers/video-sync && npx wrangler deploy
 * 然后将 Workers URL 写入 data/site.json → video_preview_sync.api_url
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const KEY_RE = /^[\w-]{8,48}$/;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const syncKey = decodeURIComponent(url.pathname.replace(/^\//, ''));

    if (!KEY_RE.test(syncKey)) {
      return new Response(JSON.stringify({ error: 'invalid sync key' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
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
        return new Response(JSON.stringify({ error: 'payload too large' }), {
          status: 413,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      try {
        const parsed = JSON.parse(body);
        if (!Array.isArray(parsed)) throw new Error('not array');
      } catch {
        return new Response(JSON.stringify({ error: 'invalid json array' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      await env.SYNC_KV.put(kvKey, body);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  },
};
