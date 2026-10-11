// Checks every skill folder: frontmatter, naming, size and relative links.
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseFrontmatter(text) {
  const match = text.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return null;
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (pair) data[pair[1]] = pair[2].trim().replace(/^["']|["']$/g, '');
  }
  return data;
}

function markdownFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...markdownFiles(path));
    else if (path.endsWith('.md')) files.push(path);
  }
  return files;
}

export function validateSkill(skillDir) {
  const folder = basename(skillDir);
  const skillFile = join(skillDir, 'SKILL.md');
  if (!existsSync(skillFile)) return [`${folder}: missing SKILL.md`];
  const text = readFileSync(skillFile, 'utf8');
  const frontmatter = parseFrontmatter(text);
  if (!frontmatter) return [`${folder}: SKILL.md has no frontmatter`];
  const errors = [];
  if (frontmatter.name !== folder) errors.push(`${folder}: name "${frontmatter.name}" must match the folder name`);
  if (!folder.startsWith('longevo-')) errors.push(`${folder}: name must start with "longevo-"`);
  if (!frontmatter.description) errors.push(`${folder}: description is missing`);
  else if (frontmatter.description.length > 1024) errors.push(`${folder}: description is longer than 1024 characters`);
  const lines = text.split('\n').length;
  if (lines > 500) errors.push(`${folder}: SKILL.md has ${lines} lines (limit 500)`);
  for (const file of markdownFiles(skillDir)) {
    const body = readFileSync(file, 'utf8');
    for (const link of body.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
      const target = link[1];
      if (/^[a-z]+:/i.test(target)) continue;
      if (!existsSync(resolve(dirname(file), target))) {
        errors.push(`${folder}: broken link to ${target} in ${file.slice(skillDir.length + 1)}`);
      }
    }
  }
  return errors;
}

export function validateAll(skillsRoot) {
  if (!existsSync(skillsRoot)) return [`${skillsRoot} does not exist`];
  const dirs = readdirSync(skillsRoot)
    .map((entry) => join(skillsRoot, entry))
    .filter((path) => statSync(path).isDirectory());
  if (dirs.length === 0) return [`${skillsRoot} has no skills`];
  return dirs.flatMap(validateSkill);
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const errors = validateAll(process.argv[2] ?? 'skills');
  for (const error of errors) console.error(error);
  process.exit(errors.length ? 1 : 0);
}
