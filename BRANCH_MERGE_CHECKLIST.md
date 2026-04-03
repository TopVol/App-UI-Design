# Branch Merge Checklist

**Branch:** `sprint-6-legacy-restore`

Diese Checkliste dient dazu, die Branch vor einem möglichen Merge nach `main` kontrolliert zu prüfen.

## 1. Inhaltliche Prüfung

- [ ] modulare v4.9-Dateien sind weiterhin vorhanden
- [ ] wiederhergestellte Legacy-JS-Dateien liegen an erwarteten Pfaden
- [ ] rekonstruierte TypeScript-Schicht ist vollständig sichtbar
- [ ] `mvp_demo_v4.8.html` ist als Legacy-Bridge vorhanden
- [ ] `RECOVERY_STATUS.md` beschreibt den Stand korrekt

## 2. Lokale Prüfung

Nach lokalem Checkout der Branch ausführen:

```bash
npm install
npm run typecheck
node files/examples.js
```

Zusätzlich manuell prüfen:

- [ ] `index.html` im Browser öffnen
- [ ] `mvp_demo_v4.8.html` im Browser öffnen
- [ ] Sidebar/Bottom/Floating-Verhalten grob testen
- [ ] keine offensichtlichen Importfehler in der Konsole

## 3. Architektonische Einordnung

Vor einem Merge klar entscheiden:

- [ ] Welche Dateien gelten als echte Legacy-Wiederherstellung?
- [ ] Welche Dateien gelten als Rekonstruktion?
- [ ] Welche Dateien sollen später wieder ersetzt oder angeglichen werden?

## 4. Empfehlung vor PR/Merge

Empfohlene Reihenfolge:

1. Typecheck lokal laufen lassen
2. JS/TS-Differenzen dokumentieren
3. kurze visuelle Prüfung durchführen
4. dann erst PR oder selektiven Merge vorbereiten

## 5. Nächster technischer Schritt nach Sprint 10

- `src/engine/constraint-engine.ts` gegen `files/ConstraintEngine.js` angleichen
- `src/state-store.ts` gegen `files/StateStore.js` angleichen
- optional danach PR von `sprint-6-legacy-restore` nach `main`
