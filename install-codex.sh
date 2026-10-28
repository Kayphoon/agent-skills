#!/bin/sh
set -eu

# npm downloads the complete package, including native TOML files and notices.
# Arguments are forwarded literally; --dry-run can be used before installation.
if ! command -v npx >/dev/null 2>&1; then
  printf '%s\n' 'Node.js 18+ and npm/npx are required. Install Node.js and run this command again.' >&2
  exit 1
fi
exec npx --yes --package=github:Kayphoon/agent-skills agent-skills codex install "$@"
