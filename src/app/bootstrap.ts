/**
 * bootstrap.ts
 *
 * Minimaler Laufzeit-Adapter für die sichtbare Core-Architektur.
 *
 * Ziel:
 *  - initialen State aufbauen
 *  - StateStore und ResizeController verbinden
 *  - Änderungen sichtbar/logisch nachvollziehbar machen
 *
 * Kein UI-first. Kein DOM-Zwang.
 * Dieser Bootstrap ist bewusst renderer-agnostisch und damit portierbar.
 */

import { ResizeHandle } from "../types/window.types";
import { ResizeController } from "../controller/resize-controller";
import { StateStore } from "../store/state-store";
import { createInitialState } from "../state/initial-state";

export interface BootstrapRuntime {
  store: StateStore;
  controller: ResizeController;
  getSnapshot(): ReturnType<StateStore["getState"]>;
  beginResize(windowId: string, handle: ResizeHandle, pointer: { x: number; y: number }, modifiers?: Set<string>): void;
  updateResize(pointer: { x: number; y: number }, modifiers?: Set<string>): void;
  endResize(modifiers?: Set<string>): void;
  cancelResize(reason?: string): void;
  selectWindow(windowId: string | null): void;
  setFullscreen(fullscreen: boolean): void;
  setActiveView(activeView: string): void;
  appendLog(message: string): void;
  subscribe(listener: Parameters<StateStore["subscribe"]>[0]): () => void;
}

export function createBootstrapRuntime(): BootstrapRuntime {
  const initial = createInitialState();
  const store = new StateStore(initial);

  const controller = new ResizeController(store.getTree(), {
    onUpdate: (tree) => {
      store.setTree(tree);
      store.appendLog?.("Resize update committed");
    },
    onCommit: (tree) => {
      store.setTree(tree);
      store.appendLog?.("Resize session committed");
    },
    onRollback: (tree, reason) => {
      store.setTree(tree);
      store.appendLog?.(`Resize rollback: ${reason}`);
    },
  });

  // Store bleibt die Wahrheit, Controller bekommt externe Tree-Änderungen gespiegelt.
  store.subscribe((state) => {
    controller.setTree(state.tree);
  });

  return {
    store,
    controller,
    getSnapshot: () => store.getState(),
    beginResize: (windowId, handle, pointer, modifiers = new Set()) => {
      controller.beginResize(windowId, handle, pointer, modifiers);
    },
    updateResize: (pointer, modifiers = new Set()) => {
      controller.updateResize(pointer, modifiers);
    },
    endResize: (modifiers = new Set()) => {
      controller.endResize(modifiers);
    },
    cancelResize: (reason = "Bootstrap cancel") => {
      controller.cancelResize(reason);
    },
    selectWindow: (windowId) => {
      store.updateUI({ selectedWindowId: windowId });
    },
    setFullscreen: (fullscreen) => {
      store.updateUI({ fullscreen });
    },
    setActiveView: (activeView) => {
      store.updateUI({ activeView });
    },
    appendLog: (message) => {
      store.appendLog(message);
    },
    subscribe: (listener) => store.subscribe(listener),
  };
}

/**
 * Debug-Helfer für schnellen manuellen Smoke-Test in zukünftigen Shells.
 */
export function createConsoleBootstrap() {
  const runtime = createBootstrapRuntime();
  runtime.subscribe((state) => {
    const root = state.tree.nodes.get("app.root");
    const main = state.tree.nodes.get("main.canvas");
    const left = state.tree.nodes.get("sidebar.left");
    const right = state.tree.nodes.get("sidebar.right");
    const bottom = state.tree.nodes.get("panel.bottom");

    console.log("[bootstrap] state", {
      selectedWindowId: state.ui.selectedWindowId,
      activeView: state.ui.activeView,
      fullscreen: state.ui.fullscreen,
      processLogTail: state.ui.processLog.slice(-3),
      appRoot: root?.currentSize,
      leftSidebar: left?.currentSize,
      rightSidebar: right?.currentSize,
      bottomPanel: bottom?.currentSize,
      mainCanvas: main?.currentSize,
    });
  });

  return runtime;
}
