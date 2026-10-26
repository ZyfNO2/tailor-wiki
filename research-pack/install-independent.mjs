import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

export const skillNames = ['wiki-maintain', 'academic-tailor', 'experiment-design', 'research-story'];
export const packRoot = path.dirname(fileURLToPath(import.meta.url));
export function skillFiles(name, root = packRoot) {
  if (!skillNames.includes(name)) throw new Error(`UNKNOWN_SKILL: ${name}`);
  const base = path.join(root, 'trial-skills', name), files = [];
  function visit(prefix = '') {
    for (const entry of fs.readdirSync(path.join(base, prefix), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error(`PATH_ESCAPE: skill contains link ${entry.name}`);
      const file = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && /\.(?:md|mjs|json)$/.test(entry.name)) files.push(file);
      else throw new Error(`INVALID_PACK: unexpected skill resource ${file}`);
    }
  }
  visit();
  const skill = fs.readFileSync(path.join(base, 'SKILL.md'), 'utf8');
  if (!new RegExp(`^---\\r?\\nname: ${name}\\r?\\n`).test(skill)) throw new Error(`INVALID_PACK: frontmatter name ${name}`);
  for (const file of files.filter(f => f.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(base, file), 'utf8');
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1].split('#')[0];
      if (!link || /^[a-z][a-z0-9+.-]*:/i.test(link)) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), link));
      if (!files.includes(target)) throw new Error(`INVALID_PACK: ${name}/${file} links outside installed closure: ${link}`);
    }
  }
  return files.sort().map(file => ({ name, file, sha256: createHash('sha256').update(fs.readFileSync(path.join(base, file))).digest('hex') }));
}
export function installIndependent(workspacePath, selected = skillNames, write = false, root = packRoot) {
  const workspace = fs.realpathSync(workspacePath), names = [...new Set(selected)];
  if (!names.length) throw new Error('INVALID_INPUT: select at least one skill');
  const files = names.flatMap(name => skillFiles(name, root));
  for (const name of ['.agents', '.agents/skills', ...names.map(n => `.agents/skills/${n}`)]) {
    const file = path.join(workspace, name);
    if (fs.existsSync(file) && (fs.lstatSync(file).isSymbolicLink() || !fs.lstatSync(file).isDirectory())) throw new Error(`PATH_ESCAPE: ${name}`);
  }
  const destinations = names.map(name => ({ name, path: path.join(workspace, '.agents/skills', name) }));
  for (const destination of destinations) if (fs.existsSync(destination.path)) throw new Error(`ALREADY_EXISTS: ${destination.name}; existing files are never overwritten`);
  if (write) {
    const stage = path.join(workspace, '.agents', `independent-install-${randomUUID()}`);
    fs.mkdirSync(stage, { recursive: true });
    // Validate and stage every resource first. Retain staging on interruption/failure;
    // installation is not claimed atomic across multiple destination directories.
    const receipt = { status: 'staging', destinations, files, published: [] };
    const saveReceipt = () => fs.writeFileSync(path.join(stage, 'install-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
    saveReceipt();
    try {
      for (const entry of files) {
        const target = path.join(stage, entry.name, entry.file); fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, 'trial-skills', entry.name, entry.file), target, fs.constants.COPYFILE_EXCL);
        if (createHash('sha256').update(fs.readFileSync(target)).digest('hex') !== entry.sha256) throw new Error(`SOURCE_CHANGED: ${entry.name}/${entry.file}`);
      }
      fs.mkdirSync(path.join(workspace, '.agents/skills'), { recursive: true });
      for (const destination of destinations) {
        if (fs.existsSync(destination.path)) throw new Error(`ALREADY_EXISTS: ${destination.name} appeared during staging`);
        // mkdir is exclusive: a racing installer/user directory cannot be replaced.
        fs.mkdirSync(destination.path);
        receipt.published.push(destination.name); saveReceipt();
        for (const entry of files.filter(e => e.name === destination.name)) {
          const target = path.join(destination.path, entry.file); fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.copyFileSync(path.join(stage, entry.name, entry.file), target, fs.constants.COPYFILE_EXCL);
          if (createHash('sha256').update(fs.readFileSync(target)).digest('hex') !== entry.sha256) throw new Error(`READBACK_FAILED: ${target}`);
        }
      }
      receipt.status = 'installed'; saveReceipt();
    } catch (error) { receipt.status = 'failed'; receipt.error = String(error); saveReceipt(); throw new Error(`INSTALL_FAILED: ${error.message}; inspect ${stage}/install-receipt.json`, { cause: error }); }
    return { mode: 'installed', destinations, files, receipt: path.join(stage, 'install-receipt.json'), note: 'No MCP/global configuration changed; native skill discovery depends on the host.' };
  }
  return { mode: 'preview', destinations, files, note: 'Use --write to install. No MCP/global configuration changed.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), index = args.indexOf('--workspace'), selected = args.indexOf('--skill');
    if (index < 0 || !args[index + 1]) throw new Error('--workspace DIR required; preview by default; optional --skill NAME; --write installs');
    process.stdout.write(JSON.stringify(installIndependent(args[index + 1], selected < 0 ? skillNames : [args[selected + 1]], args.includes('--write')), null, 2) + '\n');
  } catch (error) { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; }
}
