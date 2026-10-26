import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const commit = 'e1f9a6166a593a4804a2f99f1d942919c9cc8ea7';
const root = path.resolve('apps/wiki-reader/upstream');
const tree = JSON.parse(execFileSync('gh', ['api', `repos/Tencent/WeKnora/git/trees/${commit}?recursive=1`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
if (tree.truncated) throw new Error('Upstream tree truncated');
const resources = tree.tree.filter(e => e.type === 'blob' && (/^frontend\/src\/(?:assets|styles|locales|i18n)\//.test(e.path) && /(?:token|variable|theme|zh-CN|zh-cn|index\.less|global|design)/.test(e.path) || /(?:security|markedLiteralTilde|wikiRevisionDiff)\.ts$|SettingDrawer\.vue$/.test(e.path)));
if (process.argv.includes('--list')) { process.stdout.write(resources.map(e => e.path).join('\n') + '\n'); process.exit(0); }
const files = ['LICENSE', 'frontend/package.json',
  'frontend/src/views/knowledge/wiki/WikiBrowser.vue',
  'frontend/src/views/knowledge/wiki/WikiRevisionDrawer.vue',
  'frontend/src/api/wiki/index.ts',
  ...process.argv.slice(2),
];
const manifest = [];
for (const file of [...new Set(files)]) {
  const data = JSON.parse(execFileSync('gh', ['api', `repos/Tencent/WeKnora/contents/${file}?ref=${commit}`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  if (data.encoding !== 'base64' || !data.content) throw new Error(`No source bytes: ${file}`);
  const bytes = Buffer.from(data.content, 'base64'), target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target) && !fs.readFileSync(target).equals(bytes)) throw new Error(`Upstream file differs: ${file}`);
  fs.writeFileSync(target, bytes, { flag: fs.existsSync(target) ? 'w' : 'wx' });
  manifest.push({ file, sha256: createHash('sha256').update(bytes).digest('hex') });
}
fs.writeFileSync(path.join(root, 'SOURCE-MANIFEST.json'), JSON.stringify({ repository: 'Tencent/WeKnora', commit, files: manifest }, null, 2) + '\n');
process.stdout.write(JSON.stringify(manifest.map(e => e.file), null, 2));
