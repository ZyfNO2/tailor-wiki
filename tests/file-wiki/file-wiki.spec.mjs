import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { FileWiki } from '../../research-pack/trial-skills/wiki-maintain/scripts/wiki.mjs';

// Drafts in this suite are deterministic fixtures, never model output.
const hash = v => createHash('sha256').update(v).digest('hex');
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'file-wiki-fixture-'));
  fs.mkdirSync(path.join(root, 'materials'));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  write('materials/a.md', '# Fixture A\nABC denotes Alpha Beam Concrete.\nShared claim: value 2.\n');
  write('materials/b.txt', 'Fixture B\nABC denotes Adaptive Binary Coding.\nShared claim: value 3.\n');
  const wiki = new FileWiki(root);
  return { root, wiki, write, prepare: (extra = {}) => wiki.run('prepare', { paths: ['materials'], ...extra }) };
}
function cite(prepared, file, quote, extra = {}) {
  const s = prepared.sources.find(s => s.path === file), v = s.versions.at(-1), startByte = Buffer.from(v.text).indexOf(Buffer.from(quote));
  assert.ok(startByte >= 0);
  return { sourceId: s.sourceId, revision: v.revision, startByte, endByte: startByte + Buffer.byteLength(quote), quote, ...extra };
}
const page = (pageId, title, citations, markdown = 'Deterministic fixture statement; not a research conclusion.') => ({ pageId, title, expectedVersion: 0, expectedHash: null, facts: [{ id: 'definition', markdown, citations }] });
const draft = (p, pages = [], extra = {}) => ({ runId: p.runId, baseCommitId: p.baseCommitId, draftType: 'fixture', complete: true, pages, ...extra });
async function first(f) {
  const p = await f.prepare(), a = cite(p, 'materials/a.md', 'ABC denotes Alpha Beam Concrete.'), b = cite(p, 'materials/b.txt', 'ABC denotes Adaptive Binary Coding.');
  const result = await f.wiki.run('apply', draft(p, [page('abc-concrete', 'ABC', [a]), page('abc-coding', 'ABC', [b]), page('conflict', 'Conflict evidence', [cite(p, 'materials/a.md', 'Shared claim: value 2.'), cite(p, 'materials/b.txt', 'Shared claim: value 3.')], 'Conflicting fixture observations: 2 and 3; conditions unknown.')]));
  return { p, result };
}

test('two related materials, same acronym distinct pages, conflicting evidence, deterministic index and exact quotes', async () => {
  const f = setup(), { result } = await first(f), state = f.wiki.current();
  assert.equal(result.completion, 'complete'); assert.equal(state.pages.length, 3);
  assert.deepEqual(state.pages.map(p => p.version), [1, 1, 1]);
  const folder = f.wiki.snapshot(result.commitId).folder;
  assert.match(fs.readFileSync(path.join(folder, 'INDEX.md'), 'utf8'), /abc-concrete/);
  assert.match(fs.readFileSync(path.join(folder, 'pages/conflict.md'), 'utf8'), /Shared claim: value 2/);
  assert.match(fs.readFileSync(path.join(folder, 'pages/conflict.md'), 'utf8'), /Shared claim: value 3/);
});
test('unchanged input is a true no-op; one source change only changes patched page; unrelated facts and notes survive', async () => {
  const f = setup(), { result } = await first(f), again = await f.prepare();
  assert.deepEqual(again.changedSourceIds, []);
  assert.equal((await f.wiki.run('apply', draft(again))).status, 'unchanged'); assert.equal(f.wiki.current().commitId, result.commitId);
  f.write('wiki/notes/abc-concrete.md', 'User note without evidence; retain exactly.');
  f.write('materials/a.md', '# Fixture A\nABC denotes Alpha Beam Concrete v2.\nShared claim: value 2.\n');
  const changed = await f.prepare(), old = changed.pages.find(p => p.pageId === 'abc-concrete');
  assert.equal(changed.changedSourceIds.length, 1);
  const updated = await f.wiki.run('apply', draft(changed, [{ pageId: old.pageId, expectedVersion: old.version, expectedHash: old.contentHash, facts: [{ id: 'definition', markdown: 'Updated deterministic fixture.', changeReason: 'Source explicitly revised this definition.', citations: [cite(changed, 'materials/a.md', 'ABC denotes Alpha Beam Concrete v2.')] }] }], { deferredPages: [{ pageId: 'conflict', reason: 'Retain conflict and old citation pending semantic review.' }] }));
  assert.equal(updated.completion, 'partial');
  assert.equal(f.wiki.current().pages.find(p => p.pageId === 'abc-concrete').version, 2);
  assert.equal(f.wiki.current().pages.find(p => p.pageId === 'abc-coding').version, 1);
  assert.equal(fs.readFileSync(path.join(f.root, 'wiki/notes/abc-concrete.md'), 'utf8'), 'User note without evidence; retain exactly.');
  assert.equal(f.wiki.snapshot(result.commitId).state.pages[0].version, 1);
});
test('empty input, forged quote, truncation and dead/self links fail without replacing old pages; failures retained', async () => {
  const f = setup(), { result } = await first(f);
  f.write('materials/empty.txt', '  ');
  await assert.rejects(f.prepare(), /EMPTY_CONTENT/);
  const p = await f.prepare({ paths: ['materials/a.md'] }), c = cite(p, 'materials/a.md', 'ABC denotes Alpha Beam Concrete.');
  await assert.rejects(f.wiki.run('apply', draft(p, [page('forged', 'Forged', [{ ...c, quote: 'invented' }])])), /INVALID_CITATION/);
  await assert.rejects(f.wiki.run('apply', draft(p, [], { complete: false })), /INCOMPLETE_DRAFT/);
  await assert.rejects(f.wiki.run('apply', draft(p, [page('dead', 'Dead', [c], '[[unknown-page]]')])), /INVALID_LINK/);
  await assert.rejects(f.wiki.run('apply', draft(p, [page('self', 'Self', [c], '[[self]]')])), /INVALID_LINK/);
  assert.equal(f.wiki.current().commitId, result.commitId);
  const events = fs.readdirSync(path.join(f.root, '.wiki/runs', p.runId, 'events')).map(n => JSON.parse(fs.readFileSync(path.join(f.root, '.wiki/runs', p.runId, 'events', n))));
  assert.ok(events.filter(e => e.stage === 'failed').length >= 4);
});
test('manual edits and stale concurrent callers rejected; no silent lock takeover', async () => {
  const f = setup(); await first(f);
  const a = await f.prepare(), b = await f.prepare(), c = cite(a, 'materials/a.md', 'ABC denotes Alpha Beam Concrete.');
  await f.wiki.run('apply', draft(a, [page('new-page', 'Additional fixture', [c])]));
  await assert.rejects(f.wiki.run('apply', draft(b)), /REVISION_CONFLICT/);
  const pointer = f.wiki.pointer(), folder = f.wiki.snapshot(pointer.commitId).folder;
  fs.appendFileSync(path.join(folder, 'pages/abc-concrete.md'), '\nUser edit that must not be overwritten.');
  await assert.rejects(f.prepare(), /MANUAL_EDIT_CONFLICT/);
  f.write('.wiki/writer.lock', JSON.stringify({ token: 'existing', pid: process.pid }));
  await assert.rejects(f.prepare(), /HOST_BUSY/);
  const bytes = fs.readFileSync(path.join(f.root, '.wiki/writer.lock'));
  await assert.rejects(f.wiki.run('recover-lock', { expectedHash: hash(bytes) }), /HOST_BUSY/);
});
test('scope-local absence is not deletion; withdrawal and unavailable are distinct; other evidence preserved', async () => {
  const f = setup(); await first(f);
  const partial = await f.prepare({ paths: ['materials/a.md'] });
  assert.equal(partial.sources.find(s => s.path === 'materials/b.txt').status, 'available');
  const sourceId = partial.sources.find(s => s.path === 'materials/a.md').sourceId;
  const withdrawn = await f.prepare({ paths: ['materials/a.md'], withdrawals: [sourceId] });
  const result = await f.wiki.run('apply', draft(withdrawn, [], { deferredPages: withdrawn.affectedPageIds.map(pageId => ({ pageId, reason: 'Keep independent evidence; mark withdrawn citation.' })) }));
  assert.equal(result.completion, 'partial'); assert.equal(f.wiki.current().pages.find(p => p.pageId === 'conflict').facts[0].citations.length, 2);
  const rendered = fs.readFileSync(path.join(f.wiki.snapshot(result.commitId).folder, 'pages/conflict.md'), 'utf8');
  assert.match(rendered, /待核实\/过时引用/); assert.match(rendered, /value 3/);
  fs.renameSync(path.join(f.root, 'materials/b.txt'), path.join(f.root, 'b-temporarily-unavailable.txt'));
  const unavailable = await f.prepare({ paths: ['materials/b.txt'] });
  assert.equal(unavailable.sources.find(s => s.path === 'materials/b.txt').status, 'unavailable');
  assert.equal(unavailable.sources.find(s => s.path === 'materials/a.md').status, 'withdrawn');
});
test('renames require identity mapping; same content copies stay distinct; same path changes retain ID and gain revision', async () => {
  const f = setup(); await first(f);
  const before = f.wiki.current().sources.find(s => s.path === 'materials/a.md');
  fs.renameSync(path.join(f.root, 'materials/a.md'), path.join(f.root, 'materials/renamed.md'));
  const p = await f.prepare({ renames: [{ sourceId: before.sourceId, path: 'materials/renamed.md' }] });
  assert.equal(p.sources.find(s => s.path === 'materials/renamed.md').sourceId, before.sourceId);
  assert.equal(p.sources.find(s => s.sourceId === before.sourceId).versions.length, 1);
  await f.wiki.run('apply', draft(p));
  fs.copyFileSync(path.join(f.root, 'materials/renamed.md'), path.join(f.root, 'materials/copy.md'));
  const copy = await f.prepare();
  assert.notEqual(copy.sources.find(s => s.path === 'materials/copy.md').sourceId, before.sourceId);
  await f.wiki.run('apply', draft(copy));
  f.write('materials/renamed.md', 'New fixture text.'); const changed = await f.prepare();
  assert.equal(changed.sources.find(s => s.path === 'materials/renamed.md').sourceId, before.sourceId);
  assert.equal(changed.sources.find(s => s.sourceId === before.sourceId).versions.length, 2);
});
for (const checkpoint of ['before-pointer', 'after-pointer']) test(`interruption ${checkpoint} is visible and recoverable; rollback creates new history`, async () => {
  const f = setup(), { result } = await first(f), p = await f.prepare();
  f.wiki.checkpoint = at => { if (at === checkpoint) throw new Error('INJECTED_FIXTURE_CRASH'); };
  await assert.rejects(f.wiki.run('apply', draft(p, [page('later', 'Later fixture', [cite(p, 'materials/a.md', 'ABC denotes Alpha Beam Concrete.')])])), /INJECTED_FIXTURE_CRASH/);
  const journal = f.wiki.pending()[0]; assert.ok(journal); delete f.wiki.checkpoint;
  await assert.rejects(f.prepare(), /RECOVERY_REQUIRED/);
  const recovered = await new FileWiki(f.root).run('recover', { commitId: journal.commitId, mode: 'finish' });
  assert.equal(recovered.status, 'committed'); assert.equal(f.wiki.pending().length, 0);
  const rollback = await f.wiki.run('rollback', { targetCommitId: result.commitId, expectedCommitId: recovered.commitId, reason: 'Restore earlier fixture content.' });
  assert.notEqual(rollback.commitId, result.commitId); assert.equal(f.wiki.current().parentCommitId, recovered.commitId);
  assert.equal(f.wiki.current().provenance.command, 'rollback'); assert.equal(f.wiki.current().pages.length, 3);
});
test('source changes after prepare or while an interrupted commit waits prevent publication; abort preserves current', async () => {
  const f = setup(), p = await f.prepare(); f.write('materials/a.md', 'Changed after read.');
  await assert.rejects(f.wiki.run('apply', draft(p)), /SOURCE_CHANGED/); assert.equal(f.wiki.pointer(), null);
  const next = await f.prepare(); f.wiki.checkpoint = () => { throw new Error('FIXTURE_INTERRUPTION'); };
  await assert.rejects(f.wiki.run('apply', draft(next)), /FIXTURE_INTERRUPTION/); delete f.wiki.checkpoint;
  f.write('materials/a.md', 'Changed again.');
  const journal = f.wiki.pending()[0];
  await assert.rejects(f.wiki.run('recover', { commitId: journal.commitId, mode: 'finish' }), /SOURCE_CHANGED/);
  assert.equal((await f.wiki.run('recover', { commitId: journal.commitId, mode: 'abort' })).status, 'aborted'); assert.equal(f.wiki.pointer(), null);
});
test('JSON pointer and page-mapped PDF extraction verified; missing parser remains explicitly partial', async () => {
  const f = setup(); f.write('materials/metrics.json', '{"metrics":{"mse":0.25},"kind":"synthetic-fixture"}');
  f.write('materials/paper.pdf', '%PDF-fixture-unparsed');
  const previous = process.env.RESEARCH_PDFJS_MODULE; delete process.env.RESEARCH_PDFJS_MODULE;
  try {
    const p = await f.prepare(), result = await f.wiki.run('apply', draft(p, [page('metric', 'Fixture metric', [cite(p, 'materials/metrics.json', '0.25', { jsonPointer: '/metrics/mse' })])]));
    assert.equal(result.completion, 'partial'); assert.equal(result.issues[0].status, 'unparsed');
    const invalid = await f.prepare();
    await assert.rejects(f.wiki.run('apply', draft(invalid, [page('badmetric', 'Wrong field', [cite(invalid, 'materials/metrics.json', '0.25', { jsonPointer: '/absent' })])])), /INVALID_CITATION/);
    const pdfHash = hash(fs.readFileSync(path.join(f.root, 'materials/paper.pdf')));
    f.write('page-extraction.json', JSON.stringify({ sourceSha256: pdfHash, pages: [{ page: 1, text: 'Mapped fixture paper text.' }] }));
    const mapped = await f.prepare({ extractions: [{ path: 'materials/paper.pdf', textPath: 'page-extraction.json' }] });
    const applied = await f.wiki.run('apply', draft(mapped, [page('paper', 'Mapped fixture', [cite(mapped, 'materials/paper.pdf', 'Mapped fixture paper text.', { page: 1 })])], { sourceDispositions: mapped.sources.filter(s => /\.(?:md|txt)$/.test(s.path)).map(s => ({ sourceId: s.sourceId, revision: s.versions.at(-1).revision, disposition: 'no-wiki-needed', reason: 'Unrelated fixture input, intentionally not summarized in this metric/PDF test.' })) }));
    assert.equal(applied.completion, 'complete'); assert.match(f.wiki.current().sources.find(s => s.path.endsWith('.pdf')).versions.at(-1).parser, /fidelity-unverified/);
    const repeated = await f.prepare(); assert.deepEqual(repeated.changedSourceIds, []);
    assert.equal((await f.wiki.run('apply', draft(repeated))).completion, 'complete');
  } finally { if (previous !== undefined) process.env.RESEARCH_PDFJS_MODULE = previous; }
});
test('explicit shrink needs reasons, unmentioned facts retained, input/output boundaries enforced', async () => {
  const f = setup(); await first(f); const p = await f.prepare(), old = p.pages[0];
  await assert.rejects(f.wiki.run('apply', draft(p, [{ pageId: old.pageId, expectedVersion: old.version, expectedHash: old.contentHash, facts: [{ ...old.facts[0], markdown: 'Shortened fixture.' }] }])), /EMPTY_CONTENT/);
  await assert.rejects(f.prepare({ paths: ['../outside'] }), /PATH_ESCAPE/);
  f.write('node_modules/ignored.txt', 'dependency'); f.write('.env', 'SECRET=fixture-not-a-real-key');
  const broad = await f.prepare({ paths: ['.'] });
  assert.equal(broad.scan.files.some(n => /node_modules|\.env|wiki\//.test(n)), false);
  f.write('.wiki/runs/' + p.runId + '/prepared.json', '{}');
  await assert.rejects(f.wiki.run('apply', draft(p)), /REVISION_CONFLICT|PREPARED_CHANGED/);
  const other = setup(); other.write('wiki/INDEX.md', 'User existing wiki');
  await assert.rejects(other.prepare(), /ADOPTION_REQUIRED/);
  assert.equal(fs.readFileSync(path.join(other.root, 'wiki/INDEX.md'), 'utf8'), 'User existing wiki');
});
test('authored links validate but code and quote strings remain literal; rollback versions stay monotonic after removal', async () => {
  const f = setup(), { result } = await first(f), p = await f.prepare();
  const c = cite(p, 'materials/a.md', 'ABC denotes Alpha Beam Concrete.');
  const markdown = 'See [[abc-concrete|concrete]]. Inline `[[not-a-page]]`.\n\n```txt\n[[code-not-a-page]]\n```\n\n> [[source-quote-not-a-page]]';
  const added = await f.wiki.run('apply', draft(p, [page('links', 'Literal links', [c], markdown)]));
  const text = fs.readFileSync(path.join(f.wiki.snapshot(added.commitId).folder, 'pages/links.md'), 'utf8');
  assert.match(text, /\[concrete\]\(abc-concrete.md\)/); assert.ok(text.includes('`[[not-a-page]]`')); assert.ok(text.includes('[[code-not-a-page]]')); assert.ok(text.includes('> [[source-quote-not-a-page]]'));
  const removed = await f.wiki.run('rollback', { targetCommitId: result.commitId, expectedCommitId: added.commitId, reason: 'Fixture remove added page.' });
  const revived = await f.wiki.run('rollback', { targetCommitId: added.commitId, expectedCommitId: removed.commitId, reason: 'Fixture restore page with new content version.' });
  assert.equal(f.wiki.current().pages.find(p => p.pageId === 'links').version, 2); assert.notEqual(revived.commitId, added.commitId);
});
test('actual competing calls use exclusive writer lock; unsupported-only scope cannot claim completion', async () => {
  const f = setup(), results = await Promise.allSettled([f.prepare(), f.prepare()]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(String(results.find(r => r.status === 'rejected').reason), /HOST_BUSY/);
  const unsupported = setup(); unsupported.write('image.png', 'fixture-not-an-image');
  await assert.rejects(unsupported.prepare({ paths: ['image.png'] }), /NO_INPUT/);
});
test('Chinese UTF-8 citations reject partial characters, constructor page ID remains a numeric version', async () => {
  const f = setup(); f.write('unicode.txt', '中');
  const p = await f.prepare({ paths: ['unicode.txt'] }), good = cite(p, 'unicode.txt', '中');
  await assert.rejects(f.wiki.run('apply', draft(p, [page('bad-unicode', 'Bad UTF8', [{ ...good, startByte: 1, quote: '��' }])])), /INVALID_CITATION/);
  await f.wiki.run('apply', draft(p, [page('constructor', 'UTF8 citation fixture', [good])]));
  assert.equal(f.wiki.current().pages[0].version, 1);
});
