const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, 'public');
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const files = new Map();
for (const [url, name, type] of [
  ['/', 'index.html', 'text/html; charset=utf-8'],
  ['/index.html', 'index.html', 'text/html; charset=utf-8'],
  ['/assets/masquerade-print.webp', 'assets/masquerade-print.webp', 'image/webp'],
  ['/assets/role-sigils.webp', 'assets/role-sigils.webp', 'image/webp']
]) {
  const data = fs.readFileSync(path.join(root, name));
  files.set(url, {data, type, etag:'W/"' + crypto.createHash('sha256').update(data).digest('hex').slice(0,24) + '"', gzip: name==='index.html' ? fs.readFileSync(path.join(root,name+'.gz')) : null});
}
const server = http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405, {'Allow':'GET, HEAD'}); return res.end(); }
  let url;
  try { url = new URL(req.url,'http://localhost').pathname; } catch { res.writeHead(400); return res.end(); }
  if (url === '/healthz') { res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(req.method==='HEAD' ? '' : '{"status":"ok"}'); }
  if (url === '/favicon.ico') { res.writeHead(204); return res.end(); }
  const file = files.get(url);
  if (!file) { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Not found'); }
  res.setHeader('Content-Type',file.type);
  res.setHeader('Cache-Control',file.type.startsWith('text/html')?'no-cache':'public, max-age=86400, must-revalidate');
  res.setHeader('ETag',file.etag);
  if (file.gzip) res.setHeader('Vary','Accept-Encoding');
  if (req.headers['if-none-match'] === file.etag) { res.writeHead(304); return res.end(); }
  const gz = file.gzip && /(?:^|,)\s*gzip\s*(?:,|$|;)/i.test(req.headers['accept-encoding'] || '') && !/gzip\s*;\s*q=0(?:\.0*)?\s*(?:,|$)/i.test(req.headers['accept-encoding'] || '');
  const data = gz ? file.gzip : file.data;
  if (gz) res.setHeader('Content-Encoding','gzip');
  res.setHeader('Content-Length',data.length);
  res.writeHead(200); res.end(req.method==='HEAD' ? undefined : data);
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(port,host,()=>console.log('Boardgame listening on '+host+':'+port));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>process.exit(0)));
