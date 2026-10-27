import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { zipSync } from 'fflate';
import { skillNames, skillFiles, packRoot, workbenchFiles } from '../research-pack/install-independent.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), outIndex = args.indexOf('--out');
const output = path.resolve(outIndex < 0 ? path.join(repo, 'dist', `independent-skills-${randomUUID()}`) : args[outIndex + 1]);
if (fs.existsSync(output) || fs.existsSync(output + '.zip')) throw new Error('ALREADY_EXISTS: build never overwrites a distribution');
fs.mkdirSync(path.dirname(output), { recursive: true });
if (fs.lstatSync(path.dirname(output)).isSymbolicLink()) throw new Error('PATH_ESCAPE: output parent cannot be a link');
const entries = skillNames.flatMap(name => skillFiles(name));
const expected = new Map(entries.map(entry => [`trial-skills/${entry.name}/${entry.file}`, entry.sha256]));
const files = ['install-independent.mjs', 'research-intent.mjs', 'ENTRYPOINTS.md', 'README.md', ...expected.keys()];
const archive = {}, manifest = [];
// The read-only workbench ships in workbench/; its read modules are the pack's
// own files at the package root, so its pack/ copies are not duplicated here.
const workbench = (workbenchFiles(packRoot) ?? []).filter(entry => !entry.file.startsWith('pack/'));
if (!workbench.some(entry => entry.file === 'open.mjs')) throw new Error('INVALID_PACK: workbench files missing');
for (const entry of workbench) {
  const bytes = fs.readFileSync(entry.from), sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== entry.sha256) throw new Error(`SOURCE_CHANGED: workbench/${entry.file}; rebuild after edits finish`);
  archive[`workbench/${entry.file}`] = new Uint8Array(bytes); manifest.push({ file: `workbench/${entry.file}`, sha256 });
}
for (const file of files) {
  const sourceBytes = fs.readFileSync(path.join(packRoot, file));
  // Repository-only planning documents are not shipped. Preserve their labels
  // as text instead of creating broken relative links in standalone ZIPs.
  const bytes = file === 'README.md' ? Buffer.from(sourceBytes.toString('utf8').replace(/\[([^\]]+)\]\(\.\.\/planning\/[^)]+\)/g, '$1（仓库内文档，不随独立包提供）')) : sourceBytes;
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (expected.has(file) && expected.get(file) !== sha256) throw new Error(`SOURCE_CHANGED: ${file}; rebuild after edits finish`);
  archive[file] = new Uint8Array(bytes); manifest.push({ file, sha256, ...(file === 'README.md' ? { sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'), transform: 'Repository planning links converted to plain labels for standalone distribution.' } : {}) });
}
if (JSON.stringify(skillNames.flatMap(name => skillFiles(name))) !== JSON.stringify(entries)) throw new Error('SOURCE_CHANGED: Skill closure changed during build; no distribution published');
archive['manifest.json'] = new TextEncoder().encode(JSON.stringify({ schemaVersion: 1, skills: skillNames, runtime: 'Node.js 24+; no Core or dependencies needed for Wiki runtime', workbench: 'workbench/: read-only display, installed to <host>/workbench by default; --no-workbench skips it; no Skill depends on it', files: manifest }, null, 2) + '\n');
fs.mkdirSync(output);
for (const [file, bytes] of Object.entries(archive)) { const target = path.join(output, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes, { flag: 'wx' }); }
fs.writeFileSync(output + '.zip', zipSync(archive, { level: 6 }), { flag: 'wx' });
process.stdout.write(JSON.stringify({ output, zip: output + '.zip', skills: skillNames, files: Object.keys(archive), note: 'Independent package with the optional read-only workbench; no root dsh-research Skill and no host slash registration claim.' }, null, 2) + '\n');
