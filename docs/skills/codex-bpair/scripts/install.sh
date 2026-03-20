#!/usr/bin/env bash
set -euo pipefail

SKILL_SRC="/Users/yanghanwen/Development/Cicada/bpmax-air/docs/skills/codex-bpair"
CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
TARGET="$CODEX_HOME_DIR/skills/codex-bpair"

mkdir -p "$CODEX_HOME_DIR/skills"
ln -sfn "$SKILL_SRC" "$TARGET"
echo "linked $TARGET -> $SKILL_SRC"
