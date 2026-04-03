/**
 * LayoutTree – Modul 1 (Abschnitt 11.1)
 * Verwaltet die Parent-Child-Hierarchie aller WindowNodes
 * und stellt Traversal-Methoden bereit.
 *
 * Zustandsprinzip (Abschnitt 11.2):
 *  - Immutable State Updates: jede Mutation gibt einen neuen LayoutTree zurück.
 *  - Jede UI-Aktion erzeugt ein Action-Event; Layout wird nur über die
 *    ConstraintEngine committed.
 */

import { LayoutTree, WindowNode, Size } from "../types/window.types";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Erstellt einen leeren LayoutTree für das AppWindow.
 * Das Root-Window muss als erstes via addNode eingefügt werden.
 */
export function createLayoutTree(rootNode: WindowNode): LayoutTree {
  if (rootNode.parentId !== null) {
    throw new Error(
      `Root-Window "${rootNode.id}" muss parentId: null haben.`
    );
  }
  const nodes = new Map<string, WindowNode>();
  nodes.set(rootNode.id, rootNode);
  return { rootId: rootNode.id, nodes };
}

// ---------------------------------------------------------------------------
// Lesende Operationen
// ---------------------------------------------------------------------------

/**
 * Gibt den WindowNode für die angegebene ID zurück.
 * Wirft einen Fehler wenn die ID nicht existiert.
 */
export function getNode(tree: LayoutTree, id: string): WindowNode {
  const node = tree.nodes.get(id);
  if (!node) {
    throw new Error(`WindowNode "${id}" nicht im LayoutTree gefunden.`);
  }
  return node;
}

/**
 * Gibt den direkten Parent-Knoten zurück.
 * Gibt null zurück für den Root-Knoten.
 */
export function getParent(
  tree: LayoutTree,
  nodeId: string
): WindowNode | null {
  const node = getNode(tree, nodeId);
  if (node.parentId === null) return null;
  return getNode(tree, node.parentId);
}

/**
 * Gibt alle direkten Kinder eines Knotens zurück (keine Enkel).
 */
export function getChildren(
  tree: LayoutTree,
  parentId: string
): WindowNode[] {
  const children: WindowNode[] = [];
  for (const node of tree.nodes.values()) {
    if (node.parentId === parentId) {
      children.push(node);
    }
  }
  return children;
}

/**
 * Gibt alle Geschwister-Knoten (Siblings) zurück – gleicher Parent,
 * aber nicht der Knoten selbst.
 */
export function getSiblings(
  tree: LayoutTree,
  nodeId: string
): WindowNode[] {
  const node = getNode(tree, nodeId);
  if (node.parentId === null) return [];
  return getChildren(tree, node.parentId).filter((c) => c.id !== nodeId);
}

/**
 * Ermittelt den vollständigen Pfad von einem Knoten bis zur Wurzel.
 * Index 0 = übergebener Knoten, letzter Index = Root.
 */
export function pathToRoot(tree: LayoutTree, nodeId: string): WindowNode[] {
  const path: WindowNode[] = [];
  let current: WindowNode | null = getNode(tree, nodeId);
  while (current !== null) {
    path.push(current);
    current = current.parentId ? tree.nodes.get(current.parentId) ?? null : null;
  }
  return path;
}

/**
 * Topologische Reihenfolge: Root zuerst, dann Children (Breadth-First).
 * Wichtig für die ConstraintEngine (Abschnitt 14, Risiko 1: Zykeldetektion).
 */
export function topologicalOrder(tree: LayoutTree): WindowNode[] {
  const result: WindowNode[] = [];
  const queue: string[] = [tree.rootId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) {
      throw new Error(
        `Zirkuläre Abhängigkeit im LayoutTree bei Node "${id}" entdeckt.`
      );
    }
    visited.add(id);
    const node = getNode(tree, id);
    result.push(node);
    const children = getChildren(tree, id);
    for (const child of children) {
      queue.push(child.id);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Mutationen (geben immer einen neuen LayoutTree zurück – Immutable)
// ---------------------------------------------------------------------------

/**
 * Fügt einen neuen WindowNode in den Baum ein.
 * Wirft Fehler wenn die ID bereits existiert oder der Parent fehlt.
 */
export function addNode(tree: LayoutTree, node: WindowNode): LayoutTree {
  if (tree.nodes.has(node.id)) {
    throw new Error(`WindowNode "${node.id}" existiert bereits im LayoutTree.`);
  }
  if (node.parentId !== null && !tree.nodes.has(node.parentId)) {
    throw new Error(
      `Parent "${node.parentId}" für Node "${node.id}" nicht im LayoutTree gefunden.`
    );
  }
  const newNodes = new Map(tree.nodes);
  newNodes.set(node.id, node);
  return { ...tree, nodes: newNodes };
}

/**
 * Ersetzt einen bestehenden WindowNode durch eine aktualisierte Version.
 * Wird vom ConstraintEngine-Commit aufgerufen.
 */
export function updateNode(tree: LayoutTree, updated: WindowNode): LayoutTree {
  if (!tree.nodes.has(updated.id)) {
    throw new Error(
      `WindowNode "${updated.id}" nicht im LayoutTree – Update nicht möglich.`
    );
  }
  const newNodes = new Map(tree.nodes);
  newNodes.set(updated.id, updated);
  return { ...tree, nodes: newNodes };
}

/**
 * Entfernt einen Knoten und alle seine Nachfahren rekursiv.
 * Root-Knoten kann nicht entfernt werden.
 */
export function removeNode(tree: LayoutTree, nodeId: string): LayoutTree {
  if (nodeId === tree.rootId) {
    throw new Error("Das Root-AppWindow kann nicht entfernt werden.");
  }
  const idsToRemove = collectDescendants(tree, nodeId);
  idsToRemove.add(nodeId);
  const newNodes = new Map(tree.nodes);
  for (const id of idsToRemove) {
    newNodes.delete(id);
  }
  return { ...tree, nodes: newNodes };
}

// ---------------------------------------------------------------------------
// Interne Hilfsfunktionen
// ---------------------------------------------------------------------------

function collectDescendants(tree: LayoutTree, nodeId: string): Set<string> {
  const result = new Set<string>();
  const children = getChildren(tree, nodeId);
  for (const child of children) {
    result.add(child.id);
    for (const desc of collectDescendants(tree, child.id)) {
      result.add(desc);
    }
  }
  return result;
}

/**
 * Berechnet die innere verfügbare Fläche eines Knotens
 * (entspricht currentSize, da kein Padding-Modell im MVP).
 */
export function innerSize(node: WindowNode): Size {
  return { ...node.currentSize };
}
