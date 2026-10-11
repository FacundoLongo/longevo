#!/usr/bin/env bash
# A repo where CLAUDE.md and AGENTS.md disagree and CLAUDE.md does not import AGENTS.md.
set -euo pipefail
cat > package.json <<'JSON'
{ "name": "app", "private": true, "scripts": { "test": "vitest run", "build": "tsc" } }
JSON
cat > AGENTS.md <<'MD'
# Rules

- Use pnpm.
- Run `pnpm test` before you push.
MD
cat > CLAUDE.md <<'MD'
# Claude

- Use npm.
- Read AGENTS.md for more rules.
MD
git init -q && git add -A && git -c user.email=eval@example.com -c user.name=eval commit -qm init || true
