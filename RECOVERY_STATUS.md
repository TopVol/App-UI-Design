# Recovery Status

**Branch:** `sprint-6-legacy-restore`

## Ziel
Diese Branch bündelt den Wiederaufbau des ursprünglichen Repo-Inhalts, ohne die modulare v4.9-Basis auf `main` zu zerstören.

## Bereits vorhanden

### Modulare v4.9-Basis
- `index.html`
- `styles/layout.css`
- `app/app.js`
- `app/render.js`
- `engine/constraint-engine.js`
- `engine/state-store.js`

### Wiederhergestellte Legacy-JS-Dateien
- `files/constants.js`
- `files/initialState.js`
- `files/StateStore.js`
- `files/ConstraintEngine.js`
- `files/examples.js`

### Legacy-/Recovery-Dokumentation
- `Layout Rules.txt`
- `legacy/README.md`
- `legacy/original-file-manifest.txt`
- `mvp_demo_v4.8.html` (als lauffähige Legacy-Bridge)

### Rekonstruierte TypeScript-Schicht
- `src/types/window.types.ts`
- `src/engine/layout-tree.ts`
- `src/engine/constraint-engine.ts`
- `src/controller/resize-controller.ts`
- `src/state-store.ts`
- `src/README.md`

### Projekt-Metadaten
- `package.json`
- `tsconfig.json`

## Wichtige Einordnung

Nicht alle auf dieser Branch wiederhergestellten Dateien sind garantierte Byte-für-Byte-Originale des historischen Uploads.

Es gibt drei Kategorien:

1. **Originalpfad wiederhergestellt**
   - Datei liegt wieder am historischen Ort
2. **Rekonstruktion auf Basis der Legacy-Logik**
   - besonders in `src/`
3. **Legacy-Bridge / Übergangsdatei**
   - z. B. `mvp_demo_v4.8.html`

## Noch offen

Folgende Punkte können als nächste Sprints folgen:

1. `src/` gegen `files/` systematisch angleichen
2. optional PR von `sprint-6-legacy-restore` nach `main`
3. echte Build-/Typecheck-Runde außerhalb des GitHub-Connectors
4. spätere Rückführung weiterer historischer Artefakte, falls noch extern vorhanden

## Empfehlung

Vor einem Merge:

- Repo lokal auschecken
- `npm install`
- `npm run typecheck`
- `node files/examples.js`
- visuelle Prüfung von `index.html` und `mvp_demo_v4.8.html`
