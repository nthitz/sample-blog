import { isSafariUserAgent, SAFARI_PENALTY_MS } from '../../shared/safari.ts';
export { isSafariUserAgent, SAFARI_PENALTY_MS } from '../../shared/safari.ts';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Post, PostSummary } from '../../shared/types.ts';

// Model a fast inline read, then a constrained materialization path in 512-byte chunks.
// This is deliberate simulation, not the measured performance of SQLite.
export const INLINE_BODY_BYTES = 2048;
export const READ_CHUNK_BYTES = 512;
export const READ_CHUNK_MS = 100;
export const contentBytes = (post: Post): number =>
  Buffer.byteLength(post.sections.flatMap((section) => section.paragraphs).join('\n\n'), 'utf8');
export const sizeDelayMs = (bytes: number): number =>
  Math.ceil(Math.max(0, bytes - INLINE_BODY_BYTES) / READ_CHUNK_BYTES) * READ_CHUNK_MS;

export const contentDelayMs = (bytes: number, userAgent = ''): number =>
  sizeDelayMs(bytes) + (isSafariUserAgent(userAgent) ? SAFARI_PENALTY_MS : 0);

export function createPostDatabase(seed: Post[]) {
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE posts (slug TEXT PRIMARY KEY, summary_json TEXT NOT NULL, body_json TEXT NOT NULL, body_bytes INTEGER NOT NULL)',
  );
  const insert = db.prepare('INSERT INTO posts VALUES (?, ?, ?, ?)');
  for (const post of seed) {
    const { sections, ...summary } = post;
    insert.run(post.slug, JSON.stringify(summary), JSON.stringify(post), contentBytes(post));
  }
  const list = db.prepare('SELECT summary_json FROM posts ORDER BY rowid');
  const summary = db.prepare('SELECT summary_json FROM posts WHERE slug = ?');
  const find = db.prepare('SELECT body_json, body_bytes FROM posts WHERE slug = ?');
  return {
    listPosts(): PostSummary[] {
      return list.all().map((row) => JSON.parse(row.summary_json as string) as PostSummary);
    },
    getSummary(slug: string): PostSummary | undefined {
      const row = summary.get(slug);
      return row ? (JSON.parse(row.summary_json as string) as PostSummary) : undefined;
    },
    async getPost(slug: string, userAgent = '') {
      const read = async () => {
        const row = find.get(slug);
        if (!row) return undefined;
        const bytes = Number(row.body_bytes);
        const sizeCostMs = sizeDelayMs(bytes);
        const safariDelayMs = isSafariUserAgent(userAgent) ? SAFARI_PENALTY_MS : 0;
        const delayMs = contentDelayMs(bytes, userAgent);
        if (delayMs) await sleep(delayMs);
        return {
          post: JSON.parse(row.body_json as string) as Post,
          bytes,
          delayMs,
          sizeDelayMs: sizeCostMs,
          safariDelayMs,
        };
      };
      return read();
    },
    close() {
      db.close();
    },
  };
}
