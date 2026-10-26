import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FileWiki } from '../../../research-pack/trial-skills/wiki-maintain/scripts/wiki.mjs';
import { skillNames, skillFiles } from '../../../research-pack/install-independent.mjs';
import { readWorkbench, fingerprint } from '../lib/adapter.mjs';
import { renderMarkdown } from '../lib/markdown.mjs';
import { createWorkbenchServer } from '../server.mjs';
import { buildFixture } from './fixture.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(appRoot, '../..');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-fixture-'));
// Every file under the workspace with its bytes hash and mtime: the
// workbench must leave this exactly as it found it.
function tree(root) {
  const out = {};
  const visit = rel => {
    for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const r = path.posix.join(rel, e.name), full = path.join(root, r);
      if (e.isDirectory()) { out[r + '/'] = 'dir'; visit(r); } else out[r] = createHash('sha256').update(fs.readFileSync(full)).digest('hex') + ':' + fs.statSync(full).mtimeMs;
    }
  };
  visit('');
  return out;
}
async function serve(root, opt) {
  const server = createWorkbenchServer(root, opt);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: 'http://127.0.0.1:' + server.address().port, close: () => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); } };
}

test('projection maps the verified snapshot, the four Skill artifacts and run records', async () => {
  const root = await buildFixture(temp());
  const p = await readWorkbench(root, { paths: ['runs'] });
  assert.equal(p.live, true); assert.equal(p.sample, false); assert.equal(p.empty, false);
  assert.deepEqual(p.pages.map(x => x.id).sort(), ['baseline-a', 'crack-seg']);
  const crack = p.pages.find(x => x.id === 'crack-seg'), base = p.pages.find(x => x.id === 'baseline-a');
  assert.equal(crack.versions.length, 2); assert.equal(crack.versions[0].note, '设计稿更新了接入位置与窗口大小。');
  assert.equal(base.review, 'reviewed'); assert.equal(crack.review, 'pending');
  assert.match(crack.body, /<a class="dsh-plink" href="#\/knowledge\/read\/baseline-a">基线 A<\/a>/);
  assert.equal((crack.body.match(/\{\{c:c\d+\}\}/g) ?? []).length, 3, 'one marker per content citation');
  const cite = p.citations[crack.citations[0]];
  assert.equal(cite.loc, '第 3 行'); assert.equal(cite.missing, false); assert.equal(cite.stale, false);
  assert.ok(cite.context.some(l => l.hit && l.t.includes('窗口为 7')));
  assert.deepEqual(Object.fromEntries(p.sources.map(s => [s.path, s.status])), { 'materials/design.md': 'processed', 'materials/report.md': 'processed', 'materials/notes.md': 'partial', 'materials/slides.pptx': 'failed' });
  assert.equal(p.coverage.status, 'partial'); assert.equal(p.issues[0].id, 'metric-protocol');
  assert.deepEqual(p.schemes.map(s => [s.id, s.readiness, s.evidence, s.decision]), [['S1', 'design', 'pending', 'unknown'], ['S2', 'pilot', 'partial', 'unknown']]);
  assert.deepEqual(p.schemes[0].plans, ['E1', 'E2']);
  assert.deepEqual(p.plans.map(x => [x.id, x.exec, x.scheme, x.deps.join()]), [['E1', 'pending', null, 'T2'], ['E2', 'pending', 'S1', 'T3']]);
  assert.deepEqual(p.tasks.map(t => [t.id, t.exec]), [['T1', 'done'], ['T2', 'blocked'], ['T3', 'pending']]);
  assert.deepEqual(p.dagEdges.map(e => e.state), ['ok', 'blocked', 'missing']); assert.deepEqual(p.dagMissing.map(m => m.id), ['T9']);
  assert.match(p.story.thread, /^细裂缝漏检/); assert.deepEqual(p.story.contributions.map(c => c.refs), [['plan:E1', 'wiki:baseline-a'], ['scheme:S1', 'plan:E2']]);
  assert.deepEqual(p.runs.map(r => [r.id, r.plan, r.status, r.prov]), [['R-E1-0', 'E1', 'pending', 'current']]);
  assert.ok(p.graph.edges.some(e => e.from === 'crack-seg' && e.to === 'baseline-a' && e.type === 'cites'));
  assert.ok(p.graph.edges.some(e => e.from === 'S1' && e.to === 'crack-seg' && e.type === 'adopts'));
  assert.equal(p.files.find(f => f.key === 'team').status, 'missing');
  assert.ok(Object.keys(p.traces).length >= 2);
});

test('read only: workspace bytes unchanged, no lock taken, Skill writes proceed while the server runs', { timeout: 20000 }, async () => {
  const root = await buildFixture(temp());
  const before = tree(root), fp = fingerprint(root, { paths: ['runs'] });
  const s = await serve(root, { paths: ['runs'] });
  try {
    for (const url of ['/api/workbench', '/api/fingerprint', '/', '/assets/js/live.js']) assert.equal((await fetch(s.url + url)).status, 200);
    assert.deepEqual(tree(root), before);
    assert.equal(fs.existsSync(path.join(root, '.wiki/writer.lock')), false);
    // A Skill-side write while the workbench is serving: no HOST_BUSY, no conflict.
    const wiki = new FileWiki(root), prepared = await wiki.run('prepare', { paths: ['materials/report.md'] });
    const applied = await wiki.run('apply', { runId: prepared.runId, baseCommitId: prepared.baseCommitId, draftType: 'fixture', complete: true, pages: [] });
    assert.equal(applied.status, 'committed');
    fs.appendFileSync(path.join(root, 'STORY-PLAN.md'), '\n- 新增补证事项\n');
    const after = await (await fetch(s.url + '/api/workbench')).json();
    assert.notEqual(after.fingerprint, fp);
    assert.equal(after.projects[0].wikiSnapshot.commitId, applied.commitId, 'next read shows the new commit');
    assert.equal(after.projects[0].story.gaps.length, 3);
  } finally { await s.close(); }
});

test('server is GET-only and serves only its own web files', { timeout: 10000 }, async () => {
  const root = await buildFixture(temp());
  const s = await serve(root);
  try {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) assert.equal((await fetch(s.url + '/api/workbench', { method })).status, 405);
    for (const url of ['/TAILOR.md', '/materials/design.md', '/..%2f..%2fTAILOR.md', '/%2e%2e/%2e%2e/package.json', '/.wiki/current.json', '/api/unknown']) assert.equal((await fetch(s.url + url)).status, 404, url);
    const res = await fetch(s.url + '/');
    assert.match(res.headers.get('content-security-policy'), /script-src 'self';/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  } finally { await s.close(); }
  const index = fs.readFileSync(path.join(appRoot, 'web/index.html'), 'utf8');
  assert.equal([...index.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)].length, 0, 'no inline scripts, so CSP stays strict');
});

test('Markdown is escaped; only server-made links and citation tokens survive', () => {
  const md = '# T\n\n<script>alert(1)</script> <img src=x onerror=alert(1)> {{c:c1}} [[nope]] [[ok|好]] [x](javascript:alert(1)) [y](https://example.com)\n\n| a | b |\n|---|---|\n| <b>1</b> | `{{c:c2}}` |';
  const { html } = renderMarkdown(md, { pageExists: id => id === 'ok' });
  assert.doesNotMatch(html, /<script|<img|<[^>]*\son\w+=|href="javascript/i);
  assert.doesNotMatch(html, /\{\{c:|\[\[/);
  assert.match(html, /<a class="dsh-plink" href="#\/knowledge\/read\/ok">好<\/a>/);
  assert.match(html, /dsh-plink is-broken[^>]*>nope/);
  assert.match(html, /<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">y<\/a>/);
  assert.match(html, /&lt;b&gt;1&lt;\/b&gt;/);
});

test('problems stay local: a corrupt snapshot or broken file is reported, the rest still shows', async () => {
  const root = await buildFixture(temp());
  const wiki = new FileWiki(root), commit = wiki.pointer().commitId;
  fs.appendFileSync(path.join(root, 'wiki/history', commit, 'state.json'), ' ');
  fs.writeFileSync(path.join(root, 'EXPERIMENT-PLAN.md'), Buffer.from([0xff, 0xfe, 0x00]));
  const p = await readWorkbench(root);
  const files = Object.fromEntries(p.files.map(f => [f.key, f]));
  assert.equal(files.wiki.status, 'error'); assert.match(files.wiki.note, /MANUAL_EDIT_CONFLICT/);
  assert.equal(files.plan.status, 'error'); assert.equal(p.pages.length, 0); assert.equal(p.plans.length, 0);
  assert.equal(files.tailor.status, 'ok'); assert.equal(p.schemes.length, 2);
  const empty = await readWorkbench(temp());
  assert.equal(empty.empty, true);
  assert.ok(empty.files.filter(f => f.key !== 'runs').every(f => f.status === 'missing'));
});

test('the Skill pack never depends on the workbench', () => {
  for (const name of skillNames) assert.ok(skillFiles(name).every(e => !/workbench/i.test(e.file)));
  const scan = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? scan(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  // Pack code and every installed Skill file stay workbench-free (the pack
  // README may mention the repository app in prose; that is not a dependency).
  const checked = scan(path.join(repo, 'research-pack')).filter(f => /\.(mjs|json)$/.test(f) || f.includes(`${path.sep}trial-skills${path.sep}`));
  assert.ok(checked.length > 10);
  for (const file of checked) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /workbench/i, file);
});
