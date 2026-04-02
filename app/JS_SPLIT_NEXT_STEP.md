# JS Split – Next Step

## Status
- CSS wurde bereits aus dem HTML ausgelagert.
- Die Repo-Struktur `styles/`, `app/`, `engine/` wurde vorbereitet.
- Die eigentliche Logik lebt aktuell noch in `mvp_demo_v4.8.html` und in den bestehenden Modulen unter `files/`.

## Ziel jetzt
Die Demo soll **nicht neu erfunden**, sondern kontrolliert auf die neue Struktur umgelegt werden.

## Konkrete Zuordnung

### 1. `app/app.js`
Hierhin kommt:
- `createInitialState()` aufrufen
- `new StateStore(...)` erzeugen
- erste `render(...)` Ausführung
- `store.subscribe(...)`
- Event-Wiring für Buttons, Resize, Collapse/Expand, View-Buttons, Save etc.

### 2. `app/render.js`
Hierhin kommt:
- alle `document.querySelector(...)`
- alle DOM-Updates
- alle `innerHTML` / `textContent` / Klassen-Updates
- Renderer für Panels, Fenster, Floating Window, HUD, Statusanzeige

### 3. `engine/*`
Vorläufig NICHT duplizieren.
Nutze bis zum echten Refactor direkt die bestehenden Module aus `files/`:
- `../files/ConstraintEngine.js`
- `../files/StateStore.js`
- `../files/initialState.js`
- `../files/constants.js`

## Minimaler Startpunkt für `app/app.js`

```js
import { StateStore } from '../files/StateStore.js';
import { createInitialState } from '../files/initialState.js';
import { render } from './render.js';

const state = createInitialState();
const store = new StateStore(state);

render(store.getState(), store);
store.subscribe((newState) => {
  render(newState, store);
});
```

## Minimaler Startpunkt für `app/render.js`

```js
export function render(state, store) {
  console.log('render state', state);
}
```

## Wichtig
- Keine Engine-Logik in `render.js`
- Keine DOM-Logik in `StateStore`
- Keine doppelten Kopien von ConstraintEngine / StateStore anlegen
- Erst funktional gleichziehen, dann verschönern

## Danach
Sobald die Demo über `app/app.js` startet, kann der nächste Schritt folgen:
1. HTML-Monolith entschlacken
2. Render-Funktionen verfeinern
3. Drag/Resize sauber anbinden
4. Dev-Overlay vorbereiten
