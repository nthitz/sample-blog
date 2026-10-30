import type { PostSummary } from './types.ts';

// Deliberate stale-index fixture: discoverable summary, unavailable article body.
export const brokenPost: PostSummary = {
  slug: 'the-note-that-never-arrived',
  title: 'The note that never arrived',
  category: 'Everyday life',
  date: '2026-05-21',
  readTime: '3 min read',
  color: 'sage',
  excerpt: 'On unfinished thoughts, misplaced notebooks, and the stories we keep meaning to tell.',
};
