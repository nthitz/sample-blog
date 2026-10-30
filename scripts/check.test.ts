import { brokenPost } from '../shared/broken-post.ts';
import {
  createPostDatabase,
  contentBytes,
  contentDelayMs,
  INLINE_BODY_BYTES,
  READ_CHUNK_BYTES,
} from '../apps/api/database.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startServer, serverPort } from './serve.ts';
import { about, contact } from '../shared/content.ts';
import { posts } from '../apps/api/posts.ts';
import { startApi } from '../apps/api/server.ts';
import { getPosts, getPost } from '../apps/react/src/api.ts';

for (const variant of ['static', 'react'] as const) {
  test(`${variant}: production routes, missing assets, and deep links`, async (t) => {
    const api = await startApi();
    t.after(
      () =>
        new Promise<void>((resolve, reject) =>
          api.close((error) => (error ? reject(error) : resolve())),
        ),
    );
    const server = await startServer({ variant, apiOrigin: `http://127.0.0.1:${serverPort(api)}` });
    t.after(
      () =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    );
    const origin = `http://127.0.0.1:${serverPort(server)}`;
    const routes = ['/', '/about/', '/contact/', ...posts.map((p) => `/posts/${p.slug}/`)];
    for (const path of routes) {
      const response = await fetch(origin + path, { headers: { Accept: 'text/html' } });
      assert.equal(response.status, 200, path);
      const html = await response.text();
      assert.match(html, /<html lang="en">/);
      if (variant === 'static') {
        assert.doesNotMatch(html, /<script/);
        const expected =
          path === '/'
            ? 'The latest notes'
            : path === '/about/'
              ? about.title
              : path === '/contact/'
                ? contact.title
                : posts.find((p) => path.includes(p.slug))!.title;
        assert.ok(html.includes(expected), path);
        for (const match of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
          const target = await fetch(origin + match[1]);
          assert.equal(
            target.status,
            match[1] === `/posts/${brokenPost.slug}/` ? 404 : 200,
            `${path} links to ${match[1]}`,
          );
        }
      } else assert.match(html, /id="root"/);
    }
    const missing = await fetch(origin + '/not-a-page/', { headers: { Accept: 'text/html' } });
    assert.equal(missing.status, variant === 'static' ? 404 : 200);
    if (variant === 'static') assert.match(await missing.text(), /This page wandered off/);
    assert.equal((await fetch(origin + '/assets/missing.js')).status, 404);
    assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
  });
}

test('React build has lazy route chunks without bundled article bodies', async () => {
  const { readdir } = await import('node:fs/promises');
  const directory = new URL('../apps/react/dist/assets/', import.meta.url);
  const files = await readdir(directory);
  for (const route of ['home', 'post', 'about', 'contact']) {
    assert.ok(
      files.some((name) => name.startsWith(`${route}-`) && name.endsWith('.js')),
      route,
    );
  }
  const bundles = await Promise.all(
    files
      .filter((name) => name.endsWith('.js'))
      .map((name) => readFile(new URL(name, directory), 'utf8')),
  );
  for (const post of posts)
    assert.ok(
      bundles.every((js) => !js.includes(post.sections[0].paragraphs[0])),
      post.slug,
    );
});

test('API and React loaders work through the production proxy, including failure paths', async (t) => {
  const api = await startApi();
  const server = await startServer({
    variant: 'react',
    apiOrigin: `http://127.0.0.1:${serverPort(api)}`,
  });
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  t.after(() => {
    if (api.listening)
      return new Promise<void>((resolve, reject) =>
        api.close((error) => (error ? reject(error) : resolve())),
      );
  });
  const origin = `http://127.0.0.1:${serverPort(server)}`;
  const request = () => new Request(origin + '/');
  const summaries = await getPosts(request());
  assert.equal(summaries.length, posts.length + 1);
  assert.ok(summaries.every((post) => !('sections' in post)));
  for (const post of posts) assert.deepEqual(await getPost(post.slug, request()), post);
  await assert.rejects(
    getPost('missing', request()),
    (error) => error instanceof Response && error.status === 404,
  );
  const missing = await fetch(origin + '/api/unknown', { headers: { Accept: 'text/html' } });
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('content-type') ?? '', /application\/json/);
  assert.equal((await fetch(origin + '/api/posts/%ZZ')).status, 400);
  assert.equal((await fetch(origin + '/api/posts', { method: 'POST' })).status, 405);
  const head = await fetch(origin + '/api/posts', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    getPosts(new Request(origin, { signal: controller.signal })),
    (error) => error instanceof Error && error.name === 'AbortError',
  );
  // Stop the API to verify that the preview proxy does not serve the SPA shell on failure.
  await new Promise<void>((resolve, reject) =>
    api.close((error) => (error ? reject(error) : resolve())),
  );
  await assert.rejects(
    getPosts(request()),
    (error) => error instanceof Response && error.status === 502,
  );
});

test('every fourth successful content GET waits one second without blocking other requests', async (t) => {
  const api = await startApi();
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        api.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const origin = `http://127.0.0.1:${serverPort(api)}`;
  for (let i = 1; i <= 8; i++) {
    // Health, HEAD, and missing content do not change the successful-GET counter.
    await fetch(`${origin}/api/health`).then((response) => response.arrayBuffer());
    await fetch(`${origin}/api/posts`, { method: 'HEAD' });
    await fetch(`${origin}/api/posts/missing`).then((response) => response.arrayBuffer());
    const path = i % 2 ? '/api/posts' : `/api/posts/${posts[0].slug}`;
    const started = performance.now();
    const response = await fetch(origin + path);
    await response.arrayBuffer();
    assert.equal(response.status, 200);
    if (i % 4 === 0) {
      assert.ok(performance.now() - started >= 900, `request ${i} returned before the delay`);
      assert.match(response.headers.get('server-timing') ?? '', /artificial_delay;dur=\d/);
    } else assert.doesNotMatch(response.headers.get('server-timing') ?? '', /artificial_delay/);
  }
  // Requests 9–11 are fast; request 12 sleeps while request 13 and health still respond.
  for (let i = 0; i < 3; i++)
    await fetch(`${origin}/api/posts`).then((response) => response.arrayBuffer());
  let slowFinished = false;
  const slow = fetch(`${origin}/api/posts`).then(async (response) => {
    await response.arrayBuffer();
    slowFinished = true;
    return response;
  });
  // Separate connections allow the next content request to run during the sleeping one.
  const fast = await fetch(`${origin}/api/posts`);
  await fast.arrayBuffer();
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  await health.arrayBuffer();
  assert.equal(slowFinished, false, 'The delay blocked unrelated work');
  assert.equal((await slow).status, 200);
});

test('SQLite stores a snapshot, summaries omit bodies, and content cost scales by bytes', async (t) => {
  const seed = structuredClone(posts);
  const database = createPostDatabase(seed);
  t.after(() => database.close());
  seed[0].title = 'Changed after database initialization';
  assert.equal((await database.getPost(posts[0].slug))?.post.title, posts[0].title);
  const summaries = database.listPosts();
  assert.equal(summaries.length, 4);
  assert.ok(summaries.every((post) => !('sections' in post)));
  assert.equal(await database.getPost('absent'), undefined);
  for (const post of posts.slice(0, 3)) assert.equal(contentDelayMs(contentBytes(post)), 0);
  const large = posts[3];
  const words = (post: typeof large) =>
    post.sections
      .flatMap((section) => section.paragraphs)
      .join(' ')
      .split(/\s+/).length;
  assert.ok(words(large) >= words(posts[0]) * 9.5);
  assert.ok(words(large) <= words(posts[0]) * 10.5);
  assert.equal(contentDelayMs(contentBytes(large)), 2000);
  assert.equal(contentDelayMs(INLINE_BODY_BYTES), 0);
  assert.equal(contentDelayMs(INLINE_BODY_BYTES + 1), 100);
  assert.equal(contentDelayMs(INLINE_BODY_BYTES + READ_CHUNK_BYTES * 10), 1000);
  assert.equal(contentDelayMs(INLINE_BODY_BYTES + READ_CHUNK_BYTES * 30), 3000);
  // An arbitrary post with the same content pays the same cost, independently of its slug.
  const renamed = { ...large, slug: 'unrelated-record-id' };
  assert.equal(contentDelayMs(contentBytes(renamed)), contentDelayMs(contentBytes(large)));
});

test('long post API read adds its content cost to the existing fourth-request wait', async (t) => {
  const api = await startApi();
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        api.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const origin = `http://127.0.0.1:${serverPort(api)}`;
  for (const post of posts.slice(0, 3)) {
    const response = await fetch(`${origin}/api/posts/${post.slug}`);
    assert.match(response.headers.get('server-timing') ?? '', /content_read;dur=0/);
    await response.arrayBuffer();
  }
  const started = performance.now();
  const pending = fetch(`${origin}/api/posts/${posts[3].slug}`);
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  await health.arrayBuffer();
  const response = await pending;
  assert.deepEqual(await response.json(), posts[3]);
  assert.ok(performance.now() - started >= 2900);
  const timing = response.headers.get('server-timing') ?? '';
  assert.match(timing, /content_read;dur=2000/);
  assert.match(timing, /db_read;dur=\d/);
  assert.match(timing, /artificial_delay;dur=\d/);
});

test('Safari user agents add the same minimum penalty to short and long records', async (t) => {
  const { isSafariUserAgent, SAFARI_PENALTY_MS } = await import('../apps/api/database.ts');
  const safari =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';
  const chrome =
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  assert.equal(isSafariUserAgent(safari), true);
  assert.equal(
    isSafariUserAgent(
      'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1',
    ),
    true,
  );
  for (const ua of [
    chrome,
    chrome + ' Edg/130.0',
    safari + ' CriOS/130.0',
    safari + ' FxiOS/130.0',
    'node',
    '',
  ])
    assert.equal(isSafariUserAgent(ua), false, ua);
  for (const post of [posts[0], posts[3]]) {
    assert.equal(
      contentDelayMs(contentBytes(post), safari) - contentDelayMs(contentBytes(post), chrome),
      SAFARI_PENALTY_MS,
    );
  }
  for (const [post, ua, expectedSize, expectedSafari] of [
    [posts[0], chrome, 0, 0],
    [posts[0], safari, 0, 1000],
    [posts[3], safari, 2000, 1000],
  ] as const) {
    const api = await startApi();
    t.after(
      () =>
        new Promise<void>((resolve, reject) =>
          api.close((error) => (error ? reject(error) : resolve())),
        ),
    );
    const started = performance.now();
    const response = await fetch(`http://127.0.0.1:${serverPort(api)}/api/posts/${post.slug}`, {
      headers: { 'User-Agent': ua },
    });
    await response.arrayBuffer();
    assert.equal(response.status, 200);
    const timing = response.headers.get('server-timing') ?? '';
    assert.match(timing, new RegExp(`content_read;dur=${expectedSize}`));
    assert.match(timing, new RegExp(`safari_penalty;dur=${expectedSafari}`));
    assert.ok(performance.now() - started >= expectedSize + expectedSafari - 100);
    assert.doesNotMatch(timing, /artificial_delay/);
  }
});

test('Safari delays index and informational pages without delaying shells or probes', async (t) => {
  const safari = 'Mozilla/5.0 Version/18.6 Safari/605.1.15';
  const api = await startApi();
  const origin = `http://127.0.0.1:${serverPort(api)}`;
  t.after(() => new Promise<void>((resolve) => api.close(() => resolve())));
  const check = async (url: string, delayed: boolean, method = 'GET', ua = safari) => {
    const started = performance.now();
    const response = await fetch(url, {
      method,
      headers: { 'User-Agent': ua, Accept: 'text/html' },
    });
    await response.arrayBuffer();
    assert.equal(response.status, 200, url);
    if (delayed) {
      assert.match(response.headers.get('server-timing') ?? '', /safari_penalty;dur=1000/);
      assert.ok(performance.now() - started >= 950, url);
    } else assert.doesNotMatch(response.headers.get('server-timing') ?? '', /safari_penalty/);
  };
  for (const path of ['/api/posts', '/api/pages/about', '/api/pages/contact']) {
    await check(origin + path, true);
    await check(origin + path, false, 'HEAD');
  }
  await check(origin + '/api/health', false);
  for (const path of ['/api/pages/about', '/api/pages/contact'])
    await check(origin + path, false, 'GET', 'Chrome/130.0 Safari/537.36');
  for (const variant of ['static', 'react'] as const) {
    const server = await startServer({ variant, apiOrigin: origin });
    t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
    const base = `http://127.0.0.1:${serverPort(server)}`;
    for (const path of ['/', '/about/', '/contact/'])
      await check(base + path, variant === 'static');
    await check(base + '/about/', false, 'HEAD');
    if (variant === 'react') await check(base + '/api/pages/about', true);
  }
});

test('stale index entry fails individually while healthy posts remain available', async (t) => {
  const api = await startApi();
  t.after(() => new Promise<void>((resolve) => api.close(() => resolve())));
  const origin = `http://127.0.0.1:${serverPort(api)}`;
  const summaries = (await (await fetch(origin + '/api/posts')).json()) as { slug: string }[];
  assert.ok(summaries.some((post) => post.slug === brokenPost.slug));
  const response = await fetch(`${origin}/api/posts/${brokenPost.slug}`);
  assert.equal(response.status, 500);
  assert.equal((await response.json()).code, 'ARTICLE_CONTENT_UNAVAILABLE');
  await assert.rejects(
    getPost(brokenPost.slug, new Request(origin)),
    (error) => error instanceof Response && error.status === 500,
  );
  assert.equal((await fetch(`${origin}/api/posts/${posts[0].slug}`)).status, 200);
  const server = await startServer({ variant: 'static' });
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const base = `http://127.0.0.1:${serverPort(server)}`;
  assert.ok((await (await fetch(base)).text()).includes(`/posts/${brokenPost.slug}/`));
  const missing = await fetch(`${base}/posts/${brokenPost.slug}/`);
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /This page wandered off/);
});

test('static generation escapes API content and rejects unsafe slugs before writing', async (t) => {
  const { mkdtemp, mkdir, copyFile, symlink, rm, readdir } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { createServer } = await import('node:http');
  const { escapeHtml, outputPath } = await import('../apps/static/scripts/safety.ts');
  const root = await mkdtemp(join(tmpdir(), 'static-security-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scripts = join(root, 'apps/static/scripts');
  await mkdir(scripts, { recursive: true });
  for (const name of ['build.ts', 'safety.ts'])
    await copyFile(new URL(`../apps/static/scripts/${name}`, import.meta.url), join(scripts, name));
  await symlink(fileURLToPath(new URL('../shared', import.meta.url)), join(root, 'shared'));
  await symlink(fileURLToPath(new URL('../apps/api', import.meta.url)), join(root, 'apps/api'));
  const payload = '\"><script>alert("injection")</script><img src=x onerror=alert(1)> & \'test\'';
  const malicious = {
    ...structuredClone(posts[0]),
    title: payload,
    category: payload,
    excerpt: payload,
    readTime: payload,
    color: payload,
    sections: [{ heading: payload, paragraphs: [payload] }],
  };
  let summarySlug = malicious.slug;
  let articleSlug = malicious.slug;
  const api = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify(
        req.url === '/api/posts'
          ? [{ ...malicious, slug: summarySlug }]
          : { ...malicious, slug: articleSlug },
      ),
    );
  });
  await new Promise<void>((resolve) => api.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => api.close(() => resolve())));
  const build = () =>
    promisify(execFile)(process.execPath, [join(scripts, 'build.ts')], {
      env: { ...process.env, API_ORIGIN: `http://127.0.0.1:${serverPort(api)}` },
    });
  await build();
  const output = join(root, 'apps/static/dist');
  for (const page of ['index.html', `posts/${malicious.slug}/index.html`]) {
    const html = await readFile(join(output, page), 'utf8');
    assert.ok(html.includes(escapeHtml(payload)), page);
    assert.doesNotMatch(html, /<script|<img|class="art ">/);
  }
  await rm(output, { recursive: true });
  for (const slug of [
    '../escape',
    '../../escape',
    '/absolute',
    'a/b',
    'a\\b',
    '%2e%2e',
    '..',
    '',
    payload,
  ]) {
    summarySlug = slug;
    await assert.rejects(build(), /Invalid article slug/);
    summarySlug = malicious.slug;
    articleSlug = slug;
    await assert.rejects(build(), /Invalid article slug/);
    articleSlug = malicious.slug;
  }
  articleSlug = 'different-article';
  await assert.rejects(build(), /Post slug does not match/);
  assert.deepEqual(await readdir(join(root, 'apps/static')), ['scripts']);
  for (const path of ['../escape', '../../escape', output, `${output}-sibling/file`])
    assert.throws(() => outputPath(output, path), /inside the build directory/);
});
