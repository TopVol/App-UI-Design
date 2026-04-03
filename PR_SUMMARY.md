# PR Summary

## Branch
- `sprint-6-legacy-restore`

## Ziel
Diese Branch bereitet den kontrollierten Abgleich zwischen der modularen v4.9-Basis und den wiederhergestellten bzw. rekonstruierten Legacy-Artefakten vor.

## Enthalten

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
- `mvp_demo_v4.8.html` (Legacy-Bridge)
- `RECOVERY_STATUS.md`
- `BRANCH_MERGE_CHECKLIST.md`

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

Diese Branch enthält drei Arten von Ergebnissen:

1. **Originalpfad wiederhergestellt**
   - Dateien liegen wieder an historischen Pfaden, z. B. in `files/`
2. **Rekonstruktion auf Basis der Legacy-Logik**
   - insbesondere in `src/`
3. **Übergangs-/Bridge-Dateien**
   - insbesondere `mvp_demo_v4.8.html`

## Vor einem Merge empfohlen

1. `npm install`
2. `npm run typecheck`
3. `node files/examples.js`
4. Browser-Prüfung von `index.html`
5. Browser-Prüfung von `mvp_demo_v4.8.html`

## Offene Fragen für Review

1. Welche Rekonstruktionen sollen dauerhaft bleiben?
2. Welche Dateien müssen später wieder enger an die Legacy-JS-Quelle angeglichen werden?
3. Soll `mvp_demo_v4.8.html` als Bridge bestehen bleiben oder später durch den Originalstand ersetzt werden?
