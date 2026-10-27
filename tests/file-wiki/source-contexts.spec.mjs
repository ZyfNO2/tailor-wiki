import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileWiki } from '../../research-pack/trial-skills/wiki-maintain/scripts/wiki.mjs';

const span = (field, quote) => ({ field, quote, startByte: 0, endByte: Buffer.byteLength(quote) });
// Two sources, one reviewed page each, with document contexts for both.
async function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-context-fixture-'));
  fs.writeFileSync(path.join(root, 'a.md'), 'Alpha design proposes X.\n');
  fs.writeFileSync(path.join(root, 'b.md'), 'Beta report records Y.\n');
  const wiki = new FileWiki(root), p = await wiki.run('prepare', { paths: ['a.md', 'b.md'] });
  const src = file => p.sources.find(s => s.path === file);
  const cite = file => { const q = src(file).versions[0].text.trim(); return { sourceId: src(file).sourceId, revision: 1, startByte: 0, endByte: Buffer.byteLength(q), quote: q }; };
  const checks = [{ evidenceId: 'body', assessment: 'supported', reason: 'Fixture.' }, { evidenceId: 'sum', assessment: 'supported', reason: 'Fixture.' }];
  const page = (pageId, file, text) => ({ pageId, title: pageId, pageType: 'concept', summary: text, content: text, expectedVersion: 0, expectedHash: null, evidence: [{ id: 'body', target: span('content', text), citations: [cite(file)] }, { id: 'sum', target: span('summary', text), citations: [cite(file)] }], review: { status: 'reviewed', reviewer: 'fixture reviewer', scope: 'Fixture sources only.', checks } });
  const ctx = (file, summary) => ({ sourceId: src(file).sourceId, revision: 1, title: file, documentType: 'design', date: 'unknown', summary, attribution: 'Fixture author.' });
  await wiki.run('apply', { runId: p.runId, baseCommitId: null, draftType: 'fixture', complete: true, pages: [page('pa', 'a.md', 'Alpha proposes X.'), page('pb', 'b.md', 'Beta records Y.')], sourceContexts: [ctx('a.md', 'Alpha summary.'), ctx('b.md', 'Beta summary.')] });
  const draft = (prepared, extra) => ({ runId: prepared.runId, baseCommitId: prepared.baseCommitId, draftType: 'fixture', complete: true, pages: [], ...extra });
  return { root, wiki, src, ctx, draft };
}
const review = (wiki, pageId) => wiki.current().pages.find(p => p.pageId === pageId).review.status;
const context = (wiki, sourceId) => wiki.current().sourceContexts.find(c => c.sourceId === sourceId);

test('a single-source context update leaves unrelated contexts and reviews untouched and reports the impact', async () => {
  const f = await setup(), betaBefore = context(f.wiki, f.src('b.md').sourceId);
  const p = await f.wiki.run('prepare', { paths: ['a.md'] });
  const r = await f.wiki.run('apply', f.draft(p, { sourceContexts: [f.ctx('a.md', 'Alpha summary, reworded.')] }));
  assert.equal(r.status, 'committed');
  assert.deepEqual(r.contextChanges.map(c => [c.path, c.change, c.fields]), [['a.md', 'updated', ['summary']]]);
  assert.deepEqual(r.reviewInvalidatedPageIds, ['pa']);
  assert.deepEqual(context(f.wiki, f.src('b.md').sourceId), betaBefore);
  assert.equal(review(f.wiki, 'pa'), 'not-reviewed'); assert.equal(review(f.wiki, 'pb'), 'reviewed');
});

test('rewriting contexts outside the prepared scope is refused unless a full update is declared', async () => {
  const f = await setup(), p = await f.wiki.run('prepare', { paths: ['a.md'] });
  await assert.rejects(f.wiki.run('apply', f.draft(p, { sourceContexts: [f.ctx('a.md', 'Alpha summary.'), f.ctx('b.md', 'Beta summary, rewritten.')] })), /CONTEXT_SCOPE: .*b\.md.*pb/s);
  assert.equal(review(f.wiki, 'pb'), 'reviewed');
  // Resubmitting an out-of-scope context unchanged is harmless.
  assert.equal((await f.wiki.run('apply', f.draft(p, { sourceContexts: [f.ctx('b.md', 'Beta summary.')] }))).status, 'unchanged');
  await assert.rejects(f.wiki.run('apply', f.draft(p, { sourceContexts: [f.ctx('b.md', 'Beta summary, rewritten.')], contextUpdate: { sourceIds: 'all' } })), /contextUpdate.*reason/);
  const ok = await f.wiki.run('apply', f.draft(p, { sourceContexts: [f.ctx('b.md', 'Beta summary, rewritten.')], contextUpdate: { sourceIds: 'all', reason: 'User authorized a full context pass.' } }));
  assert.equal(ok.status, 'committed'); assert.deepEqual(ok.reviewInvalidatedPageIds, ['pb']);
  assert.deepEqual(ok.contextChanges.map(c => c.path), ['b.md']);
});

test('dryRun previews the change scope without writing a snapshot, draft, event or lock', async () => {
  const f = await setup(), p = await f.wiki.run('prepare', { paths: ['a.md'] });
  const runDir = path.join(f.root, '.wiki/runs', p.runId), list = () => fs.readdirSync(runDir, { recursive: true }).sort();
  const pointer = f.wiki.pointer(), files = list();
  const preview = await f.wiki.run('apply', f.draft(p, { dryRun: true, sourceContexts: [f.ctx('a.md', 'Alpha summary, previewed.')] }));
  assert.equal(preview.status, 'preview'); assert.equal(preview.wouldCommit, true);
  assert.deepEqual(preview.contextChanges.map(c => c.path), ['a.md']); assert.deepEqual(preview.reviewInvalidatedPageIds, ['pa']);
  assert.deepEqual(f.wiki.pointer(), pointer); assert.deepEqual(list(), files);
  assert.equal(fs.existsSync(path.join(f.root, '.wiki/writer.lock')), false);
  await assert.rejects(f.wiki.run('apply', f.draft(p, { dryRun: true, sourceContexts: [f.ctx('b.md', 'Beta summary, rewritten.')] })), /CONTEXT_SCOPE/);
  assert.deepEqual(list(), files, 'a refused preview leaves no trace either');
  assert.equal(review(f.wiki, 'pa'), 'reviewed');
});
