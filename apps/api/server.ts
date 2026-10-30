import { brokenPost } from '../../shared/broken-post.ts';
import { about, contact } from '../../shared/content.ts';
import { isSafariUserAgent, SAFARI_PENALTY_MS } from '../../shared/safari.ts';
import { createPostDatabase } from './database.ts';
import { simulateLatency } from './latency.ts';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { posts } from './posts.ts';

// A seeded SQLite database keeps the sample deterministic without an external service.
export async function startApi({ port = 0, host = '127.0.0.1' } = {}) {
  const database = createPostDatabase(posts);
  let contentRequests = 0;
  const server = createServer(async (req, res) => {
    const maybeDelay = async () => {
      if (req.method !== 'GET' || ++contentRequests % 4 !== 0) return;
      const started = performance.now();
      await simulateLatency();
      res.appendHeader(
        'Server-Timing',
        `artificial_delay;dur=${(performance.now() - started).toFixed(1)};desc="Intentional 1s delay"`,
      );
    };
    const json = (status: number, data: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...headers,
      });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(data));
    };
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname).replace(
        /\/$/,
        '',
      );
    } catch {
      return json(400, { error: 'Bad request' });
    }
    if (!['GET', 'HEAD'].includes(req.method ?? 'GET'))
      return json(405, { error: 'Method not allowed' }, { Allow: 'GET, HEAD' });
    if (pathname === '/api/health') return json(200, { status: 'ok' });
    const delaySafariPage = async () => {
      if (req.method !== 'GET' || !isSafariUserAgent(req.headers['user-agent'] ?? '')) return;
      await simulateLatency('safari_page_delay');
      res.appendHeader(
        'Server-Timing',
        `safari_penalty;dur=${SAFARI_PENALTY_MS};desc="Intentional Safari UA penalty"`,
      );
    };
    if (pathname === '/api/pages/about' || pathname === '/api/pages/contact') {
      await delaySafariPage();
      return json(200, pathname.endsWith('/about') ? about : contact);
    }
    if (pathname === '/api/posts') {
      await delaySafariPage();
      await maybeDelay();
      return json(200, [...database.listPosts(), brokenPost]);
    }
    const match = pathname.match(/^\/api\/posts\/([^/]+)$/);
    if (match) {
      if (match[1] === brokenPost.slug)
        return json(500, {
          error: 'Article content unavailable',
          code: 'ARTICLE_CONTENT_UNAVAILABLE',
        });
      if (req.method === 'HEAD') {
        const summary = database.getSummary(match[1]);
        return summary ? json(200, summary) : json(404, { error: 'Post not found' });
      }
      const readStarted = performance.now();
      const result = await database.getPost(match[1], req.headers['user-agent'] ?? '');
      if (!result) return json(404, { error: 'Post not found' });
      res.appendHeader(
        'Server-Timing',
        `db_read;dur=${(performance.now() - readStarted).toFixed(1)};desc="SQLite post read", content_read;dur=${result.sizeDelayMs};desc="Size-based materialization", safari_penalty;dur=${result.safariDelayMs};desc="Intentional Safari UA penalty"`,
      );
      await maybeDelay();
      return json(200, result.post);
    }
    json(404, { error: 'Endpoint not found' });
  });
  server.once('close', () => database.close());
  await new Promise<void>((resolve, reject) => {
    server.once('error', (error) => {
      database.close();
      reject(error);
    });
    server.listen(port, host, resolve);
  });
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startApi({ port: Number(process.env.PORT || 3001) });
  console.log(`Content API: http://127.0.0.1:${(server.address() as AddressInfo).port}`);
}
