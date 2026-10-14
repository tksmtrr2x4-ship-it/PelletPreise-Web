// PelletPreise Web – kleiner Server: liefert index.html und ruft die Anbieter serverseitig ab
// (Browser dürfen die Anbieter-APIs wegen CORS nicht direkt abfragen). Start: node server.mjs
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { bestwood, wahr, schellinger } from './fetchers.mjs';

const PORT = Number(process.env.PORT) || 3000;
const dir = path.dirname(fileURLToPath(import.meta.url));

const providers = { bestwood, wahr, schellinger };
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); };
  if (url.pathname === '/api/fetch') {
    const fn = providers[url.searchParams.get('provider')];
    if (!fn) return json(404, { error: 'Unbekannter Anbieter' });
    try { json(200, await fn()); } catch (e) { json(502, { error: e.message || String(e) }); }
    return;
  }
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  if (file.includes('..')) { res.writeHead(400); return res.end(); }
  try {
    const data = await fs.readFile(path.join(dir, file));
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  } catch { res.writeHead(404); res.end('Nicht gefunden'); }
}).listen(PORT, '127.0.0.1', () => console.log(`PelletPreise: http://localhost:${PORT}`));
