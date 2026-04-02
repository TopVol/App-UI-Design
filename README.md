# App-UI-Design

## Überblick

Dieses Repository implementiert ein **constraint-basiertes Fenster- und Resize-System** für verschachtelte Web-UIs. Die zugehörigen Konzepte sind im `Layout Rules.txt` beschrieben. Ziel ist ein robustes, deterministisches Layout, in dem Fenster ihre minimale und maximale Größe respektieren, Kinder ihren Parent nicht überlaufen und Kanten einrasten können.

### Highlights

- **Constraint Engine:** `files/ConstraintEngine.js` validiert Größenänderungen, erkennt Regelverletzungen und liefert einen neuen gültigen State zurück.
- **State Store:** `files/StateStore.js` kapselt den gesamten Zustand, erzwingt immutable Updates und erlaubt Undo/Redo.
- **Konzept-Handbuch:** `Layout Rules.txt` dokumentiert Regeln, Datenmodell, API-Verträge und QA-Kriterien.
- **Demo:** `mvp_demo_v4.8.html` zeigt eine integrierte Browser-Demo mit Desktop-artigem UI.
- **TypeScript-Port:** Unter `src/` liegt eine getypte, modulare Fassung als Work in Progress.

## Verzeichnisstruktur

```text
.
├── Layout Rules.txt
├── mvp_demo_v4.8.html
├── files/
│   ├── ConstraintEngine.js
│   ├── StateStore.js
│   ├── constants.js
│   ├── examples.js
│   └── initialState.js
└── src/
    ├── controller/
    ├── engine/
    └── types/
```

## Nächste sinnvolle Schritte

1. Demo aus dem HTML-Monolithen in `index.html`, CSS- und JS-Module zerlegen.
2. JavaScript- und TypeScript-Codebasis zusammenführen.
3. Tests für Constraint Engine und StateStore ergänzen.
4. Dev-Overlay gemäß Konzept-Handbuch implementieren.
