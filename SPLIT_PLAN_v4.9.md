# Split Plan v4.9

## Ziel
Den HTML-Monolithen `mvp_demo_v4.8.html` in eine echte Repo-Struktur überführen, ohne die Demo sofort funktional umzubauen.

## Zielstruktur

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

## Reihenfolge

1. `styles/layout.css`
   - kompletter Inhalt aus dem `<style>`-Block der HTML-Demo

2. `engine/constraint-engine.js`
   - zunächst Re-Export oder Kopie von `files/ConstraintEngine.js`

3. `engine/state-store.js`
   - zunächst Re-Export oder Kopie von `files/StateStore.js`

4. `app/render.js`
   - DOM-Selektoren, Template-Helfer, Render-Funktionen

5. `app/app.js`
   - Initialisierung, Event-Wiring, Import von Engine/Store/Render

## Wichtige Regel
Vor dem vollständigen Split zuerst Struktur + Platzhalter herstellen. Danach gezielt den Monolithen in kleinen Diffs zerlegen.

## Warum dieser Zwischenschritt?
Weil der GitHub-Connector in diesem Lauf nicht den bestehenden HTML-Dateiinhalt aus `main` lesen konnte. Deshalb wird zuerst die Zielstruktur im Repo vorbereitet, damit der nächste Arbeitsgang sauber und risikoarm aufsetzen kann.
