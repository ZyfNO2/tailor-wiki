import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createWorkbenchServer } from '../server.mjs';
import { openWorkbench, probe } from '../open.mjs';
import { installIndependent, packRoot } from '../../../research-pack/install-independent.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(appRoot, '../..');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-launch-'));
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => { server.closeAllConnections?.(); return new Promise(resolve => server.close(resolve)); };
const stop = pid => { try { process.kill(pid); } catch { /* already gone */ } };
const identity = async port => (await fetch(`http://127.0.0.1:${port}/api/identity`)).json();
const workspace = () => { const root = temp(); fs.writeFileSync(path.join(root, 'STORY-PLAN.md'), '# 叙事\n\n一句话主线：只用于测试。\n'); return fs.realpathSync(root); };
const hashes = dir => {
  const out = {};
  const visit = rel => { for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) { const r = path.posix.join(rel, e.name); if (e.isDirectory()) visit(r); else out[r] = createHash('sha256').update(fs.readFileSync(path.join(dir, r))).digest('hex'); } };
  visit('');
  return out;
};

test('the launcher reuses only a workbench bound to the same workspace and paths; other projects and busy ports are skipped', async () => {
  const w1 = workspace(), w2 = workspace(), started = [];
  const s1 = createWorkbenchServer(w1), p1 = await listen(s1);
  const other = http.createServer((req, res) => res.end('another app')), po = await listen(other);
  try {
    assert.deepEqual((await probe(p1)).identity.workspace, w1);
    assert.equal((await probe(po)).state, 'other');
    const same = await openWorkbench({ workspace: w1, port: p1 });
    assert.equal(same.ok, true); assert.equal(same.reused, true); assert.equal(same.url, `http://127.0.0.1:${p1}/`);
    // Same workspace but different --paths would show different content: not reused.
    const paths = await openWorkbench({ workspace: w1, port: p1, paths: ['runs'] }); started.push(paths.pid);
    assert.equal(paths.ok, true); assert.equal(paths.reused, false); assert.notEqual(paths.port, p1);
    assert.match(paths.skipped[0], new RegExp(`^${p1}：`));
    assert.deepEqual(await identity(paths.port), { ...(await identity(paths.port)), workspace: w1, paths: ['runs'] });
    // Another workspace on the requested port is never returned.
    const second = await openWorkbench({ workspace: w2, port: p1 }); if (!second.reused) started.push(second.pid);
    assert.equal(second.ok, true); assert.notEqual(second.port, p1); assert.equal((await identity(second.port)).workspace, w2);
    const json = await (await fetch(second.url + 'api/workbench')).json();
    assert.equal(json.workspace, w2); assert.equal(json.projects[0].docs.story.status, 'ok');
    // A port busy with something that is not this workbench is skipped.
    const busy = await openWorkbench({ workspace: w2, port: po }); if (!busy.reused) started.push(busy.pid);
    assert.equal(busy.ok, true); assert.notEqual(busy.port, po); assert.match(busy.skipped[0], new RegExp(`^${po}：`));
    assert.equal((await identity(busy.port)).workspace, w2);
  } finally {
    started.forEach(stop); await close(s1); await close(other);
  }
});

test('a failed start prints the real error and the existing Markdown outputs, never a URL', async () => {
  // A copy of the launcher whose server exits with an error, as a broken install would.
  const app = temp(), root = workspace();
  fs.mkdirSync(path.join(app, 'lib'));
  fs.copyFileSync(path.join(appRoot, 'open.mjs'), path.join(app, 'open.mjs'));
  fs.copyFileSync(path.join(appRoot, 'lib/docs.mjs'), path.join(app, 'lib/docs.mjs'));
  fs.writeFileSync(path.join(app, 'server.mjs'), "process.stderr.write('boom: cannot read workspace\\n'); process.exit(3);\n");
  fs.writeFileSync(path.join(root, 'TAILOR.md'), '# 方案\n');
  const probeServer = http.createServer(), port = await listen(probeServer); await close(probeServer);
  const text = spawnSync(process.execPath, [path.join(app, 'open.mjs'), '--workspace', root, '--port', String(port)], { encoding: 'utf8' });
  assert.equal(text.status, 1);
  assert.match(text.stdout, /工作台没有打开/); assert.match(text.stdout, /boom: cannot read workspace/);
  assert.match(text.stdout, /TAILOR\.md/); assert.match(text.stdout, /STORY-PLAN\.md/);
  assert.doesNotMatch(text.stdout, /https?:\/\//);
  const json = JSON.parse(spawnSync(process.execPath, [path.join(app, 'open.mjs'), '--workspace', root, '--port', String(port), '--json'], { encoding: 'utf8' }).stdout);
  assert.equal(json.ok, false); assert.equal(json.url, undefined);
  assert.deepEqual(json.outputs.map(f => path.basename(f)).sort(), ['STORY-PLAN.md', 'TAILOR.md']);
  const missing = spawnSync(process.execPath, [path.join(appRoot, 'open.mjs'), '--workspace', path.join(root, 'nope')], { encoding: 'utf8' });
  assert.equal(missing.status, 1); assert.match(missing.stdout, /ENOENT|no such file/);
});

test('the installer adds the read-only workbench by default; --no-workbench installs identical Skills; an existing one is kept', async () => {
  const withWb = workspace(), without = workspace(), kept = workspace();
  const a = installIndependent(withWb, undefined, true, packRoot, 'claude');
  assert.equal(a.workbench.status, 'installed'); assert.equal(a.workbench.open, 'node .claude/workbench/open.mjs --workspace .');
  const wb = path.join(withWb, '.claude/workbench');
  for (const file of ['open.mjs', 'server.mjs', 'lib/pack.mjs', 'lib/adapter.mjs', 'web/index.html', 'pack/research-intent.mjs', 'pack/install-independent.mjs', 'pack/trial-skills/wiki-maintain/scripts/wiki.mjs']) assert.ok(fs.existsSync(path.join(wb, file)), file);
  assert.equal(fs.existsSync(path.join(wb, 'web/assets/js/data.js')), false, 'design-prototype sample data is not installed');
  assert.equal(fs.existsSync(path.join(wb, 'tests')), false);
  const b = installIndependent(without, undefined, true, packRoot, 'claude', { workbench: false });
  assert.equal(b.workbench.status, 'skipped'); assert.equal(fs.existsSync(path.join(without, '.claude/workbench')), false);
  assert.deepEqual(hashes(path.join(without, '.claude/skills')), hashes(path.join(withWb, '.claude/skills')));
  fs.mkdirSync(path.join(kept, '.agents/workbench'), { recursive: true }); fs.writeFileSync(path.join(kept, '.agents/workbench/mine.txt'), 'user file');
  const c = installIndependent(kept, ['research-story'], true);
  assert.equal(c.workbench.status, 'exists'); assert.equal(fs.readFileSync(path.join(kept, '.agents/workbench/mine.txt'), 'utf8'), 'user file');
  assert.equal(fs.existsSync(path.join(kept, '.agents/workbench/open.mjs')), false);
  const cli = JSON.parse(spawnSync(process.execPath, [path.join(repo, 'research-pack/install-independent.mjs'), '--workspace', workspace(), '--no-workbench', '--write'], { encoding: 'utf8' }).stdout);
  assert.equal(cli.workbench.status, 'skipped'); assert.equal(cli.destinations.length, 5);
  // The installed copy reads with its own pack modules, not the repository's.
  const pack = await import(pathToFileURL(path.join(wb, 'lib/pack.mjs')).href);
  assert.equal(pack.packRoot, path.join(wb, 'pack'));
  const { readWorkbench } = await import(pathToFileURL(path.join(wb, 'lib/adapter.mjs')).href);
  const p = await readWorkbench(withWb);
  assert.equal(p.docs.story.status, 'ok'); assert.ok(p.skills.every(s => s.installed.includes('.claude/skills')));
});
