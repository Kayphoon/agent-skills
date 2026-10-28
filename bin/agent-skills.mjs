#!/usr/bin/env node
// Zero-dependency installer for the skills bundled in this package.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, cpSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(PKG_ROOT, 'skills');
const PKG = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8'));

const COLORS = {
  dim: (s) => `\u001b[2m${s}\u001b[0m`,
  bold: (s) => `\u001b[1m${s}\u001b[0m`,
  green: (s) => `\u001b[32m${s}\u001b[0m`,
  yellow: (s) => `\u001b[33m${s}\u001b[0m`,
  red: (s) => `\u001b[31m${s}\u001b[0m`,
};
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (fn, s) => (useColor ? fn(s) : s);
const dim = (s) => paint(COLORS.dim, s);
const bold = (s) => paint(COLORS.bold, s);
const green = (s) => paint(COLORS.green, s);
const yellow = (s) => paint(COLORS.yellow, s);

function fail(message, code = 1) {
  console.error(paint(COLORS.red, `error: ${message}`));
  process.exit(code);
}

function readFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return null;
  const body = match[1];
  const name = /^name:\s*(.+)$/m.exec(body)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  let description = /^description:\s*(?:\|[-+]?)?\s*(.*)$/m.exec(body)?.[1]?.trim() ?? '';
  if (!description) {
    const block = /^description:\s*[|>][-+]?\s*\n((?:[ \t]+.*\n?)*)/m.exec(body)?.[1] ?? '';
    description = block.split('\n').map((line) => line.trim()).filter(Boolean).join(' ');
  }
  return { name, description };
}

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(path);
    else if (entry.isFile()) total += statSync(path).size;
  }
  return total;
}

function loadSkills() {
  if (!existsSync(SKILLS_DIR)) fail(`no skills directory at ${SKILLS_DIR}`);
  const skills = [];
  for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(SKILLS_DIR, entry.name);
    const skillFile = join(dir, 'SKILL.md');
    if (!existsSync(skillFile)) continue;
    const frontmatter = readFrontmatter(readFileSync(skillFile, 'utf8'));
    if (!frontmatter?.name) continue;
    skills.push({
      dir,
      folder: entry.name,
      name: frontmatter.name,
      description: frontmatter.description,
      bytes: dirSize(dir),
    });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function resolveSkill(skills, wanted) {
  const found = skills.find((s) => s.name === wanted || s.folder === wanted);
  if (!found) fail(`unknown skill "${wanted}" (available: ${skills.map((s) => s.name).join(', ')})`);
  return found;
}

const TARGETS = {
  agents: {
    global: () => join(homedir(), '.agents', 'skills'),
    project: (root) => join(root, '.agents', 'skills'),
  },
  codex: {
    global: () => join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'skills'),
    project: (root) => join(root, '.agents', 'skills'),
  },
  claude: {
    global: () => join(homedir(), '.claude', 'skills'),
    project: (root) => join(root, '.claude', 'skills'),
  },
  opencode: {
    global: () => join(homedir(), '.config', 'opencode', 'skills'),
    project: (root) => join(root, '.opencode', 'skills'),
  },
  cursor: {
    global: () => join(homedir(), '.cursor', 'skills'),
    project: (root) => join(root, '.cursor', 'skills'),
  },
};

function resolveTargetDir(targetName, project) {
  const target = TARGETS[targetName];
  if (!target) fail(`unknown target "${targetName}" (available: ${Object.keys(TARGETS).join(', ')})`);
  return project ? target.project(project) : target.global();
}

function install(skills, names, opts) {
  const selected = names.length ? names.map((name) => resolveSkill(skills, name)) : skills;
  const project = opts.project ? resolve(opts.project) : null;
  const targetDirs = opts.targets.map((target) => ({ target, dir: resolveTargetDir(target, project) }));
  let installed = 0;
  let skipped = 0;

  for (const { target, dir } of targetDirs) {
    if (!opts.dryRun) mkdirSync(dir, { recursive: true });
    for (const skill of selected) {
      const dest = join(dir, skill.folder);
      const exists = existsSync(dest);
      if (exists && !opts.force) {
        console.log(`${yellow('skip')} ${skill.name} -> ${dest} ${dim('(already present, use --force to replace)')}`);
        skipped += 1;
        continue;
      }
      if (opts.dryRun) {
        console.log(`${dim('would install')} ${skill.name} -> ${dest} ${dim(`[${target}]`)}`);
        continue;
      }
      if (exists) rmSync(dest, { recursive: true, force: true });
      if (opts.link) symlinkSync(skill.dir, dest, 'dir');
      else cpSync(skill.dir, dest, { recursive: true, verbatimSymlinks: true, preserveTimestamps: true });
      console.log(`${green(opts.link ? 'linked' : 'installed')} ${skill.name} -> ${dest} ${dim(`[${target}]`)}`);
      installed += 1;
    }
  }

  console.log('');
  console.log(`${installed} installed, ${skipped} skipped${opts.dryRun ? ' (dry run)' : ''}.`);
  if (installed) console.log(dim('Start a new session so the runtime can discover the new skills.'));
}

function remove(skills, names, opts) {
  if (!names.length) fail('remove needs at least one skill name');
  const selected = names.map((name) => resolveSkill(skills, name));
  const project = opts.project ? resolve(opts.project) : null;
  const targetDirs = opts.targets.map((target) => resolveTargetDir(target, project));
  let removed = 0;
  for (const dir of targetDirs) {
    for (const skill of selected) {
      const dest = join(dir, skill.folder);
      if (!existsSync(dest)) {
        console.log(`${dim('absent')} ${skill.name} in ${dir}`);
        continue;
      }
      if (opts.dryRun) {
        console.log(`${dim('would remove')} ${dest}`);
        continue;
      }
      rmSync(dest, { recursive: true, force: true });
      console.log(`${green('removed')} ${dest}`);
      removed += 1;
    }
  }
  console.log('');
  console.log(`${removed} removed${opts.dryRun ? ' (dry run)' : ''}.`);
}

function installState(skill, opts) {
  const project = opts.project ? resolve(opts.project) : null;
  const dirs = opts.targets.map((target) => resolveTargetDir(target, project));
  const found = dirs.filter((dir) => existsSync(join(dir, skill.folder)));
  return found.length ? green(`installed -> ${found[0]}`) : dim('not installed');
}

function oneLine(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function wrap(text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function list(skills, opts) {
  if (opts.json) {
    const data = skills.map(({ name, description, folder, bytes }) => ({ name, description, folder, bytes }));
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  console.log(bold(`${PKG.name} ${PKG.version}`));
  console.log('');
  for (const skill of skills) {
    console.log(`  ${bold(skill.name)} ${dim(installState(skill, opts))}`);
    console.log(`  ${wrap(oneLine(skill.description), 96).join('\n  ')}`);
    console.log('');
  }
  console.log(`Install with: ${bold('npx github:Kayphoon/agent-skills install <skill>')}`);
}

function info(skills, name, opts) {
  const skill = resolveSkill(skills, name);
  console.log(bold(skill.name));
  console.log('');
  console.log(wrap(oneLine(skill.description), 96).join('\n'));
  console.log('');
  console.log(`folder:  ${skill.folder}`);
  console.log(`source:  ${skill.dir}`);
  console.log(`size:    ${(skill.bytes / 1024).toFixed(1)} KiB`);
  console.log(`status:  ${installState(skill, opts)}`);
  const files = [];
  const walk = (dir, prefix = '') => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === 'SKILL.md' && !prefix) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, `${prefix}${entry.name}/`);
      else files.push(`${prefix}${entry.name}`);
    }
  };
  walk(skill.dir);
  if (files.length) {
    console.log('');
    console.log(dim('supporting files:'));
    for (const file of files) console.log(dim(`  ${file}`));
  }
}

function parseArgs(argv) {
  const opts = { targets: [], project: null, force: false, link: false, dryRun: false, json: false };
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('-')) {
      positionals.push(arg);
      continue;
    }
    if (arg === '-g' || arg === '--global') continue;
    if (arg === '-h' || arg === '--help') { opts.help = true; continue; }
    if (arg === '-v' || arg === '--version') { opts.version = true; continue; }
    const [key, inlineValue] = arg.replace(/^--/, '').split('=');
    const take = () => {
      if (inlineValue !== undefined) return inlineValue;
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) fail(`--${key} needs a value`);
      i += 1;
      return next;
    };
    if (key === 'target') opts.targets.push(take());
    else if (key === 'project') opts.project = take();
    else if (key === 'force' || key === 'upgrade') opts.force = true;
    else if (key === 'link') opts.link = true;
    else if (key === 'dry-run') opts.dryRun = true;
    else if (key === 'json') opts.json = true;
    else fail(`unknown option ${arg}`);
  }
  if (!opts.targets.length) opts.targets.push('agents');
  return { opts, positionals };
}

function usage(skills) {
  console.log(`${bold('agent-skills')} ${PKG.version} ${dim(`- ${skills.map((s) => s.name).join(', ')}`)}

Usage:
  npx @kayphoon/agent-skills <command> [options]
  npx github:Kayphoon/agent-skills <command> [options]

Commands:
  list [--json]                  List bundled skills and install status
  info <skill>                   Show description, path, size, install status
  install [skill...] [options]   Install skills (default: all)
  remove <skill...> [options]    Remove installed skills

Options:
  --target <name>   agents (default), codex, claude, opencode, cursor. Repeatable.
  --project <dir>   Install into a project instead of the user directory
  --force           Replace an existing skill directory at the target
  --link            Symlink instead of copying (development)
  --dry-run         Print planned changes without writing
  -h, --help        Show this help
  -v, --version     Show version

Examples:
  npx @kayphoon/agent-skills install
  npx @kayphoon/agent-skills install superwiki --target codex
  npx @kayphoon/agent-skills install explorer librarian --project ./my-repo
  npx @kayphoon/agent-skills list --json`);
}

function main() {
  const { opts, positionals } = parseArgs(process.argv.slice(2));
  if (opts.version) {
    console.log(PKG.version);
    return;
  }
  const skills = loadSkills();
  const [command = 'help', ...rest] = positionals;
  if (opts.help || command === 'help') {
    usage(skills);
    return;
  }
  if (command === 'list' || command === 'ls') list(skills, opts);
  else if (command === 'info' || command === 'show') {
    if (!rest.length) fail('info needs a skill name');
    info(skills, rest[0], opts);
  } else if (command === 'install' || command === 'add' || command === 'i') install(skills, rest, opts);
  else if (command === 'remove' || command === 'uninstall' || command === 'rm') remove(skills, rest, opts);
  else fail(`unknown command "${command}" (try --help)`);
}

main();
