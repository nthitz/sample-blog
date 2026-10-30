import { setTimeout as sleep } from 'node:timers/promises';
import { isSafariUserAgent, SAFARI_PENALTY_MS } from '../shared/safari.ts';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createServer, request as httpRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

type Variant = 'static' | 'react';
type ServerOptions = { variant: Variant; port?: number; host?: string; apiOrigin?: string };
export const serverPort = (server: Server): number => (server.address() as AddressInfo).port;
export async function startServer({
  variant,
  port = 0,
  host = '127.0.0.1',
  apiOrigin = process.env.API_ORIGIN || 'http://127.0.0.1:3001',
}: ServerOptions) {
  if (!['static', 'react'].includes(variant)) throw new Error('Choose static or react');
  const root = fileURLToPath(new URL(`../apps/${variant}/dist/`, import.meta.url));
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
  };
  const server = createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method ?? 'GET')) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    let path;
    try {
      path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    } catch {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }
    if (variant === 'react' && (path === '/api' || path.startsWith('/api/'))) {
      const upstream = httpRequest(
        new URL(req.url ?? '/', apiOrigin),
        {
          method: req.method,
          headers: { ...req.headers, host: new URL(apiOrigin).host },
        },
        (response) => {
          res.writeHead(response.statusCode ?? 502, response.headers);
          response.pipe(res);
        },
      );
      upstream.setTimeout(10000, () => upstream.destroy(new Error('API timeout')));
      upstream.on('error', () => {
        if (res.headersSent) {
          res.destroy();
          return;
        }
        res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: 'Content API unavailable' }));
      });
      res.on('close', () => upstream.destroy());
      req.pipe(upstream);
      return;
    }
    let file = resolve(root, `.${path}`);
    if (file !== root.slice(0, -1) && !file.startsWith(`${root.replace(/\/$/, '')}${sep}`)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    let status = 200;
    try {
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
      await stat(file);
    } catch {
      const documentRequest = req.headers.accept?.includes('text/html');
      if (variant === 'react' && documentRequest) file = resolve(root, 'index.html');
      else {
        status = 404;
        file = resolve(root, variant === 'static' ? '404.html' : '__missing__');
      }
    }
    try {
      const body = await readFile(file);
      // Static navigation has no API loader: delay HTML delivery, never assets or React's shell.
      const safariDelay =
        variant === 'static' &&
        status === 200 &&
        extname(file) === '.html' &&
        req.method === 'GET' &&
        isSafariUserAgent(req.headers['user-agent'] ?? '');
      if (safariDelay) {
        await sleep(SAFARI_PENALTY_MS);
        res.setHeader(
          'Server-Timing',
          `safari_penalty;dur=${SAFARI_PENALTY_MS};desc="Intentional Safari UA penalty"`,
        );
      }
      res.writeHead(status, {
        'Content-Type': types[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });
  await new Promise<void>((done, reject) => {
    server.once('error', reject);
    server.listen(port, host, done);
  });
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const variant = process.argv[2];
  if (variant !== 'static' && variant !== 'react') throw new Error('Choose static or react');
  const server = await startServer({ variant, port: Number(process.argv[3]) });
  console.log(`${variant}: http://127.0.0.1:${serverPort(server)}`);
}
