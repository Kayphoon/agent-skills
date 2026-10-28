#!/usr/bin/env node
// Native Codex agents; MCP registration is delegated to the Codex CLI.
import {
  chmodSync, constants, copyFileSync, lstatSync, mkdirSync, readFileSync,
  renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTEXT7_URL = 'https://mcp.context7.com/mcp';
const AGENTS = ['flash_explorer', 'flash_librarian'];
const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];

function readExisting(path) {
  let stat;
  try { stat = lstatSync(path); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (!stat.isFile()) throw new Error(`Expected a regular file (not a symlink or directory): ${path}`);
  return readFileSync(path, 'utf8');
}

function checkDirectory(path) {
  try {
    if (!lstatSync(path).isDirectory()) {
      throw new Error(`Expected a directory (not a symlink): ${path}`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function backup(path) {
  const dest = `${path}.backup-${randomUUID()}`;
  copyFileSync(path, dest, constants.COPYFILE_EXCL);
  chmodSync(dest, 0o600);
  return dest;
}

function atomicWrite(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.agent-skills-${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    renameSync(temporary, path);
  } finally {
    try { unlinkSync(temporary); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function configureTemplate(text, opts) {
  for (const [key, value] of [['model', opts.model], ['model_reasoning_effort', opts.effort]]) {
    if (value === undefined) continue;
    if (typeof value !== 'string' || !value.trim() || /[\x00-\x1f\x7f]/.test(value)) {
      throw new Error(`Invalid ${key}`);
    }
    if (key === 'model_reasoning_effort' && !EFFORTS.includes(value)) {
      throw new Error(`Unknown reasoning effort: ${value}`);
    }
    const field = new RegExp(`^${key} = "[^"\\n]*"$`, 'm');
    if (!field.test(text)) throw new Error(`Bundled agent is missing ${key}`);
    text = text.replace(field, () => `${key} = ${JSON.stringify(value)}`);
  }
  return text;
}

export function installCodexAgents(opts = {}, runtime = {}) {
  const codexHome = resolve(runtime.codexHome || process.env.CODEX_HOME || join(homedir(), '.codex'));
  const packageRoot = runtime.packageRoot || PACKAGE_ROOT;
  checkDirectory(join(codexHome, 'agents'));
  checkDirectory(join(codexHome, 'agent-skills-notices'));
  const log = runtime.log || console.log;
  const runCodex = runtime.runCodex || ((args) => spawnSync('codex', args, {
    // Inspect user config, not an MCP connection supplied by the current project.
    cwd: homedir(), encoding: 'utf8', timeout: 30000, windowsHide: true,
    shell: process.platform === 'win32',
  }));
  const callCodex = (args) => {
    const result = runCodex(args);
    if (result.error?.code === 'ENOENT') {
      throw new Error('Codex CLI is required to configure Context7. Install Codex, or use --skip-context7 to install only the agent files.');
    }
    if (result.error || result.status !== 0) {
      throw new Error(`codex ${args.join(' ')} failed. Check your Codex configuration; no existing MCP settings were intentionally replaced.`);
    }
    return result.stdout;
  };

  // Resolve the whole file plan before any mutation.
  const files = AGENTS.map((name) => ({
    path: join(codexHome, 'agents', `${name}.toml`),
    content: configureTemplate(readFileSync(join(packageRoot, 'codex', 'agents', `${name}.toml`), 'utf8'), opts),
  }));
  for (const name of ['LICENSE.txt', 'NOTICE.md']) {
    files.push({
      path: join(codexHome, 'agent-skills-notices', name),
      content: readFileSync(join(packageRoot, 'codex', name), 'utf8'),
    });
  }
  for (const file of files) {
    file.previous = readExisting(file.path);
    file.action = file.previous === file.content ? 'unchanged'
      : file.previous !== null && !opts.force ? 'skip' : 'install';
  }

  let context7 = 'skipped';
  let configBefore = null;
  const configPath = join(codexHome, 'config.toml');
  if (!opts.skipContext7) {
    const servers = JSON.parse(callCodex(['mcp', 'list', '--json']));
    if (!Array.isArray(servers) || servers.some((s) => !s || typeof s.name !== 'string')) {
      throw new Error('Unexpected response from codex mcp list --json; nothing was installed.');
    }
    const existing = servers.find((s) => s.name === 'context7');
    context7 = existing ? (existing.enabled === false ? 'disabled' : 'existing') : 'add';
    if (context7 === 'add') configBefore = readExisting(configPath);
  }

  log(`Codex home: ${codexHome}`);
  for (const file of files) {
    log(`${opts.dryRun ? 'would ' : ''}${file.action}: ${file.path}`);
  }
  if (context7 === 'disabled') log('Context7 exists but is disabled; enable it in Codex settings to use it.');
  else if (context7 === 'existing') log('Context7: preserving the existing connection and authentication settings.');
  else if (context7 === 'add') log(`Context7: ${opts.dryRun ? 'would add' : 'adding'} ${CONTEXT7_URL}`);
  else log('Context7: skipped by request.');
  const result = {
    installed: 0, unchanged: files.filter((f) => f.action === 'unchanged').length,
    skipped: files.filter((f) => f.action === 'skip').length,
    context7: context7 === 'add' && opts.dryRun ? 'would-add' : context7,
    backups: [], dryRun: Boolean(opts.dryRun),
  };
  if (opts.dryRun) return result;

  // Only add a missing server. Codex handles the TOML edit, preserving other settings.
  if (context7 === 'add') {
    if (readExisting(configPath) !== configBefore) throw new Error('Codex config changed during installation; retry.');
    if (configBefore !== null) {
      const saved = backup(configPath);
      result.backups.push(saved);
      log(`Config backup: ${saved}`);
    }
    callCodex(['mcp', 'add', 'context7', '--url', CONTEXT7_URL]);
    result.context7 = 'added';
  }

  for (const file of files) {
    if (file.action !== 'install') continue;
    if (readExisting(file.path) !== file.previous) throw new Error(`File changed during installation; retry: ${file.path}`);
    if (file.previous !== null) {
      const saved = backup(file.path);
      result.backups.push(saved);
      log(`Backup: ${saved}`);
    }
    atomicWrite(file.path, file.content);
    result.installed += 1;
  }
  log(`${result.installed} files installed, ${result.unchanged} unchanged, ${result.skipped} preserved.`);
  if (result.skipped) log('Use --force to replace preserved files after backing them up.');
  log('Start a new Codex session and ask it to use flash_explorer or flash_librarian.');
  log('The configured model must be available through your existing provider; use --model and --effort to choose another.');
  return result;
}

const USAGE = `Install native Codex agents and Context7:
  npx --yes github:Kayphoon/agent-skills codex install [options]

Options:
  --model <id>       Set both agents' model (default: deepseek-flash)
  --effort <level>   Set both agents' reasoning effort (default: low)
  --force           Back up and replace differing agent/notice files
  --dry-run         Show planned changes without modifying target files
  --skip-context7   Install agent files only; no Codex CLI required
  -h, --help        Show help

Uses CODEX_HOME when set, otherwise ~/.codex. Existing MCP settings are preserved.
Agent permissions and provider are inherited from the parent Codex session.
`;

export function runCodexInstaller(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return;
  }
  if (argv[0] !== 'install') throw new Error('Expected: codex install (use codex --help).');
  const opts = {};
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--force') opts.force = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--skip-context7') opts.skipContext7 = true;
    else if (arg === '--model' || arg === '--effort') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`${arg} needs a value`);
      opts[arg.slice(2)] = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return installCodexAgents(opts);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runCodexInstaller(process.argv.slice(2)); } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}
