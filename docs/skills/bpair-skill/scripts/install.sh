#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_SRC="$(cd "$SCRIPT_DIR/.." && pwd)"
PLATFORM="codex"
TARGET_DIR=""
MODE="link"

usage() {
  cat <<'EOF'
Usage: install.sh [options]

Options:
  --platform <name>   codex | claude-code | openclaw | opencode
  --target-dir <dir>  Override the target skills directory
  --copy              Copy files instead of creating a symlink
  --link              Create a symlink (default)
  -h, --help          Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    --target-dir)
      TARGET_DIR="$2"
      shift 2
      ;;
    --copy)
      MODE="copy"
      shift
      ;;
    --link)
      MODE="link"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

default_target_dir() {
  case "$PLATFORM" in
    codex)
      echo "${CODEX_HOME:-$HOME/.codex}/skills"
      ;;
    claude|claude-code)
      echo "${CLAUDE_HOME:-$HOME/.claude}/skills"
      ;;
    openclaw)
      echo "${OPENCLAW_HOME:-$HOME/.openclaw}/skills"
      ;;
    opencode)
      if [[ -n "${OPENCODE_HOME:-}" ]]; then
        echo "${OPENCODE_HOME}/skills"
      else
        echo "$(pwd)/.opencode/skills"
      fi
      ;;
    *)
      echo "Unsupported platform: $PLATFORM" >&2
      exit 1
      ;;
  esac
}

SKILLS_DIR="${TARGET_DIR:-$(default_target_dir)}"
TARGET="${SKILLS_DIR}/bpair-skill"

mkdir -p "$SKILLS_DIR"

if [[ "$MODE" == "copy" ]]; then
  rm -rf "$TARGET"
  cp -R "$SKILL_SRC" "$TARGET"
  echo "copied $SKILL_SRC -> $TARGET"
else
  ln -sfn "$SKILL_SRC" "$TARGET"
  echo "linked $TARGET -> $SKILL_SRC"
fi
