// Read-only research workbench. GET/HEAD only; serves its own web/ files and a
// JSON projection of the workspace. It takes no writer lock and writes nothing,
// so the four Skills work the same whether or not this server is running.
import * as fs from 'node:fs';
import * as path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { readWorkbench, fingerprint } from './lib/adapter.mjs';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(appRoot, 'web');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" };

export function createWorkbenchServer(workspace, opt = {}) {
  const root = fs.realpathSync(workspace);
  const send = (res, status, body, headers = {}) => { res.writeHead(status, { ...SECURITY, ...headers }); res.end(body); };
  const json = (res, status, value) => send(res, status, JSON.stringify(value), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  return http.createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Read only', { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/workbench') {
        const project = await readWorkbench(root, opt);
        return json(res, 200, { mode: 'live', fingerprint: fingerprint(root, opt), projects: [project] });
      }
      if (url.pathname === '/api/fingerprint') return json(res, 200, { fingerprint: fingerprint(root, opt) });
      let relative;
      try { relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)); }
      catch { return send(res, 400, 'Bad path'); }
      const file = path.resolve(webRoot, relative);
      // Only the app's own files; never workspace files, never links out of web/.
      if (!file.startsWith(webRoot + path.sep) || !fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink() || !fs.statSync(file).isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return send(res, 200, req.method === 'HEAD' ? undefined : fs.readFileSync(file), { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    } catch (error) { return json(res, 500, { error: String(error?.message ?? error) }); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), flag = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  if (!flag('--workspace')) { process.stderr.write('Usage: node apps/workbench/server.mjs --workspace DIR [--port 8772] [--paths runs,reviews]\n'); process.exit(1); }
  const root = fs.realpathSync(flag('--workspace')), port = Number(flag('--port') ?? 8772);
  const paths = (flag('--paths') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  createWorkbenchServer(root, { paths }).listen(port, '127.0.0.1', () => process.stdout.write(`DSH research workbench (read-only) http://127.0.0.1:${port}\nWorkspace: ${root}${paths.length ? `\nExtra paths: ${paths.join(', ')}` : ''}\nSkills are unaffected: this server reads files and holds no lock.\n`));
}
