# JS ↔ TS Alignment Notes

## Branch
- `sprint-6-legacy-restore`

## Ziel von Sprint 12
Die rekonstruierte TypeScript-Schicht sollte näher an die wiederhergestellte Legacy-JS-API herangeführt werden, ohne die bestehende Branch-Struktur riskant umzuschreiben.

## In Sprint 12 hinzugefügt

### 1. `src/engine/legacy-compat.ts`
Diese Datei bildet eine kleine Kompatibilitätsschicht zur Legacy-JS-Engine nach.

Enthalten:
- `createWindow(...)`
- `createSharedEdge(...)`
- `buildCollapseUpdate(...)`
- `buildExpandUpdate(...)`
- Re-Export von `applyConstraints(...)`

### 2. `src/state-store.compat.ts`
Diese Datei spiegelt das Verhalten des wiederhergestellten `files/StateStore.js` enger nach als die schlankere Rekonstruktion in `src/state-store.ts`.

Enthalten:
- `getWindowDiagnostics()` in JS-naher Form
- `collapseWindow()` mit `buildCollapseUpdate(...)`
- `expandWindow()` mit `buildExpandUpdate(...)`
- `setSizeValue()` in JS-naher Logik
- Commit-/Undo-/Redo-/Subscribe-Pfad ähnlich zur Legacy-JS-Schicht

## Warum als Adapter statt Direkt-Umbau?

Weil die bestehende rekonstruierte TS-Schicht bereits als Basis auf der Branch liegt.
Ein harter Direkt-Umbau von `src/engine/constraint-engine.ts` und `src/state-store.ts` hätte unnötig viel Risiko erzeugt.

Der Adapter-Weg sorgt dafür, dass:

1. die aktuelle TS-Basis erhalten bleibt,
2. die Legacy-nahe API trotzdem verfügbar wird,
3. die Unterschiede im Review klar sichtbar bleiben.

## Weiterhin offene Unterschiede

1. `src/engine/constraint-engine.ts` ist weiterhin nicht 1:1 auf dem Stand von `files/ConstraintEngine.js`
2. `src/state-store.ts` bleibt eine schlankere Rekonstruktion neben `src/state-store.compat.ts`
3. Die TS-Schicht ist weiterhin eine Recovery-/Weiterentwicklungsbasis, keine garantierte historische 1:1-Kopie

## Empfohlener nächster Schritt

1. Entscheiden, ob `compat`-Dateien nur Übergang oder neue offizielle TS-API sein sollen
2. Danach entweder:
   - bestehende TS-Dateien auf Compat-Niveau anheben
   - oder Compat-Dateien als offizielle Fassung übernehmen
