// ============================================================
// StateStore.js
//
// Zentrale Quelle der Wahrheit für den gesamten App-State.
//
// Prinzipien:
//   - Einziger Weg zur State-Mutation: commit()
//   - Jede Layout-Mutation geht durch applyConstraints()
//   - Undo/Redo über unveränderliche Snapshots
//   - Subscriber werden nach jedem Commit synchron benachrichtigt
//
// Keinerlei DOM-, CSS- oder Event-Logik.
// ============================================================

import { ConstraintErrorCode } from './constants.js';
import {
  applyConstraints,
  buildCollapseUpdate,
  buildExpandUpdate,
} from './ConstraintEngine.js';

export class StateStore {
  #state;
  #undoStack   = [];
  #redoStack   = [];
  #maxHistory;
  #subscribers = new Set();

  /**
   * @param {Object} initialState  — Ergebnis von createInitialState()
   * @param {number} maxHistory    — Max. Anzahl Undo-Schritte (default: 50)
   */
  constructor(initialState, maxHistory = 50) {
    this.#state      = initialState;
    this.#maxHistory = maxHistory;
  }

  // ═══════════════════════════════════════════════════════
  // Read
  // ═══════════════════════════════════════════════════════

  /** Aktueller gesamter State (unveränderliche Referenz) */
  getState() {
    return this.#state;
  }

  /** Einzelnes Window per ID, oder null wenn nicht gefunden */
  getWindow(id) {
    return this.#state.windows[id] ?? null;
  }

  /**
   * Vollständige Diagnose-Daten eines Windows.
   * Alle sechs Werttypen + Policies + collapsed-Flag.
   * Rückgabe: tiefe Kopie (sicher zum Weitergeben an UI/DevOverlay).
   */
  getWindowDiagnostics(id) {
    const w = this.getWindow(id);
    if (!w) return null;
    return {
      id,
      name:             w.name,
      parentId:         w.parentId,
      bounds:           { ...w.bounds },
      minSize:          { ...w.minSize },
      maxSize:          { ...w.maxSize },
      defaultSize:      { ...w.defaultSize },
      currentSize:      { ...w.currentSize },
      adaptSize:        { ...w.adaptSize },
      previousSize:     { ...w.previousSize },
      visibilityPolicy: w.visibilityPolicy,
      resizePolicy:     w.resizePolicy,
      snapPolicy:       w.snapPolicy,
      collapsed:        w.collapsed,
      overlay:          w.overlay,
    };
  }

  canUndo() { return this.#undoStack.length > 0; }
  canRedo() { return this.#redoStack.length > 0; }

  // ═══════════════════════════════════════════════════════
  // Subscribe
  // ═══════════════════════════════════════════════════════

  /**
   * Subscriber wird nach jedem erfolgreichen Commit aufgerufen.
   * Wird verwendet von View-Layer und DevOverlay.
   *
   * @param {(newState: Object, prevState: Object) => void} callback
   * @returns {() => void} Unsubscribe-Funktion
   */
  subscribe(callback) {
    this.#subscribers.add(callback);
    return () => this.#subscribers.delete(callback);
  }

  // ═══════════════════════════════════════════════════════
  // Commit (einziger Mutations-Pfad)
  // ═══════════════════════════════════════════════════════

  /**
   * Nimmt einen von applyConstraints() zurückgegebenen validierten State an
   * und persistiert ihn. Schiebt alten State auf den Undo-Stack.
   *
   * Darf AUSSCHLIESSLICH mit dem result.state aus applyConstraints() aufgerufen
   * werden, nie mit manuell zusammengesetzten Objekten.
   *
   * Ausnahme: setSizeValue() committet direkt, weil CE keine Bounds ändert.
   *
   * @param {Object} newState
   * @returns {{ ok: boolean }}
   */
  commit(newState) {
    this.#undoStack.push(this.#state);
    if (this.#undoStack.length > this.#maxHistory) {
      this.#undoStack.shift();
    }
    this.#redoStack = [];
    const prev = this.#state;
    this.#state = newState;
    this.#notify(prev);
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════
  // Undo / Redo
  // ═══════════════════════════════════════════════════════

  undo() {
    if (!this.#undoStack.length) {
      return { ok: false, error: ConstraintErrorCode.NOTHING_TO_UNDO };
    }
    this.#redoStack.push(this.#state);
    const prev  = this.#state;
    this.#state = this.#undoStack.pop();
    this.#notify(prev);
    return { ok: true };
  }

  redo() {
    if (!this.#redoStack.length) {
      return { ok: false, error: ConstraintErrorCode.NOTHING_TO_REDO };
    }
    this.#undoStack.push(this.#state);
    const prev  = this.#state;
    this.#state = this.#redoStack.pop();
    this.#notify(prev);
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════
  // Layout-Mutationen (alle über CE)
  // ═══════════════════════════════════════════════════════

  /**
   * Resize: Ändert Bounds eines Windows. Sämtliche Constraints werden geprüft.
   *
   * Wird vom ResizeController aufgerufen, der die Pointer-Deltas berechnet.
   *
   * @param {string} windowId
   * @param {{ x?, y?, w?, h? }} boundsChange  — Partial-Bounds-Update
   * @param {{ snapOverride?, viewportBounds? }} options
   * @returns {{ ok: boolean, state?, errors? }}
   */
  resizeWindow(windowId, boundsChange, options = {}) {
    const result = applyConstraints(
      this.#state,
      { [windowId]: { bounds: boundsChange } },
      options,
    );
    if (!result.ok) return result;
    return { ...this.commit(result.state), errors: result.errors };
  }

  /**
   * Move: Verschiebt ein Window (ändert x/y, nicht w/h).
   * Läuft durch dieselbe CE-Pipeline (Parent-Bounds, Overflow, Snap).
   *
   * @param {string} windowId
   * @param {{ x: number, y: number }} position
   * @param {Object} options
   */
  moveWindow(windowId, position, options = {}) {
    return this.resizeWindow(windowId, position, options);
  }

  /**
   * Collapse: Klappt ein Window auf minSize.h ein.
   *
   * Layout Rules §7.2:
   *   1. previousSize wird gesichert
   *   2. Window schrumpft auf minSize.h
   *   3. SharedEdge-Propagation verschiebt benachbarte Windows automatisch
   *
   * @param {string} windowId
   * @param {Object} options
   */
  collapseWindow(windowId, options = {}) {
    const w = this.getWindow(windowId);
    if (!w)          return { ok: false, error: ConstraintErrorCode.INVALID_WINDOW_ID };
    if (w.collapsed) return { ok: false, error: 'ALREADY_COLLAPSED' };

    // previousSize VOR dem Collapse sichern
    const stateWithPrev = this.#patchWindow(windowId, {
      previousSize: { ...w.currentSize },
    });

    const proposed = buildCollapseUpdate(stateWithPrev, windowId);
    if (!proposed) return { ok: false, error: 'BUILD_COLLAPSE_FAILED' };

    const result = applyConstraints(stateWithPrev, proposed, options);
    if (!result.ok) return result;

    // Semantisches Flag setzen (nicht Aufgabe der CE)
    result.state.windows[windowId].collapsed = true;
    return { ...this.commit(result.state), errors: result.errors };
  }

  /**
   * Expand: Klappt ein Window auf default- oder adaptSize auf.
   *
   * Layout Rules §7.1:
   *   - Wenn parent.currentSize > parent.defaultSize → adaptSize verwenden
   *   - Sonst → defaultSize verwenden
   *
   * @param {string} windowId
   * @param {Object} options
   */
  expandWindow(windowId, options = {}) {
    const w = this.getWindow(windowId);
    if (!w)           return { ok: false, error: ConstraintErrorCode.INVALID_WINDOW_ID };
    if (!w.collapsed) return { ok: false, error: 'NOT_COLLAPSED' };

    const proposed = buildExpandUpdate(this.#state, windowId);
    if (!proposed) return { ok: false, error: 'BUILD_EXPAND_FAILED' };

    const result = applyConstraints(this.#state, proposed, options);
    if (!result.ok) return result;

    result.state.windows[windowId].collapsed = false;
    return { ...this.commit(result.state), errors: result.errors };
  }

  /**
   * Setzt einen der Konfigurationswerte (min/max/default/adapt/previous).
   *
   * Ändert keine Bounds — kein CE-Durchlauf nötig.
   * Prüft aber: minSize darf nicht > maxSize sein.
   *
   * @param {string} windowId
   * @param {string} valueType  — 'minSize' | 'maxSize' | 'defaultSize' | 'adaptSize' | 'previousSize'
   * @param {{ w: number, h: number }} size
   */
  setSizeValue(windowId, valueType, size) {
    const allowed = ['minSize', 'maxSize', 'defaultSize', 'adaptSize', 'previousSize'];
    if (!allowed.includes(valueType)) {
      return { ok: false, error: 'INVALID_VALUE_TYPE' };
    }

    const w = this.getWindow(windowId);
    if (!w) return { ok: false, error: ConstraintErrorCode.INVALID_WINDOW_ID };

    const newMin = valueType === 'minSize' ? size : w.minSize;
    const newMax = valueType === 'maxSize' ? size : w.maxSize;

    if (newMin.w > newMax.w || newMin.h > newMax.h) {
      return {
        ok:    false,
        error: ConstraintErrorCode.MIN_EXCEEDS_MAX,
        detail: `min(${newMin.w}×${newMin.h}) > max(${newMax.w}×${newMax.h})`,
      };
    }

    const newState = this.#patchWindow(windowId, { [valueType]: { ...size } });
    return this.commit(newState);
  }

  /**
   * Ändert Snap- und Threshold-Einstellungen.
   * Betrifft alle zukünftigen applyConstraints-Aufrufe.
   */
  updateSettings(patch) {
    const newState = {
      ...this.#state,
      settings: { ...this.#state.settings, ...patch },
    };
    return this.commit(newState);
  }

  // ═══════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════

  /**
   * Erzeugt einen neuen State mit einem Partial-Patch auf ein einzelnes Window.
   * KEINE CE-Validierung — nur für interne Vor-/Nachbereitungsschritte.
   *
   * @private
   */
  #patchWindow(windowId, patch) {
    return {
      ...this.#state,
      windows: {
        ...this.#state.windows,
        [windowId]: { ...this.#state.windows[windowId], ...patch },
      },
    };
  }

  #notify(prevState) {
    for (const cb of this.#subscribers) {
      try {
        cb(this.#state, prevState);
      } catch (e) {
        console.error('[StateStore] Subscriber-Fehler:', e);
      }
    }
  }
}
