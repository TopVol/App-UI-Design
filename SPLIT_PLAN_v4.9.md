# Split Plan v4.9

## Ziel
Den bisherigen Demo-Gedanken in eine echte Repo-Struktur überführen.

## Struktur

```text
styles/
  layout.css
app/
  app.js
  render.js
engine/
  constraint-engine.js
  state-store.js
```

## Ergebnis dieser Stufe
- HTML als reine Shell
- CSS als eigenes Modul
- Rendering separat
- State/Logik separat
- Grundlage für die Rückführung weiterer Monolith-Funktionen
