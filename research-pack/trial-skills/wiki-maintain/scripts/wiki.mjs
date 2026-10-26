import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { compilePage, evidenceOf, contentOf, sourceContexts, bindReview, updateIssues, semanticStatus } from './page-model.mjs';
import { requestCoverage, reconcileCoverage } from './coverage.mjs';

// Independent file workflow. No Core state, network client or model invocation.
const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const fail = (code, message) => { throw new Error(`${code}: ${message}`); };
const id = value => { if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(value)) fail('INVALID_ID', String(value)); return value; };
const nonempty = (value, label) => { if (typeof value !== 'string' || !value.trim()) fail('EMPTY_CONTENT', label); return value; };
const excluded = name => /^(?:\.git|\.wiki|wiki|node_modules|dist|build|coverage|\.agents|\.claude|\.research|\.dsh|\.venv|venv|__pycache__|credentials|secrets)$/i.test(name) || /^(?:\.env(?:\.|$))|(?:credentials|secret|token|private)|\.(?:pem|key|pfx|p12)$/i.test(name);
const supported = file => /\.(?:md|markdown|txt|json|pdf)$/i.test(file);
const within = (root, file) => { const relative = path.relative(root, file); return relative === '' || !relative.startsWith('..') && !path.isAbsolute(relative); };
const pageVersion = (state, pageId) => state.pageVersions && Object.hasOwn(state.pageVersions, pageId) ? state.pageVersions[pageId] : state.pages.find(p => p.pageId === pageId)?.version ?? 0;
// Code and quoted source strings are data, not authored cross-links.
function prose(markdown, transform) {
  let fence = null;
  return markdown.split('\n').map(line => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) { if (!fence) fence = marker[1]; else if (fence[0] === marker[1][0] && marker[1].length >= fence.length && !line.slice(marker[0].length).trim()) fence = null; return line; }
    if (fence || /^(?: {4}|\t)|^\s*>/.test(line)) return line;
    return line.split(/(`+[^`]*`+)/g).map(part => part.startsWith('`') ? part : transform(part)).join('');
  }).join('\n');
}

function safe(root, relative, missing = false) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p === '..')) fail('PATH_ESCAPE', String(relative));
  const file = path.resolve(root, relative);
  if (!within(root, file)) fail('PATH_ESCAPE', relative);
  let cursor = root;
  for (const part of path.relative(root, file).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    if (!fs.existsSync(cursor)) { if (!missing) fail('SOURCE_UNAVAILABLE', relative); continue; }
    if (fs.lstatSync(cursor).isSymbolicLink() || !within(root, fs.realpathSync(cursor))) fail('PATH_ESCAPE', relative);
  }
  return file;
}
function bounded(file, limit = 4 * 1024 * 1024) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('PATH_ESCAPE', file);
  if (stat.size > limit) fail('QUOTA', `${file} exceeds ${limit} bytes; not truncated`);
  const bytes = fs.readFileSync(file);
  if (bytes.length !== stat.size) fail('SOURCE_CHANGED', file);
  return bytes;
}
function atomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temporary, 'wx');
  try { fs.writeFileSync(fd, content); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}
function fresh(file, content) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content, { flag: 'wx' }); }
const readJSON = file => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bounded(file, 32 * 1024 * 1024)));

export class FileWiki {
  constructor(workspace) {
    this.root = fs.realpathSync(workspace);
    this.meta = safe(this.root, '.wiki', true);
    this.output = safe(this.root, 'wiki', true);
  }
  location(relative) { return safe(this.root, relative, true); }
  pointer() { const file = this.location('.wiki/current.json'); return fs.existsSync(file) ? readJSON(file) : null; }
  event(runId, stage, detail = {}) {
    fresh(this.location(`.wiki/runs/${id(runId)}/events/${Date.now()}-${randomUUID()}.json`), json({ at: new Date().toISOString(), runId, stage, ...detail }));
  }
  async lock(work) {
    const file = this.location('.wiki/writer.lock'), token = randomUUID();
    fs.mkdirSync(this.meta, { recursive: true });
    try { fresh(file, json({ token, pid: process.pid, at: new Date().toISOString() })); }
    catch (error) { if (error.code === 'EEXIST') fail('HOST_BUSY', 'writer lock exists; inspect before explicit recover-lock'); throw error; }
    return Promise.resolve().then(work).finally(() => {
      if (readJSON(file).token !== token) fail('LOCK_CHANGED', 'writer lock identity changed');
      fs.unlinkSync(file);
    });
  }
  pending() {
    const folder = this.location('.wiki/journals');
    return fs.existsSync(folder) ? fs.readdirSync(folder).filter(n => n.endsWith('.json')).map(n => readJSON(safe(folder, n))).filter(j => j.status === 'pending') : [];
  }
  assertReady() { if (this.pending().length) fail('RECOVERY_REQUIRED', 'inspect pending journal and run recover before new work'); }
  snapshot(commitId) {
    const folder = this.location(`wiki/history/${id(commitId)}`), manifest = readJSON(safe(folder, 'manifest.json'));
    if (manifest.commitId !== commitId || !Array.isArray(manifest.files)) fail('STATE_CORRUPT', 'snapshot manifest identity');
    for (const entry of manifest.files) if (digest(bounded(safe(folder, entry.path), 32 * 1024 * 1024)) !== entry.sha256) fail('MANUAL_EDIT_CONFLICT', `snapshot changed: ${entry.path}; preserve edits and reconcile explicitly`);
    const state = readJSON(safe(folder, 'state.json'));
    if (state.commitId !== commitId || ![1, 2].includes(state.schemaVersion)) fail('STATE_CORRUPT', 'snapshot state identity');
    return { folder, manifest, state };
  }
  current() {
    const pointer = this.pointer();
    if (!pointer) return { schemaVersion: 1, commitId: null, sources: [], pages: [] };
    const snapshot = this.snapshot(pointer.commitId);
    if (digest(json(snapshot.manifest)) !== pointer.manifestHash) fail('STATE_CORRUPT', 'current manifest hash mismatch');
    return snapshot.state;
  }
  async run(command, input = {}) {
    if (command === 'status') { const state = this.current(); return { pointer: this.pointer(), journals: this.pending(), pendingFeedback: this.pendingFeedback(), ...this.completion(state), state }; }
    if (command === 'recover-lock') {
      const file = this.location('.wiki/writer.lock'), bytes = bounded(file), lock = JSON.parse(bytes);
      if (input.expectedHash !== digest(bytes)) fail('REVISION_CONFLICT', 'lock hash differs');
      if (!Number.isSafeInteger(lock.pid) || lock.pid < 1) fail('STATE_CORRUPT', 'lock pid invalid');
      try { process.kill(lock.pid, 0); fail('HOST_BUSY', 'lock owner process is alive'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
      fresh(this.location(`.wiki/lock-history/${randomUUID()}.json`), bytes);
      if (digest(bounded(file)) !== input.expectedHash) fail('REVISION_CONFLICT', 'lock changed during recovery');
      fs.unlinkSync(file); return { recovered: true };
    }
    const runId = command === 'apply' ? id(input.runId) : `run-${randomUUID()}`;
    return this.lock(async () => {
      try {
        if (command === 'recover') return this.recover(input, runId);
        this.assertReady();
        if (command === 'feedback') return await this.feedback(input, runId);
        if (command === 'prepare') return await this.prepare(input, runId);
        if (command === 'apply') return this.apply(input, runId);
        if (command === 'rollback') return this.rollback(input, runId);
        fail('INVALID_COMMAND', command);
      } catch (error) {
        try { this.event(runId, 'failed', { command, error: String(error), pointer: this.pointer(), ...(command === 'feedback' ? { artifacts: input.artifacts } : command === 'prepare' ? { paths: input.paths, requestScope: input.requestScope } : {}) }); }
        catch (traceError) { throw new AggregateError([error, traceError], 'operation and trace persistence failed'); }
        throw error;
      }
    }).catch(error => {
      // A busy writer never entered the callback. Persist this feedback request
      // in the existing trace so saved experiment/story files cannot disappear
      // from pending work just because publication was temporarily busy.
      if (command === 'feedback' && String(error).startsWith('Error: HOST_BUSY:')) this.event(runId, 'failed', { command, artifacts: input.artifacts, error: String(error), pointer: this.pointer() });
      throw error;
    });
  }
  pendingFeedback() {
    const directory = this.location('.wiki/runs');
    if (!fs.existsSync(directory)) return [];
    const pending = [];
    for (const runId of fs.readdirSync(directory)) {
      const file = this.location(`.wiki/runs/${id(runId)}/prepared.json`);
      const prepared = fs.existsSync(file) ? readJSON(file) : null;
      const eventsDir = this.location(`.wiki/runs/${runId}/events`);
      const events = fs.existsSync(eventsDir) ? fs.readdirSync(eventsDir).map(n => readJSON(safe(eventsDir, n))) : [];
      const failure = events.filter(e => e.stage === 'failed').at(-1);
      if (prepared?.input.workflow !== 'artifact-feedback' && failure?.command !== 'feedback') continue;
      if (events.some(e => e.stage === 'superseded' || ['committed', 'unchanged'].includes(e.stage) && e.feedbackStatus === 'synced')) continue;
      pending.push({ runId, status: failure ? 'failed-awaiting-agent' : 'awaiting-agent', artifacts: prepared?.input.artifacts ?? failure.artifacts, baseCommitId: prepared?.baseCommitId ?? null, handoff: prepared ? `.wiki/runs/${runId}/prepared.json` : null, error: failure?.error ?? null });
    }
    return pending;
  }
  async feedback(input, runId) {
    if (!Array.isArray(input.artifacts) || !input.artifacts.length) fail('INVALID_INPUT', 'feedback requires explicit saved artifacts');
    const ids = new Set(), paths = new Set();
    for (const artifact of input.artifacts) {
      id(artifact.artifactId);
      if (ids.has(artifact.artifactId)) fail('DUPLICATE_ID', artifact.artifactId); ids.add(artifact.artifactId);
      if (!['tailor', 'dag', 'experiment-plan', 'run', 'result', 'review', 'story', 'task', 'maintenance'].includes(artifact.kind)) fail('INVALID_INPUT', 'explicit artifact kind required');
      nonempty(artifact.path, 'artifact path');
      const canonicalPath = path.relative(this.root, safe(this.root, artifact.path, true)).replaceAll('\\', '/');
      if (paths.has(canonicalPath.toLowerCase())) fail('IDENTITY_CONFLICT', 'one artifact path cannot have multiple identities'); paths.add(canonicalPath.toLowerCase());
      if (canonicalPath !== artifact.path) fail('INVALID_INPUT', 'artifact path must use canonical workspace-relative forward slashes');
      if (!Array.isArray(artifact.relatedIds) || artifact.relatedIds.some(r => typeof r !== 'string' || !r.trim())) fail('INVALID_INPUT', 'relatedIds array required; preserve upstream IDs');
    }
    const current = this.current();
    const pending = this.pendingFeedback();
    for (const artifact of input.artifacts) {
      const bound = current.sources.find(s => s.artifact?.artifactId === artifact.artifactId);
      if (bound && bound.path !== artifact.path) fail('RENAME_CONFLICT', 'artifact ID already bound to another path; use explicit source rename first');
      const samePath = current.sources.find(s => s.path === artifact.path);
      if (samePath?.artifact && samePath.artifact.artifactId !== artifact.artifactId) fail('IDENTITY_CONFLICT', 'same artifact path cannot change stable identity');
    }
    for (const previous of pending.filter(p => p.handoff && json(p.artifacts) === json(input.artifacts))) {
      const prepared = readJSON(this.location(previous.handoff));
      if (prepared.baseCommitId !== current.commitId) continue;
      try { this.verifyInputs(prepared); }
      catch (error) { if (!String(error).startsWith('Error: SOURCE_CHANGED:')) throw error; continue; }
      return { syncStatus: previous.status, reusedHandoff: true, runId: previous.runId, handoff: previous.handoff, artifacts: previous.artifacts, note: 'Same versions already pending; resume Agent merge/apply. No experiment rerun.' };
    }
    const allUnchanged = input.artifacts.every(a => {
      const source = current.sources.find(s => s.path === a.path), version = source?.versions.at(-1), receipt = (current.readReceipts ?? current.coverage?.entries)?.find(e => e.sourceId === source?.sourceId && ['read', 'reuse'].includes(e.status) && e.revision === version?.revision && e.sha256 === version?.sha256);
      const artifact = source?.artifact;
      if (!version || source.status !== 'available' || !artifact || artifact.artifactId !== a.artifactId || artifact.kind !== a.kind || json(artifact.relatedIds) !== json(a.relatedIds) || !receipt) return false;
      return digest(bounded(safe(this.root, a.path))) === version.sha256 && (current.pages.some(p => evidenceOf(p).some(e => e.citations.some(c => c.sourceId === source.sourceId && c.revision === version.revision))) || (current.sourceDispositions ?? []).some(d => d.sourceId === source.sourceId && d.revision === version.revision));
    });
    if (allUnchanged) {
      for (const previous of pending.filter(p => p.artifacts?.every(a => input.artifacts.some(b => a.artifactId === b.artifactId)))) this.event(previous.runId, 'superseded', { byRunId: runId, reason: 'Current snapshot already maps these current artifact revisions.' });
      this.event(runId, 'unchanged', { command: 'feedback', commitId: current.commitId, artifacts: input.artifacts, feedbackStatus: 'synced' });
      return { syncStatus: 'unchanged', commitId: current.commitId, ...this.completion(current), note: 'Same file bytes, identities and mapped read receipts; no model/experiment invoked.' };
    }
    const prepared = await this.prepare({ paths: input.artifacts.map(a => a.path), requestScope: { mode: 'full', paths: input.artifacts.map(a => a.path) }, workflow: 'artifact-feedback', artifacts: input.artifacts }, runId);
    for (const previous of pending.filter(p => p.artifacts?.every(a => input.artifacts.some(b => a.artifactId === b.artifactId)))) this.event(previous.runId, 'superseded', { byRunId: runId, reason: 'New current-version handoff replaces this pending attempt; error/history preserved.' });
    return { ...prepared, syncStatus: 'awaiting-agent', experimentStatus: 'not-modified', note: 'Actual saved files parsed and versioned; Agent must read changes, compile page/evidence and apply. No experiment/model is invoked. Retry apply/reprepare these artifacts only; do not rerun experiments.' };
  }
  feedbackResult(prepared, state) {
    if (prepared?.input.workflow !== 'artifact-feedback') return undefined;
    const synced = prepared.input.artifacts.every(a => {
      const source = state.sources.find(s => s.path === a.path), revision = source?.versions.at(-1)?.revision;
      return source?.status === 'available' && source.artifact?.artifactId === a.artifactId && source.artifact?.kind === a.kind && (state.readReceipts ?? []).some(r => r.sourceId === source.sourceId && r.revision === revision && r.sha256 === source.versions.at(-1).sha256) && (state.pages.some(p => evidenceOf(p).some(e => e.citations.some(c => c.sourceId === source.sourceId && c.revision === revision))) || (state.sourceDispositions ?? []).some(d => d.sourceId === source.sourceId && d.revision === revision));
    });
    return synced ? 'synced' : 'awaiting-agent';
  }
  scan(paths) {
    if (!Array.isArray(paths) || !paths.length || paths.some(p => typeof p !== 'string')) fail('INVALID_INPUT', 'paths must explicitly name approved workspace files/directories');
    const files = new Set(), scopes = [], inventory = new Map();
    const visit = relative => {
      const normalized = relative.replaceAll('\\', '/');
      if (relative.split(/[\\/]/).some(excluded)) { inventory.set(normalized, { path: normalized, status: 'excluded', reason: 'Safety/output/dependency exclusion (subtree not inspected).' }); return; }
      const file = safe(this.root, relative), stat = fs.lstatSync(file);
      if (stat.isDirectory()) for (const name of fs.readdirSync(file).sort()) visit(path.posix.join(relative.replaceAll('\\', '/'), name));
      else if (stat.isFile()) { const name = path.relative(this.root, file).replaceAll('\\', '/'); inventory.set(name, { path: name, status: supported(relative) ? 'supported' : 'unsupported', reason: supported(relative) ? null : 'No supported parser; not read.' }); if (supported(relative)) files.add(name); }
      if (files.size > 256) fail('QUOTA', 'at most 256 input files per prepare');
      if (inventory.size > 4096) fail('QUOTA', 'requested inventory exceeds 4096 entries; not truncated');
    };
    for (const relative of paths) {
      if (relative !== '.' && relative.split(/[\\/]/).some(excluded)) fail('EXCLUDED_INPUT', relative);
      const file = safe(this.root, relative, true), normalized = path.relative(this.root, file).replaceAll('\\', '/');
      scopes.push({ path: normalized, directory: fs.existsSync(file) && fs.statSync(file).isDirectory() });
      if (fs.existsSync(file)) visit(relative);
      else inventory.set(normalized, { path: normalized, status: 'missing', reason: 'Requested path unavailable.' });
    }
    return { files: [...files].sort(), scopes, inventory: [...inventory.values()].sort((a, b) => a.path.localeCompare(b.path)) };
  }
  async source(file, extraction, cached) {
    const bytes = bounded(safe(this.root, file)), sha256 = digest(bytes);
    let text, pages = [], parser = 'utf8/1', extractionPin = null;
    if (/\.pdf$/i.test(file)) {
      if (!extraction && cached?.sha256 === sha256 && cached.text !== null) {
        if (cached.extractionPin) extraction = { textPath: cached.extractionPin.path };
        else return { path: file, ...cached };
      }
      if (extraction) {
        const textPath = nonempty(extraction.textPath, 'textPath'), sidecar = bounded(safe(this.root, textPath));
        const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(sidecar));
        if (data.sourceSha256 !== sha256 || !Array.isArray(data.pages) || !data.pages.length) fail('INVALID_EXTRACTION', `${file}: sourceSha256 and nonempty pages required`);
        pages = data.pages;
        parser = 'user-supplied-page-text/1;page-fidelity-unverified';
        extractionPin = { path: textPath, sha256: digest(sidecar) };
      } else {
        const modulePath = process.env.RESEARCH_PDFJS_MODULE;
        if (!modulePath || !path.isAbsolute(modulePath)) return { path: file, sha256, text: null, pages: [], parser: 'unavailable', issue: 'PDF_PARSER_UNAVAILABLE: provide configured pdfjs or page-mapped extraction' };
        const pdfjs = await import(pathToFileURL(modulePath).href), task = pdfjs.getDocument({ data: Uint8Array.from(bytes), isEvalSupported: false, useSystemFonts: true });
        try {
          const document = await task.promise;
          if (document.numPages > 300) fail('QUOTA', 'PDF exceeds 300 pages');
          for (let page = 1; page <= document.numPages; page++) {
            const content = await (await document.getPage(page)).getTextContent();
            pages.push({ page, text: content.items.map(item => `${item.str ?? ''}${item.hasEOL ? '\n' : ' '}`).join('').trim() });
          }
        } finally { await task.destroy(); }
        parser = 'configured-pdfjs/1';
      }
      if (pages.some((p, i) => p.page !== i + 1 || typeof p.text !== 'string')) fail('INVALID_EXTRACTION', 'pages must be contiguous, one-based, with text');
      let offset = 0;
      pages = pages.map(p => { const result = { ...p, startByte: offset, endByte: offset + Buffer.byteLength(p.text) }; offset = result.endByte + 3; return result; });
      text = pages.map(p => p.text).join('\n\f\n');
    } else {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (/\.json$/i.test(file)) JSON.parse(text);
    }
    nonempty(text, `no extracted text: ${file}`);
    if (Buffer.byteLength(text) > 4 * 1024 * 1024) fail('QUOTA', 'text exceeds 4 MiB; not truncated');
    return { path: file, sha256, text, pages, parser, extractionPin, issue: null };
  }
  async prepare(input, runId) {
    if (!this.pointer() && fs.existsSync(this.output) && fs.readdirSync(this.output).some(name => name !== 'history' && name !== 'notes')) fail('ADOPTION_REQUIRED', 'existing unmanaged Wiki: choose a separate file workspace; no automatic migration');
    const current = this.current(), scan = this.scan(input.paths), sources = structuredClone(current.sources), changed = [], unavailable = [];
    const requestedScan = input.requestScope ? this.scan(input.requestScope.paths) : scan;
    const coverage = requestCoverage(input, scan, requestedScan);
    if (!scan.files.length && !current.sources.length) fail('NO_INPUT', 'no supported source files in the declared scope');
    const extractions = input.extractions ?? [], renames = input.renames ?? [];
    if (!Array.isArray(extractions) || !Array.isArray(renames)) fail('INVALID_INPUT', 'extractions and renames must be arrays');
    for (const rename of renames) {
      const source = sources.find(s => s.sourceId === rename.sourceId);
      if (!source || !scan.files.includes(rename.path) || fs.existsSync(safe(this.root, source.path, true)) || sources.some(s => s !== source && s.path === rename.path)) fail('RENAME_CONFLICT', 'explicit rename needs a known missing old path and unique scanned new path');
      source.path = rename.path;
    }
    const covered = file => scan.scopes.some(scope => file === scope.path || scope.directory && (!scope.path || file.startsWith(scope.path + '/')));
    for (const file of scan.files) {
      let source = sources.find(s => s.path === file);
      const material = await this.source(file, extractions.find(e => e.path === file), source?.versions.at(-1));
      if (!source) { source = { sourceId: `source-${randomUUID()}`, path: file, status: 'available', versions: [] }; sources.push(source); }
      const last = source.versions.at(-1), content = { sha256: material.sha256, text: material.text, pages: material.pages, parser: material.parser, extractionPin: material.extractionPin ?? null, issue: material.issue, format: path.extname(file).toLowerCase() };
      if (!last || digest({ ...last, revision: undefined }) !== digest(content)) {
        source.versions.push({ ...content, revision: (last?.revision ?? 0) + 1 }); changed.push(source.sourceId);
      }
      // Withdrawal is explicit and sticky; scanning must not grant it again.
      if (source.status !== 'withdrawn') source.status = material.text === null ? 'unparsed' : 'available';
    }
    for (const source of sources) if (covered(source.path) && !scan.files.includes(source.path) && source.status !== 'withdrawn') { source.status = 'unavailable'; unavailable.push(source.sourceId); }
    for (const sourceId of input.withdrawals ?? []) {
      const source = sources.find(s => s.sourceId === sourceId);
      if (!source) fail('UNKNOWN_SOURCE', sourceId);
      source.status = 'withdrawn';
    }
    for (const artifact of input.artifacts ?? []) {
      const source = sources.find(s => s.path === artifact.path);
      if (!source) fail('SOURCE_UNAVAILABLE', artifact.path);
      source.artifact = { artifactId: artifact.artifactId, kind: artifact.kind, relatedIds: artifact.relatedIds, authority: artifact.kind === 'story' ? 'narrative-not-independent-scientific-evidence' : ['experiment-plan', 'tailor', 'dag', 'task'].includes(artifact.kind) ? 'design-not-execution' : 'artifact-claims-require-review' };
    }
    if (Buffer.byteLength(json(sources)) > 16 * 1024 * 1024) fail('QUOTA', 'source history exceeds 16 MiB; split workspace explicitly');
    const affectedPageIds = current.pages.filter(p => evidenceOf(p).some(f => f.citations.some(c => changed.includes(c.sourceId) || unavailable.includes(c.sourceId) || (input.withdrawals ?? []).includes(c.sourceId)))).map(p => p.pageId);
    const prepared = { schemaVersion: 1, runId, baseCommitId: current.commitId, input, scan, coverage, sources, changedSourceIds: changed, unavailableSourceIds: unavailable, affectedPageIds, pages: current.pages, currentMetadata: { sourceContexts: current.sourceContexts ?? [], issues: current.issues ?? [], indexIntro: current.indexIntro ?? null, coverage: current.coverage ?? null }, createdAt: new Date().toISOString() };
    fresh(this.location(`.wiki/runs/${runId}/prepared.json`), json(prepared));
    fresh(this.location(`.wiki/runs/${runId}/prepared.sha256`), digest(json(prepared)));
    this.event(runId, 'prepared', { baseCommitId: current.commitId, changedSourceIds: changed, affectedPageIds });
    return { ...prepared, handoff: `.wiki/runs/${runId}/prepared.json`, note: 'Agent must read originals + old pages, then provide natural content, summary, exact evidence mappings, source contexts and explicit review scope. See RUNTIME.md. Preparation is not publication or semantic review.' };
  }
  validateCitation(c, sources, allowHistorical = false) {
    const source = sources.find(s => s.sourceId === c.sourceId), version = source?.versions.find(v => v.revision === c.revision);
    if (!version || version.text === null) fail('INVALID_CITATION', 'unknown/unparsed source version');
    if (!allowHistorical && (source.status !== 'available' || source.versions.at(-1).revision !== c.revision)) fail('STALE_CITATION', c.sourceId);
    const bytes = Buffer.from(version.text, 'utf8');
    if (!Number.isSafeInteger(c.startByte) || !Number.isSafeInteger(c.endByte) || c.startByte < 0 || c.endByte <= c.startByte || c.endByte > bytes.length || !bytes.subarray(c.startByte, c.endByte).equals(Buffer.from(nonempty(c.quote, 'citation quote'), 'utf8'))) fail('INVALID_CITATION', 'UTF-8 byte range must exactly match quote');
    if (version.pages.length && !version.pages.some(p => p.page === c.page && c.startByte >= p.startByte && c.endByte <= p.endByte)) fail('INVALID_CITATION', 'PDF citation requires the matching page');
    if (version.format === '.json') {
      if (typeof c.jsonPointer !== 'string' || !/^(?:\/[^/]+)*$/.test(c.jsonPointer)) fail('INVALID_CITATION', 'JSON needs an RFC 6901 jsonPointer');
      let value = JSON.parse(version.text);
      for (const key of c.jsonPointer.split('/').slice(1).map(k => k.replaceAll('~1', '/').replaceAll('~0', '~'))) {
        if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) fail('INVALID_CITATION', 'unknown JSON pointer');
        value = value[key];
      }
      if (c.quote !== JSON.stringify(value) && !(typeof value === 'string' && c.quote === value)) fail('INVALID_CITATION', 'quote does not match the JSON field value');
    }
  }
  validateLinks(pages) {
    const ids = new Set(pages.map(p => p.pageId));
    for (const page of pages) {
      let text = ''; prose(contentOf(page) + '\n' + (page.summary ?? ''), part => { text += part + '\n'; return part; });
      for (const match of text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) if (match[1] === page.pageId || !ids.has(match[1])) fail('INVALID_LINK', `unknown/self page link ${match[1]}`);
      // Restrict authored links to external HTTP(S); internal pages use stable [[page-id]].
      for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) if (!/^https?:\/\/[^\s<>]+$/.test(match[1])) fail('INVALID_LINK', `use [[page-id]] for local links: ${match[1]}`);
      if (/\]\s*\[[^\]]*\]|^\s*\[[^\]]+\]:|<\/?(?:a|img|iframe|script)\b/im.test(text)) fail('INVALID_LINK', 'reference links and HTML links are not supported');
    }
  }
  verifyInputs(prepared) {
    if (digest(json(prepared)) !== fs.readFileSync(this.location(`.wiki/runs/${id(prepared.runId)}/prepared.sha256`), 'utf8')) fail('PREPARED_CHANGED', 'handoff was edited; prepare again instead');
    const scan = this.scan(prepared.input.paths);
    if (json(scan) !== json(prepared.scan)) fail('SOURCE_CHANGED', 'scan membership changed after prepare');
    if (prepared.coverage?.requestedScan && json(this.scan(prepared.coverage.paths)) !== json(prepared.coverage.requestedScan)) fail('SOURCE_CHANGED', 'requested scope membership changed after prepare');
    for (const source of prepared.sources.filter(s => scan.files.includes(s.path))) {
      const version = source.versions.at(-1);
      const bytes = bounded(safe(this.root, source.path));
      if (digest(bytes) !== version.sha256) fail('SOURCE_CHANGED', source.path);
      if (version.format !== '.pdf' && new TextDecoder('utf-8', { fatal: true }).decode(bytes) !== version.text) fail('SOURCE_CHANGED', 'prepared text differs from original');
      if (version.extractionPin && digest(bounded(safe(this.root, version.extractionPin.path))) !== version.extractionPin.sha256) fail('SOURCE_CHANGED', 'page extraction changed');
    }
  }
  apply(input, runId) {
    fresh(this.location(`.wiki/runs/${runId}/draft-${randomUUID()}.json`), json(input));
    if (input.complete !== true || !['agent', 'fixture'].includes(input.draftType) || !Array.isArray(input.pages)) fail('INCOMPLETE_DRAFT', 'complete:true, draftType:agent|fixture and pages required');
    const prepared = readJSON(this.location(`.wiki/runs/${runId}/prepared.json`)), current = this.current();
    if (current.commitId !== input.baseCommitId || prepared.baseCommitId !== current.commitId) fail('REVISION_CONFLICT', 'base commit changed; prepare again');
    this.verifyInputs(prepared);
    const next = { ...structuredClone(current), sources: prepared.sources }, seen = new Set();
    next.coverage = reconcileCoverage(prepared, input.coverageDecisions, current);
    const scopeKey = coverage => digest([...coverage.paths].map(p => p.replaceAll('\\', '/')).sort());
    next.coverageRequests = [...(current.coverageRequests ?? (current.coverage && current.coverage.mode !== 'legacy-unattested' ? [current.coverage] : []))];
    if (next.coverage.mode !== 'legacy-unattested') {
      next.coverageRequests = next.coverageRequests.filter(c => scopeKey(c) !== scopeKey(next.coverage));
      next.coverageRequests.push(next.coverage);
      next.coverageRequests.sort((a, b) => scopeKey(a).localeCompare(scopeKey(b)));
    }
    const receipts = new Map((current.readReceipts ?? current.coverage?.entries ?? []).filter(e => ['read', 'reuse'].includes(e.status)).map(e => [e.sourceId, e]));
    for (const entry of next.coverage.entries.filter(e => ['read', 'reuse'].includes(e.status))) receipts.set(entry.sourceId, entry);
    next.readReceipts = [...receipts.values()].sort((a, b) => a.path.localeCompare(b.path));
    next.sourceContexts = sourceContexts(input.sourceContexts ?? [], current.sourceContexts, next.sources);
    if (input.indexIntro !== undefined) {
      nonempty(input.indexIntro.title, 'index title'); nonempty(input.indexIntro.content, 'index introduction');
      if (/[\r\n<>\[\]]/.test(input.indexIntro.title) || /\[\[|\]\(/.test(input.indexIntro.content)) fail('INVALID_INPUT', 'index intro is title + prose; directory is generated from pages');
      next.indexIntro = { title: input.indexIntro.title, content: input.indexIntro.content };
    }
    next.sourceDispositions = [...(current.sourceDispositions ?? [])];
    for (const decision of input.sourceDispositions ?? []) {
      const source = next.sources.find(s => s.sourceId === decision.sourceId);
      if (!source || source.versions.at(-1).revision !== decision.revision || decision.disposition !== 'no-wiki-needed') fail('INVALID_INPUT', 'source disposition must name a current source revision and no-wiki-needed');
      nonempty(decision.reason, 'source disposition reason');
      next.sourceDispositions = next.sourceDispositions.filter(d => d.sourceId !== decision.sourceId); next.sourceDispositions.push(decision);
    }
    for (const patch of input.pages) {
      id(patch.pageId);
      if (seen.has(patch.pageId)) fail('DUPLICATE_ID', patch.pageId); seen.add(patch.pageId);
      const old = next.pages.find(p => p.pageId === patch.pageId);
      if ((old?.version ?? 0) !== patch.expectedVersion || (old?.contentHash ?? null) !== patch.expectedHash) fail('REVISION_CONFLICT', `page ${patch.pageId}`);
      if (patch.content !== undefined) {
        const page = compilePage(patch, old, next.sources, this.validateCitation.bind(this));
        page.version = pageVersion(current, page.pageId) + (old?.contentHash === page.contentHash ? 0 : 1);
        page.review = bindReview(page, patch.review, next.sourceContexts, old);
        if (old) next.pages[next.pages.indexOf(old)] = page; else next.pages.push(page);
        continue;
      }
      if (old?.content !== undefined) fail('INCOMPLETE_DRAFT', 'natural Markdown page requires full content/summary/evidence; cannot return to legacy facts');
      const page = old ? structuredClone(old) : { pageId: patch.pageId, title: nonempty(patch.title, 'page title'), version: 0, facts: [] };
      if (patch.title !== undefined) { nonempty(patch.title, 'page title'); if (/[\r\n<>\[\]]/.test(patch.title)) fail('INVALID_INPUT', 'title must be a plain single line'); page.title = patch.title; }
      if (!Array.isArray(patch.facts)) fail('INCOMPLETE_DRAFT', 'facts patch array required');
      const factIds = new Set();
      for (const fact of patch.facts) {
        id(fact.id); nonempty(fact.markdown, 'fact markdown');
        if (factIds.has(fact.id)) fail('DUPLICATE_ID', fact.id); factIds.add(fact.id);
        if (!Array.isArray(fact.citations) || !fact.citations.length) fail('INVALID_CITATION', 'each fact requires a real quote');
        fact.citations.forEach(c => this.validateCitation(c, next.sources));
        const index = page.facts.findIndex(f => f.id === fact.id), previous = page.facts[index];
        if (previous && previous.markdown !== fact.markdown && previous.markdown.split(/\r?\n/).some(line => line.trim() && !fact.markdown.includes(line))) nonempty(fact.changeReason, 'changed/removed paragraph or table row requires changeReason');
        const stored = { id: fact.id, markdown: fact.markdown, citations: fact.citations };
        if (index < 0) page.facts.push(stored); else page.facts[index] = stored;
      }
      for (const removal of patch.removeFacts ?? []) {
        nonempty(removal.reason, 'fact removal reason');
        const index = page.facts.findIndex(f => f.id === removal.id);
        if (index < 0 || factIds.has(removal.id)) fail('INVALID_INPUT', 'removal must reference a unique existing, unpatched fact');
        page.facts.splice(index, 1);
      }
      if (!page.facts.length) fail('EMPTY_CONTENT', 'a page cannot become empty');
      page.contentHash = digest({ title: page.title, facts: page.facts });
      page.version = pageVersion(current, page.pageId) + (old?.contentHash === page.contentHash ? 0 : 1);
      if (old) next.pages[next.pages.indexOf(old)] = page; else next.pages.push(page);
    }
    for (const page of next.pages) if (page.content !== undefined && !seen.has(page.pageId)) page.review = bindReview(page, undefined, next.sourceContexts, page);
    next.issues = updateIssues(input.issues ?? [], current.issues, next.pages, next.sources);
    for (const pageId of prepared.affectedPageIds) if (!seen.has(pageId) && !(input.deferredPages ?? []).some(d => d.pageId === pageId && typeof d.reason === 'string' && d.reason.trim())) fail('UNRESOLVED_PAGE', `update or explicitly defer ${pageId}`);
    this.validateLinks(next.pages);
    const comparable = state => ({ sources: state.sources, pages: state.pages, sourceDispositions: state.sourceDispositions ?? [], sourceContexts: state.sourceContexts ?? [], indexIntro: state.indexIntro ?? null, issues: state.issues ?? [], coverage: state.coverage?.mode === 'legacy-unattested' ? null : state.coverage ?? null, coverageRequests: state.coverageRequests ?? [], readReceipts: state.readReceipts ?? [] });
    if (digest(comparable(next)) === digest(comparable(current))) {
      const syncStatus = this.feedbackResult(prepared, current);
      this.event(runId, 'unchanged', { commitId: current.commitId, draftType: input.draftType, feedbackStatus: syncStatus });
      return { status: 'unchanged', commitId: current.commitId, ...(syncStatus ? { syncStatus } : {}), ...this.completion(current) };
    }
    return this.commit(next, current, runId, { command: 'apply', draftType: input.draftType, preparedRunId: runId, removals: input.pages.map(p => ({ pageId: p.pageId, changeReason: p.changeReason, removeFacts: p.removeFacts ?? [], changes: (p.facts ?? []).filter(f => f.changeReason).map(f => ({ id: f.id, reason: f.changeReason })) })) });
  }
  render(page, sources, contexts = []) {
    if (page.content !== undefined) {
      const body = page.content.replace(new RegExp(`^\\s*# ${page.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n+`), '');
      const refs = [...new Map(page.evidence.flatMap(e => e.citations).map(c => [`${c.sourceId}:${c.revision}`, c])).values()];
      const footer = refs.map(c => {
        const source = sources.find(s => s.sourceId === c.sourceId), context = contexts.find(s => s.sourceId === c.sourceId && s.revision === c.revision);
        const label = path.basename(source.path).replace(/[\[\]<>\r\n]/g, '_');
        return `- [${label}](../sources/${c.sourceId}-v${c.revision}.md#source) · revision ${c.revision}${context ? ` · ${context.documentType} · ${context.date}` : ''}`;
      }).join('\n');
      return `# ${page.title}\n\n${page.summary}\n\n${prose(body, text => text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, label) => `[${label ?? target}](${target}.md)`))}\n\n---\n\n来源（定位与复核记录见本提交 state.json）：\n\n${footer}\n`;
    }
    const lines = [`# ${page.title}`, '', `Page ID: \`${page.pageId}\` · version ${page.version}`, '', '> 派生 Wiki；引用不证明结论。人工笔记请写入 wiki/notes/' + page.pageId + '.md。', ''];
    page.facts.forEach(fact => {
      lines.push(`## ${fact.id}`, '', prose(fact.markdown, text => text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, label) => `[${label ?? target}](${target}.md)`)), '');
      fact.citations.forEach(c => {
        const source = sources.find(s => s.sourceId === c.sourceId), stale = source.status !== 'available' || source.versions.at(-1).revision !== c.revision;
        const version = source.versions.find(v => v.revision === c.revision), line = Buffer.from(version.text).subarray(0, c.startByte).toString('utf8').split('\n').length;
        lines.push(`- ${stale ? '**待核实/过时引用** ' : ''}[${c.sourceId} v${c.revision}](../sources/${c.sourceId}-v${c.revision}.md#source) · UTF-8 bytes ${c.startByte}–${c.endByte} · line ${line}${c.page ? ` · page ${c.page}` : ''}${c.jsonPointer !== undefined ? ` · JSON pointer ${c.jsonPointer || '(root)'}` : ''}`, ...c.quote.split('\n').map(line => `  > ${line}`));
      }); lines.push('');
    }); return lines.join('\n');
  }
  commit(next, current, runId, provenance) {
    const commitId = `commit-${randomUUID()}`;
    next = { ...next, schemaVersion: 2, commitId, parentCommitId: current.commitId, createdAt: new Date().toISOString(), provenance };
    next.pageVersions = { ...current.pageVersions, ...Object.fromEntries(next.pages.map(p => [p.pageId, p.version])) };
    const folder = this.location(`wiki/history/${commitId}`), files = [];
    const write = (relative, content) => { fresh(safe(folder, relative, true), content); files.push({ path: relative, sha256: digest(content) }); };
    for (const page of next.pages) write(`pages/${page.pageId}.md`, this.render(page, next.sources, next.sourceContexts));
    for (const source of next.sources) for (const version of source.versions) write(`sources/${source.sourceId}-v${version.revision}.md`, `# ${path.basename(source.path)}\n\nID: ${source.sourceId} · revision ${version.revision}\n\nOriginal path: ${source.path}\n\nRaw SHA-256: ${version.sha256}\n\nParser: ${version.parser}\n\n## Source\n\n${version.text ?? '**未解析；无可引用文本。**'}\n`);
    write('INDEX.md', `# ${next.indexIntro?.title ?? 'Wiki'}\n\n${next.indexIntro?.content ?? '尚未编写材料导读。'}\n\n${[...next.pages].sort((a, b) => a.pageId.localeCompare(b.pageId)).map(p => `- [${p.title}](pages/${p.pageId}.md)${p.summary ? ` — ${p.summary}` : ''} · ${p.pageType ?? 'legacy'} · ${(p.category ?? []).join(' / ')} · v${p.version}`).join('\n')}\n`);
    write('state.json', json(next));
    const manifest = { schemaVersion: 1, commitId, files };
    fresh(safe(folder, 'manifest.json', true), json(manifest));
    this.snapshot(commitId); // Fully validate immutable artifacts before staging publication.
    const pointer = { schemaVersion: 1, commitId, manifestHash: digest(json(manifest)) };
    const journal = { schemaVersion: 1, commitId, runId, expectedCommitId: current.commitId, pointer, status: 'pending', provenance };
    atomic(this.location(`.wiki/journals/${commitId}.json`), json(journal));
    this.event(runId, 'staged', { commitId, parentCommitId: current.commitId });
    // Tests inject a crash through an overridden hook; production has no fault env flag.
    this.checkpoint?.('before-pointer');
    atomic(this.location('.wiki/current.json'), json(pointer));
    this.checkpoint?.('after-pointer');
    return this.finish(journal);
  }
  finish(journal) {
    const state = this.current();
    if (state.commitId !== journal.commitId) fail('REVISION_CONFLICT', 'journal is not current');
    const index = `# Wiki\n\n[浏览当前页面](history/${journal.commitId}/INDEX.md)\n\n当前提交：\`${journal.commitId}\`。原始来源与实验文件是事实依据；此目录为派生整理。\n`;
    atomic(this.location('wiki/INDEX.md'), index);
    if (fs.readFileSync(this.location('wiki/INDEX.md'), 'utf8') !== index) fail('READBACK_FAILED', 'index differs');
    const prepared = journal.provenance.preparedRunId ? readJSON(this.location(`.wiki/runs/${id(journal.provenance.preparedRunId)}/prepared.json`)) : null;
    const syncStatus = this.feedbackResult(prepared, state);
    this.event(journal.runId, 'committed', { commitId: journal.commitId, artifactsVerified: true, semanticReview: this.completion(state).semanticReview, issueStatus: this.completion(state).issueStatus, provenance: journal.provenance, feedbackStatus: syncStatus });
    atomic(this.location(`.wiki/journals/${journal.commitId}.json`), json({ ...journal, status: 'committed' }));
    return { status: 'committed', ...(syncStatus ? { syncStatus } : {}), ...this.completion(state), commitId: journal.commitId, index: 'wiki/INDEX.md', pages: state.pages.map(p => ({ pageId: p.pageId, version: p.version, contentHash: p.contentHash })) };
  }
  completion(state) {
    const issues = state.sources.filter(s => s.status !== 'available').map(s => ({ sourceId: s.sourceId, status: s.status, issue: s.versions.at(-1).issue }));
    const stalePageIds = state.pages.filter(p => evidenceOf(p).some(f => f.citations.some(c => { const source = state.sources.find(s => s.sourceId === c.sourceId); return source.status !== 'available' || source.versions.at(-1).revision !== c.revision; }))).map(p => p.pageId);
    const unmappedSourceIds = state.sources.filter(s => s.status === 'available' && !state.pages.some(p => evidenceOf(p).some(f => f.citations.some(c => c.sourceId === s.sourceId && c.revision === s.versions.at(-1).revision))) && !(state.sourceDispositions ?? []).some(d => d.sourceId === s.sourceId && d.revision === s.versions.at(-1).revision)).map(s => s.sourceId);
    const open = (state.issues ?? []).filter(i => i.status === 'open');
    const outstandingRequests = (state.coverageRequests ?? (state.coverage ? [state.coverage] : [])).filter(c => c.status === 'partial');
    const coverageStatus = { ...(state.coverage ?? { status: 'not-audited' }), latestStatus: state.coverage?.status ?? 'not-audited', status: outstandingRequests.length ? 'partial' : state.coverage?.status ?? 'not-audited', outstandingRequests };
    return { completion: issues.length || stalePageIds.length || unmappedSourceIds.length || coverageStatus.status === 'partial' ? 'partial' : 'complete', coverageStatus, completionScope: 'structural source mapping only; see coverageStatus for requested scope', fileStatus: state.commitId ? 'snapshot-verified' : 'no-snapshot', semanticReview: semanticStatus(state, stalePageIds), issueStatus: { open: open.length, total: (state.issues ?? []).length, issueIds: open.map(i => i.issueId) }, issues, stalePageIds, unmappedSourceIds, legacyPageIds: state.pages.filter(p => p.content === undefined).map(p => p.pageId) };
  }
  recover(input, recoveryRunId) {
    const journals = this.pending();
    if (journals.length !== 1 || journals[0].commitId !== input.commitId) fail('INVALID_INPUT', 'name the single pending journal commitId');
    const journal = journals[0], currentId = this.pointer()?.commitId ?? null;
    if (input.mode === 'abort') {
      if (currentId !== journal.expectedCommitId) fail('REVISION_CONFLICT', 'already published; finish recovery, then rollback');
      atomic(this.location(`.wiki/journals/${journal.commitId}.json`), json({ ...journal, status: 'aborted' }));
      this.event(recoveryRunId, 'aborted', { commitId: journal.commitId }); return { status: 'aborted', commitId: currentId };
    }
    if (input.mode !== 'finish') fail('INVALID_INPUT', 'recover mode must be finish or abort');
    const snapshot = this.snapshot(journal.commitId);
    if (digest(json(snapshot.manifest)) !== journal.pointer.manifestHash) fail('STATE_CORRUPT', 'journal manifest mismatch');
    if (currentId === journal.expectedCommitId) {
      this.current();
      if (journal.provenance.preparedRunId) this.verifyInputs(readJSON(this.location(`.wiki/runs/${id(journal.provenance.preparedRunId)}/prepared.json`)));
      atomic(this.location('.wiki/current.json'), json(journal.pointer));
    } else if (currentId !== journal.commitId) fail('REVISION_CONFLICT', 'pointer differs from both journal states');
    this.event(recoveryRunId, 'recovery', { commitId: journal.commitId, originalRunId: journal.runId });
    return this.finish(journal);
  }
  rollback(input, runId) {
    const current = this.current(), target = this.snapshot(input.targetCommitId).state;
    if (current.commitId !== input.expectedCommitId) fail('REVISION_CONFLICT', 'rollback expectedCommitId differs');
    nonempty(input.reason, 'rollback reason');
    // Source observations are not rolled back. Historical quotes remain visibly stale.
    const pages = structuredClone(target.pages);
    for (const page of pages) {
      evidenceOf(page).forEach(f => f.citations.forEach(c => this.validateCitation(c, current.sources, true)));
      const previous = current.pages.find(p => p.pageId === page.pageId);
      page.version = pageVersion(current, page.pageId) + (previous?.contentHash === page.contentHash ? 0 : 1);
    }
    this.validateLinks(pages);
    const next = { ...current, pages, sourceContexts: target.sourceContexts ?? [], indexIntro: target.indexIntro ?? null, issues: target.issues ?? [] };
    return this.commit(next, current, runId, { command: 'rollback', targetCommitId: input.targetCommitId, reason: input.reason });
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2), flag = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  if (!command || command === '--help') { process.stdout.write(json({ commands: ['prepare', 'feedback', 'apply', 'status', 'recover', 'rollback', 'recover-lock'], usage: 'node wiki.mjs COMMAND --workspace DIR [--input JSON]', note: 'Internal Agent file operations; no Core, network or model client. Read RUNTIME.md.' })); return; }
  const workspace = flag('--workspace'); if (!workspace) fail('INVALID_INPUT', '--workspace required');
  const inputFile = flag('--input'), wiki = new FileWiki(workspace);
  let input;
  try { input = inputFile ? readJSON(path.resolve(inputFile)) : {}; }
  catch (error) { wiki.event(`run-${randomUUID()}`, 'input_failed', { command, error: String(error), inputFile }); throw error; }
  const result = await wiki.run(command, input);
  process.stdout.write(json(result));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
