#!/bin/sh
set -eu

# Compatibility bridge; the native agents are maintained in their own repository.
printf '%s\n' 'Codex Flash agents have moved to https://github.com/Kayphoon/codex-flash-agents' >&2
if ! command -v npx >/dev/null 2>&1; then
  printf '%s\n' 'Node.js 18+ and npm/npx are required. Install Node.js and run this command again.' >&2
  exit 1
fi
# A fresh cache prevents npm from reusing an older archive at the same main URL.
codex_flash_cache=$(mktemp -d "${TMPDIR:-/tmp}/codex-flash-npx.XXXXXXXX")
trap 'rm -rf "$codex_flash_cache"' 0
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
codex_flash_status=0
npx --yes --cache="$codex_flash_cache/npm-cache" --package=https://codeload.github.com/Kayphoon/codex-flash-agents/tar.gz/refs/heads/main codex-flash-agents install "$@" || codex_flash_status=$?
exit "$codex_flash_status"
