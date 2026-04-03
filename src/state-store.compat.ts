import type {
  ApplyConstraintOptions,
  LayoutState,
  Size,
  WindowId,
  WindowNode,
} from './types/window.types';
import {
  applyConstraints,
  buildCollapseUpdate,
  buildExpandUpdate,
} from './engine/legacy-compat';

export type CompatSubscriber = (nextState: LayoutState, previousState: LayoutState) => void;

export class StateStoreCompat {
  private state: LayoutState;
  private undoStack: LayoutState[] = [];
  private redoStack: LayoutState[] = [];
  private subscribers = new Set<CompatSubscriber>();

  constructor(initialState: LayoutState, private readonly maxHistory = 50) {
    this.state = structuredClone(initialState);
  }

  getState(): LayoutState {
    return this.state;
  }

  getWindow(id: WindowId): WindowNode | null {
    return this.state.windows[id] ?? null;
  }

  getWindowDiagnostics(id: WindowId) {
    const w = this.getWindow(id);
    if (!w) return null;
    return {
      id,
      name: w.name,
      parentId: w.parentId,
      bounds: { ...w.bounds },
      minSize: { ...w.minSize },
      maxSize: { ...w.maxSize },
      defaultSize: { ...w.defaultSize },
      currentSize: { ...w.currentSize },
      adaptSize: { ...w.adaptSize },
      previousSize: { ...w.previousSize },
      visibilityPolicy: w.visibilityPolicy,
      resizePolicy: w.resizePolicy,
      snapPolicy: w.snapPolicy,
      collapsed: w.collapsed,
      overlay: w.overlay,
    };
  }

  subscribe(callback: CompatSubscriber): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  commit(nextState: LayoutState): { ok: true } {
    this.undoStack.push(structuredClone(this.state));
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack = [];
    const previous = this.state;
    this.state = structuredClone(nextState);
    this.notify(previous);
    return { ok: true };
  }

  undo(): { ok: boolean; error?: string } {
    if (!this.undoStack.length) return { ok: false, error: 'NOTHING_TO_UNDO' };
    this.redoStack.push(structuredClone(this.state));
    const previous = this.state;
    this.state = this.undoStack.pop() as LayoutState;
    this.notify(previous);
    return { ok: true };
  }

  redo(): { ok: boolean; error?: string } {
    if (!this.redoStack.length) return { ok: false, error: 'NOTHING_TO_REDO' };
    this.undoStack.push(structuredClone(this.state));
    const previous = this.state;
    this.state = this.redoStack.pop() as LayoutState;
    this.notify(previous);
    return { ok: true };
  }

  resizeWindow(windowId: WindowId, boundsChange: Partial<WindowNode['bounds']>, options: ApplyConstraintOptions = {}) {
    const result = applyConstraints(this.state, { [windowId]: { bounds: boundsChange } }, options);
    if (!result.ok) return result;
    return { ...this.commit(result.state), errors: result.errors };
  }

  moveWindow(windowId: WindowId, position: Pick<WindowNode['bounds'], 'x' | 'y'>, options: ApplyConstraintOptions = {}) {
    return this.resizeWindow(windowId, position, options);
  }

  collapseWindow(windowId: WindowId, options: ApplyConstraintOptions = {}) {
    const node = this.getWindow(windowId);
    if (!node) return { ok: false, error: 'INVALID_WINDOW_ID' };
    if (node.collapsed) return { ok: false, error: 'ALREADY_COLLAPSED' };

    const stateWithPrev = this.patchWindow(windowId, { previousSize: { ...node.currentSize } });
    const proposed = buildCollapseUpdate(stateWithPrev, windowId);
    if (!proposed) return { ok: false, error: 'BUILD_COLLAPSE_FAILED' };

    const result = applyConstraints(stateWithPrev, proposed, options);
    if (!result.ok) return result;
    result.state.windows[windowId].collapsed = true;
    return { ...this.commit(result.state), errors: result.errors };
  }

  expandWindow(windowId: WindowId, options: ApplyConstraintOptions = {}) {
    const node = this.getWindow(windowId);
    if (!node) return { ok: false, error: 'INVALID_WINDOW_ID' };
    if (!node.collapsed) return { ok: false, error: 'NOT_COLLAPSED' };

    const proposed = buildExpandUpdate(this.state, windowId);
    if (!proposed) return { ok: false, error: 'BUILD_EXPAND_FAILED' };

    const result = applyConstraints(this.state, proposed, options);
    if (!result.ok) return result;
    result.state.windows[windowId].collapsed = false;
    return { ...this.commit(result.state), errors: result.errors };
  }

  setSizeValue(windowId: WindowId, valueType: 'minSize' | 'maxSize' | 'defaultSize' | 'adaptSize' | 'previousSize', size: Size) {
    const node = this.getWindow(windowId);
    if (!node) return { ok: false, error: 'INVALID_WINDOW_ID' };

    const newMin = valueType === 'minSize' ? size : node.minSize;
    const newMax = valueType === 'maxSize' ? size : node.maxSize;
    if (newMin.w > newMax.w || newMin.h > newMax.h) {
      return { ok: false, error: 'MIN_EXCEEDS_MAX' };
    }

    const nextState = this.patchWindow(windowId, { [valueType]: { ...size } as WindowNode['minSize'] });
    return this.commit(nextState);
  }

  updateSettings(patch: Partial<LayoutState['settings']>) {
    const nextState = structuredClone(this.state);
    nextState.settings = { ...nextState.settings, ...patch };
    return this.commit(nextState);
  }

  private patchWindow(windowId: WindowId, patch: Partial<WindowNode>): LayoutState {
    return {
      ...this.state,
      windows: {
        ...this.state.windows,
        [windowId]: {
          ...this.state.windows[windowId],
          ...patch,
        },
      },
    };
  }

  private notify(previousState: LayoutState): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(this.state, previousState);
      } catch (error) {
        console.error('[StateStoreCompat] subscriber failed', error);
      }
    }
  }
}
