import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileWiki } from '../../../research-pack/trial-skills/wiki-maintain/scripts/wiki.mjs';
import { runCollection } from '../../../research-pack/research-intent.mjs';
import { readWorkbench } from '../lib/adapter.mjs';

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-intake-'));
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };

test('run collections are recognised by structure only; arbitrary JSON arrays are not runs', () => {
  const val = { runs: Array.from({ length: 17 }, (_, i) => ({ run: `ffs-val-${i + 1}`, miou: 70 + i / 10, seed: i })) };
  const c = runCollection(val);
  assert.equal(c.pointer, '/runs'); assert.equal(c.records.length, 17);
  assert.equal(runCollection({ layers: [{ type: 'conv', size: 3 }] }), null, 'config arrays are not runs');
  assert.equal(runCollection([{ name: 'train', size: 100 }]), null, 'a generic name/value list is not a run collection');
  assert.equal(runCollection({ runs: [{ runId: 'r1', status: 'done' }, { note: 'no identity' }] }), null, 'one malformed record disqualifies the file');
  assert.equal(runCollection({ runs: [] }), null);
  assert.equal(runCollection([{ runId: 'r1', metrics: { acc: 0.9 } }]).pointer, '');
});

test('run records inside --paths keep file and entry locations; provenance is never assumed to be this round', async () => {
  const root = temp();
  write(root, 'results/validation_summaries_val.json', JSON.stringify({ runs: Array.from({ length: 17 }, (_, i) => ({ run: `ffs-val-${String(i + 1).padStart(2, '0')}`, miou: 70 + i / 10, seed: i })) }));
  write(root, 'results/history.json', JSON.stringify({ provenance: 'historical', runs: [{ runId: 'paper-baseline', metrics: { miou: 71.8 } }] }));
  write(root, 'results/config.json', JSON.stringify({ layers: [{ type: 'conv', size: 3 }] }));
  const p = await readWorkbench(root, { paths: ['results'] });
  const val = p.runs.filter(r => r.files[0] === 'results/validation_summaries_val.json');
  assert.equal(val.length, 17);
  assert.equal(val[0].id, 'ffs-val-01'); assert.equal(val[0].entry, 'results/validation_summaries_val.json#/runs/0');
  assert.deepEqual(val[0].metrics, { miou: 70 }); assert.equal(val[0].seed, '0');
  assert.ok(val.every(r => r.prov === 'unknown'), 'no provenance written: unknown, not current');
  assert.equal(p.runs.find(r => r.id === 'paper-baseline').prov, 'historical');
  assert.equal(p.runs.some(r => r.files[0] === 'results/config.json'), false);
  assert.equal(p.files.find(f => f.key === 'runs').detail.includes('18 条运行'), true);
});

test('scanned items, registered sources and exclusions are counted separately and consistently', async () => {
  const root = temp();
  for (let i = 1; i <= 41; i++) write(root, `materials/note-${String(i).padStart(2, '0')}.md`, `Note ${i} records one observation.\n`);
  for (let i = 1; i <= 13; i++) write(root, `materials/private-${i}.md`, 'excluded by name\n');
  const wiki = new FileWiki(root), p = await wiki.run('prepare', { paths: ['materials'], requestScope: { mode: 'full', paths: ['materials'] } });
  const decisions = p.sources.map(s => { const v = s.versions.at(-1); return { path: s.path, status: 'read', sourceId: s.sourceId, revision: v.revision, sha256: v.sha256, reason: 'Fixture read.', readRanges: [{ startByte: 0, endByte: Buffer.byteLength(v.text) }] }; });
  await wiki.run('apply', { runId: p.runId, baseCommitId: null, draftType: 'fixture', complete: true, pages: [], coverageDecisions: decisions });
  const w = await readWorkbench(root);
  assert.deepEqual(w.counts, { scanned: 54, registered: 41, excluded: 13, unavailable: 0, unsupported: 0, inScope: 41, complete: 41 });
  assert.equal(w.sources.filter(s => !s.inventoryOnly).length, 41);
  assert.equal(w.sources.filter(s => s.status === 'excluded').length, 13);
});
