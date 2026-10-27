import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveIntent, readArtifacts } from '../../research-pack/research-intent.mjs';
import { installIndependent } from '../../research-pack/install-independent.mjs';
import { pathToFileURL } from 'node:url';

const setup = () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'research-intent-fixture-')); installIndependent(root, undefined, true); return root; };
test('auto handoff discovers the installed router without declaring a PDF-only workspace empty or granting execution', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-intent-'));
  fs.mkdirSync(path.join(root, 'materials'));
  fs.writeFileSync(path.join(root, 'materials/paper.pdf'), '%PDF-fixture');
  installIndependent(root, undefined, true);
  const before = fs.readFileSync(path.join(root, 'materials/paper.pdf'));
  const result = await resolveIntent(root, { intent: '/auto-research' });
  assert.equal(result.skill, 'auto-research');
  assert.equal(result.allowInternet, true);
  const offline = await resolveIntent(root, { intent: '/auto-resaech', allowInternet: false });
  assert.equal(offline.skill, 'auto-research'); assert.equal(offline.allowInternet, false);
  assert.equal(result.status, 'agent-handoff');
  assert.deepEqual(result.questions, []);
  assert.equal(result.execution.authorizedToRun, false);
  assert.equal(result.nativeSlashRegistered, false);
  assert.ok(result.installedSkill.endsWith('auto-research/SKILL.md') || result.installedSkill.endsWith('auto-research\\SKILL.md'));
  assert.deepEqual(fs.readFileSync(path.join(root, 'materials/paper.pdf')), before);
});

test('guide installs and routes independently, discovers guide but does not implicitly ingest personal practice', async () => {
  const root = setup();
  fs.writeFileSync(path.join(root, 'RESEARCH-GUIDE.md'), '# Learning route');
  fs.writeFileSync(path.join(root, 'RESEARCH-PRACTICE.md'), 'Private learner answers');
  const result = await resolveIntent(root, { intent: 'guide' });
  assert.equal(result.skill, 'research-guide');
  assert.equal(result.status, 'agent-handoff');
  assert.ok(result.artifacts.some(a => a.path === 'RESEARCH-GUIDE.md'));
  assert.equal(result.artifacts.some(a => a.path === 'RESEARCH-PRACTICE.md'), false);
  assert.equal(result.handoff.wikiFeedback, null);
  assert.equal(result.execution.authorizedToRun, false);
});
test('empty init asks only the missing goal and defaults public research online; never registers or shadows host init', async () => {
  const root = setup(), before = fs.readdirSync(root), result = await resolveIntent(root, { intent: '/init' });
  assert.equal(result.status, 'needs-input'); assert.equal(result.skill, 'wiki-maintain'); assert.equal(result.localEntry, 'research-init');
  assert.equal(result.nativeSlashRegistered, false); assert.equal(result.questions.length, 1); assert.equal(result.execution.authorizedToRun, false);
  assert.deepEqual(fs.readdirSync(root), before);
  assert.equal((await resolveIntent(root, { intent: 'research-init' })).intent, 'init');
  assert.equal((await resolveIntent(root, { intent: 'init', goal: 'Concrete damage' })).questions.length, 0);
  assert.equal((await resolveIntent(root, { intent: 'init', goal: 'Concrete damage', allowInternet: false })).status, 'agent-handoff');
});
test('soft dependency skips Wiki and earlier stages; exp cannot authorize execution', async () => {
  const root = setup();
  for (const intent of ['tailor', 'exp', 'story', 'guide']) {
    const result = await resolveIntent(root, { intent, goal: 'Study this direct method design.' });
    assert.equal(result.status, 'agent-handoff'); assert.equal(result.handoff.previousStagesRequired, false);
    assert.equal(result.wiki.status, 'absent'); assert.equal(result.execution.authorizedToRun, false);
  }
  assert.equal((await resolveIntent(root, { intent: 'story' })).status, 'needs-input');
});
test('read projection preserves explicit plan/task/run IDs, file hashes and declared scope; errors remain visible', async () => {
  const root = setup(); fs.mkdirSync(path.join(root, 'work'));
  fs.writeFileSync(path.join(root, 'TAILOR.md'), '# Method\nplanId: plan-existing\n');
  fs.writeFileSync(path.join(root, 'work/run.json'), JSON.stringify({ runId: 'run-existing', taskId: 'task-existing', status: 'not-run' }));
  fs.writeFileSync(path.join(root, 'unrelated.md'), 'Do not scan me.');
  const first = await resolveIntent(root, { intent: 'exp', paths: ['work', 'missing.md'] });
  assert.equal(first.status, 'blocked'); assert.equal(first.unavailable[0].path, 'missing.md');
  assert.equal(first.artifacts.length, 2); assert.equal(first.artifacts.some(a => a.path === 'unrelated.md'), false);
  assert.equal(first.artifacts.find(a => a.path === 'TAILOR.md').domainIds.planId, 'plan-existing');
  const run = first.artifacts.find(a => a.path === 'work/run.json');
  assert.equal(run.domainIds.runId, 'run-existing'); assert.equal(run.domainIds.taskId, 'task-existing'); assert.equal(run.type, 'run-or-evidence-record');
  assert.deepEqual(readArtifacts(root, ['work']).artifacts, readArtifacts(root, ['work']).artifacts);
  assert.throws(() => readArtifacts(root, ['../other']), /PATH_ESCAPE/);
  fs.writeFileSync(path.join(root, 'work/run.json'), '{"runId":'); assert.throws(() => readArtifacts(root, ['work']), /SyntaxError/);
});
test('missing installed skill is reported instead of claiming native discovery', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'research-intent-missing-'));
  const result = await resolveIntent(root, { intent: 'tailor', goal: 'A direct proposal' });
  assert.equal(result.status, 'blocked'); assert.equal(result.blockers[0].code, 'SKILL_NOT_INSTALLED');
});
test('init exposes real Wiki recovery journal and rejects corrupt snapshots instead of starting over', async () => {
  const root = setup(), { FileWiki } = await import(pathToFileURL(path.join(root, '.agents/skills/wiki-maintain/scripts/wiki.mjs')).href);
  fs.writeFileSync(path.join(root, 'source.txt'), 'Synthetic intake material.');
  const wiki = new FileWiki(root), p = await wiki.run('prepare', { paths: ['source.txt'] });
  wiki.checkpoint = () => { throw new Error('INTENT_FIXTURE_INTERRUPTION'); };
  await assert.rejects(wiki.run('apply', { runId: p.runId, baseCommitId: p.baseCommitId, complete: true, draftType: 'fixture', pages: [] }), /INTENT_FIXTURE_INTERRUPTION/);
  const pending = await resolveIntent(root, { intent: 'init' });
  assert.equal(pending.wiki.status, 'recovery-required'); assert.equal(pending.status, 'blocked');
  delete wiki.checkpoint; const recovered = await wiki.run('recover', { commitId: wiki.pending()[0].commitId, mode: 'finish' });
  const ready = await resolveIntent(root, { intent: 'init', paths: ['source.txt'] });
  assert.equal(ready.wiki.commitId, recovered.commitId); assert.equal(ready.artifacts[0].wikiSource.currentBytesMatch, true);
  const snapshot = wiki.snapshot(recovered.commitId); fs.appendFileSync(path.join(snapshot.folder, 'state.json'), '\n');
  await assert.rejects(resolveIntent(root, { intent: 'story', goal: 'Direct design' }), /MANUAL_EDIT_CONFLICT/);
});
