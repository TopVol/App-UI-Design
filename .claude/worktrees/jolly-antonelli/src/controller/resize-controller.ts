/**
 * ResizeController – Modul 3 (Abschnitt 6 + 11.1)
 * Verwaltet den vollständigen Drag-Lifecycle für Resize-Operationen.
 *
 * Prinzip (Abschnitt 6.1):
 *  1. beginResize  → Snapshot aller betroffenen Zustände
 *  2. updateResize → Delta berechnen, Primärfenster updaten, Children propagieren,
 *                    Constraints validieren
 *  3. endResize    → Bei Erfolg commit, sonst rollback auf letzten gültigen Zustand
 *
 * noOverflow-Policy (Abschnitt 9.1):
 *  - Default: kein Child verlässt den sichtbaren Parent-Bereich.
 *  - Wird nach jedem update hart erzwungen.
 *
 * Frame-Throttling (Abschnitt 14, Risiko 2):
 *  - Pointer-Events werden auf requestAnimationFrame-Takt gedrosselt.
 *  - Verhindert Layout-Jitter bei schnellem Drag.
 */

import { LayoutTree, ResizeHandle } from "../types/window.types";
import {
  beginResize as engineBeginResize,
  updateResize as engineUpdateResize,
  endResize as engineEndResize,
  ResizeSession,
  SnapConfig,
  DEFAULT_SNAP_THRESHOLD_PX,
  DEFAULT_MIN_DRAG_DELTA_PX,
} from "./constraint-engine";

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

export interface ResizeControllerConfig {
  snapConfig?: SnapConfig;
  /** Modifier-Taste zum temporären Deaktivieren von Snap (Abschnitt 8.3). */
  snapDisableModifier?: "Alt" | "Shift" | "Control" | "Meta";
  /** Callback nach jedem validen Layout-Update (für Renderer). */
  onUpdate?: (tree: LayoutTree) => void;
  /** Callback nach endResize-Commit (für StateStore). */
  onCommit?: (tree: LayoutTree) => void;
  /** Callback bei Rollback wegen Constraint-Verletzung. */
  onRollback?: (tree: LayoutTree, reason: string) => void;
}

// ---------------------------------------------------------------------------
// ResizeController
// ---------------------------------------------------------------------------

export class ResizeController {
  private currentTree: LayoutTree;
  private session: ResizeSession | null = null;
  private pendingFrameId: number | null = null;
  private pendingPointer: { x: number; y: number } | null = null;
  private config: ResizeControllerConfig;

  constructor(initialTree: LayoutTree, config: ResizeControllerConfig = {}) {
    this.currentTree = initialTree;
    this.config = {
      snapConfig: {
        threshold: DEFAULT_SNAP_THRESHOLD_PX,
        enabled: true,
      },
      snapDisableModifier: "Alt",
      ...config,
    };
  }

  // -------------------------------------------------------------------------
  // Öffentliche Getter
  // -------------------------------------------------------------------------

  get tree(): LayoutTree {
    return this.currentTree;
  }

  get isResizing(): boolean {
    return this.session !== null;
  }

  // -------------------------------------------------------------------------
  // Öffentliche Methoden (API, Abschnitt 12.1)
  // -------------------------------------------------------------------------

  /**
   * Startet eine Resize-Operation.
   * @param windowId  ID des zu resizenden Fensters
   * @param handle    Welche Kante/Ecke gezogen wird
   * @param pointer   Startposition des Pointers in px
   * @param modifiers Aktuell gehaltene Modifier-Tasten
   */
  beginResize(
    windowId: string,
    handle: ResizeHandle,
    pointer: { x: number; y: number },
    modifiers: Set<string> = new Set()
  ): void {
    if (this.session) {
      // Vorherige Session sauber beenden (z. B. nach verlorenen Events)
      this._commitEnd();
    }

    const snapConfig = this._buildSnapConfig(modifiers);
    this.session = engineBeginResize(
      this.currentTree,
      windowId,
      handle,
      pointer
    );
    // Snap-Config in Session einbetten für updateResize
    this._activeSnapConfig = snapConfig;
  }

  /**
   * Aktualisiert die Resize-Position (gebunden an Pointer-Move-Events).
   * Intern gedrosselt auf requestAnimationFrame-Takt.
   */
  updateResize(
    pointer: { x: number; y: number },
    modifiers: Set<string> = new Set()
  ): void {
    if (!this.session) return;

    this._activeSnapConfig = this._buildSnapConfig(modifiers);
    this.pendingPointer = pointer;

    if (this.pendingFrameId === null) {
      this.pendingFrameId = requestAnimationFrame(() => this._flushFrame());
    }
  }

  /**
   * Beendet die Resize-Operation und committet den finalen Zustand.
   */
  endResize(modifiers: Set<string> = new Set()): void {
    if (!this.session) return;

    // Ausstehenden Frame sofort flushen
    if (this.pendingFrameId !== null) {
      cancelAnimationFrame(this.pendingFrameId);
      this.pendingFrameId = null;
    }
    if (this.pendingPointer) {
      this._applyUpdate(this.pendingPointer);
      this.pendingPointer = null;
    }

    this._commitEnd();
  }

  /**
   * Bricht die laufende Resize-Operation ab und rollt auf den
   * Snapshot-Zustand zurück.
   */
  cancelResize(reason = "Abgebrochen durch Nutzer"): void {
    if (!this.session) return;

    if (this.pendingFrameId !== null) {
      cancelAnimationFrame(this.pendingFrameId);
      this.pendingFrameId = null;
    }
    this.pendingPointer = null;

    const rollbackTree = this.session.snapshotTree;
    this.session = null;
    this.currentTree = rollbackTree;

    this.config.onRollback?.(rollbackTree, reason);
  }

  /**
   * Ersetzt den verwalteten LayoutTree (z. B. nach externem Undo).
   */
  setTree(tree: LayoutTree): void {
    if (this.session) {
      this.cancelResize("Tree extern ersetzt während Resize");
    }
    this.currentTree = tree;
  }

  // -------------------------------------------------------------------------
  // Private Hilfsmethoden
  // -------------------------------------------------------------------------

  private _activeSnapConfig: SnapConfig = { enabled: true };

  private _buildSnapConfig(modifiers: Set<string>): SnapConfig {
    const base = this.config.snapConfig ?? { enabled: true };
    const modifier = this.config.snapDisableModifier ?? "Alt";
    if (modifiers.has(modifier)) {
      return { ...base, enabled: false };
    }
    return base;
  }

  /** Wird einmal pro Animation-Frame aufgerufen (Throttling). */
  private _flushFrame(): void {
    this.pendingFrameId = null;
    if (!this.pendingPointer || !this.session) return;

    const pointer = this.pendingPointer;
    this.pendingPointer = null;
    this._applyUpdate(pointer);
  }

  /** Wendet ein einzelnes Pointer-Update auf die Engine an. */
  private _applyUpdate(pointer: { x: number; y: number }): void {
    if (!this.session) return;

    try {
      const result = engineUpdateResize(
        this.currentTree,
        this.session,
        pointer,
        this._activeSnapConfig
      );
      this.currentTree = result.tree;
      this.session = result.session;
      this.config.onUpdate?.(this.currentTree);
    } catch (err: unknown) {
      // Constraint-Verletzung → Rollback (Abschnitt 6.1)
      const message =
        err instanceof Error ? err.message : "Unbekannter Constraint-Fehler";
      const rollbackTree =
        (err as { lastValidTree?: LayoutTree }).lastValidTree ??
        this.session.snapshotTree;

      this.currentTree = rollbackTree;
      this.session = null;
      this.config.onRollback?.(rollbackTree, message);
    }
  }

  /** Committet den Endzustand nach endResize. */
  private _commitEnd(): void {
    if (!this.session) return;

    try {
      const committed = engineEndResize(
        this.currentTree,
        this.session,
        this._activeSnapConfig
      );
      this.currentTree = committed;
      this.session = null;
      this.config.onCommit?.(this.currentTree);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Commit-Fehler";
      const rollbackTree =
        (err as { lastValidTree?: LayoutTree }).lastValidTree ??
        (this.session?.snapshotTree ?? this.currentTree);

      this.currentTree = rollbackTree;
      this.session = null;
      this.config.onRollback?.(rollbackTree, message);
    }
  }
}

// ---------------------------------------------------------------------------
// NoOverflow-Guard (Abschnitt 9.1)
// ---------------------------------------------------------------------------

/**
 * Standalone-Prüfung: Gibt alle Constraint-Verletzungen zurück,
 * bei denen ein Child (noOverflow-Policy) seinen Parent verlässt.
 * Leere Liste = kein Verstoß.
 *
 * Wird ergänzend zu applyConstraints genutzt, z. B. im Dev-Modus
 * zur visuellen Darstellung von Regelverstößen.
 */
export interface OverflowViolation {
  childId: string;
  parentId: string;
  axis: "width" | "height" | "both";
  childSize: number;
  parentInnerSize: number;
}

export function detectOverflowViolations(
  tree: LayoutTree
): OverflowViolation[] {
  const violations: OverflowViolation[] = [];

  for (const node of tree.nodes.values()) {
    if (!node.parentId) continue;
    if (node.visibilityPolicy !== "noOverflow") continue;

    const parent = tree.nodes.get(node.parentId);
    if (!parent) continue;

    const widthViolation = node.currentSize.width > parent.currentSize.width;
    const heightViolation = node.currentSize.height > parent.currentSize.height;

    if (widthViolation || heightViolation) {
      violations.push({
        childId: node.id,
        parentId: node.parentId,
        axis: widthViolation && heightViolation ? "both"
          : widthViolation ? "width"
          : "height",
        childSize: widthViolation
          ? node.currentSize.width
          : node.currentSize.height,
        parentInnerSize: widthViolation
          ? parent.currentSize.width
          : parent.currentSize.height,
      });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Pointer-Event-Adapter (Browser-/Framework-unabhängig)
// ---------------------------------------------------------------------------

/**
 * Normalisiert ein beliebiges Pointer-Event auf { x, y } in px.
 * Unterstützt MouseEvent, PointerEvent und Touch-ähnliche Strukturen.
 */
export function normalizePointerEvent(
  event: MouseEvent | PointerEvent | Touch
): { x: number; y: number } {
  return { x: event.clientX, y: event.clientY };
}

/**
 * Extrahiert die aktuell gedrückten Modifier-Tasten aus einem KeyboardEvent
 * oder MouseEvent als Set<string>.
 */
export function extractModifiers(
  event: MouseEvent | PointerEvent | KeyboardEvent
): Set<string> {
  const mods = new Set<string>();
  if (event.altKey) mods.add("Alt");
  if (event.shiftKey) mods.add("Shift");
  if (event.ctrlKey) mods.add("Control");
  if (event.metaKey) mods.add("Meta");
  return mods;
}

// ---------------------------------------------------------------------------
// Hilfsfunktion: Resize-Handle aus DOM-Position berechnen
// ---------------------------------------------------------------------------

/** Toleranzbereich in px zur Erkennung einer Resize-Kante am Fensterrand. */
export const RESIZE_EDGE_TOLERANCE_PX = DEFAULT_MIN_DRAG_DELTA_PX * 4;

/**
 * Berechnet den ResizeHandle basierend auf der Pointer-Position
 * relativ zu einem Fenster-Bounding-Rect.
 * Gibt null zurück wenn der Pointer nicht in der Resize-Zone liegt.
 */
export function detectResizeHandle(
  pointer: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
  tolerance = RESIZE_EDGE_TOLERANCE_PX
): ResizeHandle | null {
  const { x, y, width, height } = rect;
  const nearLeft = pointer.x - x <= tolerance;
  const nearRight = x + width - pointer.x <= tolerance;
  const nearTop = pointer.y - y <= tolerance;
  const nearBottom = y + height - pointer.y <= tolerance;

  if (nearTop && nearLeft) return "top-left";
  if (nearTop && nearRight) return "top-right";
  if (nearBottom && nearLeft) return "bottom-left";
  if (nearBottom && nearRight) return "bottom-right";
  if (nearLeft) return "left";
  if (nearRight) return "right";
  if (nearTop) return "top";
  if (nearBottom) return "bottom";

  return null;
}
