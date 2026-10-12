// Briefs in docs/work/<date>-<slug>/brief.md, with status, task and covers in their frontmatter.
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { readText } from './text.mjs';

export const BRIEF = /^docs\/work\/[^/]+\/brief\.md$/;

export function briefs(sc, files) {
  return files.filter((file) => BRIEF.test(file)).sort().map((path) => {
    const { data } = parseFrontmatter(readText(join(sc.root, path)) ?? '');
    // Only globs count; covers written another way cover nothing.
    const covers = typeof data.covers === 'string' ? [data.covers] : Array.isArray(data.covers) ? data.covers.filter((c) => typeof c === 'string') : [];
    return { path, status: data.status ?? 'open', task: data.task ?? null, covers };
  });
}
