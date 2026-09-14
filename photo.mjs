/**
 * Morgan-Millworks — serves one stored photograph.
 *   GET /api/photo/<id>
 */
import { getStore } from '@netlify/blobs';

const STORE = 'morgan-millworks';

export default async (req) => {
  const id = decodeURIComponent(new URL(req.url).pathname.split('/').pop() || '');
  if (!id) return new Response('Not found', { status: 404 });

  try {
    /* Strong consistency, so a freshly uploaded photograph is readable the
     moment the page asks for it. */
    const store = getStore({ name: STORE, consistency: 'strong' });
    const res = await store.getWithMetadata('photo/' + id, { type: 'arrayBuffer' });
    if (!res || !res.data) return new Response('Not found', { status: 404 });
    const type = (res.metadata && res.metadata.type) || 'image/jpeg';
    return new Response(res.data, {
      status: 200,
      headers: {
        'content-type': type,
        /* The id is derived from the picture itself, so a given address
           never changes what it points at — safe to cache indefinitely. */
        'cache-control': 'public, max-age=31536000, immutable',
        'access-control-allow-origin': '*'
      }
    });
  } catch (err) {
    return new Response('Error: ' + String(err), { status: 500 });
  }
};

export const config = { path: '/api/photo/:id' };
