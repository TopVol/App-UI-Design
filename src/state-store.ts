import { applyConstraints } from './engine/constraint-engine';
import type {
  ApplyConstraintOptions,
  ConstraintResult,
  LayoutState,
  ProposedUpdates,
  Size,
  WindowId,
  WindowNode,
} from './types/window.types';

export type StateSubscriber = (nextState: LayoutState, previousState: LayoutState) => void;

export class StateStore {
  private state: LayoutState;
  private undoStack: LayoutState[] = [];
  private redoStack: LayoutState[] = [];
  private subscribers = new Set<StateSubscriber>();

  constructor(initialState: LayoutState, private readonly maxHistory = 50) {
    this.state = structuredClone(initialState);
  }

  getState(): LayoutState {
    return this.state;
  }

  getWindow(id: WindowId): WindowNode | null {
    return this.state.windows[id] ?? null;
  }

  subscribe(callback: StateSubscriber): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  commit(nextState: LayoutState): { ok: true } {
    this.undoStack.push(structuredClone(this.state));
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    const previous = this.state;
    this.state = structuredClone(nextState);
    this.notify(previous);
    return { ok: true };
  }

  undo(): { ok: boolean; error?: string } {
    if (!this.undoStack.length) {
      return { ok: false, error: 'NOTHING_TO_UNDO' };
    }
    this.redoStack.push(structuredClone(this.state));
    const previous = this.state;
    this.state = this.undoStack.pop() as LayoutState;
    this.notify(previous);
    return { ok: true };
  }

  redo(): { ok: boolean; error?: string } {
    if (!this.redoStack.length) {
      return { ok: false, error: 'NOTHING_TO_REDO' };
    }
    this.undoStack.push(structuredClone(this.state));
    const previous = this.state;
    this.state = this.redoStack.pop() as LayoutState;
    this.notify(previous);
    return { ok: true };
  }

  resizeWindow(
    windowId: WindowId,
    boundsChange: Partial<WindowNode['bounds']>,
    options: ApplyConstraintOptions = {},
  ): ConstraintResult | ({ ok: true; errors: [] } & { state?: LayoutState }) {
    const result = applyConstraints(
      this.state,
      {
        [windowId]: {
          bounds: boundsChange,
        },
      },
      options,
    );

    if (!result.ok) {
      return result;
    }

    this.commit(result.state);
    return { ok: true, state: result.state, errors: result.errors };
  }

  moveWindow(
    windowId: WindowId,
    position: Pick<WindowNode['bounds'], 'x' | 'y'>,
    options: ApplyConstraintOptions = {},
  ): ConstraintResult | ({ ok: true; errors: [] } & { state?: LayoutState }) {
    return this.resizeWindow(windowId, position, options);
  }

  applyUpdates(
    proposedUpdates: ProposedUpdates,
    options: ApplyConstraintOptions = {},
  ): ConstraintResult | ({ ok: true; errors: [] } & { state?: LayoutState }) {
    const result = applyConstraints(this.state, proposedUpdates, options);
    if (!result.ok) {
      return result;
    }
    this.commit(result.state);
    return { ok: true, state: result.state, errors: result.errors };
  }

  collapseWindow(windowId: WindowId, options: ApplyConstraintOptions = {}) {
    const node = this.state.windows[windowId];
    if (!node) {
      return { ok: false, error: 'INVALID_WINDOW_ID' };
    }
    if (node.collapsed) {
      return { ok: false, error: 'ALREADY_COLLAPSED' };
    }

    const previous = structuredClone(node.currentSize);
    return this.applyUpdates(
      {
        [windowId]: {
          previousSize: previous,
          bounds: { ...node.bounds, h: node.minSize.h },
          collapsed: true,
        },
      },
      options,
    );
  }

  expandWindow(windowId: WindowId, options: ApplyConstraintOptions = {}) {
    const node = this.state.windows[windowId];
    if (!node) {
      return { ok: false, error: 'INVALID_WINDOW_ID' };
    }
    if (!node.collapsed) {
      return { ok: false, error: 'NOT_COLLAPSED' };
    }

    const parent = node.parentId ? this.state.windows[node.parentId] : null;
    const useAdapt = !!parent && (
      parent.currentSize.w > parent.defaultSize.w ||
      parent.currentSize.h > parent.defaultSize.h
    );
    const target = useAdapt ? node.adaptSize : node.defaultSize;

    return this.applyUpdates(
      {
        [windowId]: {
          bounds: { ...node.bounds, w: target.w, h: target.h },
          collapsed: false,
        },
      },
      options,
    );
  }

  setSizeValue(
    windowId: WindowId,
    valueType: 'minSize' | 'maxSize' | 'defaultSize' | 'adaptSize' | 'previousSize',
    size: Size,
  ): { ok: boolean; error?: string } {
    const node = this.state.windows[windowId];
    if (!node) {
      return { ok: false, error: 'INVALID_WINDOW_ID' };
    }

    const nextState = structuredClone(this.state);
    const target = nextState.windows[windowId];
    target[valueType] = { ...size };

    if (
      target.minSize.w > target.maxSize.w ||
      target.minSize.h > target.maxSize.h
    ) {
      return { ok: false, error: 'MIN_EXCEEDS_MAX' };
    }

    this.commit(nextState);
    return { ok: true };
  }

  updateSettings(patch: Partial<LayoutState['settings']>): { ok: true } {
    const nextState = structuredClone(this.state);
    nextState.settings = { ...nextState.settings, ...patch };
    return this.commit(nextState);
  }

  getWindowDiagnostics(windowId: WindowId): WindowNode | null {
    const node = this.state.windows[windowId];
    return node ? structuredClone(node) : null;
  }

  private notify(previousState: LayoutState): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(this.state, previousState);
      } catch (error) {
        console.error('[StateStore] subscriber failed', error);
      }
    }
  }
}
