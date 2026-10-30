// Serve the web app locally on port 5173, with the same security headers CloudFront adds in AWS.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('../web/', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 5173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

// The origins the page may call: the API, and locally cognito-local and the traveller service.
async function connectOrigins() {
  try {
    const cfg = await readFile(join(root, 'config.js'), 'utf8');
    return [...cfg.matchAll(/"(?:apiUrl|cognitoEndpoint|travellerUrl)": "([^"]+)"/g)].map((m) => new URL(m[1]).origin).join(' ');
  } catch {
    return '';
  }
}

createServer(async (req, res) => {
  let path;
  try {
    path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  } catch {
    res.writeHead(400).end(); // a malformed address, such as a stray %
    return;
  }
  const file = join(root, path === '/' ? 'index.html' : path);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'content-security-policy': `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ${await connectOrigins()}; img-src 'self' data:; frame-ancestors 'none'`,
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
}).listen(PORT, process.env.HOST ?? '127.0.0.1', () => console.log(`Web app on http://localhost:${PORT}`));
