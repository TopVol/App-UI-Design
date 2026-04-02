// ============================================================
// constants.js
// Alle Enums, Werttypen und Fehlercodes des Layout-Systems.
// Keine Logik — nur Definitionen.
// ============================================================

/** Toleranz (px): ab wann zwei Kanten als "direkt benachbart" gelten (Layout Rules §5.3) */
export const ADJACENCY_TOLERANCE  = 1;

/** Default Snap-Schwellenwert (px) (Layout Rules §8.2) */
export const SNAP_THRESHOLD_DEFAULT = 8;

/** Minimaler Drag-Delta (px) — verhindert Mikro-Jitter (Layout Rules §8.2) */
export const MIN_DRAG_DELTA = 2;

/**
 * Die sechs Werttypen pro Window (Layout Rules §3, §4.1).
 *
 * MIN / MAX      — harte Grenzen, niemals über-/unterschritten
 * DEFAULT        — Startzustand beim App-Start
 * CURRENT        — aktiver Ist-Wert (wird durch Resize, Collapse etc. gesetzt)
 * ADAPT          — Sonderwert für situationsabhängiges Aufklappen
 * PREVIOUS       — Wert vor der letzten Aktion (Grundlage für Collapse-Restore)
 */
export const ValueType = Object.freeze({
  MIN:      'minSize',
  MAX:      'maxSize',
  DEFAULT:  'defaultSize',
  CURRENT:  'currentSize',
  ADAPT:    'adaptSize',
  PREVIOUS: 'previousSize',
});

/**
 * Wie ein Window auf Größenänderungen von Parent oder Siblings reagiert.
 *
 * FIXED        — wird nie automatisch verschoben oder skaliert
 * FLEXIBLE     — darf durch die ConstraintEngine geclampd / gepusht werden
 * PROPORTIONAL — skaliert proportional mit dem Parent
 */
export const ResizePolicy = Object.freeze({
  FIXED:        'fixed',
  FLEXIBLE:     'flexible',
  PROPORTIONAL: 'proportional',
});

/**
 * Ob Children außerhalb des sichtbaren Parent-Bereichs erlaubt sind.
 *
 * NO_OVERFLOW (Default) — kein Overflow erlaubt (Layout Rules §9.1)
 * ALLOW_OVERFLOW_SCROLL — Overflow erlaubt, Parent muss ScrollContainer sein
 */
export const VisibilityPolicy = Object.freeze({
  NO_OVERFLOW:           'noOverflow',
  ALLOW_OVERFLOW_SCROLL: 'allowOverflowWithScroll',
});

/** Ob dieses Window am Snap-System teilnimmt (Layout Rules §8) */
export const SnapPolicy = Object.freeze({
  ENABLED:  'enabled',
  DISABLED: 'disabled',
});

/** Die vier Kanten eines Window-Rechtecks */
export const Edge = Object.freeze({
  LEFT:   'left',
  RIGHT:  'right',
  TOP:    'top',
  BOTTOM: 'bottom',
});

/**
 * Fehlercodes der ConstraintEngine.
 *
 * severity: 'error' → Rollback, 'warn' → auto-geclampt, Commit trotzdem möglich
 */
export const ConstraintErrorCode = Object.freeze({
  // Harte Fehler → Rollback
  INVALID_WINDOW_ID:        'INVALID_WINDOW_ID',         // unbekannte ID in proposedUpdates
  MIN_EXCEEDS_MAX:          'MIN_EXCEEDS_MAX',            // Datenfehler: min > max
  MIN_SIZE_VIOLATED:        'MIN_SIZE_VIOLATED',          // Endergebnis unterschreitet min
  MAX_SIZE_VIOLATED:        'MAX_SIZE_VIOLATED',          // Endergebnis überschreitet max
  SIBLING_OVERLAP:          'SIBLING_OVERLAP',            // Überlappung mit FIXED sibling
  OVERFLOW_POLICY_VIOLATED: 'OVERFLOW_POLICY_VIOLATED',   // FIXED child außerhalb Parent

  // Warnungen → geclampt, Commit möglich
  PARENT_BOUND_EXCEEDED:    'PARENT_BOUND_EXCEEDED',      // geclampt auf Parent-Innenbereich

  // Store-Fehler
  NOTHING_TO_UNDO:          'NOTHING_TO_UNDO',
  NOTHING_TO_REDO:          'NOTHING_TO_REDO',
});
