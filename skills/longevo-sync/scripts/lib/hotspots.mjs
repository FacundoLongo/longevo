// The files that changed most in the last 12 months, without lockfiles, generated files or big reformat commits.
import { generatedFiles, isNoise } from './attributes.mjs';
import { git } from './repo.mjs';
import { areaOf } from './tests.mjs';

export const MAX_COMMIT_FILES = 100;

export function commitsSince(sc, { range, since } = {}) {
  if (!sc.isGit) return [];
  // Without rename detection a moved file shows under its old path too, so moving code out of covers counts.
  const args = ['-c', 'core.quotePath=false', 'log', '--no-merges', '--no-renames', '--format=%x00%H', '--name-only'];
  if (since) args.push(`--since=${since}`);
  if (range) args.push(range);
  const out = git(sc.root, args);
  if (!out) return [];
  return out.split('\0').filter((chunk) => chunk.trim()).map((chunk) => {
    const [hash, ...files] = chunk.split('\n');
    return { hash: hash.trim(), files: files.map((file) => file.trim()).filter(Boolean) };
  });
}

export function hotspots(sc, files, packages, { limit = 10, generated = generatedFiles(sc, files) } = {}) {
  const existing = new Set(files);
  const counts = new Map();
  for (const commit of commitsSince(sc, { since: '12.months' })) {
    const real = [...new Set(commit.files)].filter((file) => !isNoise(file, generated));
    if (real.length > MAX_COMMIT_FILES) continue;
    for (const file of real) if (existing.has(file)) counts.set(file, (counts.get(file) ?? 0) + 1);
  }
  const ranked = [...counts].map(([file, commits]) => ({ file, commits })).sort((a, b) => b.commits - a.commits || a.file.localeCompare(b.file));
  const byArea = new Map();
  for (const { file, commits } of ranked) byArea.set(areaOf(file, packages), (byArea.get(areaOf(file, packages)) ?? 0) + commits);
  const areas = [...byArea].map(([area, commits]) => ({ area, commits })).sort((a, b) => b.commits - a.commits || a.area.localeCompare(b.area));
  return { files: ranked.slice(0, limit), areas: areas.slice(0, 5) };
}
