import { createHash } from 'node:crypto';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (code, text) => { throw new Error(`${code}: ${text}`); };
const text = (value, field) => { if (typeof value !== 'string' || !value.trim()) fail('EMPTY_CONTENT', field); return value; };
const ident = value => { if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(value)) fail('INVALID_ID', String(value)); return value; };
export const evidenceOf = page => page.evidence ?? page.facts ?? [];
export const contentOf = page => page.content ?? page.facts.map(f => f.markdown).join('\n\n');

// Byte identity is deterministic. Whether these citations support this text is
// an explicit reviewer judgement, never inferred from matching keywords.
export function compilePage(patch, old, sources, validateCitation) {
  const title = text(patch.title ?? old?.title, 'page title');
  if (/[\r\n<>\[\]]/.test(title)) fail('INVALID_INPUT', 'title must be a plain single line');
  const summary = text(patch.summary, 'summary'), content = text(patch.content, 'content');
  if (/\r|\n/.test(summary)) fail('INVALID_INPUT', 'summary must be one line');
  const pageType = patch.pageType ?? old?.pageType;
  if (!['summary', 'entity', 'concept', 'synthesis', 'comparison'].includes(pageType)) fail('INVALID_INPUT', 'pageType required');
  const category = patch.category ?? old?.category ?? [], aliases = patch.aliases ?? old?.aliases ?? [];
  if (!Array.isArray(category) || category.length > 2 || category.some(v => typeof v !== 'string' || !v.trim() || /[\\/\r\n]/.test(v))) fail('INVALID_INPUT', 'category needs at most two nonempty labels');
  if (!Array.isArray(aliases) || aliases.some(v => typeof v !== 'string' || !v.trim())) fail('INVALID_INPUT', 'aliases array');
  if (old && (old.content === undefined || contentOf(old).split(/\r?\n/).some(line => line.trim() && !content.includes(line)))) text(patch.changeReason, 'whole-page rewrite/removal requires changeReason');
  if (patch.facts !== undefined || !Array.isArray(patch.evidence) || !patch.evidence.length) fail('INVALID_MAPPING', 'content/summary and evidence required; facts are legacy only');
  const ids = new Set(), coverage = { content: [], summary: [] };
  const evidence = patch.evidence.map(e => {
    ident(e.id); if (ids.has(e.id)) fail('DUPLICATE_ID', e.id); ids.add(e.id);
    const target = e.target;
    if (!target || !['content', 'summary'].includes(target.field)) fail('INVALID_MAPPING', 'target.field is content or summary');
    const bytes = Buffer.from(target.field === 'content' ? content : summary);
    if (!Number.isSafeInteger(target.startByte) || !Number.isSafeInteger(target.endByte) || target.startByte < 0 || target.endByte <= target.startByte || target.endByte > bytes.length || !bytes.subarray(target.startByte, target.endByte).equals(Buffer.from(text(target.quote, 'target quote')))) fail('INVALID_MAPPING', 'target UTF-8 range must exactly match this page revision');
    if (!Array.isArray(e.citations) || !e.citations.length) fail('INVALID_CITATION', 'evidence requires original source citations');
    e.citations.forEach(c => validateCitation(c, sources));
    coverage[target.field].push([target.startByte, target.endByte]);
    return { id: e.id, target: { field: target.field, startByte: target.startByte, endByte: target.endByte, quote: target.quote }, citations: e.citations };
  });
  // Cover the authored text, including numbers, tables, and summary. Overlap is
  // allowed; whitespace needs no mapping. This checks scope, not entailment.
  for (const field of ['content', 'summary']) {
    const value = field === 'content' ? content : summary, covered = new Uint8Array(Buffer.byteLength(value));
    for (const [start, end] of coverage[field]) covered.fill(1, start, end);
    let offset = 0;
    for (const char of value) { const size = Buffer.byteLength(char); if (char.trim() && covered.subarray(offset, offset + size).some(v => !v)) fail('UNMAPPED_CONTENT', `${field}: byte ${offset}`); offset += size; }
  }
  const page = { pageId: patch.pageId, title, summary, content, pageType, category, aliases, evidence };
  page.contentHash = hash(page);
  return page;
}

export function sourceContexts(input, existing, sources) {
  const result = structuredClone(existing ?? []), seen = new Set();
  if (!Array.isArray(input)) fail('INVALID_INPUT', 'sourceContexts array');
  for (const context of input) {
    const source = sources.find(s => s.sourceId === context.sourceId);
    if (!source || context.revision !== source.versions.at(-1).revision || seen.has(context.sourceId)) fail('INVALID_INPUT', 'source context must uniquely name current source revision');
    seen.add(context.sourceId);
    for (const key of ['title', 'documentType', 'date', 'summary', 'attribution']) text(context[key], `source context ${key} (unknown must be explicit)`);
    const stored = { sourceId: context.sourceId, revision: context.revision, title: context.title, documentType: context.documentType, date: context.date, summary: context.summary, attribution: context.attribution };
    const index = result.findIndex(c => c.sourceId === context.sourceId);
    if (index < 0) result.push(stored); else result[index] = stored;
  }
  return result;
}

export function bindReview(page, supplied, contexts, old) {
  const citations = evidenceOf(page).flatMap(e => e.citations);
  const relevant = contexts.filter(c => citations.some(r => r.sourceId === c.sourceId && r.revision === c.revision));
  const bindingHash = hash({ contentHash: page.contentHash, contexts: relevant });
  if (supplied === undefined) return old?.review?.bindingHash === bindingHash ? old.review : { status: 'not-reviewed', bindingHash };
  if (!['reviewed', 'needs-review', 'not-reviewed'].includes(supplied.status)) fail('INVALID_REVIEW', 'explicit review status');
  if (supplied.status === 'not-reviewed') return { status: 'not-reviewed', bindingHash };
  text(supplied.reviewer, 'reviewer'); text(supplied.scope, 'review scope');
  if (!Array.isArray(supplied.checks) || supplied.checks.length !== evidenceOf(page).length) fail('INVALID_REVIEW', 'review all mapped units exactly once');
  const ids = new Set();
  for (const check of supplied.checks) {
    if (!evidenceOf(page).some(e => e.id === check.evidenceId) || ids.has(check.evidenceId) || !['supported', 'insufficient'].includes(check.assessment)) fail('INVALID_REVIEW', 'unknown/duplicate evidence or assessment');
    ids.add(check.evidenceId); text(check.reason, 'semantic assessment reason');
  }
  if (supplied.status === 'reviewed' && supplied.checks.some(c => c.assessment !== 'supported')) fail('INVALID_REVIEW', 'insufficient coverage cannot be reviewed');
  if (supplied.status === 'reviewed' && citations.some(c => !relevant.some(s => s.sourceId === c.sourceId && s.revision === c.revision))) fail('INVALID_REVIEW', 'reviewed page requires every cited document context');
  return { status: supplied.status, reviewer: supplied.reviewer, scope: supplied.scope, checks: supplied.checks, bindingHash };
}

export function updateIssues(input, existing, pages, sources) {
  if (!Array.isArray(input)) fail('INVALID_INPUT', 'issues array');
  const result = structuredClone(existing ?? []), seen = new Set();
  for (const issue of input) {
    ident(issue.issueId); if (seen.has(issue.issueId)) fail('DUPLICATE_ID', issue.issueId); seen.add(issue.issueId);
    for (const key of ['type', 'description', 'reportedBy']) text(issue[key], `issue ${key}`);
    if (!['open', 'resolved', 'dismissed'].includes(issue.status) || !Array.isArray(issue.pageIds) || !issue.pageIds.length || issue.pageIds.some(id => !pages.some(p => p.pageId === id))) fail('INVALID_ISSUE', 'status and affected pageIds required');
    if (issue.status !== 'open') text(issue.resolution, 'issue resolution');
    if (!Array.isArray(issue.evidenceRefs) || issue.evidenceRefs.some(r => !issue.pageIds.includes(r.pageId) || !evidenceOf(pages.find(p => p.pageId === r.pageId)).some(e => e.id === r.evidenceId))) fail('INVALID_ISSUE', 'evidenceRefs must reference affected page evidence');
    if (!Array.isArray(issue.sourceIds) || issue.sourceIds.some(id => !sources.some(s => s.sourceId === id))) fail('INVALID_ISSUE', 'sourceIds array');
    const stored = { issueId: issue.issueId, type: issue.type, description: issue.description, reportedBy: issue.reportedBy, status: issue.status, pageIds: issue.pageIds, evidenceRefs: issue.evidenceRefs, sourceIds: issue.sourceIds, ...(issue.resolution ? { resolution: issue.resolution } : {}) };
    const index = result.findIndex(i => i.issueId === issue.issueId);
    if (index < 0) result.push(stored); else result[index] = stored;
  }
  // Rewrites cannot silently leave dangling issue references.
  for (const issue of result) if (issue.status === 'open' && (issue.pageIds.some(id => !pages.some(p => p.pageId === id)) || issue.evidenceRefs.some(r => !pages.some(p => p.pageId === r.pageId && evidenceOf(p).some(e => e.id === r.evidenceId))))) fail('INVALID_ISSUE', `reconcile issue ${issue.issueId} after rewrite`);
  return result;
}

export function semanticStatus(state, stalePageIds = []) {
  const pages = state.pages.map(page => ({ pageId: page.pageId, status: stalePageIds.includes(page.pageId) ? 'needs-review' : page.review?.status ?? 'not-reviewed' }));
  return { status: pages.length && pages.every(p => p.status === 'reviewed') ? 'reviewed' : pages.some(p => p.status === 'needs-review') ? 'needs-review' : 'not-reviewed', pages, scope: 'Recorded reviewer assessments of cited materials; not experimental/scientific validation.' };
}
