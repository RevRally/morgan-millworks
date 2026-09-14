/**
 * Morgan-Millworks — site content store
 *
 *   GET  /api/site-data   → the published content as JSON
 *   POST /api/site-data   → replace it (needs the editor password)
 *
 * Content lives in Netlify Blobs. Photographs are split out of the payload
 * and stored as their own blobs, so the page load stays small.
 */
import { getStore } from '@netlify/blobs';

const KEY = 'site-data';
const STORE = 'morgan-millworks';

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign(
      {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'content-type, x-editor-password',
        'access-control-allow-methods': 'GET, POST, OPTIONS'
      },
      extra
    )
  });
}

/* No fallback on purpose. If EDITOR_PASSWORD is not set, every write is
   refused — a missing setup step must lock the editor, never open it. */
function password() {
  const p = process.env.EDITOR_PASSWORD;
  return typeof p === 'string' && p.length ? p : null;
}

/* A short, stable id for a given photograph, so republishing the same
   picture does not store a second copy of it. */
function idFor(dataUri) {
  let h = 5381;
  for (let i = 0; i < dataUri.length; i++) {
    h = ((h << 5) + h + dataUri.charCodeAt(i)) >>> 0;
  }
  return h.toString(36) + '-' + dataUri.length.toString(36);
}

function bytesFromDataUri(uri) {
  const comma = uri.indexOf(',');
  if (comma === -1) return null;
  const head = uri.slice(0, comma);
  const type = (head.match(/^data:([^;,]+)/) || [])[1] || 'image/jpeg';
  const b64 = uri.slice(comma + 1);
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return { bytes: out, type };
}

export default async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });

  /* Strong consistency: every publish replaces the same key and the next
     page load reads it straight back. Eventual consistency would serve the
     previous content for a while — indistinguishable from a failed publish. */
  const store = getStore({ name: STORE, consistency: 'strong' });

  if (req.method === 'GET') {
    try {
      const saved = await store.get(KEY, { type: 'json' });
      if (!saved) return json({ ok: true, data: null });
      return json({ ok: true, data: saved });
    } catch (err) {
      return json({ ok: false, error: String(err) }, 500);
    }
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const expected = password();
  if (!expected) {
    return json({
      ok: false,
      error: 'Publishing is switched off: this site has no EDITOR_PASSWORD set. Add it in Netlify under Site configuration, Environment variables.'
    }, 503);
  }
  const given = req.headers.get('x-editor-password') || '';
  if (given !== expected) return json({ ok: false, error: 'Wrong password' }, 401);

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return json({ ok: false, error: 'Could not read the submitted content' }, 400);
  }
  if (!body || !Array.isArray(body.shows) || !Array.isArray(body.gallery)) {
    return json({ ok: false, error: 'Content is missing its shows or gallery' }, 400);
  }

  /* Lift every freshly uploaded photograph out into its own blob. */
  let stored = 0;
  const gallery = [];
  for (const row of body.gallery) {
    const copy = Array.isArray(row) ? row.slice() : [];
    const img = copy[2] || '';
    if (typeof img === 'string' && img.startsWith('data:')) {
      const parsed = bytesFromDataUri(img);
      if (parsed) {
        const id = idFor(img);
        try {
          await store.set('photo/' + id, new Blob([parsed.bytes], { type: parsed.type }), { metadata: { type: parsed.type } });
          copy[2] = '/api/photo/' + id;
          stored++;
        } catch (err) {
          return json({ ok: false, error: 'Could not save a photograph: ' + String(err) }, 500);
        }
      }
    }
    gallery.push(copy);
  }

  const payload = {
    shows: body.shows,
    gallery,
    prices: Array.isArray(body.prices) ? body.prices : [],
    publishedAt: new Date().toISOString()
  };

  try {
    await store.setJSON(KEY, payload);
  } catch (err) {
    return json({ ok: false, error: 'Could not save the content: ' + String(err) }, 500);
  }

  return json({ ok: true, data: payload, photosStored: stored });
};

export const config = { path: '/api/site-data' };
