import { brokenPost } from '../../../shared/broken-post.ts';
import type { AddressInfo } from 'node:net';
import type { Post, PostSummary } from '../../../shared/types.ts';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { escapeHtml as escape, validateSlug, outputPath } from './safety.ts';
import { site, about, contact, formatDate } from '../../../shared/content.ts';

import { startApi } from '../../api/server.ts';

// Model a content API used by a static generator, never by the static browser pages.
// Without API_ORIGIN, use a temporary local API so builds are self-contained.
const api = process.env.API_ORIGIN ? null : await startApi();
const origin = process.env.API_ORIGIN || `http://127.0.0.1:${(api!.address() as AddressInfo).port}`;
let posts: Post[];
let summaries: PostSummary[];
try {
  const list = await fetch(`${origin}/api/posts`, { signal: AbortSignal.timeout(10000) });
  if (!list.ok) throw new Error(`Content API returned ${list.status}`);
  summaries = (await list.json()) as PostSummary[];
  for (const summary of summaries) validateSlug(summary.slug);
  posts = await Promise.all(
    summaries
      .filter(({ slug }) => slug !== brokenPost.slug)
      .map(async ({ slug }) => {
        const response = await fetch(`${origin}/api/posts/${encodeURIComponent(slug)}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`Post API returned ${response.status}`);
        const post = (await response.json()) as Post;
        validateSlug(post.slug);
        if (post.slug !== slug) throw new Error('Post slug does not match requested article');
        return post;
      }),
  );
} finally {
  if (api)
    await new Promise<void>((resolve, reject) =>
      api.close((error) => (error ? reject(error) : resolve())),
    );
}

const output = fileURLToPath(new URL('../dist/', import.meta.url));
const paragraphs = (items: string[]) => items.map((p) => `<p>${escape(p)}</p>`).join('');
const art = (post: PostSummary) =>
  `<div class="art ${escape(post.color)}" aria-hidden="true"></div>`;
function shell(title: string, description: string, body: string, active = '') {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)} · ${escape(site.name)}</title><meta name="description" content="${escape(description)}"><link rel="icon" href="data:,"><link rel="stylesheet" href="/assets/styles.css"></head>
<body><a class="skip" href="#main">Skip to content</a><header><a class="brand" href="/">Fieldnotes<span>.</span></a><nav aria-label="Main navigation">${[
    ['/', 'Journal'],
    ['/about/', 'About'],
    ['/contact/', 'Contact'],
  ]
    .map(
      ([href, label]) =>
        `<a href="${href}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`,
    )
    .join(
      '',
    )}</nav></header><main id="main">${body}</main><footer><span>© 2026 Fieldnotes. Made with a little care.</span><span>A journal for the everyday curious.</span></footer></body></html>`;
}
async function page(path: string, html: string) {
  const destination = outputPath(output, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, html);
}
await mkdir(`${output}assets`, { recursive: true });
await copyFile(
  new URL('../../../shared/styles.css', import.meta.url),
  `${output}assets/styles.css`,
);
await page(
  'index.html',
  shell(
    'Journal',
    site.description,
    `<section class="intro"><p class="eyebrow">An independent journal</p><h1>${escape(site.tagline)}</h1><p class="lede">${escape(site.description)}</p></section><section aria-labelledby="latest"><div class="section-heading"><h2 id="latest">The latest notes</h2><span>Take a moment. Stay a while.</span></div><div class="posts">${summaries.map((post) => `<article class="card">${art(post)}<span class="eyebrow">${escape(post.category)}</span><h2><a href="/posts/${post.slug}/">${escape(post.title)}</a></h2><div class="meta"><time datetime="${escape(post.date)}">${escape(formatDate(post.date))}</time> · ${escape(post.readTime)}</div><p>${escape(post.excerpt)}</p><a class="read-link" href="/posts/${post.slug}/" aria-label="Read ${escape(post.title)}">Read the story →</a></article>`).join('')}</div></section><p class="note">A few considered words, every now and then. No rush to keep up.</p>`,
    '/',
  ),
);
for (const post of posts) {
  await page(
    `posts/${post.slug}/index.html`,
    shell(
      post.title,
      post.excerpt,
      `<article class="article"><a class="back" href="/">← Back to the journal</a><p class="eyebrow">${escape(post.category)}</p><h1>${escape(post.title)}</h1><p class="lede">${escape(post.excerpt)}</p><div class="meta"><time datetime="${escape(post.date)}">${escape(formatDate(post.date))}</time> · ${escape(post.readTime)}</div>${art(post)}<div class="prose">${post.sections.map((section) => `<section><h2>${escape(section.heading)}</h2>${paragraphs(section.paragraphs)}</section>`).join('')}</div><p class="note"><a href="/">Explore more stories →</a></p></article>`,
    ),
  );
}
await page(
  'about/index.html',
  shell(
    'About',
    about.title,
    `<article class="page"><p class="eyebrow">About Fieldnotes</p><h1>${escape(about.title)}</h1><div class="prose">${paragraphs(about.paragraphs)}</div><p class="note"><a href="/contact/">Say hello →</a></p></article>`,
    '/about/',
  ),
);
await page(
  'contact/index.html',
  shell(
    'Contact',
    contact.title,
    `<article class="page"><p class="eyebrow">Get in touch</p><h1>${escape(contact.title)}</h1><div class="prose">${paragraphs(contact.paragraphs)}</div><div class="contact-box"><p class="eyebrow">Drop us a note</p><a href="mailto:${escape(contact.email)}">${escape(contact.email)}</a><p class="meta">Demo address · no inbox connected</p></div></article>`,
    '/contact/',
  ),
);
await page(
  '404.html',
  shell(
    'Page not found',
    'This page could not be found.',
    '<section class="error"><p class="eyebrow">404 · A wrong turn</p><h1>This page wandered off.</h1><p class="lede">The story you are looking for is not here. There are a few good ones back at the journal.</p><a href="/">Back to the journal →</a></section>',
  ),
);
console.log(`Generated ${posts.length + 3} content pages and a 404 page in apps/static/dist`);
