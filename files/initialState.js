// ============================================================
// initialState.js
//
// Erstellt den vollständigen Anfangs-State für das MVP.
//
// Fenster-Hierarchie:
//
//   app.root  (1120 × 720, absolut im Viewport bei 24,24)
//     innerPadding.top = 52 (Header)
//     ├── sidebar.left    (230 × 668)  — collapsed
//     ├── main.canvas     (1120 × 668) — immer sichtbar, scrollbar
//     ├── sidebar.right   (300 × 668)  — collapsed
//     └── panel.bottom    (1120 × 150) — collapsed
//
//   Kinder von main.canvas:
//     ├── window.A        (420 × 280)
//     │     └── window.A1 (280 × 160)
//     ├── window.B        (390 × 280)
//     └── window.floating (360 × 220, overlay, collapsed)
//
// Bounds-Koordinaten:
//   - app.root:     absolut (Viewport)
//   - Alle anderen: relativ zum Innenbereich des Parent
//                   (d.h. relativ zu parent.innerPadding-Ursprung)
//
// SharedEdges:
//   sidebar.left.RIGHT  ↔  main.canvas.LEFT
//   main.canvas.RIGHT   ↔  sidebar.right.LEFT
//   main.canvas.BOTTOM  ↔  panel.bottom.TOP
// ============================================================

import { ResizePolicy, VisibilityPolicy, SnapPolicy, Edge } from './constants.js';
import { createWindow, createSharedEdge } from './ConstraintEngine.js';

export function createInitialState() {

  // ── Maße-Konstanten ─────────────────────────────────────
  const HEADER_H    = 52;
  const APP_W       = 1120;
  const APP_H       = 720;
  const SHELL_H     = APP_H - HEADER_H;   // 668 — verfügbare Höhe unter dem Header

  const SIDEBAR_L_W = 230;
  const SIDEBAR_R_W = 300;
  const BOTTOM_H    = 150;

  // main.canvas startet mit voller Breite (Sidebars collapsed)
  const MAIN_W_FULL = APP_W;
  // main.canvas Höhe wenn bottom panel offen:
  const MAIN_H_WITH_BOTTOM = SHELL_H - BOTTOM_H;  // 518

  const windows = {};

  // ── Root-Window ──────────────────────────────────────────
  windows['app.root'] = createWindow({
    id:      'app.root',
    name:    'AppRoot',
    parentId: null,
    bounds:  { x: 24, y: 24, w: APP_W, h: APP_H },
    minSize: { w: 880, h: 560 },
    maxSize: { w: Infinity, h: Infinity },
    defaultSize: { w: APP_W, h: APP_H },
    // Header belegt obere 52px — Children starten bei y=0 im Innenbereich
    innerPadding: { top: HEADER_H, right: 0, bottom: 0, left: 0 },
    resizePolicy:     ResizePolicy.FLEXIBLE,
    visibilityPolicy: VisibilityPolicy.NO_OVERFLOW,
  });

  // ── Linke Sidebar ────────────────────────────────────────
  // Startet collapsed: bounds.w = 0 für Layout-Berechnung,
  // aber defaultSize.w = SIDEBAR_L_W für Expand-Zielwert.
  // Beim Expand wird via SharedEdge automatisch main.canvas.x verschoben.
  windows['sidebar.left'] = createWindow({
    id:      'sidebar.left',
    name:    'LeftSidebar',
    parentId: 'app.root',
    // x=0, y=0 relativ zum app.root-Innenbereich (unter dem Header)
    bounds:      { x: 0, y: 0, w: 0, h: SHELL_H },
    minSize:     { w: 0, h: 200 },    // w=0 erlaubt vollständiges Einklappen
    maxSize:     { w: 480, h: Infinity },
    defaultSize: { w: SIDEBAR_L_W, h: SHELL_H },
    adaptSize:   { w: SIDEBAR_L_W, h: SHELL_H },
    resizePolicy:     ResizePolicy.FLEXIBLE,
    visibilityPolicy: VisibilityPolicy.NO_OVERFLOW,
    collapsed: true,
  });

  // ── Main Canvas ──────────────────────────────────────────
  // Nimmt anfangs die volle Breite ein (Sidebars collapsed).
  // visibilityPolicy ALLOW_OVERFLOW_SCROLL: Inhalt darf scrollen.
  windows['main.canvas'] = createWindow({
    id:      'main.canvas',
    name:    'MainCanvas',
    parentId: 'app.root',
    bounds:      { x: 0, y: 0, w: MAIN_W_FULL, h: SHELL_H },
    minSize:     { w: 320, h: 300 },
    maxSize:     { w: Infinity, h: Infinity },
    defaultSize: { w: MAIN_W_FULL, h: SHELL_H },
    resizePolicy:     ResizePolicy.FLEXIBLE,
    visibilityPolicy: VisibilityPolicy.ALLOW_OVERFLOW_SCROLL,
  });

  // ── Rechte Sidebar ───────────────────────────────────────
  // Analoges Verhalten zu sidebar.left.
  windows['sidebar.right'] = createWindow({
    id:      'sidebar.right',
    name:    'RightSidebar',
    parentId: 'app.root',
    // x = APP_W → rechts außerhalb (collapsed)
    bounds:      { x: APP_W, y: 0, w: 0, h: SHELL_H },
    minSize:     { w: 0, h: 200 },
    maxSize:     { w: 480, h: Infinity },
    defaultSize: { w: SIDEBAR_R_W, h: SHELL_H },
    adaptSize:   { w: SIDEBAR_R_W, h: SHELL_H },
    resizePolicy:     ResizePolicy.FLEXIBLE,
    visibilityPolicy: VisibilityPolicy.NO_OVERFLOW,
    collapsed: true,
  });

  // ── Bottom Panel ─────────────────────────────────────────
  // Startet collapsed (h=0). Beim Expand schrumpft main.canvas via SharedEdge.
  windows['panel.bottom'] = createWindow({
    id:      'panel.bottom',
    name:    'BottomPanel',
    parentId: 'app.root',
    // y = SHELL_H → direkt am unteren Rand, h=0 = collapsed
    bounds:      { x: 0, y: SHELL_H, w: APP_W, h: 0 },
    minSize:     { w: 400, h: 0 },
    maxSize:     { w: Infinity, h: 400 },
    defaultSize: { w: APP_W, h: BOTTOM_H },
    adaptSize:   { w: APP_W, h: BOTTOM_H },
    resizePolicy:     ResizePolicy.FLEXIBLE,
    visibilityPolicy: VisibilityPolicy.NO_OVERFLOW,
    collapsed: true,
  });

  // ── Window A (in main.canvas) ────────────────────────────
  windows['window.A'] = createWindow({
    id:      'window.A',
    name:    'Window A',
    parentId: 'main.canvas',
    bounds:      { x: 0, y: 0, w: 420, h: 280 },
    minSize:     { w: 280, h: 220 },
    maxSize:     { w: 900, h: 680 },
    defaultSize: { w: 420, h: 280 },
    adaptSize:   { w: 480, h: 320 },
    resizePolicy: ResizePolicy.FLEXIBLE,
  });

  // ── Window B (in main.canvas) ────────────────────────────
  // x = Window A Breite + 14px Gap
  windows['window.B'] = createWindow({
    id:      'window.B',
    name:    'Window B',
    parentId: 'main.canvas',
    bounds:      { x: 434, y: 0, w: 390, h: 280 },
    minSize:     { w: 280, h: 220 },
    maxSize:     { w: 900, h: 680 },
    defaultSize: { w: 390, h: 280 },
    adaptSize:   { w: 520, h: 300 },
    resizePolicy: ResizePolicy.FLEXIBLE,
  });

  // ── Window A1 (verschachtelt in Window A) ────────────────
  // y = 120: Platz für Window A's eigene Header-Zone (informal)
  windows['window.A1'] = createWindow({
    id:      'window.A1',
    name:    'Window A1',
    parentId: 'window.A',
    bounds:      { x: 0, y: 120, w: 280, h: 160 },
    minSize:     { w: 180, h: 120 },
    maxSize:     { w: 600, h: 400 },
    defaultSize: { w: 280, h: 160 },
    adaptSize:   { w: 300, h: 180 },
    resizePolicy: ResizePolicy.FLEXIBLE,
  });

  // ── Floating Window (Overlay in main.canvas) ─────────────
  // overlay: true → kein Sibling-Kollisions-Check
  // Kann frei im main.canvas positioniert werden
  windows['window.floating'] = createWindow({
    id:      'window.floating',
    name:    'FloatingWindow',
    parentId: 'main.canvas',
    bounds:      { x: 40, y: 60, w: 360, h: 220 },
    minSize:     { w: 200, h: 120 },
    maxSize:     { w: 800, h: 600 },
    defaultSize: { w: 360, h: 220 },
    resizePolicy: ResizePolicy.FLEXIBLE,
    overlay:  true,
    collapsed: true,
  });

  // ── SharedEdges ──────────────────────────────────────────
  //
  // Jede SharedEdge definiert eine harte Kantenkopplung.
  // linked: true → Kantenbewegung wird in der CE propagiert.
  // linked: false → Beziehung bekannt, aber aktuell inaktiv
  //                 (z.B. wenn eine Sidebar collapsed und auf w=0 ist)
  //
  // Hinweis: Im collapsed-Zustand ist linked trotzdem true,
  // weil der Expand über ein bounds-Update auf defaultSize läuft
  // und die Propagation dann korrekt main.canvas verschiebt.

  const sharedEdges = [
    // sidebar.left.RIGHT ↔ main.canvas.LEFT
    // Sidebar breiter machen → main.canvas.x nach rechts, .w schrumpft
    createSharedEdge({
      id:      'edge.sidebarL-main',
      windowA: 'sidebar.left', edgeA: Edge.RIGHT,
      windowB: 'main.canvas',  edgeB: Edge.LEFT,
      linked:  true,
    }),

    // main.canvas.RIGHT ↔ sidebar.right.LEFT
    // sidebar.right breiter machen → main.canvas.w schrumpft
    createSharedEdge({
      id:      'edge.main-sidebarR',
      windowA: 'main.canvas',   edgeA: Edge.RIGHT,
      windowB: 'sidebar.right', edgeB: Edge.LEFT,
      linked:  true,
    }),

    // main.canvas.BOTTOM ↔ panel.bottom.TOP
    // panel.bottom aufklappen → main.canvas.h schrumpft
    createSharedEdge({
      id:      'edge.main-bottom',
      windowA: 'main.canvas',  edgeA: Edge.BOTTOM,
      windowB: 'panel.bottom', edgeB: Edge.TOP,
      linked:  true,
    }),
  ];

  return {
    windows,
    sharedEdges,

    settings: {
      snapEnabled:        true,
      snapThreshold:      8,      // px
      adjacencyTolerance: 1,      // px
      devMode:            false,
    },

    ui: {
      selectedWindowId: 'window.A',
      activeView:       'app',
      processLog:       [],
    },
  };
}
