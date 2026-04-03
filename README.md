# App-UI-Design

## Überblick

Dieses Repository implementiert ein **constraint-basiertes Fenster- und Resize-System** für verschachtelte Web-UIs. Die zugehörigen Konzepte sind im `Layout Rules.txt` beschrieben. Ziel ist ein robustes, deterministisches Layout, in dem Fenster ihre minimale und maximale Größe respektieren, Kinder ihren Parent nicht überlaufen und Kanten einrasten können.

### Highlights

- **Constraint Engine:** Struktur für ein regelbasiertes Layout-System unter `engine/`
- **State Store:** einfacher, nachvollziehbarer UI-State mit Undo/Redo unter `engine/state-store.js`
- **Konzept-Handbuch:** `Layout Rules.txt` dokumentiert Regeln, Datenmodell, API-Verträge und QA-Kriterien.
- **Split-Demo:** `index.html` + `styles/` + `app/` + `engine/` als modulare v4.9-Basis

## Verzeichnisstruktur

```text
.
├── README.md
├── .gitignore
├── SPLIT_PLAN_v4.9.md
├── index.html
├── styles/
│   └── layout.css
├── app/
│   ├── app.js
│   └── render.js
└── engine/
    ├── constraint-engine.js
    └── state-store.js
```

## Status

Die aktuelle v4.9 ist der **echte Struktur-Split** des bisherigen Demo-Gedankens:

1. HTML ist nur noch Shell
2. CSS liegt separat
3. Rendering liegt separat
4. State + Logik liegen separat

Die nächste Ausbaustufe ist die Rückführung aller fortgeschrittenen Monolith-Funktionen in diese Modulstruktur.
