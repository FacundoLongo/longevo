// Briefs in docs/work/<date>-<slug>/brief.md, with status, task and covers in their frontmatter.
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { readText } from './text.mjs';

export const BRIEF = /^docs\/work\/[^/]+\/brief\.md$/;

export function briefs(sc, files) {
  return files.filter((file) => BRIEF.test(file)).sort().map((path) => {
    const { data } = parseFrontmatter(readText(join(sc.root, path)) ?? '');
    const covers = Array.isArray(data.covers) ? data.covers : data.covers ? [data.covers] : [];
    return { path, status: data.status ?? 'open', task: data.task ?? null, covers };
  });
}
