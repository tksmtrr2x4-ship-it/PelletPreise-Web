# Pelletpreise

Vergleicht stündlich Pelletpreise (3 t, PLZ 78056), archiviert sie und zeigt den günstigsten Anbieter oben.
Daten liegen im Browser (localStorage), Import/Export als JSON.

```bash
node server.mjs   # Node 18+, dann http://localhost:3000
```

Der Server ruft die Anbieter-APIs ab (Browser können das wegen CORS nicht direkt).

## GitHub Pages

Eine GitHub Action (`.github/workflows/update.yml`) ruft stündlich die Preise ab und schreibt `data/prices.json`;
die Seite liest diese Datei. Einrichten: Settings ▸ Pages ▸ Branch `main` / Root, Settings ▸ Actions ▸ Workflow permissions ▸ Read and write.
Manuell auslösen: Actions ▸ „Preise abrufen“ ▸ Run workflow. Lokal: `node scripts/update.mjs`.
