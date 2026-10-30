import type { about, contact } from '../../../shared/content.ts';
import type { Post, PostSummary } from '../../../shared/types.ts';
async function readJson<T>(path: string, request: Request): Promise<T> {
  let response;
  try {
    response = await fetch(new URL(path, request.url), {
      signal: request.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (request.signal.aborted) throw error;
    throw new Response('The journal is temporarily unavailable.', { status: 503 });
  }
  if (!response.ok)
    throw new Response('Unable to load journal content.', { status: response.status });
  return response.json() as Promise<T>;
}
export const getPosts = (request: Request) => readJson<PostSummary[]>('/api/posts', request);
export const getPost = (slug: string, request: Request) =>
  readJson<Post>(`/api/posts/${encodeURIComponent(slug)}`, request);

export const getAbout = (request: Request) => readJson<typeof about>('/api/pages/about', request);
export const getContact = (request: Request) =>
  readJson<typeof contact>('/api/pages/contact', request);
