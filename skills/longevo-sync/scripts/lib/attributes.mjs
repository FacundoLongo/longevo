// Files that never count as real changes: lockfiles, vendored folders and files marked generated or vendored.
import { gitInput } from './repo.mjs';

export const LOCKFILE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|go\.sum|poetry\.lock|uv\.lock|Pipfile\.lock|Gemfile\.lock|composer\.lock|Package\.resolved|mix\.lock|pubspec\.lock|packages\.lock\.json|gradle\.lockfile|flake\.lock)$/;
export const VENDOR_DIR = /(^|\/)(node_modules|vendor|dist|build|target|\.next)\//;

// Paths with linguist-generated or linguist-vendored set in .gitattributes.
export function generatedFiles(sc, files) {
  const found = new Set();
  if (!sc.isGit || files.length === 0) return found;
  const out = gitInput(sc.root, ['check-attr', '-z', '--stdin', 'linguist-generated', 'linguist-vendored'], `${files.join('\0')}\0`) ?? '';
  const parts = out.split('\0');
  for (let i = 0; i + 2 < parts.length; i += 3) {
    if (parts[i + 2] === 'set' || parts[i + 2] === 'true') found.add(parts[i]);
  }
  return found;
}

export function isNoise(file, generated) {
  return LOCKFILE.test(file) || VENDOR_DIR.test(file) || generated.has(file);
}
