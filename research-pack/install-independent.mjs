import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

export const skillNames = ['wiki-maintain', 'academic-tailor', 'experiment-design', 'research-story', 'research-guide'];
export const packRoot = path.dirname(fileURLToPath(import.meta.url));
// Project skill roots per host: DSH-style providers read .agents/skills,
// Claude Code reads .claude/skills. Choosing one never touches the other.
export const skillHosts = Object.freeze({ agents: '.agents', claude: '.claude' });
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
// The read-only workbench is installed next to the Skills by default
// (<host>/workbench) so any Skill with outputs can hand over a verified local
// page. It is display-only: no Skill imports it, --no-workbench installs the
// same Skills without it, and an existing workbench directory is kept as is.
// It carries its own copy of the read modules it needs in workbench/pack/.
const WORKBENCH_DEPS = ['research-intent.mjs', 'install-independent.mjs', 'trial-skills/wiki-maintain/scripts/wiki.mjs', 'trial-skills/wiki-maintain/scripts/page-model.mjs', 'trial-skills/wiki-maintain/scripts/coverage.mjs'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const present = file => { try { fs.lstatSync(file); return true; } catch { return false; } };
export function workbenchFiles(root = packRoot) {
  const source = [path.join(root, 'workbench'), path.resolve(root, '..', 'apps', 'workbench')].find(dir => fs.existsSync(path.join(dir, 'open.mjs')) && fs.existsSync(path.join(dir, 'server.mjs')));
  if (!source) return null;
  const files = [];
  const visit = prefix => {
    for (const entry of fs.readdirSync(path.join(source, prefix), { withFileTypes: true })) {
      const file = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`PATH_ESCAPE: workbench contains link ${file}`);
      // Tests, design-prototype sample data and any bundled pack copy stay out.
      if (entry.isDirectory()) { if (!['tests', 'pack', 'node_modules'].includes(file)) visit(file); }
      else if (entry.isFile() && file !== 'web/assets/js/data.js') files.push({ file, from: path.join(source, file) });
    }
  };
  visit('');
  for (const dep of WORKBENCH_DEPS) files.push({ file: `pack/${dep}`, from: path.join(root, dep) });
  return files.sort((a, b) => a.file.localeCompare(b.file)).map(entry => ({ ...entry, sha256: sha(fs.readFileSync(entry.from)) }));
}
export function installIndependent(workspacePath, selected = skillNames, write = false, root = packRoot, host = 'agents', opt = {}) {
  const workspace = fs.realpathSync(workspacePath), names = [...new Set(selected)], base = skillHosts[host];
  if (!Object.hasOwn(skillHosts, host)) throw new Error(`INVALID_INPUT: host must be ${Object.keys(skillHosts).join(' or ')}`);
  if (!names.length) throw new Error('INVALID_INPUT: select at least one skill');
  const files = names.flatMap(name => skillFiles(name, root));
  for (const name of [base, `${base}/skills`, ...names.map(n => `${base}/skills/${n}`)]) {
    const file = path.join(workspace, name);
    if (fs.existsSync(file) && (fs.lstatSync(file).isSymbolicLink() || !fs.lstatSync(file).isDirectory())) throw new Error(`PATH_ESCAPE: ${name}`);
  }
  const destinations = names.map(name => ({ name, path: path.join(workspace, base, 'skills', name) }));
  for (const destination of destinations) if (fs.existsSync(destination.path)) throw new Error(`ALREADY_EXISTS: ${destination.name}; existing files are never overwritten`);
  const discovery = host === 'claude' ? 'Claude Code project skills directory; if a running session does not list them, start a new session.' : 'native skill discovery depends on the host.';
  const wbPath = path.join(workspace, base, 'workbench'), wbFiles = opt.workbench === false ? null : workbenchFiles(root);
  const open = `node ${base}/workbench/open.mjs --workspace .`;
  const workbench = opt.workbench === false ? { status: 'skipped', note: '--no-workbench: Skills install and work without it.' }
    : !wbFiles ? { status: 'unavailable', note: 'This package has no workbench files; Skills are unaffected.' }
      : present(wbPath) ? { status: 'exists', path: wbPath, note: 'An existing workbench directory is left unchanged; remove it to reinstall.', open }
        : { status: write ? 'pending' : 'preview', path: wbPath, files: wbFiles.length, open };
  if (write) {
    const stage = path.join(workspace, base, `independent-install-${randomUUID()}`);
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
      fs.mkdirSync(path.join(workspace, base, 'skills'), { recursive: true });
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
    // The workbench goes in after the Skills; a problem with it never undoes them.
    if (workbench.status === 'pending') {
      try {
        const staged = path.join(stage, '.workbench');
        for (const entry of wbFiles) {
          const target = path.join(staged, entry.file); fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.copyFileSync(entry.from, target, fs.constants.COPYFILE_EXCL);
          if (sha(fs.readFileSync(target)) !== entry.sha256) throw new Error(`SOURCE_CHANGED: workbench/${entry.file}`);
        }
        fs.mkdirSync(wbPath);
        for (const entry of wbFiles) {
          const target = path.join(wbPath, entry.file); fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.copyFileSync(path.join(staged, entry.file), target, fs.constants.COPYFILE_EXCL);
          if (sha(fs.readFileSync(target)) !== entry.sha256) throw new Error(`READBACK_FAILED: ${target}`);
        }
        fs.rmSync(staged, { recursive: true, force: true });
        Object.assign(workbench, { status: 'installed' });
      } catch (error) { Object.assign(workbench, { status: 'failed', error: String(error?.message ?? error), note: 'Skills are installed; the workbench is optional.' }); }
      receipt.workbench = workbench; saveReceipt();
    }
    return { mode: 'installed', host, destinations, files, workbench, receipt: path.join(stage, 'install-receipt.json'), note: `No MCP/global configuration changed; ${discovery}` };
  }
  return { mode: 'preview', host, destinations, files, workbench, note: 'Use --write to install. No MCP/global configuration changed.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), index = args.indexOf('--workspace'), selected = args.indexOf('--skill'), host = args.indexOf('--host');
    if (index < 0 || !args[index + 1]) throw new Error('--workspace DIR required; preview by default; optional --skill NAME; --host agents|claude (default agents); --no-workbench skips the read-only workbench; --write installs');
    process.stdout.write(JSON.stringify(installIndependent(args[index + 1], selected < 0 ? skillNames : [args[selected + 1]], args.includes('--write'), packRoot, host < 0 ? 'agents' : args[host + 1], { workbench: !args.includes('--no-workbench') }), null, 2) + '\n');
  } catch (error) { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; }
}
