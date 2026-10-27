import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { unzipSync } from 'fflate';
import { createHash } from 'node:crypto';
import { installIndependent, skillFiles, skillNames } from '../../research-pack/install-independent.mjs';
import { FileWiki } from '../../research-pack/trial-skills/wiki-maintain/scripts/wiki.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-distribution-fixture-'));
test('five independent skills validate closure, preview is read-only, selective install never overwrites', () => {
  assert.deepEqual(skillNames, ['wiki-maintain', 'academic-tailor', 'experiment-design', 'research-story', 'research-guide']);
  for (const name of skillNames) assert.ok(skillFiles(name).some(entry => entry.file === 'SKILL.md'));
  const workspace = temp();
  assert.equal(installIndependent(workspace).mode, 'preview');
  assert.equal(fs.existsSync(path.join(workspace, '.agents')), false);
  const installed = installIndependent(workspace, ['wiki-maintain'], true);
  assert.equal(installed.destinations.length, 1);
  assert.equal(fs.existsSync(path.join(workspace, '.agents/skills/dsh-research')), false);
  assert.equal(fs.existsSync(path.join(workspace, '.agents/dsh-research.mcp.json')), false);
  const file = path.join(workspace, '.agents/skills/wiki-maintain/SKILL.md');
  fs.appendFileSync(file, '\nUser custom text.'); const bytes = fs.readFileSync(file);
  assert.throws(() => installIndependent(workspace, skillNames, true), /ALREADY_EXISTS/);
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.equal(fs.existsSync(path.join(workspace, '.agents/skills/academic-tailor')), false);
});
test('ZIP is self-contained, exact manifest hashes match, installed runtime completes prepare/apply/read without Core', () => {
  const root = temp(), output = path.join(root, 'package');
  const result = JSON.parse(execFileSync(process.execPath, ['scripts/build-independent-skills.mjs', '--out', output], { cwd: repo, encoding: 'utf8' }));
  const archive = unzipSync(fs.readFileSync(result.zip)), manifest = JSON.parse(new TextDecoder().decode(archive['manifest.json']));
  assert.ok(archive['research-intent.mjs']); assert.ok(archive['ENTRYPOINTS.md']); assert.ok(archive['README.md']);
  for (const [name, bytes] of Object.entries(archive).filter(([n]) => n.endsWith('.md'))) {
    const content = new TextDecoder().decode(bytes);
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      assert.ok(archive[path.posix.normalize(path.posix.join(path.posix.dirname(name), target))], `${name}: broken package link ${target}`);
    }
  }
  assert.deepEqual(manifest.skills, skillNames);
  assert.ok(manifest.files.some(entry => entry.file === 'trial-skills/research-story/SKILL.md'));
  assert.ok(manifest.files.some(entry => entry.file === 'trial-skills/research-story/references/sources.md'));
  assert.ok(manifest.files.some(entry => entry.file === 'trial-skills/experiment-design/references/external-research.md'));
  assert.ok(manifest.files.some(entry => entry.file === 'trial-skills/wiki-maintain/scripts/page-model.mjs'));
  assert.equal(manifest.skills.some(name => /novelty|innovation/.test(name)), false);
  assert.equal(archive['SKILL.md'], undefined); assert.equal(archive['trial-skills/TRY.md'], undefined);
  for (const entry of manifest.files) assert.equal(createHash('sha256').update(archive[entry.file]).digest('hex'), entry.sha256);
  const extracted = path.join(root, 'unpacked'); fs.mkdirSync(extracted);
  for (const [name, bytes] of Object.entries(archive)) { const target = path.join(extracted, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); }
  const workspace = path.join(root, 'workspace'); fs.mkdirSync(workspace);
  const install = JSON.parse(execFileSync(process.execPath, [path.join(extracted, 'install-independent.mjs'), '--workspace', workspace, '--write'], { encoding: 'utf8' }));
  assert.equal(install.destinations.length, 5);
  const intent = JSON.parse(execFileSync(process.execPath, [path.join(extracted, 'research-intent.mjs'), '--workspace', workspace, '--intent', 'research-init'], { encoding: 'utf8' }));
  assert.equal(intent.nativeSlashRegistered, false); assert.equal(intent.status, 'needs-input'); assert.equal(intent.questions.length, 2);
  assert.equal(fs.existsSync(path.join(workspace, '.agents/skills/research-story/references/sources.md')), true);
  const script = path.join(workspace, '.agents/skills/wiki-maintain/scripts/wiki.mjs');
  fs.mkdirSync(path.join(workspace, 'materials')); fs.writeFileSync(path.join(workspace, 'materials/test.txt'), 'This is a deterministic fixture source.');
  const input = path.join(root, 'prepare.json'); fs.writeFileSync(input, JSON.stringify({ paths: ['materials'] }));
  const prepared = JSON.parse(execFileSync(process.execPath, [script, 'prepare', '--workspace', workspace, '--input', input], { encoding: 'utf8' }));
  const s = prepared.sources[0], text = s.versions[0].text;
  const draft = { runId: prepared.runId, baseCommitId: null, draftType: 'fixture', complete: true, pages: [{ pageId: 'fixture', title: 'Fixture', expectedVersion: 0, expectedHash: null, facts: [{ id: 'fixture', markdown: 'Deterministic fixture only.', citations: [{ sourceId: s.sourceId, revision: 1, startByte: 0, endByte: Buffer.byteLength(text), quote: text }] }] }] };
  const draftFile = path.join(root, 'draft.json'); fs.writeFileSync(draftFile, JSON.stringify(draft));
  const applied = JSON.parse(execFileSync(process.execPath, [script, 'apply', '--workspace', workspace, '--input', draftFile], { encoding: 'utf8' }));
  assert.equal(applied.completion, 'complete');
  const status = JSON.parse(execFileSync(process.execPath, [script, 'status', '--workspace', workspace], { encoding: 'utf8' }));
  assert.equal(status.state.pages.length, 1);
  assert.equal(fs.existsSync(path.join(workspace, '.research')), false); assert.equal(fs.existsSync(path.join(workspace, '.dsh')), false);
  // Exercise the new compiler after installation. This is a synthetic protocol
  // test, not an Agent semantic acceptance result.
  const next = JSON.parse(execFileSync(process.execPath, [script, 'prepare', '--workspace', workspace, '--input', input], { encoding: 'utf8' }));
  const page = next.pages[0], citation = page.facts[0].citations[0], content = 'A synthetic proposal.', summary = 'Synthetic source only.';
  const compiled = { runId: next.runId, baseCommitId: next.baseCommitId, complete: true, draftType: 'fixture', pages: [{ pageId: page.pageId, title: page.title, pageType: 'concept', summary, content, expectedVersion: page.version, expectedHash: page.contentHash, changeReason: 'Fixture migration checks installed module, not meaning.', evidence: [
    { id: 'body', target: { field: 'content', startByte: 0, endByte: Buffer.byteLength(content), quote: content }, citations: [citation] },
    { id: 'summary', target: { field: 'summary', startByte: 0, endByte: Buffer.byteLength(summary), quote: summary }, citations: [citation] },
  ] }] };
  fs.writeFileSync(draftFile, JSON.stringify(compiled));
  const migrated = JSON.parse(execFileSync(process.execPath, [script, 'apply', '--workspace', workspace, '--input', draftFile], { encoding: 'utf8' }));
  assert.equal(migrated.status, 'committed'); assert.equal(migrated.semanticReview.status, 'not-reviewed');
  assert.deepEqual(migrated.legacyPageIds, []);
  const natural = fs.readFileSync(path.join(workspace, 'wiki/history', migrated.commitId, 'pages/fixture.md'), 'utf8');
  assert.match(natural, /A synthetic proposal/); assert.doesNotMatch(natural, /## body/);
  fs.writeFileSync(draftFile, '{"runId":');
  const truncated = spawnSync(process.execPath, [script, 'apply', '--workspace', workspace, '--input', draftFile], { encoding: 'utf8' });
  assert.equal(truncated.status, 1); assert.match(truncated.stderr, /SyntaxError/);
  const runs = path.join(workspace, '.wiki/runs');
  assert.ok(fs.readdirSync(runs).some(runId => fs.readdirSync(path.join(runs, runId, 'events')).some(file => JSON.parse(fs.readFileSync(path.join(runs, runId, 'events', file))).stage === 'input_failed')));
  assert.throws(() => execFileSync(process.execPath, ['scripts/build-independent-skills.mjs', '--out', output], { cwd: repo, stdio: 'pipe' }), /Command failed/);
});
test('actual child process termination leaves a lock and pending journal; explicit dead-owner recovery completes', async () => {
  const workspace = temp(), wiki = new FileWiki(workspace);
  fs.writeFileSync(path.join(workspace, 'source.txt'), 'Process-crash fixture source.');
  const prepared = await wiki.run('prepare', { paths: ['source.txt'] });
  const input = { runId: prepared.runId, baseCommitId: null, draftType: 'fixture', complete: true, pages: [] };
  const moduleUrl = new URL('../../research-pack/trial-skills/wiki-maintain/scripts/wiki.mjs', import.meta.url).href;
  const childCode = `import { FileWiki } from ${JSON.stringify(moduleUrl)}; const wiki = new FileWiki(${JSON.stringify(workspace)}); wiki.checkpoint = () => process.exit(29); await wiki.run('apply', ${JSON.stringify(input)});`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', childCode], { encoding: 'utf8' });
  assert.equal(child.status, 29); assert.equal(wiki.pending().length, 1);
  const lock = fs.readFileSync(path.join(workspace, '.wiki/writer.lock'));
  await assert.rejects(wiki.run('prepare', { paths: ['source.txt'] }), /HOST_BUSY/);
  assert.equal((await wiki.run('recover-lock', { expectedHash: createHash('sha256').update(lock).digest('hex') })).recovered, true);
  const journal = wiki.pending()[0], result = await wiki.run('recover', { commitId: journal.commitId, mode: 'finish' });
  assert.equal(result.status, 'committed'); assert.equal(result.completion, 'partial'); assert.equal(result.unmappedSourceIds.length, 1);
  assert.equal(wiki.pending().length, 0); assert.equal(fs.existsSync(path.join(workspace, '.wiki/writer.lock')), false);
});
