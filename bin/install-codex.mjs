#!/usr/bin/env node
// Compatibility bridge only; native agents and their installer live separately.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY = 'https://github.com/Kayphoon/codex-flash-agents';
const ARCHIVE = 'https://codeload.github.com/Kayphoon/codex-flash-agents/tar.gz/refs/heads/main';

export function runCodexInstaller(argv) {
  const help = ['help', '--help', '-h'];
  if (!argv.length || help.includes(argv[0]) ||
      (argv[0] === 'install' && argv.length === 2 && help.includes(argv[1]))) {
    console.log(`Native Codex agents have moved to ${REPOSITORY}\nSee the new repository for installation and options.`);
    return;
  }
  if (argv[0] !== 'install') throw new Error(`Native Codex agents have moved to ${REPOSITORY}`);
  console.error(`Codex Flash agents have moved to ${REPOSITORY}`);
  const cacheRoot = mkdtempSync(join(tmpdir(), 'codex-flash-npx-'));
  try {
    const result = spawnSync('npx', ['--yes', `--cache=${join(cacheRoot, 'npm-cache')}`, `--package=${ARCHIVE}`, 'codex-flash-agents', ...argv], {
      stdio: 'inherit', shell: false,
    });
    if (result.error) throw new Error(`Unable to run npx: ${result.error.message}`);
    process.exitCode = result.status ?? 1;
  } finally {
    rmSync(cacheRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runCodexInstaller(process.argv.slice(2)); } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}
