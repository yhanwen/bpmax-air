#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_SRC="$(cd "$SCRIPT_DIR/.." && pwd)"
CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
TARGET="$CODEX_HOME_DIR/skills/bpair-skill"

mkdir -p "$CODEX_HOME_DIR/skills"
ln -sfn "$SKILL_SRC" "$TARGET"
echo "linked $TARGET -> $SKILL_SRC"
