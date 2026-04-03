# TypeScript Recovery Layer

Dieser Ordner enthält die rekonstruierte TypeScript-Spur des Projekts auf der Branch `sprint-6-legacy-restore`.

## Zweck

Die Dateien in `src/` sind keine garantierten Byte-für-Byte-Originale des historischen Uploads. Sie wurden aus den wiederhergestellten JavaScript-Dateien und der aktuellen modularen v4.9-Struktur abgeleitet, damit die Architektur wieder als getypte Schicht sichtbar und weiterentwickelbar ist.

## Enthaltene Bereiche

- `types/window.types.ts`
  - zentrale Typdefinitionen für Windows, SharedEdges, LayoutState und Constraint-Ergebnisse
- `engine/layout-tree.ts`
  - Parent/Child/Sibling/Traversal-Helfer
- `engine/constraint-engine.ts`
  - rekonstruierte getypte Constraint-Engine
- `controller/resize-controller.ts`
  - Resize-Session-Logik für Pointer-basierte Layout-Änderungen

## Einordnung

Diese Schicht ist aktuell eine **Recovery- und Weiterentwicklungsbasis**.

Sie soll mittelfristig:

1. die alte JS-Logik typisiert spiegeln,
2. als sauberer Einstieg für spätere Refactors dienen,
3. die modulare v4.9-Struktur langfristig ablösen oder untermauern.

## Nächste sinnvolle Schritte

1. `typecheck` laufen lassen
2. Unterschiede zwischen `files/ConstraintEngine.js` und `src/engine/constraint-engine.ts` angleichen
3. `StateStore` ebenfalls als TypeScript-Version ergänzen
4. danach schrittweise echte Build-/Dev-Integration herstellen
