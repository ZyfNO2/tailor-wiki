const fail = message => { throw new Error(`INVALID_COVERAGE: ${message}`); };

export function requestCoverage(input, scan, requestedScan) {
  if (!input.requestScope) return { mode: 'legacy-unattested', paths: input.paths, inventory: scan.inventory };
  const { mode, paths } = input.requestScope;
  if (!['full', 'subset'].includes(mode) || !Array.isArray(paths) || !paths.length) fail('requestScope requires mode full|subset and paths');
  const includes = (scopes, file) => scopes.some(s => file === s.path || s.directory && (!s.path || file.startsWith(s.path + '/')));
  if (scan.files.some(f => !includes(requestedScan.scopes, f))) fail('selected input lies outside requested scope');
  if (mode === 'full' && JSON.stringify(scan) !== JSON.stringify(requestedScan)) fail('full request must scan every requested path; use mode subset for this batch');
  return { mode, paths, inventory: requestedScan.inventory, requestedScan };
}

export function reconcileCoverage(prepared, decisions, current) {
  const scope = prepared.coverage;
  if (!scope || scope.mode === 'legacy-unattested') return { mode: 'legacy-unattested', paths: prepared.input.paths, status: 'not-audited', entries: [] };
  if (!Array.isArray(decisions)) fail('coverageDecisions array required');
  const byPath = new Map();
  for (const d of decisions) {
    if (!scope.inventory.some(e => e.path === d.path) || byPath.has(d.path)) fail(`unknown/duplicate decision ${d.path}`);
    if (!['read', 'reuse', 'partial', 'unread', 'excluded'].includes(d.status)) fail(`status ${d.status}`);
    byPath.set(d.path, d);
  }
  const entries = scope.inventory.map(item => {
    const d = byPath.get(item.path), source = prepared.sources.find(s => s.path === item.path), version = source?.versions.at(-1);
    const base = { ...item, sourceId: source?.sourceId ?? null, revision: version?.revision ?? null, sha256: version?.sha256 ?? null };
    if (item.status !== 'supported') {
      if (d && d.status !== 'excluded') fail(`cannot mark unsupported/missing input read: ${item.path}`);
      return { ...base, status: d?.status === 'excluded' ? 'excluded' : item.status, reason: d?.reason?.trim() || item.reason };
    }
    if (!d) return { ...base, status: 'unread', reason: 'No Agent reading/explicit exclusion receipt.' };
    if (['partial', 'unread', 'excluded'].includes(d.status)) {
      if (typeof d.reason !== 'string' || !d.reason.trim()) fail(`reason required: ${item.path}`);
      return { ...base, status: d.status, reason: d.reason, readRanges: d.readRanges ?? [] };
    }
    if (!prepared.scan.files.includes(item.path) || source?.status !== 'available' || d.sourceId !== source.sourceId || d.revision !== version.revision || d.sha256 !== version.sha256) fail(`read/reuse must match current scanned, available source revision and hash: ${item.path}`);
    if (d.status === 'reuse') {
      const prior = (current.readReceipts ?? current.coverage?.entries ?? []).find(e => e.path === item.path && ['read', 'reuse'].includes(e.status));
      if (!prior || prior.sourceId !== d.sourceId || prior.revision !== d.revision || prior.sha256 !== d.sha256) fail(`no same-version completed reading to reuse: ${item.path}`);
      // Reuse the immutable receipt itself. A per-run reuse decision is already
      // retained in draft/trace; changing a timestamp/commit here would drift.
      return structuredClone(prior);
    }
    if (typeof d.reason !== 'string' || !d.reason.trim() || !Array.isArray(d.readRanges) || !d.readRanges.length) fail(`read requires reason and full text byte ranges: ${item.path}`);
    const length = Buffer.byteLength(version.text), bytes = Buffer.from(version.text), ranges = d.readRanges.slice().sort((a, b) => a.startByte - b.startByte);
    let offset = 0;
    for (const r of ranges) {
      if (!Number.isSafeInteger(r.startByte) || !Number.isSafeInteger(r.endByte) || r.startByte < 0 || r.startByte > offset || r.endByte <= r.startByte || r.endByte > length) fail(`missing/invalid read span: ${item.path}`);
      // A UTF-8 continuation byte is never a legal range boundary.
      if ((bytes[r.startByte] & 0xc0) === 0x80 || r.endByte < length && (bytes[r.endByte] & 0xc0) === 0x80) fail(`partial UTF-8 read span: ${item.path}`);
      offset = Math.max(offset, r.endByte);
    }
    if (offset !== length) fail(`unread tail: ${item.path}`);
    return { ...base, status: 'read', reason: d.reason, readRanges: ranges };
  });
  const incomplete = entries.filter(e => !['read', 'reuse', 'excluded'].includes(e.status));
  return { mode: scope.mode, paths: scope.paths, status: incomplete.length ? 'partial' : 'complete', entries, counts: Object.fromEntries([...new Set(entries.map(e => e.status))].map(s => [s, entries.filter(e => e.status === s).length])), scopeNote: 'Agent reading receipts are version-bound assertions; file parsing or byte coverage is not semantic/scientific validation.' };
}
