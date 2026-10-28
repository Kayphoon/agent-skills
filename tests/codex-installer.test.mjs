import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { installCodexAgents } from '../bin/install-codex.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const names = ['flash_explorer', 'flash_librarian'];
const relativeFiles = [
  ...names.map((name) => join('agents', `${name}.toml`)),
  join('agent-skills-notices', 'LICENSE.txt'),
  join('agent-skills-notices', 'NOTICE.md'),
];
const sourceFor = (relative) => join(packageRoot, 'codex',
  relative.startsWith('agents') ? relative : relative.split(/[\\/]/).at(-1));
const context7Section = '\n[mcp_servers.context7]\nurl = "https://mcp.context7.com/mcp"\n';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'agent-skills-codex-test-'));
  const codexHome = join(root, 'codex-home');
  const calls = [];
  let servers = [];
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (relative, content) => {
    const path = join(codexHome, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    return path;
  };
  const read = (relative) => readFileSync(join(codexHome, relative), 'utf8');
  const runtime = {
    codexHome, packageRoot, log: () => {},
    runCodex(args) {
      calls.push([...args]);
      if (args[1] === 'list') return { status: 0, stdout: JSON.stringify(servers) };
      assert.deepEqual(args, ['mcp', 'add', 'context7', '--url', 'https://mcp.context7.com/mcp']);
      const current = existsSync(join(codexHome, 'config.toml')) ? read('config.toml') : '';
      put('config.toml', current + context7Section);
      servers = [{ name: 'context7', enabled: true }];
      return { status: 0, stdout: '' };
    },
  };
  return { root, codexHome, calls, put, read, runtime,
    setServers(value) { servers = value; } };
}

function assertNoInstalledFiles(f) {
  for (const relative of relativeFiles) assert.equal(existsSync(join(f.codexHome, relative)), false, relative);
}

function assertBundledFiles(f) {
  for (const relative of relativeFiles) {
    assert.equal(f.read(relative), readFileSync(sourceFor(relative), 'utf8'), relative);
  }
}

test('fresh installation writes both native agents and legal files, and registers missing Context7', (t) => {
  const f = fixture(t);
  const result = installCodexAgents({}, f.runtime);
  assertBundledFiles(f);
  assert.equal(result.installed, 4);
  assert.equal(result.context7, 'added');
  assert.deepEqual(f.calls, [
    ['mcp', 'list', '--json'],
    ['mcp', 'add', 'context7', '--url', 'https://mcp.context7.com/mcp'],
  ]);
  assert.equal(f.read('config.toml'), context7Section);
});

test('identical repeated installation is idempotent and does not add Context7 again', (t) => {
  const f = fixture(t);
  installCodexAgents({}, f.runtime);
  const before = relativeFiles.map((relative) => lstatSync(join(f.codexHome, relative)).mtimeMs);
  const result = installCodexAgents({}, f.runtime);
  assertBundledFiles(f);
  assert.equal(result.installed, 0);
  assert.equal(result.unchanged, 4);
  assert.deepEqual(result.backups, []);
  assert.deepEqual(relativeFiles.map((relative) => lstatSync(join(f.codexHome, relative)).mtimeMs), before);
  assert.equal(f.calls.filter((args) => args[1] === 'add').length, 1);
  assert.equal(f.read('config.toml'), context7Section);
});

test('different existing agent and legal files are preserved by default', (t) => {
  const f = fixture(t);
  for (const relative of relativeFiles) f.put(relative, `custom contents: ${relative}\n`);
  const result = installCodexAgents({ skipContext7: true }, f.runtime);
  assert.equal(result.installed, 0);
  assert.equal(result.skipped, 4);
  assert.deepEqual(result.backups, []);
  for (const relative of relativeFiles) assert.equal(f.read(relative), `custom contents: ${relative}\n`);
});

test('force replaces differing files while backing up every original verbatim', (t) => {
  const f = fixture(t);
  const originals = relativeFiles.map((relative) => `original ${relative}\nprivate custom text\n`);
  relativeFiles.forEach((relative, i) => f.put(relative, originals[i]));
  const result = installCodexAgents({ force: true, skipContext7: true }, f.runtime);
  assertBundledFiles(f);
  assert.equal(result.installed, 4);
  assert.equal(result.backups.length, 4);
  assert.deepEqual(result.backups.map((path) => readFileSync(path, 'utf8')).sort(), [...originals].sort());
  for (const path of result.backups) assert.equal(lstatSync(path).isFile(), true);
});

test('dry run with missing Context7 leaves an absent target entirely absent', (t) => {
  const f = fixture(t);
  const result = installCodexAgents({ dryRun: true }, f.runtime);
  assert.equal(result.dryRun, true);
  assert.equal(result.installed, 0);
  assert.equal(result.context7, 'would-add');
  assert.equal(existsSync(f.codexHome), false);
  assert.deepEqual(f.calls, [['mcp', 'list', '--json']]);
});

test('dry run with force does not replace or back up existing data', (t) => {
  const f = fixture(t);
  f.put('agents/flash_explorer.toml', 'keep me\n');
  f.put('config.toml', 'model_provider = "existing"\n');
  const result = installCodexAgents({ dryRun: true, force: true }, f.runtime);
  assert.equal(f.read('agents/flash_explorer.toml'), 'keep me\n');
  assert.equal(f.read('config.toml'), 'model_provider = "existing"\n');
  assert.deepEqual(result.backups, []);
  assert.deepEqual(readdirSync(f.codexHome).sort(), ['agents', 'config.toml']);
  assert.deepEqual(readdirSync(join(f.codexHome, 'agents')), ['flash_explorer.toml']);
});

for (const enabled of [true, false]) {
  test(`existing Context7 connection and authentication are preserved (enabled=${enabled})`, (t) => {
    const f = fixture(t);
    const config = '[mcp_servers.context7]\nurl = "https://custom.example/mcp"\nbearer_token_env_var = "CONTEXT7_TOKEN"\n';
    f.put('config.toml', config);
    f.setServers([{ name: 'context7', enabled, transport: { url: 'https://custom.example/mcp', bearer_token_env_var: 'CONTEXT7_TOKEN' } }]);
    installCodexAgents({}, f.runtime);
    assertBundledFiles(f);
    assert.equal(f.read('config.toml'), config);
    assert.deepEqual(f.calls, [['mcp', 'list', '--json']]);
  });
}

for (const [label, response] of [
  ['nonzero list exit', { status: 1, stdout: '' }],
  ['CLI unavailable', { status: null, stdout: '', error: { code: 'ENOENT' } }],
  ['malformed JSON', { status: 0, stdout: '{broken' }],
  ['non-array JSON', { status: 0, stdout: '{}' }],
  ['invalid server records', { status: 0, stdout: '[null]' }],
]) {
  test(`${label} fails before installing any file`, (t) => {
    const f = fixture(t);
    f.runtime.runCodex = (args) => { f.calls.push(args); return response; };
    assert.throws(() => installCodexAgents({}, f.runtime));
    assertNoInstalledFiles(f);
    assert.equal(existsSync(f.codexHome), false);
    assert.deepEqual(f.calls, [['mcp', 'list', '--json']]);
  });
}

test('failed Context7 add installs no agents and retains a verbatim backup of the original config', (t) => {
  const f = fixture(t);
  const original = '# existing provider\nmodel_provider = "custom"\n';
  f.put('config.toml', original);
  f.runtime.runCodex = (args) => {
    f.calls.push(args);
    if (args[1] === 'list') return { status: 0, stdout: '[]' };
    f.put('config.toml', '# a failed CLI may have partially changed this file\n');
    return { status: 1, stdout: '' };
  };
  assert.throws(() => installCodexAgents({}, f.runtime));
  assertNoInstalledFiles(f);
  const backups = readdirSync(f.codexHome).filter((name) => name.startsWith('config.toml.backup-'));
  assert.equal(backups.length, 1);
  assert.equal(f.read(backups[0]), original);
  assert.deepEqual(f.calls.map((args) => args[1]), ['list', 'add']);
});

test('skip-context7 installs agents without calling any Codex CLI or touching config', (t) => {
  const f = fixture(t);
  const config = 'model_provider = "preserved"\n';
  f.put('config.toml', config);
  f.runtime.runCodex = () => { assert.fail('Codex CLI must not run'); };
  installCodexAgents({ skipContext7: true }, f.runtime);
  assertBundledFiles(f);
  assert.equal(f.read('config.toml'), config);
});

test('model and effort overrides change only their top-level fields in both agents', (t) => {
  const f = fixture(t);
  const model = 'custom/model-"quoted"\\suffix';
  installCodexAgents({ skipContext7: true, model, effort: 'high' }, f.runtime);
  for (const name of names) {
    const installed = f.read(`agents/${name}.toml`);
    const bundled = readFileSync(join(packageRoot, 'codex', 'agents', `${name}.toml`), 'utf8');
    const modelLine = installed.match(/^model = (.+)$/m);
    assert.equal(JSON.parse(modelLine[1]), model);
    assert.match(installed, /^model_reasoning_effort = "high"$/m);
    const removeFields = (text) => text.replace(/^model = .*\n/m, '').replace(/^model_reasoning_effort = .*\n/m, '');
    assert.equal(removeFields(installed), removeFields(bundled));
  }
});

for (const [label, opts] of [
  ['empty model', { model: '' }],
  ['blank model', { model: '   ' }],
  ['newline model', { model: 'name\nmodel_provider = "bad"' }],
  ['non-string model', { model: 7 }],
  ['unknown effort', { effort: 'unlimited' }],
  ['blank effort', { effort: '' }],
]) {
  test(`${label} is rejected before any write or CLI call`, (t) => {
    const f = fixture(t);
    assert.throws(() => installCodexAgents(opts, f.runtime));
    assert.equal(existsSync(f.codexHome), false);
    assert.deepEqual(f.calls, []);
  });
}

test('CLI accepts model and effort flags with isolated CODEX_HOME', (t) => {
  const f = fixture(t);
  const child = spawnSync(process.execPath, [join(packageRoot, 'bin', 'install-codex.mjs'), 'install', '--skip-context7', '--model', 'local-test-model', '--effort', 'medium'], {
    encoding: 'utf8', env: { ...process.env, CODEX_HOME: f.codexHome },
  });
  assert.equal(child.status, 0, child.stderr);
  for (const name of names) {
    assert.match(f.read(`agents/${name}.toml`), /^model = "local-test-model"$/m);
    assert.match(f.read(`agents/${name}.toml`), /^model_reasoning_effort = "medium"$/m);
  }
  assert.equal(existsSync(join(f.codexHome, 'config.toml')), false);
});

for (const relative of relativeFiles) {
  test(`symlink target ${relative} is rejected without modifying its referent`, (t) => {
    const f = fixture(t);
    const referent = join(f.root, 'untouched.txt');
    writeFileSync(referent, 'outside destination\n');
    const target = join(f.codexHome, relative);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(referent, target);
    assert.throws(() => installCodexAgents({ force: true, skipContext7: true }, f.runtime));
    assert.equal(readFileSync(referent, 'utf8'), 'outside destination\n');
    assert.equal(lstatSync(target).isSymbolicLink(), true);
    for (const other of relativeFiles.filter((file) => file !== relative)) {
      assert.equal(existsSync(join(f.codexHome, other)), false);
    }
  });
}

for (const directory of ['agents', 'agent-skills-notices']) {
  test(`symlink destination directory ${directory} is rejected`, (t) => {
    const f = fixture(t);
    const outside = join(f.root, 'outside');
    mkdirSync(outside);
    mkdirSync(f.codexHome);
    symlinkSync(outside, join(f.codexHome, directory), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => installCodexAgents({ skipContext7: true }, f.runtime));
    assert.deepEqual(readdirSync(outside), []);
    assertNoInstalledFiles(f);
  });
}

test('adding Context7 via CLI preserves provider configuration and unrelated MCP text verbatim', (t) => {
  const f = fixture(t);
  const original = '# formatting and comments must survive\nmodel_provider = "custom"\n\n[model_providers.custom]\nname = "Custom"\nbase_url = "https://provider.example/v1"\nenv_key = "CUSTOM_API_KEY"\n\n[mcp_servers.other]\ncommand = "other-mcp"\nargs = ["--preserve"]\n';
  f.put('config.toml', original);
  f.setServers([{ name: 'other', enabled: true }]);
  const result = installCodexAgents({}, f.runtime);
  assertBundledFiles(f);
  assert.equal(f.read('config.toml'), original + context7Section);
  assert.equal(result.backups.length, 1);
  assert.equal(readFileSync(result.backups[0], 'utf8'), original);
});

function runShellWithFakeNpx(t, args) {
  const f = fixture(t);
  const bin = join(f.root, 'fake-bin');
  mkdirSync(bin);
  const argvPath = join(f.root, 'npx-argv');
  const fakeNpx = join(bin, 'npx');
  writeFileSync(fakeNpx, '#!/bin/sh\nprintf \'%s\\000\' "$@" > "$CODEX_TEST_ARGV"\n');
  chmodSync(fakeNpx, 0o700);
  const child = spawnSync('/bin/sh', [join(packageRoot, 'install-codex.sh'), ...args], {
    encoding: 'utf8',
    // Only the fake executable is on PATH, so this scenario cannot invoke real npx.
    env: { ...process.env, PATH: bin, CODEX_HOME: f.codexHome, CODEX_TEST_ARGV: argvPath },
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(existsSync(f.codexHome), false);
  const captured = readFileSync(argvPath, 'utf8');
  assert.ok(captured.endsWith('\0'));
  return captured.slice(0, -1).split('\0');
}

test('shell entry selects the complete GitHub package and native Codex install command', (t) => {
  assert.deepEqual(runShellWithFakeNpx(t, []), [
    '--yes', '--package=github:Kayphoon/agent-skills', 'agent-skills', 'codex', 'install',
  ]);
});

test('shell entry forwards model with spaces and dry-run as literal arguments', (t) => {
  const args = ['--model', 'model with spaces and $literal', '--dry-run', '--effort', 'low'];
  assert.deepEqual(runShellWithFakeNpx(t, args), [
    '--yes', '--package=github:Kayphoon/agent-skills', 'agent-skills', 'codex', 'install', ...args,
  ]);
});

test('installed Codex CLI registers Context7 in an isolated home and accepts the native agent config', (t) => {
  const available = spawnSync('codex', ['--version'], { encoding: 'utf8', timeout: 10000 });
  if (available.status !== 0) return t.skip('Codex CLI is not available for the integration check');
  const f = fixture(t);
  const original = '# keep provider settings and comments\nmodel_provider = "custom"\n\n[model_providers.custom]\nname = "Custom"\nbase_url = "https://provider.example/v1"\nwire_api = "responses"\nenv_key = "CUSTOM_API_KEY"\n';
  f.put('config.toml', original);
  const run = (args) => spawnSync('codex', args, {
    encoding: 'utf8', timeout: 30000,
    env: { ...process.env, CODEX_HOME: f.codexHome },
  });
  f.runtime.runCodex = run;
  const result = installCodexAgents({}, f.runtime);
  assertBundledFiles(f);
  assert.equal(result.context7, 'added');
  assert.ok(f.read('config.toml').startsWith(original));
  assert.equal(readFileSync(result.backups[0], 'utf8'), original);
  const servers = run(['mcp', 'list', '--json']);
  assert.equal(servers.status, 0, servers.stderr);
  assert.equal(JSON.parse(servers.stdout).find((s) => s.name === 'context7').transport.url, 'https://mcp.context7.com/mcp');
  const config = run(['app-server', '--strict-config', '--print-startup-config']);
  assert.equal(config.status, 0, config.stderr);
  assert.doesNotThrow(() => JSON.parse(config.stdout));
  assert.equal(installCodexAgents({}, f.runtime).installed, 0);
});
