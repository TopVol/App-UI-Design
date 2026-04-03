/**
 * state-store.ts
 *
 * Zentrale State-Orchestrierung zwischen:
 *   - ConstraintEngine
 *   - ResizeController
 *   - zukünftigen Renderern
 *
 * Architektur:
 *   dispatch → ConstraintEngine → commit → subscribers
 */

import { LayoutTree } from "../types/window.types";
import {
  applyConstraints,
  collapse,
  expand,
  setSizeValue,
} from "../engine/constraint-engine";
import { AppState } from "../state/initial-state";

export type StateListener = (state: AppState) => void;

export class StateStore {
  private state: AppState;
  private listeners = new Set<StateListener>();

  private undoStack: AppState[] = [];
  private redoStack: AppState[] = [];

  constructor(initialState: AppState) {
    this.state = initialState;
  }

  // ───────────────────────────────────────────
  // Getter
  // ───────────────────────────────────────────

  getState(): AppState {
    return this.state;
  }

  getTree(): LayoutTree {
    return this.state.tree;
  }

  // ───────────────────────────────────────────
  // Subscription
  // ───────────────────────────────────────────

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l(this.state);
  }

  // ───────────────────────────────────────────
  // Core Commit
  // ───────────────────────────────────────────

  commit(next: AppState) {
    this.undoStack.push(this.state);
    this.redoStack = [];

    this.state = next;
    this.emit();
  }

  private safeCommit(next: AppState) {
    this.undoStack.push(this.state);
    this.redoStack = [];

    this.state = next;
    this.emit();
  }

  // ───────────────────────────────────────────
  // Undo / Redo
  // ───────────────────────────────────────────

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;

    this.redoStack.push(this.state);
    this.state = prev;
    this.emit();
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) return;

    this.undoStack.push(this.state);
    this.state = next;
    this.emit();
  }

  // ───────────────────────────────────────────
  // Engine-Dispatch
  // ───────────────────────────────────────────

  resizeWindow(windowId: string, size: { width?: number; height?: number }) {
    const node = this.state.tree.nodes.get(windowId);
    if (!node) return;

    const newSize = {
      width: size.width ?? node.currentSize.width,
      height: size.height ?? node.currentSize.height,
    };

    const updatedTree = setSizeValue(
      this.state.tree,
      windowId,
      "currentSize",
      newSize
    );

    const validatedTree = applyConstraints(updatedTree);

    this.safeCommit({
      ...this.state,
      tree: validatedTree,
    });
  }

  collapseWindow(windowId: string) {
    const nextTree = collapse(this.state.tree, windowId);
    this.safeCommit({ ...this.state, tree: nextTree });
  }

  expandWindow(windowId: string) {
    const nextTree = expand(this.state.tree, windowId);
    this.safeCommit({ ...this.state, tree: nextTree });
  }

  setTree(tree: LayoutTree) {
    this.safeCommit({ ...this.state, tree });
  }

  updateUI(partial: Partial<AppState["ui"]>) {
    this.safeCommit({
      ...this.state,
      ui: {
        ...this.state.ui,
        ...partial,
      },
    });
  }
}
