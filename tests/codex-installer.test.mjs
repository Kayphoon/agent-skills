import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archive = 'https://codeload.github.com/Kayphoon/codex-flash-agents/tar.gz/refs/heads/main';
const prefix = ['--yes', `--package=${archive}`, 'codex-flash-agents'];

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'agent-skills-bridge-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'fake-bin');
  mkdirSync(bin);
  // Expose only the real temporary-directory helpers, never the real npx.
  symlinkSync('/usr/bin/mktemp', join(bin, 'mktemp'));
  symlinkSync('/bin/rm', join(bin, 'rm'));
  const temporaryRoot = join(root, 'temporary cache with spaces');
  mkdirSync(temporaryRoot);
  const argvPath = join(root, 'npx-argv');
  const codexHome = join(root, 'codex-home');
  const fakeNpx = join(bin, 'npx');
  writeFileSync(fakeNpx, '#!/bin/sh\ncache=${2#--cache=}\n[ -d "${cache%/*}" ] || exit 99\nprintf x > "${cache%/*}/npx-ran"\nprintf \'%s\\000\' "$@" > "$BRIDGE_TEST_ARGV"\nexit "$BRIDGE_TEST_EXIT"\n');
  chmodSync(fakeNpx, 0o700);
  return {
    argvPath,
    run(command, args, status = 0) {
      const child = spawnSync(command, args, {
        cwd: root, encoding: 'utf8',
        // Only fake npx and temporary-directory helpers are on PATH.
        env: { ...process.env, PATH: bin, TMPDIR: temporaryRoot, CODEX_HOME: codexHome,
          BRIDGE_TEST_ARGV: argvPath, BRIDGE_TEST_EXIT: String(status) },
      });
      assert.equal(existsSync(codexHome), false, 'bridge must not install locally');
      return child;
    },
    captured() {
      const captured = readFileSync(argvPath, 'utf8');
      assert.ok(captured.endsWith('\0'));
      const args = captured.slice(0, -1).split('\0');
      assert.match(args[1], /^--cache=/);
      const cacheRoot = dirname(args[1].slice('--cache='.length));
      assert.equal(dirname(cacheRoot), temporaryRoot, 'cache must be an isolated temporary directory');
      assert.match(cacheRoot, /codex-flash-npx[.-]/);
      assert.equal(existsSync(cacheRoot), false, 'temporary cache must be cleaned after success or failure');
      args.splice(1, 1);
      return args;
    },
  };
}

const entries = [
  ['shell', '/bin/sh', [join(packageRoot, 'install-codex.sh')], []],
  ['legacy CLI', process.execPath, [join(packageRoot, 'bin/agent-skills.mjs'), 'codex'], ['install']],
  ['direct compatibility CLI', process.execPath, [join(packageRoot, 'bin/install-codex.mjs')], ['install']],
];

for (const [name, command, entry, install] of entries) {
  test(`${name} forwards literal arguments to the independent package`, (t) => {
    const f = fixture(t);
    const args = ['--model', 'model with spaces and $literal; $(not-a-command)', '--dry-run', '--effort', 'low', '--skip-context7', '--force'];
    const child = f.run(command, [...entry, ...install, ...args]);
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(f.captured(), [...prefix, 'install', ...args]);
    assert.match(child.stderr, /moved to https:\/\/github.com\/Kayphoon\/codex-flash-agents/);
  });

  test(`${name} preserves the delegated failure exit code`, (t) => {
    const f = fixture(t);
    const child = f.run(command, [...entry, ...install], 37);
    assert.equal(child.status, 37, child.stderr);
    assert.deepEqual(f.captured(), [...prefix, 'install']);
  });
}

for (const args of [[], ['--help'], ['-h'], ['help'], ['install', '--help']]) {
  test(`legacy Codex help ${JSON.stringify(args)} is local and points to the new repository`, (t) => {
    const f = fixture(t);
    const child = f.run(process.execPath, [join(packageRoot, 'bin/agent-skills.mjs'), 'codex', ...args]);
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /https:\/\/github.com\/Kayphoon\/codex-flash-agents/);
    assert.equal(existsSync(f.argvPath), false);
  });
}

test('general skills help remains local and identifies the compatibility bridge', (t) => {
  const f = fixture(t);
  const child = f.run(process.execPath, [join(packageRoot, 'bin/agent-skills.mjs'), '--help']);
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /Compatibility bridge to codex-flash-agents/);
  assert.equal(existsSync(f.argvPath), false);
});

test('npm package contains skills and compatibility bridges but no native agent resources', () => {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '--offline'], {
    cwd: packageRoot, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const files = JSON.parse(result.stdout)[0].files.map(({ path }) => path);
  assert.ok(files.includes('install-codex.sh'));
  assert.ok(files.includes('bin/install-codex.mjs'));
  for (const name of ['superwiki', 'explorer', 'librarian']) {
    assert.ok(files.includes(`skills/${name}/SKILL.md`));
  }
  assert.equal(files.some((path) => path.startsWith('codex/') || path.endsWith('.toml')), false);
});
