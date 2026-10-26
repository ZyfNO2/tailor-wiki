export type WikiPage = any;
export type WikiPageRevision = any;
let data: any;
export async function loadSnapshot() {
  const response = await fetch('/api/snapshot');
  const value = await response.json();
  if (!response.ok || value.error) throw new Error(value.error || `Snapshot HTTP ${response.status}`);
  data = value; return value;
}
export const snapshot = () => { if (!data) throw new Error('Snapshot not loaded'); return data; };
export function mappedPage(page: any, state = snapshot().state) {
  const origin=snapshot().history.filter((s:any)=>s.pages.some((p:any)=>p.pageId===page.pageId&&p.version===page.version&&p.contentHash===page.contentHash)).at(-1)??state;
  const links = [...page.content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map((m: any) => m[1]);
  const incoming = state.pages.filter((p: any) => p.pageId !== page.pageId && p.content?.includes(`[[${page.pageId}`));
  const citations = (page.evidence ?? []).flatMap((e: any) => e.citations);
  return { ...page, id: page.pageId, slug: page.pageId, page_type: page.pageType, updated_at: origin.createdAt, last_edit_source: origin.provenance?.draftType ?? 'agent', out_links: links, in_links: incoming.map((p: any) => p.pageId), in_link_titles: Object.fromEntries(incoming.map((p: any) => [p.pageId, p.title])), source_refs: [...new Set(citations.map((c: any) => c.sourceId))].map(id => { const s = state.sources.find((s: any) => s.sourceId === id); return `${id}|${s?.path.split(/[\\/]/).at(-1) ?? '来源不可用'}`; }) };
}
export async function listWikiRevisions(_kb: string, slug: string, options: any) {
  const d = snapshot(), current = d.state.pages.find((p: any) => p.pageId === slug);
  const versions = new Map();
  for (const state of d.history) { const page = state.pages.find((p: any) => p.pageId === slug); if (page && page.version !== current.version && !versions.has(page.version)) versions.set(page.version, { ...mappedPage(page, state), id: `${slug}-v${page.version}`, edit_source: state.provenance?.command === 'rollback' ? 'revert' : state.provenance?.draftType ?? 'agent', edited_at: state.createdAt, commitId: state.commitId }); }
  const all = [...versions.values()]; return { revisions: all.slice(options.offset, options.offset + options.limit), total: all.length };
}
export async function getWikiRevision(_kb: string, slug: string, version: number) {
  for (const state of snapshot().history) { const page = state.pages.find((p: any) => p.pageId === slug && p.version === version); if (page) return mappedPage(page, state); }
  throw Object.assign(new Error(`历史版本 v${version} 不可用`), { status: 404 });
}
