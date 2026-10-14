# Pelletpreise

Vergleicht täglich Pelletpreise (3 t, PLZ 78056), archiviert sie und zeigt den günstigsten Anbieter oben.
Daten liegen im Browser (localStorage), Import/Export als JSON.

```bash
node server.mjs   # Node 18+, dann http://localhost:3000
```

Der Server ruft die Anbieter-APIs ab (Browser können das wegen CORS nicht direkt).
