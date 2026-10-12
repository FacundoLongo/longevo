// Collects facts about the folder for longevo-init. Read-only, except the session marker in .git.
// Home files are read only for agent setup (names only), and shown as ~/...
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { AGENTS, agentsInUse, geminiFiles, installedSkills, mcpServers, skillFindings } from './lib/agents.mjs';
import { generatedFiles } from './lib/attributes.mjs';
import { readBlock } from './lib/block.mjs';
import { citedCommands, commandFindings, realCommands } from './lib/commands.mjs';
import { coverageFor, coverageState } from './lib/coverage.mjs';
import { docFindings, livingDocs } from './lib/docs.mjs';
import { hooks as findHooks } from './lib/hooks.mjs';
import { hotspots } from './lib/hotspots.mjs';
import { findInstructionFiles, instructionFindings, inventory, linkedFiles, unsharedRules, whoLoads } from './lib/instructions.mjs';
import { citedPaths, missingPaths } from './lib/paths.mjs';
import { chain, listFiles, scope } from './lib/repo.mjs';
import { redactDeep, securityFindings } from './lib/security.mjs';
import { declined, session } from './lib/state.mjs';
import { testInventory } from './lib/tests.mjs';
import { codeSpans, readText } from './lib/text.mjs';
import { workspaces } from './lib/workspaces.mjs';

export const VERSION = 2;

const dirOf = (file) => (file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '');

export function scan(cwd, { markSession = false, home = homedir() } = {}) {
  const sc = scope(cwd);
  const { files, notScanned } = listFiles(sc);
  const dirs = chain(sc);
  const scopeDir = dirs[dirs.length - 1];
  // Commands and tests come only from the scope folder, its subfolders, its parents and the repo CI.
  const scoped = scopeDir === ''
    ? files
    : files.filter((file) => {
      const dir = dirOf(file);
      return dirs.includes(dir) || dir === scopeDir || dir.startsWith(`${scopeDir}/`) || file.startsWith('.github/workflows/');
    });

  const instructionFiles = findInstructionFiles(files, dirs);
  const raw = Object.fromEntries(instructionFiles.map((file) => [file, readText(join(sc.root, file))]));
  const texts = Object.fromEntries(instructionFiles.map((file) => [file, raw[file] ?? '']));
  const instructionInventory = inventory(sc, instructionFiles, raw);
  const aliases = linkedFiles(sc.root, instructionFiles);
  const loads = whoLoads(dirs, instructionFiles, texts, { geminiFiles: geminiFiles(sc, home), aliases });

  const inUse = agentsInUse(sc, files, home);
  const mcp = mcpServers(sc, home);
  const skills = installedSkills(sc, files, home);

  const generated = generatedFiles(sc, files);
  const ws = workspaces(sc.root, files);
  const docs = livingDocs(sc, files, generated);
  const hooks = findHooks(sc, scoped);
  const { defined, ...commands } = realCommands(sc.root, scoped);
  const real = { ...commands, hooks: hooks.flatMap((hook) => hook.commands) };
  const cited = instructionFiles.flatMap((file) => citedCommands(file, codeSpans(texts[file])))
    .map((command) => ({ ...command, where: [...new Set(defined[`${command.kind}:${command.name}`] ?? [])].sort() }));
  const agentsPath = join(sc.cwd, 'AGENTS.md');

  return redactDeep({
    version: VERSION,
    scope: sc,
    home: { read: [...mcp.read, ...skills.read] },
    instructions: { files: instructionInventory, loads },
    commands: { real, cited },
    workspaces: ws,
    hotspots: hotspots(sc, files, ws.packages, { generated }),
    hooks,
    agents: {
      inUse,
      mcp: mcp.servers,
      skills: {
        repo: skills.repo.map(({ name, dirs: where, agents }) => ({ name, dirs: where, agents })),
        home: skills.home.map(({ name, agents }) => ({ name, agents })),
      },
    },
    docs: { living: docs.living, candidates: docs.candidates },
    block: { file: relative(sc.root, agentsPath).split(sep).join('/'), ...readBlock(readText(agentsPath)) },
    coverage: coverageState(sc.root, coverageFor(sc, files, generated, { docs: docs.living })),
    findings: [
      ...instructionFindings(instructionInventory, loads),
      ...unsharedRules(dirs, instructionInventory, texts, loads, inUse.length ? inUse : AGENTS, aliases),
      ...skillFindings(inUse, skills),
      ...commandFindings(cited, real),
      ...docFindings(docs),
    ],
    missingPaths: instructionFiles.flatMap((file) => missingPaths(sc.root, file, citedPaths(codeSpans(texts[file])), files)),
    tests: testInventory(sc.root, scoped, { packages: ws.packages }),
    security: instructionFiles.flatMap((file) => securityFindings(file, texts[file])),
    session: session(sc, markSession),
    declined: declined(sc),
    notScanned,
  });
}
