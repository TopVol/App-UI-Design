// ============================================================
// ConstraintEngine.js
//
// Enthält:
//   - createWindow / createSharedEdge  (Factory-Funktionen)
//   - LayoutTree                       (reine Query-Utilities über windows-Map)
//   - applyConstraints()               (der Kern-Validierungspipeline)
//   - buildCollapseUpdate()            (Collapse-Vorbereitung)
//   - buildExpandUpdate()              (Expand mit adaptSize-Logik)
//
// Keinerlei DOM-, CSS- oder Event-Logik.
// Alle Funktionen sind pure oder arbeiten auf tiefen Kopien.
// ============================================================

import {
  Edge,
  ResizePolicy,
  VisibilityPolicy,
  SnapPolicy,
  ConstraintErrorCode,
  SNAP_THRESHOLD_DEFAULT,
} from './constants.js';

// ═══════════════════════════════════════════════════════════
// Interne Pure-Utilities
// ═══════════════════════════════════════════════════════════

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/** Prüft ob zwei Bounds-Rechtecke überlappen (exclusive edges) */
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/** Gibt den numerischen Kantenwert eines Bounds-Objekts zurück */
function getEdgeValue(bounds, edge) {
  switch (edge) {
    case Edge.LEFT:   return bounds.x;
    case Edge.RIGHT:  return bounds.x + bounds.w;
    case Edge.TOP:    return bounds.y;
    case Edge.BOTTOM: return bounds.y + bounds.h;
    default: throw new Error(`[CE] Unbekannte Edge: ${edge}`);
  }
}

/**
 * Berechnet den nutzbaren Innenbereich eines Parent-Windows.
 * bounds.x/y der Children sind relativ zu diesem Innenbereich (Ursprung 0,0).
 *
 * innerPadding modelliert z.B. einen Header (top: 52) oder interne Ränder.
 */
function getParentInnerBounds(parent) {
  const p = parent.innerPadding ?? { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    w: parent.currentSize.w - p.left - p.right,
    h: parent.currentSize.h - p.top  - p.bottom,
  };
}

/**
 * Tiefe Kopie der windows-Map.
 * Wird am Anfang jedes applyConstraints-Aufrufs erzeugt,
 * damit das ursprüngliche State-Objekt nie mutiert wird.
 */
function cloneWindows(windows) {
  const out = {};
  for (const [id, w] of Object.entries(windows)) {
    out[id] = {
      ...w,
      bounds:       { ...w.bounds },
      minSize:      { ...w.minSize },
      maxSize:      { ...w.maxSize },
      defaultSize:  { ...w.defaultSize },
      currentSize:  { ...w.currentSize },
      adaptSize:    { ...w.adaptSize },
      previousSize: { ...w.previousSize },
      innerPadding: w.innerPadding
        ? { ...w.innerPadding }
        : { top: 0, right: 0, bottom: 0, left: 0 },
      metadata: { ...w.metadata },
    };
  }
  return out;
}

// ═══════════════════════════════════════════════════════════
// Factory-Funktionen
// ═══════════════════════════════════════════════════════════

/**
 * Erzeugt ein vollständiges, valides Window-Objekt.
 * Alle Fehlenden Größen-Werte werden sinnvoll aus bounds abgeleitet.
 *
 * @param {Object} opts
 *   id, name, parentId, bounds, minSize, maxSize,
 *   defaultSize, currentSize, adaptSize, previousSize,
 *   innerPadding, visibilityPolicy, resizePolicy, snapPolicy,
 *   collapsed, overlay, metadata
 */
export function createWindow({
  id,
  name,
  parentId         = null,
  bounds           = { x: 0, y: 0, w: 0, h: 0 },
  minSize          = { w: 0, h: 0 },
  maxSize          = { w: Infinity, h: Infinity },
  defaultSize      = null,
  currentSize      = null,
  adaptSize        = null,
  previousSize     = null,
  innerPadding     = { top: 0, right: 0, bottom: 0, left: 0 },
  visibilityPolicy = VisibilityPolicy.NO_OVERFLOW,
  resizePolicy     = ResizePolicy.FLEXIBLE,
  snapPolicy       = SnapPolicy.ENABLED,
  collapsed        = false,
  overlay          = false,   // true → Sibling-Kollisions-Check überspringen
  metadata         = {},
}) {
  const ds = defaultSize  ?? { w: bounds.w, h: bounds.h };
  const cs = currentSize  ?? { ...ds };
  const as = adaptSize    ?? { ...ds };
  const ps = previousSize ?? { ...cs };

  // Unveränderliches Objekt zurückgeben
  return Object.freeze({
    id, name, parentId,
    bounds:       { ...bounds },
    minSize:      { ...minSize },
    maxSize:      { ...maxSize },
    defaultSize:  { ...ds },
    currentSize:  { ...cs },
    adaptSize:    { ...as },
    previousSize: { ...ps },
    innerPadding: { ...innerPadding },
    visibilityPolicy,
    resizePolicy,
    snapPolicy,
    collapsed,
    overlay,
    metadata: { devLabelVisible: false, ...metadata },
  });
}

/**
 * Erzeugt eine SharedEdge-Definition.
 *
 * Eine SharedEdge beschreibt eine direkte Kantenbeziehung zwischen zwei Windows:
 * Wenn windowA.edgeA sich bewegt, muss windowB.edgeB um denselben Delta folgen.
 *
 * Beispiel: sidebar.left.RIGHT ist gelinkt mit main.canvas.LEFT.
 * → Wird sidebar.left breiter, wird main.canvas.x nach rechts verschoben.
 *
 * linked: false → die Beziehung ist definiert aber nicht aktiv
 *   (z.B. wenn eine Sidebar eingeklappt ist)
 */
export function createSharedEdge({ id, windowA, edgeA, windowB, edgeB, linked = true }) {
  return Object.freeze({ id, windowA, edgeA, windowB, edgeB, linked });
}

// ═══════════════════════════════════════════════════════════
// LayoutTree — reine Query-Funktionen über die windows-Map
// ═══════════════════════════════════════════════════════════

export const LayoutTree = {

  getParent(windows, id) {
    const w = windows[id];
    if (!w?.parentId) return null;
    return windows[w.parentId] ?? null;
  },

  getChildren(windows, parentId) {
    return Object.values(windows).filter(w => w.parentId === parentId);
  },

  getSiblings(windows, id) {
    const w = windows[id];
    if (!w) return [];
    return Object.values(windows).filter(
      s => s.parentId === w.parentId && s.id !== id
    );
  },

  getDescendants(windows, id) {
    const result = [];
    const queue  = [id];
    while (queue.length) {
      const cur      = queue.shift();
      const children = LayoutTree.getChildren(windows, cur);
      for (const child of children) {
        result.push(child);
        queue.push(child.id);
      }
    }
    return result;
  },

  /**
   * Gibt alle Window-IDs in topologischer Reihenfolge zurück:
   * Parents kommen immer vor ihren Children.
   * Wird benötigt damit Step 1+2 des Constraint-Passes Parents zuerst verarbeitet.
   */
  topologicalOrder(windows) {
    const visited = new Set();
    const result  = [];

    function visit(id) {
      if (visited.has(id)) return;
      visited.add(id);
      const w = windows[id];
      if (w?.parentId && windows[w.parentId]) {
        visit(w.parentId);
      }
      result.push(id);
    }

    for (const id of Object.keys(windows)) visit(id);
    return result;
  },

  /** Gibt alle SharedEdges zurück, an denen windowId beteiligt ist */
  getLinkedEdges(sharedEdges, windowId) {
    return sharedEdges.filter(
      e => e.linked && (e.windowA === windowId || e.windowB === windowId)
    );
  },
};

// ═══════════════════════════════════════════════════════════
// Shared-Edge-Propagation
// ═══════════════════════════════════════════════════════════

/**
 * Propagiert Kantenbewegungen über verlinkte SharedEdges.
 *
 * Wenn sidebar.left.RIGHT sich um +50px bewegt, wird main.canvas.LEFT
 * ebenfalls um +50px verschoben (bounds.x += 50, bounds.w -= 50).
 *
 * Mutiert workingWindows in-place.
 * Erweitert affectedSet um alle neu betroffenen Window-IDs.
 *
 * @param {Object} workingWindows  — veränderliche Arbeitskopie
 * @param {Object} originalBounds  — { [id]: bounds } Snapshot VOR den Updates
 * @param {Array}  sharedEdges     — SharedEdge-Definitionen aus dem State
 * @param {Object} proposedUpdates — { [id]: { bounds? } }
 * @param {Set}    affectedSet     — wird mit neuen IDs erweitert
 */
function propagateSharedEdges(
  workingWindows,
  originalBounds,
  sharedEdges,
  proposedUpdates,
  affectedSet,
) {
  for (const [windowId, update] of Object.entries(proposedUpdates)) {
    if (!update.bounds) continue;

    const orig = originalBounds[windowId];
    const curr = workingWindows[windowId]?.bounds;
    if (!orig || !curr) continue;

    for (const edge of LayoutTree.getLinkedEdges(sharedEdges, windowId)) {
      const isA       = edge.windowA === windowId;
      const myEdge    = isA ? edge.edgeA : edge.edgeB;
      const theirId   = isA ? edge.windowB : edge.windowA;
      const theirEdge = isA ? edge.edgeB : edge.edgeA;

      const them = workingWindows[theirId];
      if (!them) continue;

      const delta =
        getEdgeValue(curr, myEdge) - getEdgeValue(orig, myEdge);

      if (Math.abs(delta) < Number.EPSILON) continue;

      _applyEdgeDelta(them, theirEdge, delta);
      affectedSet.add(theirId);
    }
  }
}

/**
 * Verschiebt eine Kante eines Windows um delta (mutiert bounds in-place).
 *
 * LEFT  +delta → x wächst, w schrumpft  (linker Rand schiebt nach rechts)
 * RIGHT +delta → w wächst               (rechter Rand schiebt nach rechts)
 * TOP   +delta → y wächst, h schrumpft
 * BOTTOM+delta → h wächst
 */
function _applyEdgeDelta(w, edge, delta) {
  switch (edge) {
    case Edge.LEFT:
      w.bounds.x += delta;
      w.bounds.w -= delta;
      break;
    case Edge.RIGHT:
      w.bounds.w += delta;
      break;
    case Edge.TOP:
      w.bounds.y += delta;
      w.bounds.h -= delta;
      break;
    case Edge.BOTTOM:
      w.bounds.h += delta;
      break;
  }
  w.currentSize = { w: w.bounds.w, h: w.bounds.h };
}

// ═══════════════════════════════════════════════════════════
// Sibling-Kollision
// ═══════════════════════════════════════════════════════════

/**
 * Schiebt ein FLEXIBLE Sibling so weit weg, dass die Überlappung aufgelöst ist.
 * Auflösung erfolgt auf der Achse mit der kleineren Durchdringungstiefe.
 * Mutiert sibling.bounds in-place.
 */
function pushSibling(aggressorBounds, sibling) {
  const overlapX =
    Math.min(aggressorBounds.x + aggressorBounds.w, sibling.bounds.x + sibling.bounds.w) -
    Math.max(aggressorBounds.x, sibling.bounds.x);

  const overlapY =
    Math.min(aggressorBounds.y + aggressorBounds.h, sibling.bounds.y + sibling.bounds.h) -
    Math.max(aggressorBounds.y, sibling.bounds.y);

  if (overlapX <= overlapY) {
    // X-Achse: Sibling nach links oder rechts schieben
    sibling.bounds.x +=
      sibling.bounds.x < aggressorBounds.x ? -overlapX : overlapX;
  } else {
    // Y-Achse: Sibling nach oben oder unten schieben
    sibling.bounds.y +=
      sibling.bounds.y < aggressorBounds.y ? -overlapY : overlapY;
  }
  sibling.currentSize = { w: sibling.bounds.w, h: sibling.bounds.h };
}

// ═══════════════════════════════════════════════════════════
// Snap
// ═══════════════════════════════════════════════════════════

/**
 * Sammelt alle relevanten Snap-Zielwerte für ein gegebenes Window.
 * Quellen: Kanten des Parent-Innenbereichs + Kanten aller Siblings.
 */
function collectSnapTargets(workingWindows, windowId, parent) {
  const targets = [];

  if (parent) {
    const pib = getParentInnerBounds(parent);
    targets.push({ axis: 'x', value: 0      });   // parent inner left
    targets.push({ axis: 'x', value: pib.w  });   // parent inner right
    targets.push({ axis: 'y', value: 0      });   // parent inner top
    targets.push({ axis: 'y', value: pib.h  });   // parent inner bottom
  }

  for (const sib of LayoutTree.getSiblings(workingWindows, windowId)) {
    targets.push({ axis: 'x', value: sib.bounds.x              });
    targets.push({ axis: 'x', value: sib.bounds.x + sib.bounds.w });
    targets.push({ axis: 'y', value: sib.bounds.y              });
    targets.push({ axis: 'y', value: sib.bounds.y + sib.bounds.h });
  }

  return targets;
}

/**
 * Rastet die Kanten eines Windows an nahegelegenen Snap-Zielen ein.
 * Prüft alle vier Kanten (left, right, top, bottom).
 * Mutiert w.bounds in-place.
 */
function applySnap(w, snapTargets, threshold) {
  for (const { axis, value } of snapTargets) {
    if (axis === 'x') {
      if (Math.abs(w.bounds.x - value) < threshold)
        w.bounds.x = value;
      else if (Math.abs((w.bounds.x + w.bounds.w) - value) < threshold)
        w.bounds.x = value - w.bounds.w;
    } else {
      if (Math.abs(w.bounds.y - value) < threshold)
        w.bounds.y = value;
      else if (Math.abs((w.bounds.y + w.bounds.h) - value) < threshold)
        w.bounds.y = value - w.bounds.h;
    }
  }
  w.currentSize = { w: w.bounds.w, h: w.bounds.h };
}

// ═══════════════════════════════════════════════════════════
// applyConstraints — Haupt-API der ConstraintEngine
// ═══════════════════════════════════════════════════════════

/**
 * Validiert und passt vorgeschlagene Bounds-Änderungen gegen alle Layout-Regeln an.
 *
 * Rückgabe bei Erfolg:
 *   { ok: true,  state: <neuer validierter State>, errors: [...warnings] }
 *
 * Rückgabe bei Fehler:
 *   { ok: false, state: null, errors: [...errors] }
 *
 * Der zurückgegebene State wird NIE automatisch committed.
 * Caller (StateStore) entscheidet über Commit oder Verwerfen.
 *
 * ─── Validierungsreihenfolge (Layout Rules §5.1) ───────────────────────────
 *   0. Input-Validierung (unbekannte IDs)
 *   0.1 Working-Copy aufbauen, proposedUpdates anwenden
 *   0.2 SharedEdge-Propagation
 *
 *   1. Parent-Grenzen anwenden (+ Position clampen)
 *   2. min/max clampen
 *   3. Sibling-Kollisionen auflösen
 *   4. Overflow-Policy auf Children anwenden
 *   5. Snap
 *   6. Finale Validierung → Commit oder Rollback
 *
 * @param {Object} state             — aktueller (unveränderlicher) State
 * @param {Object} proposedUpdates   — { [windowId]: { bounds?: Partial<{x,y,w,h}> } }
 * @param {Object} options
 *   @param {boolean} options.snapOverride     — wenn true: Snap überspringen
 *   @param {Object}  options.viewportBounds   — { w, h } für Root-Window-Constraints
 *
 * @returns {{ ok: boolean, state: Object|null, errors: ConstraintViolation[] }}
 */
export function applyConstraints(state, proposedUpdates, options = {}) {
  const {
    snapOverride   = false,
    viewportBounds = { w: Infinity, h: Infinity },
  } = options;

  const errors = [];

  // ── 0. Input-Validierung ──────────────────────────────────────────────────
  for (const windowId of Object.keys(proposedUpdates)) {
    if (!state.windows[windowId]) {
      errors.push({
        code:     ConstraintErrorCode.INVALID_WINDOW_ID,
        windowId,
        severity: 'error',
        detail:   `Window '${windowId}' existiert nicht im State`,
      });
    }
  }
  if (errors.length) return { ok: false, state: null, errors };

  // ── 0.1 Working-Copy + Original-Bounds-Snapshot ──────────────────────────
  const workingWindows = cloneWindows(state.windows);
  const originalBounds = {};
  for (const id of Object.keys(state.windows)) {
    originalBounds[id] = { ...state.windows[id].bounds };
  }

  for (const [windowId, update] of Object.entries(proposedUpdates)) {
    const w = workingWindows[windowId];
    if (update.bounds) {
      w.bounds      = { ...w.bounds, ...update.bounds };
      w.currentSize = { w: w.bounds.w, h: w.bounds.h };
    }
  }

  // ── 0.2 SharedEdge-Propagation ────────────────────────────────────────────
  const affectedSet = new Set(Object.keys(proposedUpdates));
  propagateSharedEdges(
    workingWindows,
    originalBounds,
    state.sharedEdges,
    proposedUpdates,
    affectedSet,
  );

  // Verarbeitungsreihenfolge: Parents vor Children
  const ordered = LayoutTree
    .topologicalOrder(workingWindows)
    .filter(id => affectedSet.has(id));

  // ── Step 1 + 2: Parent-Grenzen + min/max clamp ───────────────────────────
  for (const windowId of ordered) {
    const w      = workingWindows[windowId];
    const parent = LayoutTree.getParent(workingWindows, windowId);

    let availW, availH;

    if (parent) {
      const pib = getParentInnerBounds(parent);
      availW = pib.w;
      availH = pib.h;
      // Position auf Parent-Innenbereich begrenzen
      w.bounds.x = clamp(w.bounds.x, 0, Math.max(0, availW - w.minSize.w));
      w.bounds.y = clamp(w.bounds.y, 0, Math.max(0, availH - w.minSize.h));
    } else {
      // Root-Window: Viewport als Parent
      availW = viewportBounds.w;
      availH = viewportBounds.h;
      w.bounds.x = clamp(w.bounds.x, 0, Math.max(0, availW - w.minSize.w));
      w.bounds.y = clamp(w.bounds.y, 0, Math.max(0, availH - w.minSize.h));
    }

    // Effektives Maximum = min(window.maxSize, verbleibender Platz ab Position)
    const effectiveMaxW = Math.min(w.maxSize.w, availW - w.bounds.x);
    const effectiveMaxH = Math.min(w.maxSize.h, availH - w.bounds.y);

    const newW = clamp(w.bounds.w, w.minSize.w, effectiveMaxW);
    const newH = clamp(w.bounds.h, w.minSize.h, effectiveMaxH);

    if (newW !== w.bounds.w || newH !== w.bounds.h) {
      errors.push({
        code:     ConstraintErrorCode.PARENT_BOUND_EXCEEDED,
        windowId,
        severity: 'warn',
        detail:   `Geclampt: ${w.bounds.w}×${w.bounds.h} → ${newW}×${newH} (verfügbar: ${availW - w.bounds.x}×${availH - w.bounds.y})`,
        original: { w: w.bounds.w, h: w.bounds.h },
        clamped:  { w: newW, h: newH },
      });
    }

    w.bounds.w    = newW;
    w.bounds.h    = newH;
    w.currentSize = { w: newW, h: newH };

    // Daten-Integritätsprüfung: min darf nie > max sein
    if (w.minSize.w > w.maxSize.w || w.minSize.h > w.maxSize.h) {
      errors.push({
        code:     ConstraintErrorCode.MIN_EXCEEDS_MAX,
        windowId,
        severity: 'error',
        detail:   `min(${w.minSize.w}×${w.minSize.h}) > max(${w.maxSize.w}×${w.maxSize.h})`,
      });
    }
  }

  if (_hasError(errors)) return { ok: false, state: null, errors };

  // ── Step 3: Sibling-Kollisionsauflösung ──────────────────────────────────
  for (const windowId of ordered) {
    const w = workingWindows[windowId];
    if (w.overlay) continue;   // Overlays sind von Kollisionsregeln befreit

    for (const sibling of LayoutTree.getSiblings(workingWindows, windowId)) {
      if (sibling.overlay) continue;
      if (!rectsOverlap(w.bounds, sibling.bounds)) continue;

      if (sibling.resizePolicy === ResizePolicy.FLEXIBLE) {
        // Flexible Siblings werden weggeschoben und erneut validiert
        pushSibling(w.bounds, sibling);
        affectedSet.add(sibling.id);
      } else {
        // FIXED Sibling kann nicht verschoben werden → harter Fehler
        errors.push({
          code:     ConstraintErrorCode.SIBLING_OVERLAP,
          windowId,
          severity: 'error',
          detail:   `'${windowId}' überschneidet FIXED Sibling '${sibling.id}'`,
        });
      }
    }
  }

  if (_hasError(errors)) return { ok: false, state: null, errors };

  // ── Step 4: Overflow-Policy — Children betroffener Windows ───────────────
  for (const windowId of ordered) {
    const w        = workingWindows[windowId];
    const children = LayoutTree.getChildren(workingWindows, windowId);

    for (const child of children) {
      if (child.visibilityPolicy === VisibilityPolicy.ALLOW_OVERFLOW_SCROLL) continue;

      const pib      = getParentInnerBounds(w);
      const overflow =
        (child.bounds.x + child.bounds.w) > pib.w ||
        (child.bounds.y + child.bounds.h) > pib.h;

      if (!overflow) continue;

      if (child.resizePolicy === ResizePolicy.FLEXIBLE) {
        const newW = Math.min(child.bounds.w, Math.max(child.minSize.w, pib.w - child.bounds.x));
        const newH = Math.min(child.bounds.h, Math.max(child.minSize.h, pib.h - child.bounds.y));
        child.bounds.w    = newW;
        child.bounds.h    = newH;
        child.currentSize = { w: newW, h: newH };
        affectedSet.add(child.id);
        errors.push({
          code:     ConstraintErrorCode.OVERFLOW_POLICY_VIOLATED,
          windowId: child.id,
          severity: 'warn',
          detail:   `Child '${child.id}' aus '${windowId}' herausgeclampt auf ${newW}×${newH}`,
        });
      } else {
        errors.push({
          code:     ConstraintErrorCode.OVERFLOW_POLICY_VIOLATED,
          windowId: child.id,
          severity: 'error',
          detail:   `FIXED Child '${child.id}' überläuft '${windowId}' — kein Auto-Clamp möglich`,
        });
      }
    }
  }

  if (_hasError(errors)) return { ok: false, state: null, errors };

  // ── Step 5: Snap ─────────────────────────────────────────────────────────
  if (!snapOverride && state.settings.snapEnabled) {
    const threshold = state.settings.snapThreshold ?? SNAP_THRESHOLD_DEFAULT;

    for (const windowId of affectedSet) {
      const w = workingWindows[windowId];
      if (w.snapPolicy === SnapPolicy.DISABLED) continue;

      const parent  = LayoutTree.getParent(workingWindows, windowId);
      const targets = collectSnapTargets(workingWindows, windowId, parent);
      applySnap(w, targets, threshold);
    }
  }

  // ── Step 6: Finale Härtepruüfung ─────────────────────────────────────────
  for (const windowId of affectedSet) {
    const w = workingWindows[windowId];

    if (w.currentSize.w < w.minSize.w || w.currentSize.h < w.minSize.h) {
      errors.push({
        code:     ConstraintErrorCode.MIN_SIZE_VIOLATED,
        windowId,
        severity: 'error',
        detail:   `Endgröße ${w.currentSize.w}×${w.currentSize.h} < min ${w.minSize.w}×${w.minSize.h}`,
      });
    }

    if (
      w.currentSize.w > w.maxSize.w ||
      (w.currentSize.h > w.maxSize.h && w.maxSize.h !== Infinity)
    ) {
      errors.push({
        code:     ConstraintErrorCode.MAX_SIZE_VIOLATED,
        windowId,
        severity: 'error',
        detail:   `Endgröße ${w.currentSize.w}×${w.currentSize.h} > max ${w.maxSize.w}×${w.maxSize.h}`,
      });
    }
  }

  if (_hasError(errors)) return { ok: false, state: null, errors };

  // ── Commit: neuen State aufbauen (Caller committed über StateStore) ────────
  const newState = { ...state, windows: workingWindows };
  return { ok: true, state: newState, errors };  // errors = ggf. nur Warnungen
}

function _hasError(errors) {
  return errors.some(e => e.severity === 'error');
}

// ═══════════════════════════════════════════════════════════
// Collapse / Expand — proposedUpdates-Builder
// ═══════════════════════════════════════════════════════════

/**
 * Erzeugt ein proposedUpdates-Objekt für das Einklappen eines Windows.
 *
 * Layout Rules §7.2:
 *   - previousSize des übergeordneten Bereichs laden und wiederherstellen
 *   - In der Praxis: das Window selbst schrumpft auf minSize.h
 *   - Parent-Propagation erfolgt durch SharedEdges + Steps 3/4 der CE
 *
 * Caller muss previousSize VOR dem Aufruf sichern (→ StateStore.collapseWindow).
 * Gibt null zurück wenn das Window bereits collapsed ist.
 */
export function buildCollapseUpdate(state, windowId) {
  const w = state.windows[windowId];
  if (!w || w.collapsed) return null;

  return {
    [windowId]: {
      bounds: { ...w.bounds, h: w.minSize.h },
    },
  };
}

/**
 * Erzeugt ein proposedUpdates-Objekt für das Aufklappen eines Windows.
 *
 * Layout Rules §7.1 — Zielgröße-Entscheidung:
 *   Wenn parent.currentSize > parent.defaultSize
 *     → orientiere an child.adaptSize  (Umgebungsanpassung)
 *   sonst
 *     → orientiere an child.defaultSize (Standardwert)
 *
 * Gibt null zurück wenn das Window nicht collapsed ist.
 */
export function buildExpandUpdate(state, windowId) {
  const w = state.windows[windowId];
  if (!w || !w.collapsed) return null;

  const parent   = w.parentId ? state.windows[w.parentId] : null;
  const useAdapt =
    parent && (
      parent.currentSize.w > parent.defaultSize.w ||
      parent.currentSize.h > parent.defaultSize.h
    );

  const target = useAdapt ? w.adaptSize : w.defaultSize;

  return {
    [windowId]: {
      bounds: { ...w.bounds, w: target.w, h: target.h },
    },
  };
}
