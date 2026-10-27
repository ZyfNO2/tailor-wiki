// Pre-delivery check for RESEARCH-DAG.md, optionally against the experiment
// plan and the story's claims. Read-only: it prints JSON diagnostics with
// file:line locations and never edits, reorders or deletes anything.
//   node check-dag.mjs --dag RESEARCH-DAG.md [--plan EXPERIMENT-PLAN.md] [--story STORY-PLAN.md]
// Exit code: 0 no errors, 1 errors found, 2 the check itself could not run.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const squash = s => String(s ?? '').replace(/\s+/g, '');
const plain = s => String(s ?? '').replace(/`/g, '').replace(/\*\*/g, '').trim();
const lead = v => (plain(v).match(/^[A-Za-z][\w.-]*/) ?? [null])[0];
const col = (headers, ...res) => headers.findIndex(h => res.some(re => re.test(squash(h))));
const idPattern = id => new RegExp(`(?<![A-Za-z0-9_-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_-])`);
const PLACEHOLDER = /^[（(]?\s*(?:暂无|无|没有|none|n\/a|—|–|-)/i;
const SEPARATOR = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

// A list means all named tasks. Reject prose/alternatives instead of dropping
// their suffix and accidentally validating a different graph.
export function dependencyIds(value) {
  const raw = plain(value).replace(/<br\s*\/?>/gi, ',');
  const ids = raw.split(/[、,，+＋;；]/).map(s => s.trim());
  return ids.length && ids.every(id => /^[A-Za-z][\w.-]*$/.test(id)) ? [...new Set(ids)] : null;
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '', code = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '`') code = !code;
    if (c === '|' && !code) { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}
/** Markdown pipe tables outside code fences, with 1-based line numbers. */
export function tables(markdown) {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n'), out = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const marker = lines[i].match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) { fence = fence ? (marker[1][0] === fence[0] ? null : fence) : marker[1]; continue; }
    if (fence || !lines[i].includes('|') || i + 1 >= lines.length || !SEPARATOR.test(lines[i + 1])) continue;
    const headers = splitRow(lines[i]).map(plain), rows = [];
    let j = i + 2;
    for (; j < lines.length && lines[j].trim() && lines[j].includes('|'); j++) rows.push({ cells: splitRow(lines[j]), line: j + 1 });
    out.push({ line: i + 1, headers, rows });
    i = j - 1;
  }
  return out;
}
const isEdgeTable = t => col(t.headers, /前置|上游|^from$/i) >= 0 && col(t.headers, /后续|下游|^to$/i) >= 0;
const TASK_ID = [/任务(?:ID|标识|编号)|^(?:ID|编号|标识|节点)$/i];

/** Claim / contribution IDs declared in the story's contribution table. */
export function storyClaims(markdown) {
  const ids = new Set();
  for (const t of tables(markdown).filter(t => col(t.headers, /主张|贡献/) >= 0)) {
    const idCol = col(t.headers, /^(?:ID|编号|标识)$/i), claimCol = col(t.headers, /主张|贡献/);
    for (const r of t.rows) { const id = lead(r.cells[idCol >= 0 ? idCol : claimCol]); if (id && /^C/i.test(id)) ids.add(id); }
  }
  return [...ids];
}

export function checkDag(markdown, opt = {}) {
  const file = opt.file ?? 'RESEARCH-DAG.md', at = line => `${file}:${line}`;
  const errors = [], warnings = [], notes = [];
  const ts = tables(markdown), edgeTable = ts.find(isEdgeTable);
  const nodeTable = ts.find(t => !isEdgeTable(t) && col(t.headers, ...TASK_ID) >= 0) ?? ts.find(t => !isEdgeTable(t) && col(t.headers, /任务/) >= 0 && col(t.headers, /状态/) >= 0);
  const tasks = new Map();
  if (!nodeTable) errors.push({ code: 'no-node-table', at: at(1), ids: [], message: '没有找到任务节点表（需要“任务 ID”列）。' });
  else {
    const idCol = Math.max(0, col(nodeTable.headers, ...TASK_ID)), goalCol = col(nodeTable.headers, /目标|任务名|名称|描述|^任务$/);
    for (const r of nodeTable.rows) {
      const id = lead(r.cells[idCol]);
      if (!id) { errors.push({ code: 'missing-id', at: at(r.line), ids: [], message: '这一行没有可识别的任务 ID。' }); continue; }
      if (tasks.has(id)) { errors.push({ code: 'duplicate-id', at: at(r.line), ids: [id], message: `任务 ID ${id} 重复，首次出现在 ${at(tasks.get(id).line)}。` }); continue; }
      tasks.set(id, { line: r.line, goal: plain(r.cells[goalCol >= 0 ? goalCol : idCol + 1]) });
    }
  }
  const claims = new Set(opt.claims ?? []), claimLike = id => claims.has(id) || /^(?:C|CL|CLAIM)-?\d+$/i.test(id);
  const edges = [];
  if (edgeTable) {
    const from = col(edgeTable.headers, /前置|上游|^from$/i), to = col(edgeTable.headers, /后续|下游|^to$/i);
    for (const r of edgeTable.rows) {
      const ends = [plain(r.cells[from]), plain(r.cells[to])];
      if (ends.some(v => !v || PLACEHOLDER.test(v))) { warnings.push({ code: 'placeholder-endpoint', at: at(r.line), ids: ends.filter(Boolean), message: `依赖行“${ends[0] || '空'} → ${ends[1] || '空'}”有一端是占位文字；没有前置或后续时不写这条边，合法的独立节点保留在节点表即可。` }); continue; }
      const [fromIds, toIds] = ends.map(dependencyIds);
      if (!fromIds || !toIds) { errors.push({ code: 'missing-endpoint', at: at(r.line), ids: ends, message: `依赖行“${ends[0]} → ${ends[1]}”不能完整解析；请明确全部任务 ID 或将条件分支单独记录，不截取首个 ID。` }); continue; }
      for (const a of fromIds) for (const b of toIds) edges.push({ from: a, to: b, line: r.line });
    }
  } else if (tasks.size > 1) notes.push({ code: 'no-edge-table', at: at(1), ids: [], message: '没有依赖边表；如果任务之间确有依赖，请补上前置、后续与所需产物。' });

  const seen = new Set();
  for (const e of edges) {
    const key = `${e.from}>${e.to}`;
    if (seen.has(key)) warnings.push({ code: 'duplicate-edge', at: at(e.line), ids: [e.from, e.to], message: `依赖 ${e.from} → ${e.to} 重复出现。` });
    seen.add(key);
    if (e.from === e.to) { errors.push({ code: 'self-dependency', at: at(e.line), ids: [e.from], message: `${e.from} 依赖它自己；依赖应指向真实的前置任务。` }); continue; }
    for (const id of [e.from, e.to]) {
      if (tasks.has(id)) continue;
      if (claimLike(id)) errors.push({ code: 'claim-as-dependency', at: at(e.line), ids: [id], message: `${id} 是主张或贡献，不是任务；主张与任务的关联写在节点的关联列或叙事的贡献表里，不作为依赖边，也不必把主张改成任务。` });
      else errors.push({ code: 'missing-endpoint', at: at(e.line), ids: [id], message: `依赖引用了节点表中没有的 ${id}。` });
    }
  }

  // Cycles among real task edges (self-dependencies are reported above).
  const order = [...tasks.keys()], adj = new Map(order.map(id => [id, []]));
  for (const e of edges) if (e.from !== e.to && tasks.has(e.from) && tasks.has(e.to)) adj.get(e.from).push(e);
  let counter = 0;
  const index = new Map(), low = new Map(), stack = [], onStack = new Set();
  const strong = v => {
    index.set(v, counter); low.set(v, counter); counter++; stack.push(v); onStack.add(v);
    for (const e of adj.get(v)) {
      if (!index.has(e.to)) { strong(e.to); low.set(v, Math.min(low.get(v), low.get(e.to))); }
      else if (onStack.has(e.to)) low.set(v, Math.min(low.get(v), index.get(e.to)));
    }
    if (low.get(v) !== index.get(v)) return;
    const component = [];
    let w;
    do { w = stack.pop(); onStack.delete(w); component.push(w); } while (w !== v);
    if (component.length < 2) return;
    const ids = order.filter(id => component.includes(id)), lines = edges.filter(e => component.includes(e.from) && component.includes(e.to)).map(e => e.line);
    errors.push({ code: 'cycle', at: at(Math.min(...lines)), ids, message: `依赖环：${ids.join(' → ')} → ${ids[0]}（相关行 ${lines.join('、')}）；环上的任务无法确定先后。` });
  };
  for (const id of order) if (!index.has(id)) strong(id);

  const linked = new Set(edges.flatMap(e => [e.from, e.to]));
  const independent = order.filter(id => !linked.has(id));
  if (independent.length) notes.push({ code: 'independent-node', at: at(tasks.get(independent[0]).line), ids: independent, message: `${independent.join('、')} 没有依赖边；合法的独立任务保留即可，不需要为它补伪边。` });

  // A plan's dependency must be a real prerequisite, not the task that runs
  // that very plan: a run verb before the plan ID in the task goal ("T14 跑
  // EXP-A2"). Tasks that implement or prepare it ("实现 EXP-C1 对照") are real
  // prerequisites and are not flagged.
  if (opt.plan) {
    const planFile = opt.planFile ?? 'EXPERIMENT-PLAN.md';
    const planTable = tables(opt.plan).find(t => col(t.headers, /实验(?:标识|ID|编号)|^(?:ID|编号|标识)$/i) >= 0);
    if (planTable) {
      const idCol = Math.max(0, col(planTable.headers, /实验(?:标识|ID|编号)|^(?:ID|编号|标识)$/i)), depCol = col(planTable.headers, /依赖|前置/);
      for (const r of planTable.rows) {
        const planId = lead(r.cells[idCol]);
        if (!planId || depCol < 0) continue;
        for (const dep of new Set(plain(r.cells[depCol]).match(/[A-Za-z][\w.-]*/g) ?? [])) {
          const task = tasks.get(dep);
          const runs = task && new RegExp(`(?:跑|运行|执行|复现|训练|实测|\brun\b|\bexecute\b|\btrain\b)[^，。；;：:]{0,40}?${idPattern(planId).source}`, 'i').test(task.goal);
          if (runs) errors.push({ code: 'plan-depends-on-own-task', at: `${planFile}:${r.line}`, ids: [planId, dep], message: `${planId} 的依赖 ${dep} 就是执行 ${planId} 的任务（${at(task.line)}）；依赖应指向真实前置（输入、实现、协议），所属任务另行注明。` });
        }
      }
    }
  }
  return { ok: errors.length === 0, file, tasks: tasks.size, edges: edges.length, errors, warnings, notes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), flag = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  try {
    const dag = flag('--dag') ?? 'RESEARCH-DAG.md', planFile = flag('--plan'), storyFile = flag('--story');
    const read = file => new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
    const result = checkDag(read(dag), { file: dag, plan: planFile ? read(planFile) : undefined, planFile, claims: storyFile ? storyClaims(read(storyFile)) : [] });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 2; }
}
