// Lenient readers for the four skill artifacts. They only lift what the files
// state explicitly: the tables each Skill prescribes and "字段：值" lines.
// Anything else stays in the rendered document; nothing is inferred from prose.
import { renderMarkdown, plainInline, firstParagraph } from './markdown.mjs';

const squash = s => String(s ?? '').replace(/\s+/g, '');
export const col = (headers, ...patterns) => headers.findIndex(h => patterns.some(re => re.test(squash(h))));
const findTable = (tables, groups) => tables.find(t => groups.every(g => col(t.headers, ...g) >= 0));
const cell = (row, k) => (k >= 0 ? String(row[k] ?? '').trim() : '');
const blank = v => !v || /^(?:—|-|–|无|n\/a|none|null|未知)$/i.test(String(v).trim());
export const splitList = v => (blank(v) ? [] : String(v).split(/[、,，;；]|<br\s*\/?>|\s\/\s|\n/).map(s => s.trim()).filter(s => s && !blank(s)));
const firstSentence = (v, n = 48) => { const t = String(v ?? '').split(/[。；;！？!?\n]/)[0].trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const CN = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
export const idPattern = id => new RegExp(`(?<![A-Za-z0-9_-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_-])`);
const lead = v => { const m = String(v ?? '').trim().match(/^[A-Za-z][\w.-]*/); return m ? m[0] : String(v ?? '').trim(); };

/** Execution state from an explicit status cell; unrecognised stays unknown. */
// Status words are read from explicit status cells only. Blocking and
// negation are checked before positive words ("blocked (not run)" is blocked,
// "incomplete" is not done); text that matches nothing stays unknown.
export function execOf(value) {
  const t = String(value ?? '').trim().toLowerCase();
  if (blank(t)) return 'unknown';
  if (/阻塞|受阻|卡住|\bblocked\b|\bon[-_\s]?hold\b/.test(t)) return 'blocked';
  if (/失败|报错|\bfail(?:ed|ure)?\b|\berror\b|\bcrash(?:ed)?\b/.test(t)) return 'failed';
  if (/取消|中止|\bcancell?ed\b|\baborted\b/.test(t)) return 'cancelled';
  if (/淘汰|放弃|\babandon(?:ed)?\b/.test(t)) return 'abandoned';
  if (/部分完成|部分交付|\bpartial(?:ly)?\b/.test(t)) return 'unknown';
  if (/运行中|进行中|执行中|\brunning\b|\bin[-_\s]?progress\b/.test(t)) return 'running';
  if (/未完成|尚未|未开始|未运行|未执行|待运行|待执行|待开始|计划|\bincomplete\b|\bunfinished\b|\bnot[-_\s]+(?:yet[-_\s]+)?(?:run|started|done|complete[d]?|finished|executed)\b|\bpending\b|\btodo\b|\bto[-_\s]do\b|\bplanned\b|\bqueued\b|\bscheduled\b/.test(t)) return 'pending';
  if (/已完成|完成|已交付|\bdone\b|\bcompleted?\b|\bfinished\b|\bsucceeded\b|\bsuccess(?:ful)?\b/.test(t)) return 'done';
  if (/^待(?:运行|执行|开始|处理)/.test(t)) return 'pending';
  return 'unknown';
}
// Evidence provenance ("what kind of evidence") is kept apart from the
// support verdict ("does it support the claim"): a run, a report or a
// simulation never implies support, and support never implies a real run.
const NEGATED = /(?:未|没有|尚未|并未|不是|并非|非)(?:本轮)?(?:实际)?(?:运行|执行|模拟|仿真|核验|复现|记载)/g;
const PROVENANCE = [
  ['historical', /报告记载|历史报告|文献报告|论文报告|论文记载|报告值|\breported\b|\bhistorical\b/gi],
  ['verified', /已核验(?:的)?(?:原始)?(?:结果)?文件|核验原始结果|原始结果文件|\bverified (?:raw )?(?:result )?files?\b/gi],
  ['current', /本轮(?:实际)?(?:运行|执行|实测)|实际运行|\bcurrent run\b|\bthis run\b/gi],
  ['simulated', /模拟|仿真|\bsimulat\w*|\bsynthetic\b|\bmock(?:ed)?\b/gi],
  ['hypothesis', /假设|设想|\bhypothes\w*|\bassum\w*/gi],
];
export function provenanceOf(value) {
  const t = String(value ?? '').replace(NEGATED, ' ');
  return PROVENANCE.map(([kind, re]) => { re.lastIndex = 0; const m = re.exec(t); return m ? [m.index, kind] : null; }).filter(Boolean).sort((a, b) => a[0] - b[0]).map(([, kind]) => kind);
}
/** Support state from an explicit evidence-status cell. */
export function verdictOf(value) {
  const t = String(value ?? '').trim();
  if (blank(t)) return 'unknown';
  if (/不支持|反驳|被否定|证伪|\brefuted\b|\bcontradict\w*/i.test(t)) return 'refuted';
  if (/证据不足|不足|不充分|\binsufficient\b|\binconclusive\b/i.test(t)) return 'insufficient';
  if (/待核实|待核对|\bto be verified\b|\bverifying\b/i.test(t)) return 'verifying';
  if (/待验证|待证|未验证|尚未验证|假设|仅方案|方案主张|待定|\bpending\b|\buntested\b|\bnot (?:yet )?(?:verified|tested)\b/i.test(t)) return 'pending';
  if (/有证据支持|有来源支持|已支持|证据充分|支持|\bsupported\b/i.test(t)) return 'supported';
  return 'unknown';
}
function earliest(value, table) {
  let best = null;
  for (const [word, key] of table) {
    for (const m of String(value).matchAll(new RegExp(word, 'g'))) {
      if (/[不未]$|尚不$/.test(String(value).slice(Math.max(0, m.index - 2), m.index))) continue;
      if (!best || m.index < best.at) best = { at: m.index, key };
      break;
    }
  }
  return best?.key ?? null;
}
const field = (text, names) => {
  const m = String(text ?? '').match(new RegExp(`^\\s*(?:[-*+]\\s*)?(?:\\*\\*)?(?:${names})(?:\\*\\*)?\\s*[:：]\\s*(.+)$`, 'm'));
  return m ? plainInline(m[1]) : null;
};
export const readinessOf = v => (v ? earliest(v, [['可完整执行', 'full'], ['可试跑', 'pilot'], ['可设计', 'design']]) : null);
// Decisions only count when stated: negated phrases ("未授权", "尚未选定",
// "not selected") are removed first and never read as a decision.
export function decisionOf(value) {
  if (!value) return null;
  const t = String(value)
    .replace(/(?:尚未|未曾|并未|未|没有|不)(?:经)?(?:用户)?(?:授权(?:代理)?(?:代选|选择)?|选定|选择|选|决定|批准|代选)/g, ' ')
    .replace(/\bnot\s+(?:yet\s+)?(?:been\s+)?(?:selected|chosen|approved|authori[sz]ed|delegated)\b/gi, ' ');
  if (/用户已选定|已选定|已选择|已选|\bselected\b|\bchosen\b/i.test(t)) return 'selected';
  if (/授权代选|授权代理|授权.{0,6}(?:选择|代选|决定)|代理选择|\bdelegated\b/i.test(t)) return 'delegated';
  if (/建议|待选|待定|推荐|候选|\bproposed\b|\bsuggested\b/i.test(t)) return 'suggested';
  return null;
}
export const evidenceOf = v => (v ? (/有来源支持|有证据支持|已支持/.test(v) ? 'supported' : /部分/.test(v) ? 'partial' : /待核|待验证|未核/.test(v) ? 'pending' : /无证据|没有证据|^无$/.test(v) ? 'none' : null) : null);
const tableOut = t => (t ? { headers: t.headers, rows: t.rows, line: t.line } : null);

/** TAILOR.md: scheme sections (explicit headings) or the whole file as one. */
export function parseTailor(md, opt = {}) {
  const doc = renderMarkdown(md, { ...opt, idPrefix: 'tl' });
  const SCHEME = /^(?:推荐|候选|备选|选定|已选)?\s*(?:方案|组合方案|scheme|option)\s*([A-Za-z]?\d+|[A-Z](?![A-Za-z])|[一二三四五六七八九十]+)\s*[:：.、—-]?\s*(.*)$/i;
  let sections = doc.sections.filter(s => s.level >= 2 && s.level <= 3 && (SCHEME.test(s.text) || /^S\d+\b/.test(s.text)));
  if (!sections.length) sections = doc.sections.filter(s => s.level >= 2 && s.level <= 3 && /^(?:推荐|选定)(?:方案|组合)/.test(s.text));
  const checkT = findTable(doc.tables, [[/检查项/], [/核验|状态|证据/]]);
  const moduleT = findTable(doc.tables, [[/模块/], [/出处|来源|位置/]]);
  const whole = !sections.length;
  const units = whole ? [{ text: doc.title ?? 'TAILOR.md', line: 1, endLine: md.split('\n').length, markdown: md, whole: true }] : sections;
  const used = new Set();
  const schemes = units.map((s, k) => {
    const m = s.text.match(SCHEME), explicit = s.text.match(/\bS\d+\b/) ?? s.markdown.match(/(?:designId|schemeId)\s*[:：]\s*`?([\w.-]+)/);
    const token = m?.[1], num = token && (CN[token] ?? (/^\d+$/.test(token) ? token : null));
    let id = explicit ? explicit[1] ?? explicit[0] : num ? `S${num}` : token ? (/^[A-Za-z]\d+$/.test(token) ? token.toUpperCase() : `S-${token.toUpperCase()}`) : `S${k + 1}`;
    if (used.has(id)) id = `${id}-${k + 1}`;
    used.add(id);
    const title = s.whole ? (doc.title ?? '学术裁缝方案') : (m && m[2] ? m[2] : s.text);
    const rendered = s.whole ? doc : renderMarkdown(s.markdown, { ...opt, idPrefix: 'sc-' + id });
    const inRange = t => t && (s.whole || (t.line >= s.line && t.line <= s.endLine));
    const text = s.whole ? md : s.markdown, scope = whole || sections.length === 1 ? md : text;
    const readyText = field(text, '技术就绪|就绪状态|就绪度|就绪') ?? (whole || sections.length === 1 ? field(md, '技术就绪|就绪状态|就绪度|就绪') : null);
    const decisionText = field(text, '决策状态|用户决策|决策') ?? (whole || sections.length === 1 ? field(md, '决策状态|用户决策|决策') : null);
    const evidenceText = field(text, '证据状态|证据等级');
    return {
      id, no: String(k + 1).padStart(2, '0'), title, short: firstSentence(title, 22),
      decision: decisionOf(decisionText) ?? 'unknown', decisionText, readiness: readinessOf(readyText) ?? 'unknown', readinessText: readyText,
      evidence: evidenceOf(evidenceText) ?? 'unknown', evidenceText,
      source: { file: 'TAILOR.md', section: s.whole ? '全文' : s.text, lines: `第 ${s.line}–${s.endLine} 行`, at: null },
      question: field(text, '研究问题|验证问题|待验证问题|最小验证问题') ?? (firstParagraph(text) || null), questionFrom: field(text, '研究问题|验证问题|待验证问题|最小验证问题') ? 'field' : 'paragraph',
      failure: [], baseline: null, modules: [], changes: [], risks: [], hypotheses: [], checks: null,
      checkTable: tableOut(inRange(checkT) ? checkT : sections.length <= 1 ? checkT : null), moduleTable: tableOut(inRange(moduleT) ? moduleT : sections.length <= 1 ? moduleT : null),
      novelty: null, cost: null, materials: null, validation: null, plans: [], contribs: [],
      html: rendered.html, toc: rendered.headings.filter(h => h.level <= 3).map(h => ({ id: h.id, t: h.text })), text: scope, live: true,
    };
  });
  return { schemes, checkTable: tableOut(checkT), moduleTable: tableOut(moduleT), html: doc.html, toc: doc.headings.filter(h => h.level <= 3).map(h => ({ id: h.id, t: h.text })), title: doc.title, decisionText: field(md, '决策状态|用户决策|决策'), wholeFile: whole };
}

/** EXPERIMENT-PLAN.md: rows of the experiment table. */
export function parsePlan(md, opt = {}) {
  const doc = renderMarkdown(md, { ...opt, idPrefix: 'ep' });
  const ID = [/实验(?:标识|ID|编号)|^(?:ID|编号|标识)$/i];
  const t = findTable(doc.tables, [ID]) ?? findTable(doc.tables, [[/实验/], [/状态/]]);
  const notes = [];
  const plans = [];
  if (t) {
    const c = { id: col(t.headers, ...ID), q: col(t.headers, /问题|变体|目的/), cfg: col(t.headers, /数据|配置/), deps: col(t.headers, /依赖|前置/), crit: col(t.headers, /指标|判定|判据/), budget: col(t.headers, /预算|资源/), art: col(t.headers, /产物|输出/), st: col(t.headers, /状态/) };
    const idc = c.id >= 0 ? c.id : 0, seen = new Set();
    t.rows.forEach((row, k) => {
      const id = lead(cell(row, idc));
      if (!id) { notes.push(`第 ${t.lines[k]} 行没有实验标识，未列为计划。`); return; }
      if (seen.has(id)) { notes.push(`实验标识 ${id} 重复（第 ${t.lines[k]} 行），只显示第一行。`); return; }
      seen.add(id);
      const q = cell(row, c.q), status = cell(row, c.st);
      plans.push({
        id, title: firstSentence(q) || id, question: q || '计划表中没有填写验证问题。', hypothesis: null, scheme: null,
        line: `第 ${t.lines[k]} 行`, variants: [], control: null, split: null, seeds: null, config: cell(row, c.cfg) || null,
        depsText: cell(row, c.deps) || null, deps: [], primary: null, criteria: cell(row, c.crit) || null, guards: [],
        budget: cell(row, c.budget) || null, success: null, failure: null, artifacts: splitList(cell(row, c.art)),
        review: null, task: null, statusText: status || null, exec: execOf(status), conditional: null, live: true, rowText: row.join(' '),
      });
    });
  } else if (md.trim()) notes.push('没有找到含“实验标识”列的实验表，按原文显示。');
  return { plans, notes, html: doc.html, toc: doc.headings.filter(h => h.level <= 3).map(h => ({ id: h.id, t: h.text })), title: doc.title, table: t ? { headers: t.headers, line: t.line } : null };
}

/** RESEARCH-DAG.md: node table, edge table (or a Mermaid preview). */
export function parseDag(md, opt = {}) {
  const doc = renderMarkdown(md, { ...opt, idPrefix: 'dg' });
  const notes = [];
  const nodeT = findTable(doc.tables, [[/任务(?:ID|标识|编号)|^(?:ID|编号|标识|节点)$/i]]) ?? findTable(doc.tables, [[/任务/], [/状态/]]);
  const edgeT = findTable(doc.tables, [[/前置|上游|^from$/i], [/后续|下游|^to$/i]]);
  const tasks = [];
  if (nodeT && nodeT !== edgeT) {
    const c = { id: col(nodeT.headers, /任务(?:ID|标识|编号)|^(?:ID|编号|标识|节点)$/i), title: col(nodeT.headers, /目标|任务名|名称|描述|^任务$/), scheme: col(nodeT.headers, /方案/), inputs: col(nodeT.headers, /输入/), outputs: col(nodeT.headers, /产物|输出/), st: col(nodeT.headers, /状态/), blocked: col(nodeT.headers, /阻塞|原因/) };
    const idc = c.id >= 0 ? c.id : 0, seen = new Set();
    nodeT.rows.forEach((row, k) => {
      const id = lead(cell(row, idc));
      if (!id) { notes.push(`节点表第 ${nodeT.lines[k]} 行没有任务标识。`); return; }
      if (seen.has(id)) { notes.push(`任务标识 ${id} 重复（第 ${nodeT.lines[k]} 行），只显示第一行。`); return; }
      seen.add(id);
      const status = cell(row, c.st), blocked = cell(row, c.blocked);
      tasks.push({
        id, title: cell(row, c.title) || id, type: null, stage: cell(row, c.scheme) ? '方案 ' + cell(row, c.scheme) : '—', schemeText: cell(row, c.scheme) || null,
        owner: null, exec: execOf(status), statusText: status || null, review: 'unknown', reviewNote: null, at: '—', event: status || '状态未填写',
        inputs: splitList(cell(row, c.inputs)), outputs: splitList(cell(row, c.outputs)), trace: null, line: `第 ${nodeT.lines[k]} 行`,
        links: [], blocked: blank(blocked) ? null : blocked, group: null, live: true, rowText: row.join(' '),
      });
    });
  } else if (md.trim()) notes.push('没有找到任务节点表，按原文显示。');
  let edges = [];
  if (edgeT) {
    const c = { from: col(edgeT.headers, /前置|上游|^from$/i), to: col(edgeT.headers, /后续|下游|^to$/i), wait: col(edgeT.headers, /产物|条件|等待|说明/) };
    edges = edgeT.rows.map((row, k) => ({ from: lead(cell(row, c.from)), to: lead(cell(row, c.to)), wait: cell(row, c.wait) || '未写明', note: `RESEARCH-DAG.md 第 ${edgeT.lines[k]} 行`, line: edgeT.lines[k] })).filter(e => e.from && e.to);
  } else {
    for (const m of md.matchAll(/```mermaid\n([\s\S]*?)```/g)) {
      for (const e of m[1].matchAll(/([A-Za-z][\w-]*)(?:\[[^\]\n]*\]|\([^)\n]*\)|\{[^}\n]*\})?\s*-{2,}>(?:\|([^|\n]*)\|)?\s*([A-Za-z][\w-]*)/g)) edges.push({ from: e[1], to: e[3], wait: e[2]?.trim() || '未写明', note: '来自 Mermaid 预览（没有依赖边表）' });
    }
    if (edges.length) notes.push('依赖来自 Mermaid 预览；文件中没有依赖边表。');
  }
  return { tasks, edges, notes, html: doc.html, toc: doc.headings.filter(h => h.level <= 3).map(h => ({ id: h.id, t: h.text })), title: doc.title };
}

/** STORY-PLAN.md: main thread, contribution-evidence table, figures, gaps. */
export function parseStory(md, opt = {}) {
  const doc = renderMarkdown(md, { ...opt, idPrefix: 'sp' });
  const section = re => doc.sections.find(s => re.test(s.text));
  const items = s => (s ? s.markdown.split('\n').map(l => l.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/)).filter(Boolean).map(m => plainInline(m[1])) : []);
  const threadSection = section(/主线/);
  const thread = field(md, '一句话主线|主线') ?? (threadSection ? firstParagraph(threadSection.markdown) || items(threadSection)[0] || null : null);
  const t = findTable(doc.tables, [[/主张|贡献/], [/证据|来源/]]);
  const contributions = [];
  if (t) {
    const c = { id: col(t.headers, /^(?:ID|编号|标识)$/i), claim: col(t.headers, /主张|贡献/), diff: col(t.headers, /差异|区别|已有工作/), src: col(t.headers, /来源|Run|产物|位置/i), st: col(t.headers, /状态/), gap: col(t.headers, /局限|缺口/) };
    t.rows.forEach((row, k) => {
      const claim = cell(row, c.claim);
      if (!claim) return;
      const explicit = cell(row, c.id) || (claim.match(/^C\d+\b/) ?? [])[0];
      contributions.push({ id: explicit ? lead(explicit) : `C${k + 1}`, aspect: null, text: claim.replace(/^C\d+\s*[:：.]?\s*/, ''), diff: cell(row, c.diff) || null, evidenceText: cell(row, c.src) || null, refs: [], state: verdictOf(cell(row, c.st)), provenance: provenanceOf(`${cell(row, c.src)} ${cell(row, c.st)}`), statusText: cell(row, c.st) || null, gaps: [], gapText: cell(row, c.gap) || null, line: `第 ${t.lines[k]} 行`, rowText: row.join(' ') });
    });
  }
  const figT = findTable(doc.tables, [[/图|表/], [/问题|回答/]]);
  const figures = figT && figT !== t
    ? figT.rows.map((row, k) => ({ id: `F${k + 1}`, title: cell(row, col(figT.headers, /图|表/)) || `图表 ${k + 1}`, question: cell(row, col(figT.headers, /问题|回答/)) || null, materials: cell(row, col(figT.headers, /素材|材料|数据/)) || null, status: 'unknown', statusText: cell(row, col(figT.headers, /状态/)) || null, refs: [] }))
    : items(section(/图表/)).map((x, k) => ({ id: `F${k + 1}`, title: x, question: null, materials: null, status: 'unknown', statusText: null, refs: [] }));
  const gaps = items(section(/补证|缺口|待补/)).map((x, k) => ({ id: `G${k + 1}`, text: x, next: null, refs: [] }));
  const weak = items(section(/不宜|强表述|慎用/));
  return { thread, contributions, figures, gaps, weak, html: doc.html, toc: doc.headings.filter(h => h.level <= 3).map(h => ({ id: h.id, t: h.text })), title: doc.title, hasTable: !!t };
}
