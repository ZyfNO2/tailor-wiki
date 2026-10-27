import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { FileWiki } from '../../research-pack/trial-skills/wiki-maintain/scripts/wiki.mjs';

const MiB = 1024 * 1024;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// The original only needs to hash correctly in sidecar mode; it is never parsed.
const bigPdf = () => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(5 * MiB, 0x20), Buffer.from('\n%%EOF\n')]);
function workspace(pdf) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-pdf-fixture-'));
  fs.mkdirSync(path.join(root, 'materials')); fs.mkdirSync(path.join(root, 'extract'));
  fs.writeFileSync(path.join(root, 'materials/paper.pdf'), pdf);
  return root;
}
const sidecar = (root, data) => fs.writeFileSync(path.join(root, 'extract/paper-pages.json'), JSON.stringify(data));
const withSidecar = { paths: ['materials'], extractions: [{ path: 'materials/paper.pdf', textPath: 'extract/paper-pages.json' }] };
const span = (field, quote) => ({ field, quote, startByte: 0, endByte: Buffer.byteLength(quote) });

test('a PDF original above the text limit is accepted with a hash-pinned page sidecar and re-verified at apply', async () => {
  const pdf = bigPdf(), root = workspace(pdf);
  assert.ok(pdf.length > 4 * MiB);
  sidecar(root, { sourceSha256: sha(pdf), pages: [{ page: 1, text: 'Page one states the method.' }, { page: 2, text: 'Page two lists the dataset.' }] });
  const wiki = new FileWiki(root), p = await wiki.run('prepare', withSidecar), s = p.sources[0], v = s.versions[0];
  assert.equal(s.status, 'available'); assert.equal(v.sha256, sha(pdf)); assert.match(v.parser, /user-supplied-page-text/);
  assert.equal(v.text, 'Page one states the method.\n\f\nPage two lists the dataset.', 'full sidecar text, never truncated');
  const quote = 'Page one states the method.', content = 'The paper states its method.', summary = 'Method statement.';
  const c = { sourceId: s.sourceId, revision: 1, page: 1, startByte: 0, endByte: Buffer.byteLength(quote), quote };
  const page = { pageId: 'method', title: 'Method', pageType: 'concept', summary, content, expectedVersion: 0, expectedHash: null, evidence: [{ id: 'body', target: span('content', content), citations: [c] }, { id: 'sum', target: span('summary', summary), citations: [c] }] };
  const applied = await wiki.run('apply', { runId: p.runId, baseCommitId: null, draftType: 'fixture', complete: true, pages: [page] });
  assert.equal(applied.status, 'committed');
  // Unchanged original + pinned sidecar: the next prepare reuses the same version.
  const again = await wiki.run('prepare', { paths: ['materials'] });
  assert.deepEqual(again.changedSourceIds, []);
  // A change to the original after prepare is still caught at apply (streamed hash).
  const late = await wiki.run('prepare', withSidecar);
  fs.appendFileSync(path.join(root, 'materials/paper.pdf'), ' ');
  await assert.rejects(wiki.run('apply', { runId: late.runId, baseCommitId: late.baseCommitId, draftType: 'fixture', complete: true, pages: [] }), /SOURCE_CHANGED/);
});

test('sidecar hash mismatch and oversize extracted text fail loudly instead of truncating', async () => {
  const pdf = bigPdf(), root = workspace(pdf);
  sidecar(root, { sourceSha256: sha(Buffer.from('a different file')), pages: [{ page: 1, text: 'x' }] });
  await assert.rejects(new FileWiki(root).run('prepare', withSidecar), /INVALID_EXTRACTION/);
  sidecar(root, { sourceSha256: sha(pdf), pages: [{ page: 1, text: 'a'.repeat(4 * MiB + 16) }] });
  await assert.rejects(new FileWiki(root).run('prepare', withSidecar), /QUOTA: .*text exceeds 4 MiB/);
});

test('a large PDF without sidecar or configured parser is registered unparsed, not a failed batch', async () => {
  const pdf = bigPdf(), root = workspace(pdf), saved = process.env.RESEARCH_PDFJS_MODULE;
  delete process.env.RESEARCH_PDFJS_MODULE;
  try {
    const p = await new FileWiki(root).run('prepare', { paths: ['materials'] });
    assert.equal(p.sources[0].status, 'unparsed'); assert.equal(p.sources[0].versions[0].sha256, sha(pdf));
    assert.match(p.sources[0].versions[0].issue, /PDF_PARSER_UNAVAILABLE/);
  } finally { if (saved !== undefined) process.env.RESEARCH_PDFJS_MODULE = saved; }
});
