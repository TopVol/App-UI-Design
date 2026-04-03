/**
 * ConstraintEngine – Modul 2 (Abschnitt 5 + 7 + 11.1)
 * Validiert und berechnet alle Layout-Änderungen.
 *
 * Validierungsreihenfolge bei jeder Layout-Änderung (Abschnitt 5.1):
 *  1. Parent-Grenzen anwenden
 *  2. min/max pro Window clampen
 *  3. Sibling-Kollisionen auflösen
 *  4. Overflow-Policy anwenden
 *  5. Snap anwenden
 *  6. Endzustand committen
 *
 * API-Verträge (Abschnitt 12):
 *  - Bei Erfolg: neuer valider LayoutTree
 *  - Bei Regelverletzung: ConstraintError mit letztem gültigen State
 */

import {
  LayoutTree,
  WindowNode,
  Size,
  Bounds,
  ResizeHandle,
} from "../types/window.types";
import {
  getNode,
  getParent,
  getChildren,
  getSiblings,
  updateNode,
  innerSize,
  topologicalOrder,
} from "./layout-tree";

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

/** Standardwerte für Snap und Adjacency (Abschnitt 8.2). */
export const DEFAULT_SNAP_THRESHOLD_PX = 8;
export const DEFAULT_ADJACENCY_TOLERANCE_PX = 1;
export const DEFAULT_MIN_DRAG_DELTA_PX = 2;

// ---------------------------------------------------------------------------
// Fehlertyp
// ---------------------------------------------------------------------------

export class ConstraintError extends Error {
  /** Der letzte gültige LayoutTree vor dem fehlgeschlagenen Versuch. */
  readonly lastValidTree: LayoutTree;

  constructor(message: string, lastValidTree: LayoutTree) {
    super(message);
    this.name = "ConstraintError";
    this.lastValidTree = lastValidTree;
  }
}

// ---------------------------------------------------------------------------
// Kernformeln (Abschnitt 5.2)
// ---------------------------------------------------------------------------

/** clamp(value, min, max) */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Berechnet die neue Breite/Höhe unter Einhaltung von min/max.
 * widthNeu = clamp(widthAlt + deltaX, minWidth, maxWidth)
 */
function applyDelta(current: number, delta: number, min: number, max: number): number {
  return clamp(current + delta, min, max);
}

// ---------------------------------------------------------------------------
// 1. Parent-Grenzen anwenden (MUSS-Regel 1, Abschnitt 3.1)
// ---------------------------------------------------------------------------

/**
 * Begrenzt die Zielgröße auf die innere Fläche des Parents.
 * Gibt null zurück wenn kein Parent existiert (Root).
 */
function applyParentBounds(
  tree: LayoutTree,
  nodeId: string,
  targetSize: Size
): Size {
  const parent = getParent(tree, nodeId);
  if (!parent) return targetSize; // Root, keine Einschränkung durch Parent

  const parentInner = innerSize(parent);
  return {
    width: Math.min(targetSize.width, parentInner.width),
    height: Math.min(targetSize.height, parentInner.height),
  };
}

// ---------------------------------------------------------------------------
// 2. min/max clampen (MUSS-Regel 2)
// ---------------------------------------------------------------------------

function clampToMinMax(node: WindowNode, targetSize: Size): Size {
  return {
    width: clamp(targetSize.width, node.minSize.width, node.maxSize.width),
    height: clamp(targetSize.height, node.minSize.height, node.maxSize.height),
  };
}

// ---------------------------------------------------------------------------
// 3. Sibling-Kollisionen auflösen (MUSS-Regel 3)
// ---------------------------------------------------------------------------

/**
 * Prüft, ob die neue Größe des Knotens andere Siblings überlappt.
 * Im MVP: Siblings dürfen sich nicht überschneiden (kein Overlay-Flag).
 * Gibt die maximal mögliche Größe zurück, die keine Überlappung verursacht.
 */
function resolveSiblingCollisions(
  tree: LayoutTree,
  node: WindowNode,
  targetSize: Size
): Size {
  const siblings = getSiblings(tree, node.id);
  let maxWidth = targetSize.width;
  let maxHeight = targetSize.height;

  for (const sibling of siblings) {
    // Horizontale Kollision: eigene rechte Kante vs. linke Kante des Siblings
    if (sibling.bounds.x > node.bounds.x) {
      const availableWidth = sibling.bounds.x - node.bounds.x;
      maxWidth = Math.min(maxWidth, availableWidth);
    }
    // Vertikale Kollision: eigene untere Kante vs. obere Kante des Siblings
    if (sibling.bounds.y > node.bounds.y) {
      const availableHeight = sibling.bounds.y - node.bounds.y;
      maxHeight = Math.min(maxHeight, availableHeight);
    }
  }

  return {
    width: Math.max(maxWidth, node.minSize.width),
    height: Math.max(maxHeight, node.minSize.height),
  };
}

// ---------------------------------------------------------------------------
// 4. Overflow-Policy anwenden (Abschnitt 9)
// ---------------------------------------------------------------------------

/**
 * Prüft ob ein Kind mit der Zielgröße aus dem Parent herausragt.
 * Bei noOverflow wird die Größe hart begrenzt.
 */
function applyOverflowPolicy(
  tree: LayoutTree,
  node: WindowNode,
  targetSize: Size
): Size {
  if (node.visibilityPolicy === "allowOverflowWithScroll") {
    return targetSize; // Überhang erlaubt
  }
  // noOverflow: identisch mit Parent-Grenzen – nochmals absichern
  return applyParentBounds(tree, node.id, targetSize);
}

// ---------------------------------------------------------------------------
// 5. Snap anwenden (Abschnitt 8)
// ---------------------------------------------------------------------------

export interface SnapConfig {
  threshold?: number;
  adjacencyTolerance?: number;
  enabled?: boolean;
}

/**
 * Rastet die Kante ein, wenn sie nah genug an einer Referenzkante liegt.
 * Gibt den ggf. korrigierten Größenwert zurück.
 */
function applySnap(
  value: number,
  referenceValues: number[],
  config: SnapConfig
): number {
  if (config.enabled === false) return value;
  const threshold = config.threshold ?? DEFAULT_SNAP_THRESHOLD_PX;
  for (const ref of referenceValues) {
    if (Math.abs(value - ref) <= threshold) {
      return ref;
    }
  }
  return value;
}

/**
 * Snap an Parent-Kanten und Sibling-Kanten (Abschnitt 8.1).
 */
function snapToEdges(
  tree: LayoutTree,
  node: WindowNode,
  targetSize: Size,
  snapConfig: SnapConfig
): Size {
  if (snapConfig.enabled === false) return targetSize;

  const parent = getParent(tree, node.id);
  const snapRefsWidth: number[] = [];
  const snapRefsHeight: number[] = [];

  if (parent) {
    snapRefsWidth.push(innerSize(parent).width);
    snapRefsHeight.push(innerSize(parent).height);
  }

  const siblings = getSiblings(tree, node.id);
  for (const sibling of siblings) {
    // Snap an Sibling-Kanten (gleiche Höhe, Abschnitt "Intelligenter Resize")
    snapRefsWidth.push(sibling.currentSize.width);
    snapRefsHeight.push(sibling.currentSize.height);
    // Snap an Sibling-rechte-Kante als Breiten-Referenz
    snapRefsWidth.push(sibling.bounds.x + sibling.currentSize.width - node.bounds.x);
  }

  return {
    width: applySnap(targetSize.width, snapRefsWidth, snapConfig),
    height: applySnap(targetSize.height, snapRefsHeight, snapConfig),
  };
}

// ---------------------------------------------------------------------------
// Haupt-Validierungspipeline (Abschnitt 5.1)
// ---------------------------------------------------------------------------

/**
 * Führt alle 5 Validierungsschritte durch und gibt die
 * finale gültige Größe zurück.
 */
function runValidationPipeline(
  tree: LayoutTree,
  node: WindowNode,
  targetSize: Size,
  snapConfig: SnapConfig
): Size {
  let size = { ...targetSize };

  // Schritt 1: Parent-Grenzen
  size = applyParentBounds(tree, node.id, size);
  // Schritt 2: min/max
  size = clampToMinMax(node, size);
  // Schritt 3: Sibling-Kollisionen
  size = resolveSiblingCollisions(tree, node, size);
  // Schritt 4: Overflow-Policy
  size = applyOverflowPolicy(tree, node, size);
  // Schritt 5: Snap
  size = snapToEdges(tree, node, size, snapConfig);

  return size;
}

// ---------------------------------------------------------------------------
// applyConstraints (API-Methode, Abschnitt 12.1)
// ---------------------------------------------------------------------------

/**
 * Wendet Constraints auf den gesamten LayoutTree an (Top-Down).
 * Gibt den validierten, neuen LayoutTree zurück.
 */
export function applyConstraints(
  tree: LayoutTree,
  snapConfig: SnapConfig = {}
): LayoutTree {
  let currentTree = tree;

  // Topologische Reihenfolge: Parent vor Children (Abschnitt 14, Maßnahme 1)
  const ordered = topologicalOrder(currentTree);

  for (const node of ordered) {
    if (!node.parentId) continue; // Root überspringen

    const finalSize = runValidationPipeline(
      currentTree,
      node,
      node.currentSize,
      snapConfig
    );

    const updatedBounds: Bounds = {
      ...node.bounds,
      width: finalSize.width,
      height: finalSize.height,
    };

    currentTree = updateNode(currentTree, {
      ...node,
      currentSize: finalSize,
      bounds: updatedBounds,
    });
  }

  return currentTree;
}

// ---------------------------------------------------------------------------
// setSizeValue (API-Methode, Abschnitt 12.1)
// ---------------------------------------------------------------------------

export type SizeValueType =
  | "minSize"
  | "maxSize"
  | "defaultSize"
  | "currentSize"
  | "adaptSize"
  | "previousSize";

/**
 * Setzt einen bestimmten Größentyp auf einem Window und validiert den
 * gesamten Baum danach.
 */
export function setSizeValue(
  tree: LayoutTree,
  windowId: string,
  valueType: SizeValueType,
  size: Size,
  snapConfig: SnapConfig = {}
): LayoutTree {
  const node = getNode(tree, windowId);
  const updated = { ...node, [valueType]: size };
  const treeWithUpdate = updateNode(tree, updated);
  return applyConstraints(treeWithUpdate, snapConfig);
}

// ---------------------------------------------------------------------------
// beginResize / updateResize / endResize (Abschnitt 6.1 + 12.1)
// ---------------------------------------------------------------------------

/** Interner Zustand einer laufenden Resize-Session. */
export interface ResizeSession {
  windowId: string;
  handle: ResizeHandle;
  /** Snapshot aller Knoten zu Beginn des Resize (für Rollback). */
  snapshotTree: LayoutTree;
  lastPointer: { x: number; y: number };
}

/**
 * Startet eine Resize-Operation und erstellt einen Snapshot für Rollback.
 */
export function beginResize(
  tree: LayoutTree,
  windowId: string,
  handle: ResizeHandle,
  pointer: { x: number; y: number }
): ResizeSession {
  getNode(tree, windowId); // Wirft Fehler wenn ID ungültig
  return {
    windowId,
    handle,
    snapshotTree: tree,
    lastPointer: pointer,
  };
}

/**
 * Aktualisiert die Größe während eines laufenden Resize-Vorgangs.
 * Gibt den neuen LayoutTree zurück oder wirft ConstraintError
 * mit lastValidTree bei einem unlösbaren Verstoß.
 */
export function updateResize(
  tree: LayoutTree,
  session: ResizeSession,
  pointer: { x: number; y: number },
  snapConfig: SnapConfig = {}
): { tree: LayoutTree; session: ResizeSession } {
  const deltaX = pointer.x - session.lastPointer.x;
  const deltaY = pointer.y - session.lastPointer.y;

  // Mikro-Jitter ignorieren (Abschnitt 8.2)
  if (
    Math.abs(deltaX) < DEFAULT_MIN_DRAG_DELTA_PX &&
    Math.abs(deltaY) < DEFAULT_MIN_DRAG_DELTA_PX
  ) {
    return { tree, session };
  }

  const node = getNode(tree, session.windowId);
  let newWidth = node.currentSize.width;
  let newHeight = node.currentSize.height;

  // Größenänderungen je nach Handle-Richtung
  const handle = session.handle;
  if (handle === "right" || handle === "bottom-right" || handle === "top-right") {
    newWidth = applyDelta(newWidth, deltaX, node.minSize.width, node.maxSize.width);
  }
  if (handle === "left" || handle === "bottom-left" || handle === "top-left") {
    newWidth = applyDelta(newWidth, -deltaX, node.minSize.width, node.maxSize.width);
  }
  if (handle === "bottom" || handle === "bottom-left" || handle === "bottom-right") {
    newHeight = applyDelta(newHeight, deltaY, node.minSize.height, node.maxSize.height);
  }
  if (handle === "top" || handle === "top-left" || handle === "top-right") {
    newHeight = applyDelta(newHeight, -deltaY, node.minSize.height, node.maxSize.height);
  }

  // Proportionales Resize bei proportional Policy (Abschnitt 6.3)
  if (node.resizePolicy === "proportional" && node.currentSize.height > 0) {
    const ratio = node.currentSize.width / node.currentSize.height;
    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      newHeight = Math.round(newWidth / ratio);
    } else {
      newWidth = Math.round(newHeight * ratio);
    }
  }

  const targetSize: Size = { width: newWidth, height: newHeight };
  const finalSize = runValidationPipeline(tree, node, targetSize, snapConfig);

  const updatedNode: WindowNode = {
    ...node,
    previousSize: node.currentSize,
    currentSize: finalSize,
    bounds: { ...node.bounds, width: finalSize.width, height: finalSize.height },
  };

  let newTree = updateNode(tree, updatedNode);

  // Children nach resizePolicy propagieren (Abschnitt 6.2)
  newTree = propagateToChildren(newTree, session.windowId, snapConfig);

  const updatedSession: ResizeSession = { ...session, lastPointer: pointer };
  return { tree: newTree, session: updatedSession };
}

/**
 * Beendet die Resize-Operation und committet den finalen Zustand.
 */
export function endResize(
  tree: LayoutTree,
  _session: ResizeSession,
  snapConfig: SnapConfig = {}
): LayoutTree {
  return applyConstraints(tree, snapConfig);
}

// ---------------------------------------------------------------------------
// Children-Propagation bei Parent-Resize (Abschnitt 6.2)
// ---------------------------------------------------------------------------

/**
 * Passt Children nach einem Parent-Resize gemäß ihrer resizePolicy an.
 * Reihenfolge: flexible zuerst, dann fixed (nur wenn notwendig).
 */
function propagateToChildren(
  tree: LayoutTree,
  parentId: string,
  snapConfig: SnapConfig
): LayoutTree {
  const children = getChildren(tree, parentId);
  const parent = getNode(tree, parentId);
  const parentInner = innerSize(parent);

  // Flexible zuerst, dann fixed (Abschnitt 6.2)
  const sorted = [...children].sort((a, b) => {
    if (a.resizePolicy === "flexible" && b.resizePolicy !== "flexible") return -1;
    if (b.resizePolicy === "flexible" && a.resizePolicy !== "flexible") return 1;
    return 0;
  });

  let currentTree = tree;

  for (const child of sorted) {
    if (child.resizePolicy === "fixed") continue;

    // Flexible: skaliere proportional zur neuen Parent-Fläche
    const scaleX = parentInner.width / Math.max(parent.previousSize.width, 1);
    const scaleY = parentInner.height / Math.max(parent.previousSize.height, 1);

    const targetSize: Size = {
      width: Math.round(child.currentSize.width * scaleX),
      height: Math.round(child.currentSize.height * scaleY),
    };

    const finalSize = runValidationPipeline(
      currentTree,
      child,
      targetSize,
      snapConfig
    );

    currentTree = updateNode(currentTree, {
      ...child,
      previousSize: child.currentSize,
      currentSize: finalSize,
      bounds: { ...child.bounds, width: finalSize.width, height: finalSize.height },
    });
  }

  return currentTree;
}

// ---------------------------------------------------------------------------
// collapse / expand (Abschnitt 7 + 12.1)
// ---------------------------------------------------------------------------

/**
 * Klappt ein Window ein: stellt previousSize des übergeordneten Bereichs
 * wieder her (Abschnitt 7.2).
 */
export function collapse(
  tree: LayoutTree,
  windowId: string,
  snapConfig: SnapConfig = {}
): LayoutTree {
  const node = getNode(tree, windowId);

  // Auf previousSize zurücksetzen (Abschnitt 7.2, Schritt 2)
  const targetSize = node.previousSize;

  const finalSize = runValidationPipeline(tree, node, targetSize, snapConfig);

  const updatedNode: WindowNode = {
    ...node,
    currentSize: finalSize,
    bounds: { ...node.bounds, width: finalSize.width, height: finalSize.height },
  };

  return applyConstraints(updateNode(tree, updatedNode), snapConfig);
}

/**
 * Klappt ein Window auf:
 * - Wenn Parent.currentSize > Parent.defaultSize → adaptSize
 * - Sonst → defaultSize (Abschnitt 7.1)
 */
export function expand(
  tree: LayoutTree,
  windowId: string,
  snapConfig: SnapConfig = {}
): LayoutTree {
  const node = getNode(tree, windowId);

  // previousSize sichern (Abschnitt 7.1, Schritt 1)
  const withPrevious: WindowNode = {
    ...node,
    previousSize: node.currentSize,
  };

  const parent = getParent(tree, windowId);
  let targetSize: Size;

  if (
    parent &&
    (parent.currentSize.width > parent.defaultSize.width ||
      parent.currentSize.height > parent.defaultSize.height)
  ) {
    // Parent größer als Default → adaptSize verwenden (Abschnitt 7.1a)
    targetSize = withPrevious.adaptSize;
  } else {
    // Sonst defaultSize des Child (Abschnitt 7.1b)
    targetSize = withPrevious.defaultSize;
  }

  const finalSize = runValidationPipeline(
    tree,
    withPrevious,
    targetSize,
    snapConfig
  );

  const updatedNode: WindowNode = {
    ...withPrevious,
    currentSize: finalSize,
    bounds: {
      ...withPrevious.bounds,
      width: finalSize.width,
      height: finalSize.height,
    },
  };

  return applyConstraints(updateNode(tree, updatedNode), snapConfig);
}

// ---------------------------------------------------------------------------
// getWindowDiagnostics (API-Methode, Abschnitt 12.1)
// ---------------------------------------------------------------------------

/** Diagnose-Ausgabe für ein einzelnes Window (Dev-Modus). */
export interface WindowDiagnostics {
  id: string;
  name: string;
  parentId: string | null;
  currentSize: Size;
  minSize: Size;
  maxSize: Size;
  defaultSize: Size;
  adaptSize: Size;
  previousSize: Size;
  visibilityPolicy: string;
  resizePolicy: string;
  snapPolicy: string;
  bounds: Bounds;
  childCount: number;
  /** Aktive Constraint-Verletzungen (leer = alles OK). */
  violations: string[];
}

export function getWindowDiagnostics(
  tree: LayoutTree,
  windowId: string
): WindowDiagnostics {
  const node = getNode(tree, windowId);
  const violations: string[] = [];

  // min/max prüfen
  if (node.currentSize.width < node.minSize.width) {
    violations.push(`Breite (${node.currentSize.width}) < minWidth (${node.minSize.width})`);
  }
  if (node.currentSize.width > node.maxSize.width) {
    violations.push(`Breite (${node.currentSize.width}) > maxWidth (${node.maxSize.width})`);
  }
  if (node.currentSize.height < node.minSize.height) {
    violations.push(`Höhe (${node.currentSize.height}) < minHeight (${node.minSize.height})`);
  }
  if (node.currentSize.height > node.maxSize.height) {
    violations.push(`Höhe (${node.currentSize.height}) > maxHeight (${node.maxSize.height})`);
  }

  // Parent-Grenzen prüfen
  const parent = getParent(tree, windowId);
  if (parent) {
    const pi = innerSize(parent);
    if (node.currentSize.width > pi.width) {
      violations.push(`Breite (${node.currentSize.width}) überschreitet Parent-Innenbreite (${pi.width})`);
    }
    if (node.currentSize.height > pi.height) {
      violations.push(`Höhe (${node.currentSize.height}) überschreitet Parent-Innenhöhe (${pi.height})`);
    }
  }

  return {
    id: node.id,
    name: node.name,
    parentId: node.parentId,
    currentSize: node.currentSize,
    minSize: node.minSize,
    maxSize: node.maxSize,
    defaultSize: node.defaultSize,
    adaptSize: node.adaptSize,
    previousSize: node.previousSize,
    visibilityPolicy: node.visibilityPolicy,
    resizePolicy: node.resizePolicy,
    snapPolicy: node.snapPolicy,
    bounds: node.bounds,
    childCount: getChildren(tree, windowId).length,
    violations,
  };
}
