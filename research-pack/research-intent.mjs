import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const intents = Object.freeze({ init: 'wiki-maintain', tailor: 'academic-tailor', exp: 'experiment-design', story: 'research-story' });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const error = (code, message) => { throw new Error(`${code}: ${message}`); };
// wiki/ is the Wiki's own published output; it is read through the runtime's
// verified snapshot below, never re-ingested as a raw artifact.
const excluded = new Set(['.git', '.agents', '.claude', '.wiki', 'wiki', '.dsh', '.research', 'node_modules', 'dist', 'build']);
// Installed skill locations: DSH-style hosts read .agents/skills, Claude Code reads .claude/skills.
const skillDirs = ['.agents/skills', '.claude/skills'];
function local(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p === '..')) error('PATH_ESCAPE', String(relative));
  const file = path.resolve(root, relative), rel = path.relative(root, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) error('PATH_ESCAPE', relative);
  let cursor = root;
  for (const part of rel.split(path.sep)) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) error('PATH_ESCAPE', relative);
  }
  return file;
}
function bytes(file) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 4 * 1024 * 1024) error('QUOTA', file);
  return fs.readFileSync(file);
}
function textFile(file) { return new TextDecoder('utf-8', { fatal: true }).decode(bytes(file)); }
function identity(text, data) {
  const ids = {};
  for (const key of ['planId', 'designId', 'taskId', 'runId', 'researchId', 'storyId']) {
    if (data && typeof data[key] === 'string') ids[key] = data[key];
    else {
      const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?${key}\\s*[:：]\\s*[\x60"']?([^\\s\x60"']+)`, 'i'));
      if (match) ids[key] = match[1];
    }
  }
  return ids; // Missing domain IDs remain absent; a path hash is not a Run ID.
}
function typeOf(relative) {
  const name = path.basename(relative);
  if (/^TAILOR(?:[-_.]|$)/i.test(name)) return 'method-plan';
  if (/^RESEARCH-DAG(?:[-_.]|$)/i.test(name)) return 'task-dag';
  if (/^EXPERIMENT-PLAN(?:[-_.]|$)/i.test(name)) return 'experiment-plan';
  if (/^STORY-PLAN(?:[-_.]|$)/i.test(name)) return 'story-plan';
  if (/(?:^|[-_.])(?:run|trace|result|review|metrics)(?:[-_.]|$)/i.test(name)) return 'run-or-evidence-record';
  return 'material';
}
/** Read explicit files/directories only. This projection writes no state. */
export function readArtifacts(workspacePath, requested = []) {
  const root = fs.realpathSync(workspacePath), files = new Set(), skipped = [], unavailable = [];
  if (!Array.isArray(requested) || requested.some(p => typeof p !== 'string')) error('INVALID_INPUT', 'paths must be an array');
  const defaults = ['TAILOR.md', 'RESEARCH-DAG.md', 'EXPERIMENT-PLAN.md', 'STORY-PLAN.md'];
  const visit = relative => {
    if (relative.split(/[\\/]/).some(p => excluded.has(p))) { skipped.push({ path: relative, reason: 'internal/runtime directory' }); return; }
    const file = local(root, relative);
    if (!fs.existsSync(file)) { unavailable.push({ path: relative, reason: 'not found' }); return; }
    const stat = fs.lstatSync(file);
    if (stat.isDirectory()) for (const entry of fs.readdirSync(file).sort()) visit(path.posix.join(relative.replaceAll('\\', '/'), entry));
    else if (/\.(?:md|markdown|txt|json)$/i.test(relative)) files.add(path.relative(root, file).replaceAll('\\', '/'));
    else skipped.push({ path: relative, reason: 'read adapter supports UTF-8 Markdown/TXT/JSON; use Wiki intake for PDF' });
    if (files.size > 256) error('QUOTA', 'at most 256 files');
  };
  for (const relative of [...new Set([...requested, ...defaults.filter(p => fs.existsSync(path.join(root, p)))])]) visit(relative);
  const artifacts = [...files].sort().map(relative => {
    const raw = bytes(local(root, relative)), text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
    const data = relative.toLowerCase().endsWith('.json') ? JSON.parse(text) : undefined;
    return { path: relative, fileIdentity: `file:${relative}`, sha256: sha(raw), type: typeOf(relative), domainIds: identity(text, data), content: text, ...(data !== undefined ? { data } : {}) };
  });
  return { root, requested, artifacts, skipped, unavailable };
}

export async function resolveIntent(workspacePath, input = {}) {
  const raw = String(input.intent ?? '').replace(/^\//, ''), intent = raw === 'research-init' ? 'init' : raw;
  const skill = intents[intent];
  if (!skill) error('UNKNOWN_INTENT', 'use init/research-init, tailor, exp or story');
  const projection = readArtifacts(workspacePath, input.paths ?? []), root = projection.root;
  const skillCandidates = skillDirs.map(dir => local(root, `${dir}/${skill}/SKILL.md`));
  const skillFile = skillCandidates.find(file => fs.existsSync(file)) ?? skillCandidates[0];
  const installed = fs.existsSync(skillFile);
  if (installed && !new RegExp(`^---\\r?\\nname: ${skill}\\r?\\n`).test(textFile(skillFile))) error('INVALID_SKILL', skill);
  let wiki = { status: 'absent', commitId: null, pages: [], journals: [] };
  if (fs.existsSync(local(root, '.wiki/current.json')) || fs.existsSync(local(root, '.wiki/journals'))) {
    const candidates = [...skillDirs.map(dir => local(root, `${dir}/wiki-maintain/scripts/wiki.mjs`)), path.join(path.dirname(fileURLToPath(import.meta.url)), 'trial-skills/wiki-maintain/scripts/wiki.mjs')];
    const runtime = candidates.find(file => fs.existsSync(file));
    if (!runtime) error('RUNTIME_UNAVAILABLE', 'Wiki exists but no validated reader runtime is available');
    const { FileWiki } = await import(pathToFileURL(runtime).href), observed = await new FileWiki(root).run('status');
    wiki = { status: observed.journals.length ? 'recovery-required' : observed.state.commitId ? 'available' : 'absent', commitId: observed.state.commitId, pages: observed.state.pages.map(p => ({ pageId: p.pageId, title: p.title, version: p.version })), journals: observed.journals, semanticReview: observed.semanticReview, coverage: observed.coverageStatus ?? null };
    for (const artifact of projection.artifacts) {
      const source = observed.state.sources.find(s => s.path === artifact.path);
      artifact.wikiSource = source ? { sourceId: source.sourceId, revision: source.versions.at(-1).revision, sha256: source.versions.at(-1).sha256, currentBytesMatch: source.versions.at(-1).sha256 === artifact.sha256 } : null;
    }
  }
  const goal = typeof input.goal === 'string' ? input.goal.trim() : '';
  const hasMaterial = projection.artifacts.length > 0 || wiki.pages.length > 0;
  const questions = intent === 'init' && !hasMaterial
    ? [...(!goal ? ['本次研究目标或主题是什么？'] : []), ...(typeof input.allowInternet !== 'boolean' ? ['是否允许联网检索，还是只使用你提供的本地材料？'] : [])]
    : !hasMaterial && !goal ? ['请提供本阶段的方案、材料路径或具体目标；无需先完成其他 Skill。'] : [];
  const blockers = [];
  if (!installed) blockers.push({ code: 'SKILL_NOT_INSTALLED', path: skillFile, searched: skillCandidates });
  if (projection.unavailable.length) blockers.push({ code: 'INPUT_UNAVAILABLE', paths: projection.unavailable.map(f => f.path) });
  if (wiki.status === 'recovery-required' && intent === 'init') blockers.push({ code: 'WIKI_RECOVERY_REQUIRED', journals: wiki.journals.map(j => j.commitId) });
  return {
    intent, skill, localEntry: intent === 'init' ? 'research-init' : intent,
    nativeSlashRegistered: false, nativeInitPolicy: 'preserve host /init; use this CLI research-init or invoke wiki-maintain by name',
    status: blockers.length ? 'blocked' : questions.length ? 'needs-input' : 'agent-handoff',
    goal, allowInternet: typeof input.allowInternet === 'boolean' ? input.allowInternet : null, questions, blockers, installedSkill: installed ? skillFile : null,
    skillContent: installed ? textFile(skillFile) : null,
    workspace: root, wiki, artifacts: projection.artifacts, skipped: projection.skipped, unavailable: projection.unavailable,
    execution: { mode: 'design-or-review', authorizedToRun: false, reason: '/exp alone never grants execution; this read-only resolver does not execute research or dispatch Agents' },
    handoff: { next: 'Current Agent reads the selected Skill and actual inputs, performs only the requested stage; preserve existing IDs and prior work.', previousStagesRequired: false, wikiFeedback: ['exp', 'story'].includes(intent) ? 'After saving changed outputs, invoke Wiki incremental feedback with those paths; do not rerun experiments for sync retry and do not recursively invoke research.' : null },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), flag = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
    const workspace = flag('--workspace'); if (!workspace) error('INVALID_INPUT', '--workspace DIR required');
    const inputFile = flag('--input'), input = inputFile ? JSON.parse(textFile(path.resolve(inputFile))) : {};
    if (flag('--intent')) input.intent = flag('--intent');
    process.stdout.write(JSON.stringify(await resolveIntent(workspace, input), null, 2) + '\n');
  } catch (cause) { process.stderr.write(`${cause.stack ?? cause}\n`); process.exitCode = 1; }
}
