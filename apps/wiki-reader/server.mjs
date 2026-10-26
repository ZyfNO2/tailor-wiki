import * as fs from 'node:fs';
import * as path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { FileWiki } from '../../research-pack/trial-skills/wiki-maintain/scripts/wiki.mjs';
const appRoot = path.dirname(fileURLToPath(import.meta.url));
const arg = name => process.argv[process.argv.indexOf(name) + 1];
export function readWorkspace(root) {
  const wiki = new FileWiki(root), state = wiki.current();
  if (!state.commitId) throw new Error('NO_SNAPSHOT: Publish a Wiki snapshot first.');
  // Follow committed ancestry only: staged/orphan snapshots are not revisions.
  const history = [], visited = new Set(); let cursor = state.commitId;
  while (cursor) {
    if (visited.has(cursor) || history.length > 200) throw new Error('INVALID_HISTORY: cycle or more than 200 retained commits');
    visited.add(cursor); const snapshot = wiki.snapshot(cursor).state;
    history.push(snapshot); cursor = snapshot.parentCommitId;
  }
  return { workspace: fs.realpathSync(root), state, history, status: wiki.completion(state) };
}
export function createReaderServer(root) {
  return http.createServer((req, res) => {
    try {
      if (req.method !== 'GET') { res.writeHead(405); res.end('Read only'); return; }
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/snapshot') {
        const payload = JSON.stringify(readWorkspace(root));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(payload); return;
      }
      const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const file = path.resolve(appRoot, 'dist', relative), dist = path.resolve(appRoot, 'dist');
      if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('Not found'); return; }
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); res.end(fs.readFileSync(file));
    } catch (error) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: String(error) })); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--workspace')) throw new Error('--workspace ABSOLUTE_PATH required');
  const root = fs.realpathSync(arg('--workspace')), port = process.argv.includes('--port') ? Number(arg('--port')) : 8771;
  readWorkspace(root); // Fail before opening a misleading preview.
  createReaderServer(root).listen(port, '127.0.0.1', () => process.stdout.write(`WeKnora pruned read-only reader http://127.0.0.1:${port}\nWorkspace: ${root}\n`));
}
