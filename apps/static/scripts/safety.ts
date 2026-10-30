import { isAbsolute, relative, resolve, sep } from 'node:path';

export const escapeHtml = (value: unknown): string =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );

export function validateSlug(slug: unknown): asserts slug is string {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('Invalid article slug: expected lowercase letters, digits, and single hyphens');
  }
}

export function outputPath(root: string, path: string): string {
  const destination = resolve(root, path);
  const withinRoot = relative(root, destination);
  if (
    !withinRoot ||
    withinRoot === '..' ||
    withinRoot.startsWith(`..${sep}`) ||
    isAbsolute(withinRoot)
  ) {
    throw new Error('Output path must remain inside the build directory');
  }
  return destination;
}
