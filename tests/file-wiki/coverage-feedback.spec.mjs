import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileWiki } from '../../research-pack/trial-skills/wiki-maintain/scripts/wiki.mjs';
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-coverage-fixture-')), wiki = new FileWiki(root);
  fs.mkdirSync(path.join(root, 'materials'));
  fs.writeFileSync(path.join(root, 'materials/a.txt'), 'A synthetic design proposes a check.');
  fs.writeFileSync(path.join(root, 'materials/b.txt'), 'B synthetic plan is not execution.');
  return { root, wiki };
}
const decision = (s, status = 'read') => { const v = s.versions.at(-1); return { path: s.path, sourceId: s.sourceId, revision: v.revision, sha256: v.sha256, status, reason: 'Read complete synthetic fixture, no scientific validation.', readRanges: [{ startByte: 0, endByte: Buffer.byteLength(v.text) }] }; };
const draft = (p, extra = {}) => ({ runId: p.runId, baseCommitId: p.baseCommitId, complete: true, draftType: 'fixture', pages: [], coverageDecisions: p.sources.filter(s => p.scan.files.includes(s.path) && s.status === 'available').map(s => decision(s)), sourceDispositions: p.sources.filter(s => s.status === 'available').map(s => ({ sourceId: s.sourceId, revision: s.versions.at(-1).revision, disposition: 'no-wiki-needed', reason: 'This test exercises coverage, not semantic publication.' })), ...extra });
test('full request cannot narrow silently; subset preserves unread paths, unsupported and missing inputs', async () => {
  const f = setup(); fs.writeFileSync(path.join(f.root, 'materials/scan.png'), 'not-readable');
  await assert.rejects(f.wiki.run('prepare', { paths: ['materials/a.txt'], requestScope: { mode: 'full', paths: ['materials'] } }), /INVALID_COVERAGE/);
  const p = await f.wiki.run('prepare', { paths: ['materials/a.txt'], requestScope: { mode: 'subset', paths: ['materials', 'missing.txt'] } });
  const result = await f.wiki.run('apply', draft(p));
  assert.equal(result.completion, 'partial'); assert.equal(result.coverageStatus.mode, 'subset');
  assert.equal(result.coverageStatus.entries.find(e => e.path.endsWith('b.txt')).status, 'unread');
  assert.equal(result.coverageStatus.entries.find(e => e.path.endsWith('.png')).status, 'unsupported');
  assert.equal(result.coverageStatus.entries.find(e => e.path === 'missing.txt').status, 'missing');
});
test('parsing is not reading; explicit full receipts enforced, unchanged reuse is version bound and no drift', async () => {
  const f = setup(), input = { paths: ['materials'], requestScope: { mode: 'full', paths: ['materials'] } }, p = await f.wiki.run('prepare', input);
  const unread = await f.wiki.run('apply', draft(p, { coverageDecisions: [] })); assert.equal(unread.coverageStatus.status, 'partial');
  const q = await f.wiki.run('prepare', input), bad = draft(q); bad.coverageDecisions[0].readRanges[0].endByte--;
  await assert.rejects(f.wiki.run('apply', bad), /unread tail/);
  const complete = await f.wiki.run('apply', draft(q)); assert.equal(complete.coverageStatus.status, 'complete');
  const r = await f.wiki.run('prepare', input), repeated = await f.wiki.run('apply', draft(r, { coverageDecisions: r.sources.map(s => decision(s, 'reuse')) })); assert.equal(repeated.status, 'unchanged');
  fs.appendFileSync(path.join(f.root, 'materials/a.txt'), '\nRevised fixture.');
  const s = await f.wiki.run('prepare', input);
  await assert.rejects(f.wiki.run('apply', draft(s, { coverageDecisions: s.sources.map(s => decision(s, 'reuse')) })), /no same-version/);
});
test('requested directory membership rechecked before publishing subset; no-material prepare fails with trace', async () => {
  const f = setup(), p = await f.wiki.run('prepare', { paths: ['materials/a.txt'], requestScope: { mode: 'subset', paths: ['materials'] } });
  fs.writeFileSync(path.join(f.root, 'materials/new.txt'), 'new fixture');
  await assert.rejects(f.wiki.run('apply', draft(p)), /requested scope membership changed/);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-empty-fixture-')), w = new FileWiki(empty);
  await assert.rejects(w.run('prepare', { paths: ['.'] }), /NO_INPUT/); assert.equal(w.pointer(), null);
  assert.ok(fs.readdirSync(path.join(empty, '.wiki/runs')).length);
});
test('feedback records actual versions, deduplicates pending work, retains first failure, recovers without rerunning execution', async () => {
  const f = setup(), file = 'STORY-PLAN.md', artifacts = [{ path: file, artifactId: 'story-a', kind: 'story', relatedIds: ['method-a', 'task-a'] }];
  fs.writeFileSync(path.join(f.root, file), 'Synthetic narrative hypothesis, not experimental evidence.');
  const p = await f.wiki.run('feedback', { artifacts });
  assert.equal(p.syncStatus, 'awaiting-agent'); assert.equal(p.sources[0].artifact.authority, 'narrative-not-independent-scientific-evidence');
  const same = await f.wiki.run('feedback', { artifacts }); assert.equal(same.runId, p.runId); assert.equal(f.wiki.pendingFeedback().length, 1);
  const unhandled = await f.wiki.run('apply', draft(p, { coverageDecisions: [], sourceDispositions: [] }));
  assert.equal(unhandled.syncStatus, 'awaiting-agent'); assert.equal(f.wiki.pendingFeedback().length, 1);
  // Refresh after a partial file commit; pending sync must not disappear.
  const refreshed = await f.wiki.run('feedback', { artifacts });
  assert.notEqual(refreshed.runId, p.runId);
  Object.assign(p, refreshed);
  const source = p.sources[0], v = source.versions.at(-1), content = v.text, citation = { sourceId: source.sourceId, revision: v.revision, startByte: 0, endByte: Buffer.byteLength(content), quote: content };
  const page = { pageId: 'story-a', title: 'Synthetic story', content, summary: content, pageType: 'concept', expectedVersion: 0, expectedHash: null, evidence: ['content', 'summary'].map(field => ({ id: field, target: { field, startByte: 0, endByte: Buffer.byteLength(content), quote: content }, citations: [citation] })) };
  const bad = structuredClone(page); bad.evidence[0].citations[0].quote = 'forged';
  await assert.rejects(f.wiki.run('apply', draft(p, { pages: [bad], sourceDispositions: [] })), /INVALID_CITATION/);
  assert.equal(f.wiki.pendingFeedback()[0].status, 'failed-awaiting-agent');
  const applied = await f.wiki.run('apply', draft(p, { pages: [page], sourceDispositions: [] }));
  assert.equal(applied.status, 'committed'); assert.equal(f.wiki.pendingFeedback().length, 0);
  const repeated = await f.wiki.run('feedback', { artifacts }); assert.equal(repeated.syncStatus, 'unchanged'); assert.equal(repeated.commitId, applied.commitId);
  fs.appendFileSync(path.join(f.root, file), '\nNew explicit hypothesis.');
  const changed = await f.wiki.run('feedback', { artifacts }); assert.equal(changed.sources[0].sourceId, source.sourceId); assert.equal(changed.sources[0].versions.at(-1).revision, 2); assert.deepEqual(changed.affectedPageIds, ['story-a']);
  await assert.rejects(f.wiki.run('feedback', { artifacts: [{ ...artifacts[0], artifactId: 'other-story' }] }), /IDENTITY_CONFLICT/);
});
test('failed source parsing remains pending, fresh feedback supersedes failed attempt without hiding error history', async () => {
  const f = setup(), artifacts = [{ path: 'result.json', artifactId: 'run-a', kind: 'result', relatedIds: [] }];
  fs.writeFileSync(path.join(f.root, 'result.json'), '{');
  await assert.rejects(f.wiki.run('feedback', { artifacts }), /SyntaxError/);
  const failed = f.wiki.pendingFeedback(); assert.equal(failed.length, 1); assert.equal(failed[0].handoff, null);
  fs.writeFileSync(path.join(f.root, 'result.json'), '{"kind":"fixture-only"}');
  const next = await f.wiki.run('feedback', { artifacts }); assert.equal(f.wiki.pendingFeedback().length, 1); assert.notEqual(next.runId, failed[0].runId);
  const events = fs.readdirSync(path.join(f.root, '.wiki/runs', failed[0].runId, 'events')).map(n => JSON.parse(fs.readFileSync(path.join(f.root, '.wiki/runs', failed[0].runId, 'events', n))));
  assert.ok(events.some(e => e.stage === 'failed')); assert.ok(events.some(e => e.stage === 'superseded'));
});
test('feedback cannot hide earlier directory coverage debt and no-wiki-needed feedback is idempotent', async () => {
  const f = setup(), p = await f.wiki.run('prepare', { paths: ['materials/a.txt'], requestScope: { mode: 'subset', paths: ['materials'] } });
  await f.wiki.run('apply', draft(p));
  fs.writeFileSync(path.join(f.root, 'STORY-PLAN.md'), 'Synthetic story scope only.');
  const artifacts = [{ path: 'STORY-PLAN.md', artifactId: 'story-x', kind: 'story', relatedIds: [] }];
  const feedback = await f.wiki.run('feedback', { artifacts }), result = await f.wiki.run('apply', draft(feedback));
  assert.equal(result.syncStatus, 'synced'); assert.equal(result.coverageStatus.latestStatus, 'complete');
  assert.equal(result.coverageStatus.status, 'partial'); assert.equal(result.completion, 'partial');
  assert.ok(result.coverageStatus.outstandingRequests[0].entries.some(e => e.path === 'materials/b.txt' && e.status === 'unread'));
  const repeat = await f.wiki.run('feedback', { artifacts }); assert.equal(repeat.syncStatus, 'unchanged'); assert.equal(repeat.coverageStatus.status, 'partial');
});
test('busy writer retains pending feedback and duplicate path identities are rejected', async () => {
  const f = setup(), artifacts = [{ path: 'materials/a.txt', artifactId: 'a', kind: 'story', relatedIds: [] }];
  fs.mkdirSync(path.join(f.root, '.wiki')); fs.writeFileSync(path.join(f.root, '.wiki/writer.lock'), JSON.stringify({ token: 'fixture', pid: process.pid }));
  await assert.rejects(f.wiki.run('feedback', { artifacts }), /HOST_BUSY/);
  const pending = f.wiki.pendingFeedback(); assert.equal(pending.length, 1); assert.deepEqual(pending[0].artifacts, artifacts); assert.match(pending[0].error, /HOST_BUSY/);
  fs.unlinkSync(path.join(f.root, '.wiki/writer.lock'));
  await assert.rejects(f.wiki.run('feedback', { artifacts: [...artifacts, { ...artifacts[0], artifactId: 'b' }] }), /IDENTITY_CONFLICT/);
});
