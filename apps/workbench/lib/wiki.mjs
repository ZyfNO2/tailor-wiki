// Read-only projection of the FileWiki snapshot for the workbench.
// Uses only FileWiki read paths (status/current/snapshot): no writer lock,
// no event, no file is created. Snapshots are verified by the runtime itself.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { FileWiki } from './pack.mjs';
import { renderMarkdown, escapeHtml } from './markdown.mjs';

const pad = n => String(n).padStart(2, '0');
export const stamp = value => {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const shortCommit = id => (id ? String(id).replace(/^commit-/, '').slice(0, 8) : null);
const message = error => String(error?.message ?? error);
const PAGE_TYPE = { summary: '文档摘要', entity: '实体', concept: '概念', synthesis: '综合', comparison: '比较' };
const STAGE = { prepared: '准备输入', staged: '暂存提交', committed: '写入快照', failed: '失败', input_failed: '输入无效', superseded: '被新请求替代', unchanged: '内容未变', recovery: '恢复提交', aborted: '放弃提交' };
const EXT = { '.pdf': 'PDF', '.md': 'Markdown', '.markdown': 'Markdown', '.txt': '文本', '.json': 'JSON' };
const kindOf = file => EXT[path.extname(file).toLowerCase()] ?? (path.extname(file).slice(1).toUpperCase() || '文件');
const hashId = value => createHash('sha256').update(value).digest('hex').slice(0, 10);

// Mirrors page-model.mjs: legacy pages store facts; natural pages store content.
const evidenceOf = page => page.evidence ?? page.facts ?? [];
function contentOf(page) {
  if (page.content !== undefined) return { text: page.content, evidence: page.evidence ?? [] };
  let offset = 0;
  const evidence = (page.facts ?? []).map(f => {
    const start = offset, end = start + Buffer.byteLength(f.markdown);
    offset = end + 2;
    return { id: f.id, target: { field: 'content', startByte: start, endByte: end }, citations: f.citations };
  });
  return { text: (page.facts ?? []).map(f => f.markdown).join('\n\n'), evidence };
}
const lineOf = (text, byte) => Buffer.from(text).subarray(0, byte).toString('utf8').split('\n').length;

// Registered source paths per published commit (for change detection) and a
// stat-keyed hash cache so originals are re-hashed only when they change.
const sourcePaths = new Map(), hashes = new Map();
export function trackedSourcePaths(root) {
  try {
    const pointer = JSON.parse(fs.readFileSync(path.join(root, '.wiki', 'current.json'), 'utf8')), key = `${root}|${pointer.commitId}`;
    if (!sourcePaths.has(key)) sourcePaths.set(key, JSON.parse(fs.readFileSync(path.join(root, 'wiki', 'history', pointer.commitId, 'state.json'), 'utf8')).sources.map(s => s.path));
    return sourcePaths.get(key);
  } catch { return []; }
}
function currentDigest(wiki, root, rel) {
  const st = fs.statSync(path.join(root, rel)), key = `${root}|${rel}`, hit = hashes.get(key);
  if (hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs) return hit.sha;
  const sha = wiki.digestSource(rel);
  hashes.set(key, { size: st.size, mtimeMs: st.mtimeMs, sha });
  return sha;
}

function readRuns(root, limit = 60) {
  const dir = path.join(root, '.wiki', 'runs'), traces = {}, byCommit = {}, problems = [];
  if (!fs.existsSync(dir)) return { traces, byCommit, problems };
  const runs = fs.readdirSync(dir).filter(name => /^[a-z0-9][a-z0-9-]{0,79}$/.test(name));
  const rows = [];
  for (const runId of runs) {
    const eventsDir = path.join(dir, runId, 'events');
    if (!fs.existsSync(eventsDir) || fs.lstatSync(eventsDir).isSymbolicLink()) continue;
    const events = [];
    for (const name of fs.readdirSync(eventsDir).filter(n => n.endsWith('.json')).sort()) {
      try { events.push(JSON.parse(fs.readFileSync(path.join(eventsDir, name), 'utf8'))); }
      catch (error) { problems.push(`${runId}/${name}: ${message(error)}`); }
    }
    if (events.length) rows.push({ runId, events, first: events[0].at, last: events.at(-1).at });
  }
  rows.sort((a, b) => String(b.last).localeCompare(String(a.last)));
  for (const row of rows.slice(0, limit)) {
    const committed = row.events.filter(e => e.stage === 'committed');
    committed.forEach(e => { byCommit[e.commitId] = row.runId; });
    const failed = row.events.some(e => e.stage === 'failed' || e.stage === 'input_failed');
    traces[row.runId] = {
      title: `Wiki 整理 │ ${committed.length ? '提交 #' + shortCommit(committed.at(-1).commitId) : failed ? '失败' : STAGE[row.events.at(-1).stage] ?? row.events.at(-1).stage}`,
      member: null, session: row.runId, file: `.wiki/runs/${row.runId}/events/`,
      at: `${stamp(row.first)} – ${stamp(row.last).split(' ')[1] ?? ''}`, sortAt: row.last, failed,
      events: row.events.map(e => ({ at: stamp(e.at).split(' ')[1] ?? '—', title: STAGE[e.stage] ?? e.stage, text: describe(e) })),
    };
  }
  return { traces, byCommit, problems };
}
function describe(e) {
  if (e.stage === 'prepared') return `起读提交 ${shortCommit(e.baseCommitId) ?? '无'}；变化来源 ${e.changedSourceIds?.length ?? 0} 个；受影响页面 ${e.affectedPageIds?.length ?? 0} 个`;
  if (e.stage === 'committed') return `快照 #${shortCommit(e.commitId)}；语义复核 ${e.semanticReview?.status ?? '—'}；未解决问题 ${e.issueStatus?.open ?? 0}${e.feedbackStatus ? '；产物同步 ' + e.feedbackStatus : ''}`;
  if (e.stage === 'staged') return `暂存 #${shortCommit(e.commitId)}，父提交 ${shortCommit(e.parentCommitId) ?? '无'}`;
  if (e.stage === 'failed' || e.stage === 'input_failed') return String(e.error ?? '').slice(0, 300);
  if (e.stage === 'unchanged') return '与当前快照相同，没有生成新版本';
  if (e.stage === 'superseded') return e.reason ?? '';
  if (e.stage === 'recovery') return `完成中断的提交 #${shortCommit(e.commitId)}`;
  return '';
}

function sourceStatus(source, coverage, receipts) {
  if (source.status === 'unavailable') return 'missing';
  if (source.status === 'withdrawn') return 'withdrawn';
  if (source.status === 'unparsed') return 'failed';
  const version = source.versions.at(-1);
  if (coverage) {
    if (coverage.status === 'read') return 'processed';
    if (coverage.status === 'reuse') return 'reused';
    if (['partial', 'unread', 'excluded'].includes(coverage.status)) return coverage.status;
  }
  return receipts.some(r => r.sourceId === source.sourceId && r.revision === version.revision) ? 'processed' : 'unaudited';
}
function readRange(entry, total) {
  if (!entry?.readRanges?.length) return '—';
  const r = entry.readRanges;
  if (r.length === 1 && r[0].startByte === 0 && r[0].endByte >= total) return '全文';
  return r.map(x => `字节 ${x.startByte}–${x.endByte}`).join('；');
}
function unreadRange(entry, total) {
  if (!entry || entry.status !== 'partial' || !entry.readRanges?.length) return entry?.status === 'unread' ? '全部' : null;
  const gaps = [];
  let at = 0;
  for (const r of [...entry.readRanges].sort((a, b) => a.startByte - b.startByte)) { if (r.startByte > at) gaps.push(`字节 ${at}–${r.startByte}`); at = Math.max(at, r.endByte); }
  if (at < total) gaps.push(`字节 ${at}–${total}`);
  return gaps.join('；') || null;
}

/** Read and project the Wiki. Never throws for Wiki problems; reports them. */
export async function readWiki(root, opt = {}) {
  const wiki = new FileWiki(root);
  const runs = readRuns(root);
  const meta = path.join(root, '.wiki');
  if (!fs.existsSync(path.join(meta, 'current.json')) && !fs.existsSync(path.join(meta, 'journals'))) {
    return { status: Object.keys(runs.traces).length ? 'partial' : 'missing', note: Object.keys(runs.traces).length ? '有 Wiki 运行记录，但还没有发布任何快照。' : null, traces: runs.traces, runProblems: runs.problems };
  }
  let observed;
  try { observed = await wiki.run('status'); }
  catch (error) { return { status: 'error', error: message(error), traces: runs.traces, runProblems: runs.problems }; }
  const state = observed.state;
  if (!state.commitId) return { status: 'partial', note: '有 Wiki 运行记录，但还没有发布任何快照。', journals: observed.journals, pendingFeedback: observed.pendingFeedback, traces: runs.traces, runProblems: runs.problems };

  // Ancestors give page version history; each snapshot is verified by FileWiki.
  const chain = [state];
  let parent = state.parentCommitId, historyNote = null;
  const limit = opt.historyLimit ?? 30;
  while (parent && chain.length < limit) {
    try { const s = wiki.snapshot(parent).state; chain.push(s); parent = s.parentCommitId; }
    catch (error) { historyNote = `更早的快照无法读取（${message(error)}）；版本历史只显示到这里。`; parent = null; }
  }
  if (parent) historyNote = `只加载最近 ${limit} 个快照的版本历史。`;
  chain.reverse();

  const sources = state.sources, sourceById = new Map(sources.map(s => [s.sourceId, s]));
  sourcePaths.set(`${root}|${state.commitId}`, sources.map(s => s.path));
  // Originals that changed or vanished after the snapshot: the Wiki needs
  // maintenance for them. Compared by content hash, never by timestamp alone.
  const drift = { changed: [], missing: [], unreadable: [] };
  for (const s of sources.filter(x => x.status === 'available')) {
    try {
      if (!fs.existsSync(path.join(root, s.path))) drift.missing.push(s.sourceId);
      else if (currentDigest(wiki, root, s.path) !== s.versions.at(-1).sha256) drift.changed.push(s.sourceId);
    } catch { drift.unreadable.push(s.sourceId); }
  }
  const driftOf = id => (drift.changed.includes(id) ? 'changed' : drift.missing.includes(id) ? 'missing' : drift.unreadable.includes(id) ? 'unreadable' : null);
  const contexts = state.sourceContexts ?? [], receipts = state.readReceipts ?? [];
  const coverageEntries = new Map();
  for (const request of state.coverageRequests ?? (state.coverage && state.coverage.mode !== 'legacy-unattested' ? [state.coverage] : [])) for (const e of request.entries ?? []) coverageEntries.set(e.path, e);
  for (const e of state.coverage?.entries ?? []) coverageEntries.set(e.path, e);
  const pageIds = new Set(state.pages.map(p => p.pageId));
  const runOf = s => s.provenance?.preparedRunId ?? runs.byCommit[s.commitId] ?? null;

  // Citations: one entry per (evidence, citation) pair, numbered per page in
  // reading order; body markers sit at the end of the block owning the range.
  const citations = {}, pages = [], graphEdges = [], sourceContext = {};
  let citeN = 0;
  for (const page of state.pages) {
    const { text, evidence } = contentOf(page);
    const ordered = [...evidence].sort((a, b) => (a.target.field === b.target.field ? a.target.endByte - b.target.endByte : a.target.field === 'content' ? -1 : 1));
    const ids = [], markers = [];
    let n = 0;
    for (const e of ordered) {
      const tokens = [];
      for (const c of e.citations) {
        const cid = 'c' + ++citeN, source = sourceById.get(c.sourceId), version = source?.versions.find(v => v.revision === c.revision);
        const current = source?.versions.at(-1), body = version?.text ?? '';
        const l1 = version ? lineOf(body, c.startByte) : null, l2 = version ? lineOf(body, Math.max(c.startByte, c.endByte - 1)) : null;
        const all = body.split('\n');
        citations[cid] = {
          page: page.pageId, n: ++n, source: c.sourceId, field: e.target.field,
          loc: [c.page != null ? `第 ${c.page} 页` : null, c.jsonPointer !== undefined ? `JSON ${c.jsonPointer || '（根）'}` : null, l1 ? (l1 === l2 ? `第 ${l1} 行` : `第 ${l1}–${l2} 行`) : null].filter(Boolean).join(' │ '),
          excerpt: c.quote, mark: '', cid: `${page.pageId}/${e.id}`, bytes: `${c.startByte}–${c.endByte}`,
          srcVersion: version ? `r${c.revision} │ sha256:${version.sha256.slice(0, 12)}…` : `r${c.revision}`,
          missing: !source || source.status !== 'available', stale: !!source && source.status === 'available' && current.revision !== c.revision,
          context: version ? all.slice(Math.max(0, l1 - 3), Math.min(all.length, l2 + 2)).map((t, k) => ({ n: Math.max(1, l1 - 2) + k, t, hit: Math.max(1, l1 - 2) + k >= l1 && Math.max(1, l1 - 2) + k <= l2 })) : null,
        };
        ids.push(cid);
        tokens.push(`{{c:${cid}}}`);
      }
      if (e.target.field === 'content') markers.push({ end: e.target.endByte, html: tokens.join('') });
    }
    let k = 0;
    const rendered = renderMarkdown(text, {
      idPrefix: 'p-' + page.pageId, pageExists: id => pageIds.has(id) && id !== page.pageId, pageTitle: id => state.pages.find(p => p.pageId === id)?.title,
      markers: (a, b) => { let out = ''; while (k < markers.length && markers[k].end - 1 < b) out += markers[k++].html; return out; },
    });
    // The runtime drops a leading H1 equal to the title; do the same in view.
    const html = rendered.html.replace(new RegExp(`^<h2 id="[^"]+">${escapeRe(escapeHtml(page.title))}</h2>\\n?`), '');
    for (const m of text.matchAll(/\[\[([a-z0-9][a-z0-9-]{0,79})(?:\|[^\]]+)?\]\]/g)) if (pageIds.has(m[1]) && m[1] !== page.pageId) graphEdges.push({ from: page.pageId, to: m[1], type: 'cites' });

    // Page versions: the oldest snapshot holding each page.version.
    const seen = new Map();
    let prev = null;
    for (const s of chain) {
      const pg = s.pages.find(p => p.pageId === page.pageId);
      if (!pg || seen.has(pg.version)) continue;
      const cur = new Map(evidenceOf(pg).flatMap(e => e.citations).map(c => [c.sourceId, c.revision]));
      const before = new Map(prev ? evidenceOf(prev).flatMap(e => e.citations).map(c => [c.sourceId, c.revision]) : []);
      const label = id => sourceById.get(id)?.path ?? id;
      const changes = [
        ...[...cur].filter(([id]) => !before.has(id)).map(([id, r]) => ({ op: 'add', text: `新增来源 ${label(id)}（r${r}）` })),
        ...[...cur].filter(([id, r]) => before.has(id) && before.get(id) !== r).map(([id, r]) => ({ op: 'change', text: `${label(id)} 来源版本 r${before.get(id)} → r${r}` })),
        ...[...before].filter(([id]) => !cur.has(id)).map(([id]) => ({ op: 'remove', text: `不再引用 ${label(id)}` })),
      ];
      const pv = s.provenance ?? {}, removal = (pv.removals ?? []).find(r => r.pageId === page.pageId);
      seen.set(pg.version, {
        v: 'v' + pg.version, at: stamp(s.createdAt), by: pv.command === 'rollback' ? 'wiki-maintain 回滚' : 'wiki-maintain', trace: runOf(s) && runs.traces[runOf(s)] ? runOf(s) : null,
        note: pv.command === 'rollback' ? `回滚到 #${shortCommit(pv.targetCommitId)}：${pv.reason ?? ''}` : removal?.changeReason ?? (prev ? '内容更新' : '首次整理'),
        lines: contentOf(pg).text.split('\n'), sources: changes, commit: shortCommit(s.commitId),
      });
      prev = pg;
    }
    const versions = [...seen.values()].reverse();
    const firstAt = versions.at(-1)?.at ?? stamp(state.createdAt), lastAt = versions[0]?.at ?? stamp(state.createdAt);
    const category = page.category ?? [];
    pages.push({
      id: page.pageId, title: page.title, type: PAGE_TYPE[page.pageType] ?? (page.content === undefined ? '旧格式页面' : page.pageType ?? '页面'),
      group: category[0] ?? (page.pageType ? 'type:' + page.pageType : 'type:legacy'), category,
      review: page.review?.status === 'reviewed' ? 'reviewed' : page.review?.status === 'needs-review' || observed.stalePageIds?.includes(page.pageId) ? 'needs' : 'pending',
      reviewInfo: page.review ? { status: page.review.status, reviewer: page.review.reviewer ?? null, scope: page.review.scope ?? null } : null,
      summary: page.summary ?? '', version: 'v' + page.version, updated: lastAt, created: firstAt,
      words: [...text].filter(ch => ch.trim()).length, file: `wiki/history/${state.commitId}/pages/${page.pageId}.md`,
      topics: [...category, ...(page.aliases ?? [])], citations: ids, body: html, versions, legacy: page.content === undefined,
      stale: observed.stalePageIds?.includes(page.pageId) ?? false,
    });
  }
  const groupKeys = [...new Set(pages.map(p => p.group))];
  const wikiGroups = groupKeys.map(key => ({ key, name: key.startsWith('type:') ? (PAGE_TYPE[key.slice(5)] ?? (key === 'type:legacy' ? '旧格式页面' : key.slice(5))) : key, en: key.startsWith('type:') ? key.slice(5) : 'Category' }));

  const sourceRows = sources.map(s => {
    const v = s.versions.at(-1), cov = coverageEntries.get(s.path), ctx = contexts.find(c => c.sourceId === s.sourceId);
    const total = Buffer.byteLength(v.text ?? '');
    if (v.text != null) sourceContext[s.sourceId] = v.text.split('\n').slice(0, 16).map((t, k) => ({ n: k + 1, t }));
    return {
      id: s.sourceId, path: s.path, kind: ctx?.documentType ?? kindOf(s.path), year: ctx?.date ?? '—', status: sourceStatus(s, cov, receipts),
      size: v.pages?.length ? `${v.pages.length} 页` : v.text != null ? `${v.text.split('\n').length} 行` : '—',
      range: cov ? readRange(cov, total) : '—', unread: unreadRange(cov, total), reason: cov?.reason ?? v.issue ?? null,
      note: ctx?.summary ?? null, attribution: ctx?.attribution ?? null, revision: v.revision, sha256: v.sha256,
      artifact: s.artifact ?? null, outside: false, drift: driftOf(s.sourceId),
    };
  });
  for (const [p, e] of coverageEntries) {
    if (e.sourceId || sourceRows.some(r => r.path === p)) continue;
    sourceRows.push({ id: 'inv-' + hashId(p), path: p, kind: kindOf(p), year: '—', status: e.status === 'unsupported' ? 'failed' : e.status, size: '—', range: '—', unread: e.status === 'unsupported' ? '全部' : null, reason: e.reason ?? null, note: null, outside: false, inventoryOnly: true });
  }
  // Scanned inventory items, registered sources and exclusions are different
  // populations; every view counts them from here so the numbers agree.
  const inventory = [...coverageEntries.values()];
  const counts = {
    scanned: inventory.length || sources.length,
    registered: sources.length,
    excluded: inventory.filter(e => e.status === 'excluded').length,
    unavailable: sources.filter(x => x.status === 'unavailable').length + inventory.filter(e => e.status === 'missing' && !e.sourceId).length,
    unsupported: inventory.filter(e => e.status === 'unsupported').length + sources.filter(x => x.status === 'unparsed').length,
  };
  counts.inScope = counts.scanned - counts.excluded;
  counts.complete = sourceRows.filter(r => !r.inventoryOnly && ['processed', 'reused'].includes(r.status)).length;

  const issues = (state.issues ?? []).map(q => ({
    id: q.issueId, title: String(q.description).split(/[。！？!?\n]/)[0].slice(0, 60) || q.issueId, kind: q.type, status: q.status, summary: q.description,
    sides: [], conditions: '', evidence: (q.evidenceRefs ?? []).map(r => `${r.pageId} / ${r.evidenceId}`).join('；') || '没有登记证据定位。',
    pages: q.pageIds ?? [], affects: (q.sourceIds ?? []).map(id => 'source:' + id), log: [{ at: '—', by: q.reportedBy, text: '登记问题' }], resolution: q.resolution ?? null, reportedBy: q.reportedBy,
  }));

  const latest = state.coverage ?? null, cs = observed.coverageStatus ?? {};
  const reviewed = pages.filter(p => p.review === 'reviewed').length;
  const coverage = {
    run: runOf(state) && runs.traces[runOf(state)] ? runOf(state) : null, by: 'wiki-maintain', at: stamp(state.createdAt),
    mode: latest?.mode ?? 'legacy-unattested', status: cs.status ?? 'not-audited', scope: latest?.paths ?? [],
    excluded: (latest?.entries ?? []).filter(e => e.status === 'excluded').map(e => `${e.path}（${e.reason ?? '排除'}）`),
    commit: { ok: true, text: `快照 #${shortCommit(state.commitId)} 已写入 wiki/history/`, at: stamp(state.createdAt) },
    review: { done: reviewed, total: pages.length, text: `语义复核：${reviewed} / ${pages.length} 页` },
    outstanding: (cs.outstandingRequests ?? []).map(r => ({ paths: r.paths, mode: r.mode, counts: r.counts ?? {} })),
    note: latest?.scopeNote ?? null,
  };

  const journals = observed.journals ?? [], feedback = observed.pendingFeedback ?? [];
  const warnings = [
    ...journals.map(j => `有未完成的写入 #${shortCommit(j.commitId)}：需要由 wiki-maintain 运行 recover。`),
    ...feedback.map(f => `待同步的产物 ${(f.artifacts ?? []).map(a => a.path).join('、')}（${f.status === 'failed-awaiting-agent' ? '上次同步失败' : '等待 Agent 合并'}）`),
    ...(historyNote ? [historyNote] : []), ...runs.problems.map(p => `trace 文件无法解析：${p}`),
  ];
  return {
    status: warnings.length || observed.completion === 'partial' ? 'partial' : 'ok',
    commitId: state.commitId, snapshot: { version: '#' + shortCommit(state.commitId), at: stamp(state.createdAt), pages: pages.length, by: 'wiki-maintain', trace: coverage.run, commitId: state.commitId, intro: state.indexIntro ?? null },
    pages, wikiGroups, citations, sources: sourceRows, counts, drift, sourceContext, issues, coverage, graphEdges, traces: runs.traces,
    completion: observed.completion, semanticReview: observed.semanticReview, journals, pendingFeedback: feedback, warnings,
    createdAt: state.createdAt,
  };
}
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
