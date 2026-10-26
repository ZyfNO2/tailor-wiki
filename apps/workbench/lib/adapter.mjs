// Workspace -> workbench project. Read-only by construction: files are only
// opened for reading, the Wiki goes through FileWiki read paths, extra paths
// go through the Skill pack's own read adapter (research-intent readArtifacts).
// Nothing is cached between requests, so a running Skill is never shadowed.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { readArtifacts } from '../../../research-pack/research-intent.mjs';
import { skillNames, skillHosts } from '../../../research-pack/install-independent.mjs';
import { readWiki, stamp, shortCommit } from './wiki.mjs';
import { parseTailor, parsePlan, parseDag, parseStory, execOf, idPattern } from './documents.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const message = error => String(error?.message ?? error);
export const DOCS = [
  { key: 'tailor', path: 'TAILOR.md', label: '学术裁缝方案', by: 'academic-tailor', view: 'schemes' },
  { key: 'dag', path: 'RESEARCH-DAG.md', label: '研究任务 DAG', by: 'academic-tailor', view: 'dag' },
  { key: 'plan', path: 'EXPERIMENT-PLAN.md', label: '实验计划', by: 'experiment-design', view: 'plan' },
  { key: 'story', path: 'STORY-PLAN.md', label: '研究叙事', by: 'research-story', view: 'story' },
];
const SKILL_LABEL = { 'wiki-maintain': 'Wiki 整理', 'academic-tailor': '学术裁缝', 'experiment-design': '实验设计', 'research-story': '研究叙事' };

/** Bounded, link-refusing UTF-8 read of one workspace-root file. */
function readDoc(root, rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return { status: 'missing' };
  const st = fs.lstatSync(file);
  if (st.isSymbolicLink() || !st.isFile()) return { status: 'error', error: '不是普通文件（链接或目录），工作台不读取。' };
  if (st.size > 4 * 1024 * 1024) return { status: 'error', error: `文件 ${st.size} 字节，超过 4 MiB；不截断读取。` };
  const bytes = fs.readFileSync(file);
  try { return { status: 'ok', text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), sha256: sha(bytes), at: stamp(st.mtime), mtime: st.mtimeMs }; }
  catch { return { status: 'error', error: '不是有效的 UTF-8 文本。' }; }
}
const PROV = { current: 'current', actual: 'current', real: 'current', historical: 'historical', history: 'historical', report: 'historical', simulated: 'simulated', simulation: 'simulated', mock: 'simulated' };
function runsOf(artifact) {
  const data = artifact.data;
  const list = Array.isArray(data) ? data : Array.isArray(data?.runs) ? data.runs : [data];
  return list.filter(r => r && typeof r === 'object' && !Array.isArray(r)).map((r, k) => {
    const metrics = r.metrics && typeof r.metrics === 'object' ? Object.fromEntries(Object.entries(r.metrics).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))) : null;
    return {
      id: String(r.runId ?? r.id ?? (list.length > 1 ? `${artifact.path}#${k + 1}` : artifact.path)), plan: r.planId ?? r.plan ?? null, task: r.taskId ?? null,
      variant: r.variant != null ? String(r.variant) : '—', seed: r.seed != null ? String(r.seed) : '—', prov: PROV[String(r.provenance ?? r.prov ?? '').toLowerCase()] ?? 'unknown',
      status: execOf(r.status), statusText: r.status ?? null, at: r.startedAt ? stamp(r.startedAt) : '—', dur: r.duration != null ? String(r.duration) : '—',
      metrics: metrics && Object.keys(metrics).length ? metrics : null, note: r.note ?? r.notes ?? null, files: [artifact.path], source: null,
      firstError: r.error ? { at: '—', text: String(r.error) } : null, config: r.config ?? null, code: r.code ?? null, data: r.data ?? null, live: true,
    };
  });
}
function installedSkills(root) {
  return Object.fromEntries(skillNames.map(name => [name, Object.values(skillHosts).filter(base => fs.existsSync(path.join(root, base, 'skills', name, 'SKILL.md'))).map(base => `${base}/skills`)]));
}

/** Build the workbench project for one workspace. Never writes. */
export async function readWorkbench(workspacePath, opt = {}) {
  const root = fs.realpathSync(workspacePath);
  const now = new Date();
  const wiki = await readWiki(root, opt);
  const docs = {}, parsed = {};
  const wikiPages = new Map((wiki.pages ?? []).map(p => [p.id, p.title])), pageExists = id => wikiPages.has(id), pageTitle = id => wikiPages.get(id);
  for (const d of DOCS) {
    const r = readDoc(root, d.path);
    docs[d.key] = { ...d, status: r.status, error: r.error ?? null, at: r.at ?? null, sha256: r.sha256 ?? null, mtime: r.mtime ?? null };
    if (r.status !== 'ok') continue;
    try {
      const fn = { tailor: parseTailor, dag: parseDag, plan: parsePlan, story: parseStory }[d.key];
      parsed[d.key] = fn(r.text, { pageExists, pageTitle });
      Object.assign(docs[d.key], { html: parsed[d.key].html, toc: parsed[d.key].toc, title: parsed[d.key].title, notes: parsed[d.key].notes ?? [] });
    } catch (error) { Object.assign(docs[d.key], { status: 'error', error: `解析失败：${message(error)}` }); }
  }

  // Extra paths (run / review / metrics records) through the Skill pack's own
  // read adapter; each path is isolated so one bad file never hides the rest.
  const extra = { files: [], errors: [], unavailable: [], skipped: [] }, runs = [];
  const docPaths = new Set(DOCS.map(d => d.path));
  for (const rel of opt.paths ?? []) {
    try {
      const projection = readArtifacts(root, [rel]);
      extra.unavailable.push(...projection.unavailable);
      extra.skipped.push(...projection.skipped);
      for (const a of projection.artifacts.filter(a => !docPaths.has(a.path))) {
        if (extra.files.some(f => f.path === a.path)) continue;
        extra.files.push({ path: a.path, type: a.type, sha256: a.sha256, domainIds: a.domainIds });
        if (a.data !== undefined && (a.type === 'run-or-evidence-record' || a.domainIds.runId)) runs.push(...runsOf(a));
      }
    } catch (error) { extra.errors.push(`${rel}：${message(error)}`); }
  }

  const tailor = parsed.tailor, dag = parsed.dag, plan = parsed.plan, story = parsed.story;
  const schemes = tailor?.schemes ?? [], tasks = dag?.tasks ?? [], plans = plan?.plans ?? [];
  schemes.forEach(s => { s.source.at = docs.tailor.at; });
  const pageIds = new Set((wiki.pages ?? []).map(p => p.id));
  const has = (text, id) => idPattern(id).test(text ?? '');

  // Cross references only where an ID literally appears in the other file.
  for (const p of plans) {
    p.scheme = schemes.find(s => has(p.rowText, s.id))?.id ?? null;
    p.deps = tasks.filter(t => has(p.depsText, t.id)).map(t => t.id);
    p.task = tasks.find(t => t.id === p.id)?.id ?? tasks.find(t => has(t.rowText, p.id))?.id ?? null;
  }
  for (const s of schemes) s.plans = plans.filter(p => has(s.text, p.id) || p.scheme === s.id).map(p => p.id);
  for (const t of tasks) t.links = [...schemes.filter(s => has(t.rowText, s.id)).map(s => 'scheme:' + s.id), ...plans.filter(p => has(t.rowText, p.id)).map(p => 'plan:' + p.id)];
  const runIds = new Set(runs.map(r => r.id));
  for (const c of story?.contributions ?? []) {
    const text = `${c.text} ${c.diff ?? ''} ${c.evidenceText ?? ''}`;
    c.refs = [...schemes.filter(s => has(text, s.id)).map(s => 'scheme:' + s.id), ...plans.filter(p => has(text, p.id)).map(p => 'plan:' + p.id), ...[...runIds].filter(id => has(text, id)).map(id => 'run:' + id), ...[...pageIds].filter(id => has(text, id)).map(id => 'wiki:' + id)];
  }
  for (const s of schemes) s.contribs = (story?.contributions ?? []).filter(c => c.refs.includes('scheme:' + s.id)).map(c => c.id);

  const taskIds = new Set(tasks.map(t => t.id));
  const missing = new Map();
  const dagEdges = (dag?.edges ?? []).map(e => {
    for (const id of [e.from, e.to]) if (!taskIds.has(id) && !missing.has(id)) missing.set(id, { id, title: id, note: `依赖边引用了节点表中没有的 ${id}` });
    const up = tasks.find(t => t.id === e.from);
    return { from: e.from, to: e.to, wait: e.wait, note: e.note, state: !up ? 'missing' : up.exec === 'done' ? 'ok' : up.exec === 'blocked' || up.exec === 'failed' ? 'blocked' : 'wait' };
  });

  // Graph: Wiki links and source support come from the snapshot; schemes join
  // only through Wiki links written in TAILOR.md.
  const graphNodes = [], graphEdges = [...(wiki.graphEdges ?? [])];
  for (const s of schemes) {
    const linked = [...new Set([...s.text.matchAll(/\[\[([a-z0-9][a-z0-9-]{0,79})(?:\|[^\]]+)?\]\]/g)].map(m => m[1]).filter(id => pageIds.has(id)))];
    if (!linked.length) continue;
    graphNodes.push({ id: s.id, type: 'scheme', title: s.short, ref: 'scheme:' + s.id });
    linked.forEach(id => graphEdges.push({ from: s.id, to: id, type: 'adopts', note: 'TAILOR.md 中的 Wiki 链接' }));
  }

  const wikiOk = wiki.status === 'ok' || (wiki.status === 'partial' && wiki.commitId);
  const files = [
    { key: 'wiki', path: 'wiki/', label: 'Wiki 已发布快照', by: 'wiki-maintain', status: wiki.status, at: wiki.snapshot?.at ?? '—',
      detail: wiki.commitId ? `快照 #${shortCommit(wiki.commitId)} │ ${wiki.pages.length} 页 │ ${wiki.sources.length} 个来源` : wiki.status === 'error' ? '快照校验失败' : '没有找到',
      note: wiki.status === 'error' ? wiki.error : [wiki.note, ...(wiki.warnings ?? []), wiki.completion === 'partial' ? 'Wiki 运行助手报告结构映射未完成（存在未映射来源、过时引用或覆盖缺口）。' : null].filter(Boolean).join(' ') || null },
    ...DOCS.map(d => {
      const doc = docs[d.key], p = parsed[d.key];
      const detail = doc.status === 'missing' ? '没有找到' : doc.status === 'error' ? '读取失败'
        : d.key === 'tailor' ? `${schemes.length} 个方案${p.wholeFile ? '（全文作为一个方案）' : ''}`
          : d.key === 'dag' ? `${tasks.length} 个任务 │ ${dagEdges.length} 条依赖`
            : d.key === 'plan' ? `${plans.length} 个实验计划`
              : `${story.contributions.length} 项贡献 │ ${story.gaps.length} 个补证事项`;
      const notes = [doc.error, ...(doc.notes ?? [])].filter(Boolean);
      return { key: d.key, path: d.path, label: d.label, by: d.by, at: doc.at ?? '—', detail: doc.sha256 ? `${detail} │ sha256 ${doc.sha256.slice(0, 8)}` : detail,
        status: doc.status === 'ok' && doc.notes?.length ? 'partial' : doc.status, note: notes.join(' ') || null };
    }),
    { key: 'runs', path: (opt.paths ?? []).join('、') || '（未指定）', label: '运行与证据记录', by: '实验执行记录',
      status: extra.errors.length ? (extra.files.length ? 'partial' : 'error') : extra.files.length ? (extra.unavailable.length ? 'partial' : 'ok') : 'missing', at: '—',
      detail: opt.paths?.length ? `${extra.files.length} 个文件 │ ${runs.length} 条运行` : '启动时用 --paths 指定运行记录目录',
      note: [...extra.errors, ...extra.unavailable.map(u => `${u.path}：${u.reason}`), ...extra.skipped.filter(s => !/internal/.test(s.reason)).map(s => `${s.path}：${s.reason}`)].join(' ') || null },
    { key: 'traces', path: '.wiki/runs/', label: 'Wiki 运行 trace', by: 'wiki-maintain', status: Object.keys(wiki.traces ?? {}).length ? (wiki.runProblems?.length ? 'partial' : 'ok') : 'missing', at: '—', detail: `${Object.keys(wiki.traces ?? {}).length} 次运行`, note: wiki.runProblems?.join(' ') || null },
    { key: 'team', path: '（未接入）', label: '成员与会话', by: 'Team（后续）', status: 'missing', at: '—', detail: 'Team 调度为后续功能，当前没有会话记录', note: null },
  ];

  const installs = installedSkills(root);
  const skillOut = {
    'wiki-maintain': wiki.commitId ? `快照 #${shortCommit(wiki.commitId)} │ ${wiki.pages.length} 页` : null,
    'academic-tailor': docs.tailor.status === 'ok' ? `${schemes.length} 个方案${docs.dag.status === 'ok' ? ` │ DAG ${tasks.length} 个任务` : ''}` : null,
    'experiment-design': docs.plan.status === 'ok' ? `${plans.length} 个实验计划` : null,
    'research-story': docs.story.status === 'ok' ? `${story.contributions.length} 项贡献 │ ${story.gaps.length} 个补证事项` : null,
  };
  const latestTrace = Object.entries(wiki.traces ?? {}).sort((a, b) => String(b[1].sortAt).localeCompare(String(a[1].sortAt)))[0]?.[0] ?? null;
  const skills = skillNames.map(name => ({
    id: name, name: SKILL_LABEL[name], file: { 'wiki-maintain': 'wiki/', 'academic-tailor': 'TAILOR.md', 'experiment-design': 'EXPERIMENT-PLAN.md', 'research-story': 'STORY-PLAN.md' }[name],
    output: skillOut[name], at: name === 'wiki-maintain' ? wiki.snapshot?.at ?? null : docs[{ 'academic-tailor': 'tailor', 'experiment-design': 'plan', 'research-story': 'story' }[name]].at,
    trace: name === 'wiki-maintain' ? latestTrace : null, installed: installs[name],
  }));

  const changes = [
    ...Object.entries(wiki.traces ?? {}).map(([id, t]) => ({ at: t.at.split(' – ')[0], sort: t.sortAt, by: 'wiki-maintain', text: t.title, ref: 'trace:' + id })),
    ...DOCS.filter(d => docs[d.key].status === 'ok').map(d => ({ at: docs[d.key].at, sort: new Date(docs[d.key].mtime).toISOString(), by: d.by, text: `${d.path} 最近修改`, ref: 'view:' + d.view })),
  ].sort((a, b) => String(b.sort).localeCompare(String(a.sort))).slice(0, 10).map(({ sort, ...c }) => c);
  const recent = [
    ...(wiki.commitId ? [{ path: `wiki/（快照 #${shortCommit(wiki.commitId)}）`, by: 'wiki-maintain', at: wiki.snapshot.at, ref: 'view:read', sort: wiki.createdAt }] : []),
    ...DOCS.filter(d => docs[d.key].status === 'ok').map(d => ({ path: d.path, by: d.by, at: docs[d.key].at, ref: 'view:' + d.view, sort: new Date(docs[d.key].mtime).toISOString() })),
  ].sort((a, b) => String(b.sort).localeCompare(String(a.sort))).map(({ sort, ...r }) => r);

  const name = path.basename(root) || root;
  const empty = !wiki.commitId && DOCS.every(d => docs[d.key].status === 'missing') && !runs.length;
  return {
    id: 'ws-' + sha(root).slice(0, 10), name, code: (name.match(/[A-Za-z]/g) ?? ['W', 'S']).slice(0, 3).join('').toUpperCase(), workspace: root,
    readAt: stamp(now), readAtIso: now.toISOString(), sample: false, live: true, empty,
    files, question: story?.thread ? { text: story.thread, from: 'STORY-PLAN.md', stage: null } : schemes[0]?.question && tailor?.wholeFile === false && schemes.length === 1 ? { text: schemes[0].question, from: 'TAILOR.md', stage: null } : null,
    skills, wikiSnapshot: wikiOk ? wiki.snapshot : null, wikiGroups: wiki.wikiGroups ?? [], pages: wiki.pages ?? [], citations: wiki.citations ?? {},
    coverage: wikiOk ? wiki.coverage : null, sources: wiki.sources ?? [], sourceContext: wiki.sourceContext ?? {}, issues: wiki.issues ?? [],
    graph: { nodes: graphNodes, edges: graphEdges }, schemes, hypotheses: [], planFile: docs.plan.status === 'ok' ? { path: 'EXPERIMENT-PLAN.md', version: 'sha256 ' + docs.plan.sha256.slice(0, 8), at: docs.plan.at, change: null } : null,
    plans, runs, reviews: [], conclusions: [], tasks, artifacts: {}, dagEdges, dagCycleEdge: null, dagMissing: [...missing.values()],
    members: [], roleTemplates: [], conflicts: [], traces: wiki.traces ?? {},
    story: docs.story.status === 'ok' ? { file: 'STORY-PLAN.md', version: 'sha256 ' + docs.story.sha256.slice(0, 8), at: docs.story.at, by: 'research-story', thread: story.thread, structure: [], claims: [], contributions: story.contributions, figures: story.figures, storylines: [], choice: null, gaps: story.gaps, weak: story.weak, live: true } : null,
    changes, recent, docs: Object.fromEntries(Object.entries(docs).map(([k, d]) => [k, { path: d.path, status: d.status, error: d.error, at: d.at, sha256: d.sha256, html: d.html ?? null, toc: d.toc ?? [], title: d.title ?? null, notes: d.notes ?? [] }])),
    schemeTables: tailor ? { check: tailor.checkTable, module: tailor.moduleTable, decisionText: tailor.decisionText } : null,
    wikiState: { journals: (wiki.journals ?? []).map(j => ({ commit: shortCommit(j.commitId), runId: j.runId })), pendingFeedback: (wiki.pendingFeedback ?? []).map(f => ({ runId: f.runId, status: f.status, paths: (f.artifacts ?? []).map(a => a.path), error: f.error })), completion: wiki.completion ?? null, semanticReview: wiki.semanticReview?.status ?? null, warnings: wiki.warnings ?? [] },
    extraFiles: extra.files,
  };
}

/** Cheap change detector: stat of the files the projection depends on. */
export function fingerprint(workspacePath, opt = {}) {
  const root = fs.realpathSync(workspacePath), parts = [];
  const add = rel => { try { const st = fs.statSync(path.join(root, rel)); parts.push(`${rel}:${st.size}:${st.mtimeMs}`); } catch { parts.push(`${rel}:-`); } };
  ['.wiki/current.json', ...DOCS.map(d => d.path)].forEach(add);
  for (const dir of ['.wiki/journals', '.wiki/runs']) {
    try { for (const name of fs.readdirSync(path.join(root, dir)).sort()) { add(`${dir}/${name}`); if (dir === '.wiki/runs') add(`${dir}/${name}/events`); } } catch { parts.push(`${dir}:-`); }
  }
  for (const rel of opt.paths ?? []) {
    const visit = (r, depth) => {
      add(r);
      if (depth > 3) return;
      try { const full = path.join(root, r); if (fs.lstatSync(full).isDirectory()) for (const n of fs.readdirSync(full).sort()) visit(path.posix.join(r, n), depth + 1); } catch { /* reported by the full read */ }
    };
    if (!path.isAbsolute(rel) && !rel.split(/[\\/]/).includes('..')) visit(rel, 0);
  }
  for (const base of Object.values(skillHosts)) for (const name of skillNames) add(`${base}/skills/${name}/SKILL.md`);
  return sha(parts.join('\n')).slice(0, 16);
}
