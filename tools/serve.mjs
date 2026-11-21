// DOORBUSTER tool — serve.mjs
// A tiny static file server for local play and for the capture tools. No dependencies.
// Run: node tools/serve.mjs [port] [root]      (default port 8080, root = project folder)
// Exports: startServer(root, port) -> Promise<{ url, close }>
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8',
};

export function startServer(root, port = 0) {
  const base = resolve(root);
  const server = http.createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = normalize(join(base, path));
      if (!file.startsWith(base)) { res.writeHead(403).end(); return; }
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
    }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({
    url: 'http://127.0.0.1:' + server.address().port,
    close: () => new Promise((done) => server.close(done)),
  })));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2]) || 8080;
  const root = process.argv[3] || resolve(fileURLToPath(import.meta.url), '..', '..');
  startServer(root, port).then((s) => console.log('DOORBUSTER at ' + s.url + '  (Ctrl+C to stop)'));
}
