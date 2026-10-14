// Ruft alle Anbieter ab und schreibt data/prices.json (Archiv + Abruf-Status). Läuft per GitHub Action täglich.
import fs from 'node:fs/promises';
import { bestwood, wahr, schellinger, TONS } from '../fetchers.mjs';

const file = new URL('../data/prices.json', import.meta.url);
const providers = { 'Bestwood Pellets': bestwood, 'Schellinger KG': schellinger, 'Wahr Energie': wahr };
const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); // YYYY-MM-DD

let data = { entries: [], statuses: {} };
try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
const sig = d => JSON.stringify([d.entries, Object.entries(d.statuses).map(([k, v]) => [k, v.ok, v.message])]);
const before = sig(data);

for (const [name, fn] of Object.entries(providers)) {
  try {
    let q;
    try { q = await fn(); } catch { await new Promise(r => setTimeout(r, 2000)); q = await fn(); }
    if (!(q.price >= 150 && q.price <= 1500)) throw new Error(`Unplausibler Wert: ${q.price} €/t`);
    if (!(q.delivery >= 0 && q.delivery <= 300)) throw new Error(`Unplausibler Wert: Lieferung ${q.delivery} €`);
    const e = data.entries.find(x => x.day === day && x.provider === name);
    const entry = { day, provider: name, pricePerTon: q.price, delivery: q.delivery, tons: TONS, source: 'auto' };
    if (e) Object.assign(e, entry); else data.entries.push(entry);
    data.statuses[name] = { date: Date.now(), ok: true, message: 'OK' };
    console.log(name, q);
  } catch (err) {
    data.statuses[name] = { date: Date.now(), ok: false, message: err.message };
    console.error(name, 'FEHLER:', err.message);
  }
}
const changed = sig(data) !== before;
data.entries.sort((a, b) => a.day.localeCompare(b.day) || a.provider.localeCompare(b.provider));
if (!changed && data.updated) process.exit(0);   // kein Commit-Rauschen bei unveränderten Preisen
data.updated = new Date().toISOString();
await fs.mkdir(new URL('../data/', import.meta.url), { recursive: true });
await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
