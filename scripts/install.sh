#!/usr/bin/env bash
# Link the Longevo skills into the folders that coding agents read.
# Usage: scripts/install.sh [--uninstall]
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
targets=("$HOME/.agents/skills" "$HOME/.claude/skills")
mode="${1:-install}"

case "$mode" in
  install | --uninstall) ;;
  *) echo "usage: scripts/install.sh [--uninstall]" >&2; exit 2 ;;
esac

# True when the path is a link this script made: it points inside this repo's skills folder.
owned() {
  [ -L "$1" ] || return 1
  case "$(readlink "$1")" in
    "$repo"/skills/*) return 0 ;;
    *) return 1 ;;
  esac
}

for skill in "$repo"/skills/longevo-*/; do
  skill="${skill%/}"
  name="$(basename "$skill")"
  for target in "${targets[@]}"; do
    link="$target/$name"
    if [ "$mode" = "--uninstall" ]; then
      if owned "$link"; then rm "$link"; echo "removed $link"; fi
      continue
    fi
    mkdir -p "$target"
    if owned "$link"; then
      ln -sfn "$skill" "$link"
    elif [ -e "$link" ] || [ -L "$link" ]; then
      echo "skipped $link: something else already uses this name" >&2
      continue
    else
      ln -s "$skill" "$link"
    fi
    echo "linked $link"
  done
done
