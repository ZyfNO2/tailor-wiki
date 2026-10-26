import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { installIndependent, skillNames, packRoot } from '../../research-pack/install-independent.mjs';
import { resolveIntent } from '../../research-pack/research-intent.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'claude-host-fixture-'));

test('Claude Code host installs only into .claude/skills, leaves settings untouched, never overwrites', () => {
  const workspace = temp(), settings = path.join(workspace, '.claude/settings.local.json');
  fs.mkdirSync(path.dirname(settings)); fs.writeFileSync(settings, '{"permissions":{"allow":[]}}'); const bytes = fs.readFileSync(settings);
  const preview = installIndependent(workspace, undefined, false, packRoot, 'claude');
  assert.equal(preview.mode, 'preview'); assert.equal(preview.host, 'claude');
  assert.equal(fs.existsSync(path.join(workspace, '.claude/skills')), false);
  const installed = installIndependent(workspace, undefined, true, packRoot, 'claude');
  assert.equal(installed.destinations.length, 4);
  for (const name of skillNames) assert.ok(fs.existsSync(path.join(workspace, '.claude/skills', name, 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(workspace, '.claude/skills/wiki-maintain/scripts/wiki.mjs')));
  assert.equal(fs.existsSync(path.join(workspace, '.agents')), false);
  assert.deepEqual(fs.readFileSync(settings), bytes);
  assert.throws(() => installIndependent(workspace, ['wiki-maintain'], true, packRoot, 'claude'), /ALREADY_EXISTS/);
  assert.throws(() => installIndependent(workspace, undefined, false, packRoot, 'vscode'), /INVALID_INPUT/);
  const other = temp();
  const cli = JSON.parse(execFileSync(process.execPath, ['research-pack/install-independent.mjs', '--workspace', other, '--host', 'claude', '--skill', 'research-story', '--write'], { cwd: repo, encoding: 'utf8' }));
  assert.equal(cli.host, 'claude'); assert.equal(cli.destinations.length, 1);
  assert.ok(fs.existsSync(path.join(other, '.claude/skills/research-story/references/sources.md')));
});

test('SKILL.md frontmatter fits Claude Code skill metadata limits', () => {
  for (const name of skillNames) {
    const text = fs.readFileSync(path.join(packRoot, 'trial-skills', name, 'SKILL.md'), 'utf8');
    const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)[1].split(/\r?\n/);
    const fields = Object.fromEntries(front.map(line => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()]));
    assert.equal(fields.name, name); assert.match(name, /^[a-z0-9-]{1,64}$/);
    assert.ok(fields.description && [...fields.description].length <= 1024 && !/[<>]/.test(fields.description), `${name}: description`);
  }
});

test('intent resolver finds .claude installs; scans skip .claude and the Wiki output', async () => {
  const root = temp(); installIndependent(root, undefined, true, packRoot, 'claude');
  const { FileWiki } = await import(pathToFileURL(path.join(root, '.claude/skills/wiki-maintain/scripts/wiki.mjs')).href);
  fs.writeFileSync(path.join(root, '.claude/settings.local.json'), '{}');
  fs.mkdirSync(path.join(root, 'materials')); fs.writeFileSync(path.join(root, 'materials/a.md'), 'Synthetic material.');
  const wiki = new FileWiki(root), prepared = await wiki.run('prepare', { paths: ['.'] });
  assert.deepEqual(prepared.scan.files, ['materials/a.md']);
  assert.ok(prepared.scan.inventory.some(entry => entry.path === '.claude' && entry.status === 'excluded'));
  await wiki.run('apply', { runId: prepared.runId, baseCommitId: null, draftType: 'fixture', complete: true, pages: [] });
  const result = await resolveIntent(root, { intent: 'story', paths: ['.'] });
  assert.equal(result.installedSkill, path.join(fs.realpathSync(root), '.claude/skills/research-story/SKILL.md'));
  assert.equal(result.wiki.status, 'available');
  assert.deepEqual(result.artifacts.map(a => a.path), ['materials/a.md']);
  for (const internal of ['.claude', '.wiki', 'wiki']) assert.ok(result.skipped.some(s => s.path === internal), internal);
});
