// ============================================================
// examples.js
//
// Demonstriert, wie ConstraintEngine und StateStore im MVP genutzt werden.
// Diese Datei kann direkt mit Node.js ausgeführt werden.
//
// Voraussetzungen:
//   node >= 18
//   package.json enthält: { "type": "module" }
//
// Aufruf:
//   node files/examples.js
// ============================================================

import { createInitialState } from './initialState.js';
import { StateStore }         from './StateStore.js';
import { ValueType }          from './constants.js';
import { applyConstraints }   from './ConstraintEngine.js';

// ---------------------------------------------------------------------------
// Helper: schönes Logging
// ---------------------------------------------------------------------------
function section(title) {
  console.log('\n' + '═'.repeat(72));
  console.log(title);
  console.log('═'.repeat(72));
}

function logWindow(state, id) {
  const w = state.windows[id];
  console.log(
    `${id.padEnd(16)}  bounds=(${w.bounds.x},${w.bounds.y},${w.bounds.w},${w.bounds.h})` +
    `  current=${w.currentSize.w}×${w.currentSize.h}` +
    `  collapsed=${w.collapsed}`
  );
}

function logErrors(errors) {
  if (!errors.length) {
    console.log('Keine Fehler/Warnungen');
    return;
  }
  for (const e of errors) {
    console.log(`- [${e.severity}] ${e.code} @ ${e.windowId}: ${e.detail}`);
  }
}

// ---------------------------------------------------------------------------
// 1) Initial State
// ---------------------------------------------------------------------------
section('1) Initial State erzeugen');
const initialState = createInitialState();

for (const id of [
  'app.root',
  'sidebar.left',
  'main.canvas',
  'sidebar.right',
  'panel.bottom',
  'window.A',
  'window.B',
  'window.A1',
  'window.floating',
]) {
  logWindow(initialState, id);
}

// ---------------------------------------------------------------------------
// 2) ConstraintEngine direkt benutzen (ohne Store)
// ---------------------------------------------------------------------------
section('2) applyConstraints() direkt verwenden');

const directResult = applyConstraints(
  initialState,
  {
    'window.A': {
      bounds: {
        w: 900, // absichtlich groß, soll geclampt / validiert werden
        h: 500,
      },
    },
  },
  {
    viewportBounds: { w: 1440, h: 900 },
  },
);

console.log('ok =', directResult.ok);
logErrors(directResult.errors);

if (directResult.ok) {
  logWindow(directResult.state, 'window.A');
  logWindow(directResult.state, 'window.B');
}

// ---------------------------------------------------------------------------
// 3) StateStore: Subscribe, Resize, Undo, Redo
// ---------------------------------------------------------------------------
section('3) StateStore mit Undo/Redo');

const store = new StateStore(initialState, 20);

store.subscribe((nextState, prevState) => {
  const prevW = prevState.windows['window.A'].bounds.w;
  const nextW = nextState.windows['window.A'].bounds.w;
  if (prevW !== nextW) {
    console.log(`[SUB] window.A width: ${prevW} -> ${nextW}`);
  }
});

console.log('Resize window.A auf 500×300');
let r = store.resizeWindow(
  'window.A',
  { w: 500, h: 300 },
  { viewportBounds: { w: 1440, h: 900 } },
);
console.log('ok =', r.ok);
logErrors(r.errors ?? []);
logWindow(store.getState(), 'window.A');

console.log('Undo');
r = store.undo();
console.log(r);
logWindow(store.getState(), 'window.A');

console.log('Redo');
r = store.redo();
console.log(r);
logWindow(store.getState(), 'window.A');

// ---------------------------------------------------------------------------
// 4) Collapse / Expand einer Sidebar
// ---------------------------------------------------------------------------
section('4) Sidebar expand / collapse');

console.log('Expand sidebar.left');
r = store.expandWindow('sidebar.left', { viewportBounds: { w: 1440, h: 900 } });
console.log('ok =', r.ok);
logErrors(r.errors ?? []);
logWindow(store.getState(), 'sidebar.left');
logWindow(store.getState(), 'main.canvas');

console.log('Collapse sidebar.left');
r = store.collapseWindow('sidebar.left', { viewportBounds: { w: 1440, h: 900 } });
console.log('ok =', r.ok);
logErrors(r.errors ?? []);
logWindow(store.getState(), 'sidebar.left');
logWindow(store.getState(), 'main.canvas');

// ---------------------------------------------------------------------------
// 5) Bottom Panel öffnen
// ---------------------------------------------------------------------------
section('5) Bottom Panel expand');

r = store.expandWindow('panel.bottom', { viewportBounds: { w: 1440, h: 900 } });
console.log('ok =', r.ok);
logErrors(r.errors ?? []);
logWindow(store.getState(), 'panel.bottom');
logWindow(store.getState(), 'main.canvas');

// ---------------------------------------------------------------------------
// 6) Konfigurationswerte im Store ändern
// ---------------------------------------------------------------------------
section('6) setSizeValue()');

console.log('window.B adaptSize -> 640×360');
r = store.setSizeValue('window.B', ValueType.ADAPT, { w: 640, h: 360 });
console.log(r);
console.log(store.getWindowDiagnostics('window.B').adaptSize);

// ---------------------------------------------------------------------------
// 7) Snap demonstrieren
// ---------------------------------------------------------------------------
section('7) Snap-Verhalten demonstrieren');

// window.B leicht in die Nähe der rechten Kante von window.A bewegen
r = store.moveWindow(
  'window.B',
  { x: 422, y: 0 }, // nahe an A.right = 420
  {
    viewportBounds: { w: 1440, h: 900 },
    snapOverride: false,
  },
);

console.log('ok =', r.ok);
logErrors(r.errors ?? []);
logWindow(store.getState(), 'window.A');
logWindow(store.getState(), 'window.B');

// ---------------------------------------------------------------------------
// 8) Diagnostics API
// ---------------------------------------------------------------------------
section('8) getWindowDiagnostics()');
console.dir(store.getWindowDiagnostics('window.A1'), { depth: null });

section('Fertig');
console.log('Beispieldurchlauf abgeschlossen.');
