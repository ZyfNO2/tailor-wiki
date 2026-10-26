import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { FileWiki } from '../../research-pack/trial-skills/wiki-maintain/scripts/wiki.mjs';

const span = (field, quote) => ({ field, quote, startByte: 0, endByte: Buffer.byteLength(quote) });
async function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-page-fixture-'));
  fs.writeFileSync(path.join(root, 'design.md'), 'A design proposes Stage 2.\nNot implemented.\n| Value | Scope |\n| 3 | CPU |\n');
  const wiki = new FileWiki(root), p = await wiki.run('prepare', { paths: ['design.md'] }), s = p.sources[0], quote = s.versions[0].text;
  const citation = { sourceId: s.sourceId, revision: 1, startByte: 0, endByte: Buffer.byteLength(quote), quote };
  const content = 'The design proposes Stage 2.\n\n| Value | Scope |\n|---|---|\n| 3 | CPU |', summary = 'A proposed design, not a verified capability.';
  const page = { pageId: 'stage-two', title: 'Stage 2 design', pageType: 'concept', category: ['Design'], expectedVersion: 0, expectedHash: null, summary, content, evidence: [{ id: 'body', target: span('content', content), citations: [citation] }, { id: 'lead', target: span('summary', summary), citations: [citation] }] };
  const context = { sourceId: s.sourceId, revision: 1, title: 'Design report', documentType: 'design', date: 'unknown', summary: 'A proposal.', attribution: 'The author proposes; not an execution result.' };
  const draft = (pages = [page], extra = {}) => ({ runId: p.runId, baseCommitId: p.baseCommitId, complete: true, draftType: 'fixture', pages, ...extra });
  return { root, wiki, p, page, context, draft };
}
test('natural body and summary are authoritative, evidence stays separate, writes never imply semantic review', async () => {
  const f = await setup(), result = await f.wiki.run('apply', f.draft());
  assert.equal(result.status, 'committed'); assert.equal(result.completion, 'complete');
  assert.equal(result.semanticReview.status, 'not-reviewed'); assert.equal(result.issueStatus.open, 0);
  const file = fs.readFileSync(path.join(f.wiki.snapshot(result.commitId).folder, 'pages/stage-two.md'), 'utf8');
  assert.match(file, /\| 3 \| CPU \|/); assert.doesNotMatch(file, /## body|UTF-8 bytes|Not implemented/); assert.match(file, /\[design.md\]\(\.\.\/sources\//);
  assert.equal(f.wiki.current().pages[0].facts, undefined);
});
test('schema 1 snapshot stays immutable when migrated to natural pages and when rolled back', async () => {
  const f = await setup(), source = f.p.sources[0], citation = f.page.evidence[0].citations[0];
  const commitId = 'commit-legacy-fixture', old = { pageId: 'stage-two', title: 'Legacy fixture', version: 1, contentHash: 'legacy-fixture-hash', facts: [{ id: 'definition', markdown: 'Old synthetic proposal.', citations: [citation] }] };
  const state = { schemaVersion: 1, commitId, parentCommitId: null, sources: [source], pages: [old] }, folder = path.join(f.root, 'wiki/history', commitId);
  fs.mkdirSync(folder, { recursive: true });
  const bytes = JSON.stringify(state, null, 2) + '\n', digest = bytes => createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(path.join(folder, 'state.json'), bytes);
  const manifest = JSON.stringify({ schemaVersion: 1, commitId, files: [{ path: 'state.json', sha256: digest(bytes) }] }, null, 2) + '\n';
  fs.writeFileSync(path.join(folder, 'manifest.json'), manifest);
  fs.writeFileSync(path.join(f.root, '.wiki/current.json'), JSON.stringify({ schemaVersion: 1, commitId, manifestHash: digest(manifest) }));
  const p = await f.wiki.run('prepare', { paths: ['design.md'] }); assert.equal(p.pages[0].content, undefined);
  const migrated = await f.wiki.run('apply', { ...f.draft([{ ...f.page, expectedVersion: 1, expectedHash: old.contentHash, changeReason: 'Explicit legacy fixture migration.' }]), runId: p.runId, baseCommitId: p.baseCommitId });
  assert.equal(f.wiki.current().schemaVersion, 2); assert.equal(f.wiki.current().pages[0].version, 2);
  assert.deepEqual(f.wiki.snapshot(commitId).state, state);
  await f.wiki.run('rollback', { expectedCommitId: migrated.commitId, targetCommitId: commitId, reason: 'Fixture rollback across schemas.' });
  assert.equal(f.wiki.current().pages[0].version, 3); assert.equal(f.wiki.current().pages[0].facts[0].markdown, old.facts[0].markdown);
  assert.equal(fs.readFileSync(path.join(folder, 'state.json'), 'utf8'), bytes);
});
test('changed body, uncovered summary and unreviewed/insufficient mappings cannot silently receive reviewed status', async () => {
  const f = await setup(), wrong = structuredClone(f.page); wrong.content += '\nInvented claim.';
  await assert.rejects(f.wiki.run('apply', f.draft([wrong])), /UNMAPPED_CONTENT/);
  const missing = structuredClone(f.page); missing.evidence.pop();
  await assert.rejects(f.wiki.run('apply', f.draft([missing])), /UNMAPPED_CONTENT/);
  const bad = structuredClone(f.page); bad.review = { status: 'reviewed', reviewer: 'fixture reviewer', scope: 'synthetic material only', checks: bad.evidence.map(e => ({ evidenceId: e.id, assessment: 'insufficient', reason: 'A keyword is insufficient support.' })) };
  await assert.rejects(f.wiki.run('apply', f.draft([bad], { sourceContexts: [f.context] })), /INVALID_REVIEW/);
  bad.review.status = 'needs-review';
  const result = await f.wiki.run('apply', f.draft([bad], { sourceContexts: [f.context] }));
  assert.equal(result.completion, 'complete'); assert.equal(result.semanticReview.status, 'needs-review');
});
test('explicit semantic review binds content and document context; repeated input is stable; context edit invalidates review', async () => {
  const f = await setup(); f.page.review = { status: 'reviewed', reviewer: 'fixture reviewer', scope: 'Read synthetic design only; no experiments run.', checks: f.page.evidence.map(e => ({ evidenceId: e.id, assessment: 'supported', reason: 'Proposal attribution and entire synthetic table match.' })) };
  await assert.rejects(f.wiki.run('apply', f.draft([f.page])), /INVALID_REVIEW/);
  const first = await f.wiki.run('apply', f.draft([f.page], { sourceContexts: [f.context], indexIntro: { title: 'Design library', content: 'A synthetic proposed design.' } }));
  assert.equal(first.semanticReview.status, 'reviewed');
  const p = await f.wiki.run('prepare', { paths: ['design.md'] });
  const again = await f.wiki.run('apply', { ...f.draft([]), runId: p.runId, baseCommitId: p.baseCommitId });
  assert.equal(again.status, 'unchanged');
  const changed = await f.wiki.run('apply', { ...f.draft([]), runId: p.runId, baseCommitId: p.baseCommitId, sourceContexts: [{ ...f.context, attribution: 'Uncertain document identity.' }] });
  assert.equal(changed.semanticReview.status, 'not-reviewed'); assert.equal(f.wiki.current().pages[0].version, 1);
  fs.appendFileSync(path.join(f.root, 'design.md'), 'A new source revision.');
  const stale = await f.wiki.run('prepare', { paths: ['design.md'] });
  const deferred = await f.wiki.run('apply', { ...f.draft([]), runId: stale.runId, baseCommitId: stale.baseCommitId, deferredPages: [{ pageId: f.page.pageId, reason: 'Fixture source changed, keep old text explicitly.' }] });
  assert.equal(deferred.semanticReview.status, 'needs-review'); assert.deepEqual(deferred.stalePageIds, [f.page.pageId]);
});
test('issues are unique records across pages; repeated words do not count; resolving requires a reason', async () => {
  const f = await setup(), issue = { issueId: 'missing-run', type: 'evidence-gap', description: 'Unverified; unverified; conflicting text is still one issue.', reportedBy: 'fixture', status: 'open', pageIds: ['stage-two'], evidenceRefs: [{ pageId: 'stage-two', evidenceId: 'body' }], sourceIds: [f.context.sourceId] };
  await assert.rejects(f.wiki.run('apply', f.draft([f.page], { issues: [issue, issue] })), /DUPLICATE_ID/);
  const result = await f.wiki.run('apply', f.draft([f.page], { issues: [issue] })); assert.equal(result.issueStatus.open, 1);
  const p = await f.wiki.run('prepare', { paths: ['design.md'] }), next = { ...f.draft([]), runId: p.runId, baseCommitId: p.baseCommitId };
  await assert.rejects(f.wiki.run('apply', { ...next, issues: [{ ...issue, status: 'resolved' }] }), /EMPTY_CONTENT/);
  const resolved = await f.wiki.run('apply', { ...next, issues: [{ ...issue, status: 'resolved', resolution: 'Synthetic test resolution, no scientific claim.' }] }); assert.equal(resolved.issueStatus.open, 0);
});
test('natural page rewrite guards loss and stale mapping; interruptions and rollback preserve old history', async () => {
  const f = await setup(), first = await f.wiki.run('apply', f.draft()), p = await f.wiki.run('prepare', { paths: ['design.md'] }), old = p.pages[0];
  const replacement = { ...f.page, expectedVersion: old.version, expectedHash: old.contentHash, content: 'Shortened.', evidence: [{ ...f.page.evidence[0], target: span('content', 'Shortened.') }, f.page.evidence[1]] };
  const input = { ...f.draft([replacement]), runId: p.runId, baseCommitId: p.baseCommitId };
  await assert.rejects(f.wiki.run('apply', input), /EMPTY_CONTENT/);
  replacement.changeReason = 'Explicit synthetic table removal.';
  f.wiki.checkpoint = () => { throw new Error('NATURAL_PAGE_CRASH'); };
  await assert.rejects(f.wiki.run('apply', input), /NATURAL_PAGE_CRASH/); delete f.wiki.checkpoint;
  const recovered = await f.wiki.run('recover', { commitId: f.wiki.pending()[0].commitId, mode: 'finish' });
  await f.wiki.run('rollback', { expectedCommitId: recovered.commitId, targetCommitId: first.commitId, reason: 'Restore table.' });
  assert.equal(f.wiki.current().pages[0].content, old.content); assert.equal(f.wiki.current().pages[0].version, 3);
});
