// PelletPreise Web – kleiner Server: liefert index.html und ruft die Anbieter serverseitig ab
// (Browser dürfen die Anbieter-APIs wegen CORS nicht direkt abfragen). Start: node server.mjs
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLZ = '78056', TONS = 3, PORT = Number(process.env.PORT) || 3000;
const dir = path.dirname(fileURLToPath(import.meta.url));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';

class Jar {
  c = new Map();
  absorb(res) { for (const s of res.headers.getSetCookie?.() ?? []) { const [kv] = s.split(';'); const i = kv.indexOf('='); this.c.set(kv.slice(0, i), kv.slice(i + 1)); } }
  get header() { return [...this.c].map(([k, v]) => `${k}=${v}`).join('; '); }
}
async function send(url, opts = {}, jar) {
  const headers = { 'User-Agent': UA, ...(opts.headers || {}) };
  if (jar?.header) headers.Cookie = jar.header;
  const res = await fetch(url, { ...opts, headers, signal: AbortSignal.timeout(20000) });
  jar?.absorb(res);
  if (!res.ok) throw new Error(`Server-Fehler (HTTP ${res.status})`);
  return res;
}
const num = s => { const n = Number(String(s).trim().replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const m1 = (re, t) => re.exec(t)?.[1];

async function bestwood() {
  const base = 'https://www.bestwood-pellets.com', page = base + '/holzpellets-kaufen/', jar = new Jar();
  const html0 = await (await send(page, {}, jar)).text();
  const cfgRe = /name=["']config_id["'][^>]*value=["']([^"']+)["']/i;
  let configId = m1(cfgRe, html0);
  for (let i = 0; i < 2; i++) {
    const p = new URLSearchParams({ product: 'loose', commercial: '0', country: '1501', postalcode: PLZ, discount_code: '',
      delivery_date_start: '', delivery_date_end: '', delivery_date: '', delivery_date_value: '', delivery_time: 'GANZTÄGIG',
      trailer: 'EGAL', tube_length: 'BIS 30 METER', amount: String(TONS * 1000), quantity: String(TONS),
      quantitylabel: '<strong>Holzpellets als lose Ware</strong>' });
    if (configId) p.set('config_id', configId);
    const res = await send(base + '/api/price/calculate', { method: 'POST', body: p, headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest', Origin: base, Referer: page } }, jar);
    const html = (await res.json()).content;
    if (typeof html !== 'string') throw new Error('Unerwartete Antwort des Servers');
    const price = num(m1(/([\d.,]+)\s*EUR\s*\/\s*Tonne/i, html) ?? '');
    if (price != null) return { price, delivery: num(m1(/([\d.,]+)\s*EUR\s*\/\s*Haushalt/i, html) ?? '') ?? 0 };
    configId = m1(cfgRe, html);
    if (!configId) break;
  }
  throw new Error('Preis in der Antwort nicht gefunden');
}

async function wahr() {
  const opts = [
    ['64238fcdd1560152d1b39256', '69e7769491f6366db481e9ee', 3, '64239156d1560152d1b3b367', 'Liefertermin', 'bis 20 Werktage (Mo.-Fr.)'],
    ['64238fcdd1560152d1b39257', '64238fcea58b1368864cda52', 1, '64239156d1560152d1b3b36d', 'Lieferzeiten', 'Ganztags (7 bis 18 Uhr)'],
    ['64238fcdd1560152d1b39258', '64238fcea58b1368864cda8e', 1, '64239156d1560152d1b3b373', 'Tankwagen', 'egal (auch mit Hänger)'],
    ['64238fcdd1560152d1b39259', '64238fcfa58b1368864cdb59', 1, '64239156d1560152d1b3b377', 'Schlauchlänge', 'bis 30 Meter'],
    ['64239213d1560152d1b3d289', '64239213d1560152d1b3d28d', 1, '6274f6a9a01b250d187f84db', 'Zahlungsart', 'EC bei Lieferung'],
  ].map(o => ({ optionSetId: o[0], optionId: o[1], sort: o[2], dynamicPcOptionsSetId: o[3], lable: o[4], name: o[5], DOB: false }));
  const fmt = d => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const day = n => new Date(Date.now() + n * 864e5);
  const plzId = '597f43b38324563a64de5d10', productId = '61d421c387bf6a786895fb6f', grams = TONS * 1000;
  const body = { plzId, dynamicProductId: productId, localOptions: opts, stations: 1, quantity: grams, co2Compensation: [],
    desiredDate: { days: 0, fromDate: fmt(day(1)), toDate: fmt(day(28)) } };
  const res = await send('https://api.aupris.com/price_calculator/calculation/priceCalculation', { method: 'POST',
    body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*',
      Origin: 'https://www.wahr-energie.de', Referer: 'https://www.wahr-energie.de/', dynamicproductid: productId, plzid: plzId,
      quantity: String(grams), ip: 'SID' + Date.now(), tag: '1', webpc: 'true', domainname: 'false',
      'Cache-Control': 'no-cache', Pragma: 'no-cache', Expires: '0' } });
  const json = await res.json();
  const item = json.success === true && Array.isArray(json.data) ? json.data[0] : null;
  if (!item) throw new Error('Unerwartete Antwort des Servers');
  const perTon = Number(item.grossPriceFactor), gross = Number(item.gross);
  if (!Number.isFinite(perTon) || !Number.isFinite(gross)) throw new Error('Preis in der Antwort nicht gefunden');
  return { price: perTon, delivery: Math.round((gross - perTon * TONS) * 100) / 100 };
}

function isoWeekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return String(y * 100 + w);
}
async function schellinger() {
  const base = 'https://schellinger-kg.de', page = base + '/de/sonnen-pellets/service/bestellen/pellets/', jar = new Jar();
  await send(page, {}, jar).catch(() => {});
  const res = await send(base + '/index.php?rex-api-call=areaprice&action=detailplz', { method: 'POST',
    body: JSON.stringify({ plz: PLZ, sbc_uid: 982121529 }),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: base, Referer: page } }, jar);
  const b64 = (await res.json()).data;
  if (typeof b64 !== 'string') throw new Error('Unerwartete Antwort des Servers');
  const weeks = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  const tiers = weeks[isoWeekKey()] ?? Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b))[0]?.[1];
  if (!tiers) throw new Error('Preis in der Antwort nicht gefunden');
  const steps = [2, 3, 6, 10, 15], tier = [...steps].reverse().find(s => s <= TONS) ?? steps[0];
  const price = Number(tiers['price_' + tier]);
  if (!Number.isFinite(price)) throw new Error('Preis in der Antwort nicht gefunden');
  return { price, delivery: 40 };
}

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
