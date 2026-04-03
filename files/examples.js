// ============================================================
// examples.js
//
// Konkrete Durchläufe durch applyConstraints() und StateStore-API.
// Dient als ausführbarer Test und als Dokumentation.
//
// Ausführen:  node examples.js  (Node ≥ 14 mit --experimental-vm-modules,
//             oder als ES-Modul mit type:"module" in package.json)
// ============================================================

import { createInitialState }    from './initialState.js';
import { StateStore }            from './StateStore.js';
import { applyConstraints, LayoutTree } from './ConstraintEngine.js';
import { ConstraintErrorCode, Edge }    from './constants.js';

// ══════════════════════════════════════════════════════════
// Hilfsfunktionen für die Ausgabe
// ══════════════════════════════════════════════════════════

function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function result(label, value) {
  console.log(`  ${label.padEnd(28)} →  ${JSON.stringify(value)}`);
}

function ok(msg)   { console.log(`  ✓  ${msg}`); }
function fail(msg) { console.log(`  ✗  ${msg}`); }

// ══════════════════════════════════════════════════════════
// Beispiel 1: Normaler App-Resize ohne Constraint-Verletzung
// ══════════════════════════════════════════════════════════

function example1_normalResize() {
  section('Beispiel 1: Normaler App-Resize (app.root)');

  const state   = createInitialState();
  const store   = new StateStore(state);

  // ResizeController würde diesen Aufruf auslösen:
  // app.root wird von 1120×720 auf 1300×800 vergrößert
  const r = store.resizeWindow(
    'app.root',
    { w: 1300, h: 800 },
    { viewportBounds: { w: 1920, h: 1080 } },
  );

  result('ok',           r.ok);
  result('warnings',     r.errors?.map(e => e.code));

  const newRoot = store.getWindow('app.root');
  result('app.root.currentSize', newRoot.currentSize);

  // Überprüfen: Undo funktioniert
  store.undo();
  const restored = store.getWindow('app.root');
  result('nach Undo app.root.w', restored.currentSize.w);

  if (restored.currentSize.w === 1120) ok('Undo korrekt wiederhergestellt');
  else fail('Undo fehlgeschlagen');
}

// ══════════════════════════════════════════════════════════
// Beispiel 2: Resize unter minSize → wird geclampt, nicht abgelehnt
// ══════════════════════════════════════════════════════════

function example2_clampToMin() {
  section('Beispiel 2: Resize unter minSize → WARN, geclampt');

  const state = createInitialState();
  const store = new StateStore(state);

  // Versuch: window.A auf 100×50 verkleinern (min: 280×220)
  const r = store.resizeWindow(
    'window.A',
    { w: 100, h: 50 },
    { viewportBounds: { w: 1920, h: 1080 } },
  );

  result('ok',         r.ok);
  result('warncodes',  r.errors?.map(e => e.code));

  const winA = store.getWindow('window.A');
  result('window.A nach Clamp', winA.currentSize);

  if (winA.currentSize.w === 280 && winA.currentSize.h === 220)
    ok('Korrekt auf minSize geclampt');
  else
    fail(`Erwartet 280×220, bekommen ${winA.currentSize.w}×${winA.currentSize.h}`);
}

// ══════════════════════════════════════════════════════════
// Beispiel 3: SharedEdge-Propagation beim Sidebar-Expand
// ══════════════════════════════════════════════════════════

function example3_sharedEdgePropagation() {
  section('Beispiel 3: SharedEdge — sidebar.left öffnet, main.canvas verschiebt sich');

  const state = createInitialState();
  const store = new StateStore(state);

  // Ausgangszustand: sidebar.left collapsed (w=0), main.canvas bei x=0, w=1120
  const mainBefore = store.getWindow('main.canvas');
  result('main.canvas vorher x', mainBefore.bounds.x);
  result('main.canvas vorher w', mainBefore.bounds.w);

  // sidebar.left auf defaultSize (230) expandieren
  // Die SharedEdge sidebarL.RIGHT ↔ main.canvas.LEFT wird propagiert:
  // sidebar.left.RIGHT bewegt sich von 0 auf 230 → delta = +230
  // → main.canvas.LEFT (bounds.x) += 230, bounds.w -= 230
  const r = applyConstraints(
    state,
    { 'sidebar.left': { bounds: { w: 230 } } },
    { viewportBounds: { w: 1920, h: 1080 } },
  );

  result('ok', r.ok);

  if (r.state) {
    const sidebarLeft = r.state.windows['sidebar.left'];
    const mainCanvas  = r.state.windows['main.canvas'];

    result('sidebar.left.currentSize', sidebarLeft.currentSize);
    result('main.canvas.bounds.x',     mainCanvas.bounds.x);
    result('main.canvas.bounds.w',     mainCanvas.bounds.w);

    const correctX = mainCanvas.bounds.x === 230;
    const correctW = mainCanvas.bounds.w === 890;  // 1120 - 230

    if (correctX && correctW)
      ok('SharedEdge korrekt propagiert: main.canvas.x=230, w=890');
    else
      fail(`Erwartet x=230, w=890 — bekommen x=${mainCanvas.bounds.x}, w=${mainCanvas.bounds.w}`);
  }
}

// ══════════════════════════════════════════════════════════
// Beispiel 4: Collapse/Expand mit previousSize und adaptSize
// ══════════════════════════════════════════════════════════

function example4_collapseExpand() {
  section('Beispiel 4: Collapse → Expand mit previousSize / adaptSize');

  const state = createInitialState();
  const store = new StateStore(state);

  // window.A ist offen (420×280)
  const before = store.getWindow('window.A');
  result('window.A vorher', before.currentSize);

  // Collapse
  const collapseResult = store.collapseWindow('window.A');
  result('collapse ok', collapseResult.ok);

  const collapsed = store.getWindow('window.A');
  result('window.A collapsed', collapsed.currentSize);
  result('previousSize gespeichert', collapsed.previousSize);

  if (collapsed.collapsed) ok('collapsed-Flag korrekt gesetzt');
  if (collapsed.previousSize.w === 420) ok('previousSize korrekt gesichert');

  // Expand — app.root ist auf defaultSize → window.A benutzt defaultSize (420×280)
  const expandResult = store.expandWindow('window.A');
  result('expand ok', expandResult.ok);

  const expanded = store.getWindow('window.A');
  result('window.A expanded', expanded.currentSize);

  if (!expanded.collapsed && expanded.currentSize.w === 420)
    ok('Expand auf defaultSize korrekt');

  // ── Jetzt: Parent größer als defaultSize → adaptSize wird verwendet ────
  // app.root auf 1400×900 vergrößern
  store.resizeWindow('app.root', { w: 1400, h: 900 }, { viewportBounds: { w: 1920, h: 1080 } });

  // window.A erst collapse, dann expand
  store.collapseWindow('window.A');
  const expandAdaptResult = store.expandWindow('window.A');
  result('expand auf adaptSize ok', expandAdaptResult.ok);

  const expandedAdapt = store.getWindow('window.A');
  result('window.A mit adaptSize', expandedAdapt.currentSize);

  // adaptSize: { w: 480, h: 320 }
  if (expandedAdapt.currentSize.w === 480)
    ok('adaptSize korrekt verwendet (parent > defaultSize)');
  else
    fail(`Erwartet w=480, bekommen w=${expandedAdapt.currentSize.w}`);
}

// ══════════════════════════════════════════════════════════
// Beispiel 5: Ungültige ID → harter Fehler, Rollback
// ══════════════════════════════════════════════════════════

function example5_invalidId() {
  section('Beispiel 5: Unbekannte Window-ID → INVALID_WINDOW_ID, kein Commit');

  const state = createInitialState();
  const store = new StateStore(state);

  const stateBefore = store.getState();

  const r = applyConstraints(
    state,
    { 'window.ghost': { bounds: { w: 500 } } },
  );

  result('ok',     r.ok);
  result('fehler', r.errors?.map(e => e.code));
  result('state',  r.state);

  if (!r.ok && r.errors[0].code === ConstraintErrorCode.INVALID_WINDOW_ID)
    ok('Korrekter Fehlercode, kein neuer State');
  if (r.state === null)
    ok('state ist null — kein Commit möglich');
}

// ══════════════════════════════════════════════════════════
// Beispiel 6: LayoutTree-Abfragen
// ══════════════════════════════════════════════════════════

function example6_layoutTree() {
  section('Beispiel 6: LayoutTree-Abfragen');

  const { windows } = createInitialState();

  result('Children von app.root',
    LayoutTree.getChildren(windows, 'app.root').map(w => w.id));

  result('Parent von window.A1',
    LayoutTree.getParent(windows, 'window.A1')?.id);

  result('Siblings von window.A',
    LayoutTree.getSiblings(windows, 'window.A').map(w => w.id));

  result('Descendants von app.root',
    LayoutTree.getDescendants(windows, 'app.root').map(w => w.id));

  result('Topologische Reihenfolge',
    LayoutTree.topologicalOrder(windows));
}

// ══════════════════════════════════════════════════════════
// Beispiel 7: setSizeValue Validierung
// ══════════════════════════════════════════════════════════

function example7_setSizeValue() {
  section('Beispiel 7: setSizeValue — min > max wird abgelehnt');

  const state = createInitialState();
  const store = new StateStore(state);

  // Gültige Änderung: minSize erhöhen (aber unter maxSize bleiben)
  const r1 = store.setSizeValue('window.A', 'minSize', { w: 300, h: 240 });
  result('gültiges setSizeValue ok', r1.ok);

  // Ungültige Änderung: minSize > maxSize
  const r2 = store.setSizeValue('window.A', 'minSize', { w: 9999, h: 9999 });
  result('min > max ok',    r2.ok);
  result('min > max error', r2.error);

  if (!r2.ok && r2.error === ConstraintErrorCode.MIN_EXCEEDS_MAX)
    ok('MIN_EXCEEDS_MAX korrekt abgewiesen');
}

// ══════════════════════════════════════════════════════════
// Alle Beispiele ausführen
// ══════════════════════════════════════════════════════════

example1_normalResize();
example2_clampToMin();
example3_sharedEdgePropagation();
example4_collapseExpand();
example5_invalidId();
example6_layoutTree();
example7_setSizeValue();

console.log('\n' + '═'.repeat(60));
console.log('  Alle Beispiele abgeschlossen.');
console.log('═'.repeat(60) + '\n');
