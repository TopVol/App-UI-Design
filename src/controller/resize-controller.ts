import type { ApplyConstraintOptions, Bounds, LayoutState, WindowId } from '../types/window.types';
import { applyConstraints } from '../engine/constraint-engine';

export type ResizeHandle =
  | 'move'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface PointerLike {
  x: number;
  y: number;
}

export interface ResizeSession {
  windowId: WindowId;
  handle: ResizeHandle;
  startPointer: PointerLike;
  startBounds: Bounds;
}

export class ResizeController {
  private session: ResizeSession | null = null;

  beginResize(state: LayoutState, windowId: WindowId, handle: ResizeHandle, pointer: PointerLike): ResizeSession {
    const node = state.windows[windowId];
    if (!node) {
      throw new Error(`Unknown window id: ${windowId}`);
    }

    this.session = {
      windowId,
      handle,
      startPointer: pointer,
      startBounds: { ...node.bounds },
    };

    return this.session;
  }

  updateResize(state: LayoutState, pointer: PointerLike, options: ApplyConstraintOptions = {}) {
    if (!this.session) {
      return { ok: false, state: null, errors: [{ code: 'NO_ACTIVE_SESSION', severity: 'error' as const, windowId: 'unknown', detail: 'Kein aktiver Resize-Vorgang' }] };
    }

    const dx = pointer.x - this.session.startPointer.x;
    const dy = pointer.y - this.session.startPointer.y;
    const next = this.computeBounds(this.session.startBounds, this.session.handle, dx, dy);

    return applyConstraints(
      state,
      {
        [this.session.windowId]: {
          bounds: next,
        },
      },
      options,
    );
  }

  endResize(): void {
    this.session = null;
  }

  private computeBounds(start: Bounds, handle: ResizeHandle, dx: number, dy: number): Partial<Bounds> {
    const next: Partial<Bounds> = {};

    if (handle === 'move') {
      next.x = start.x + dx;
      next.y = start.y + dy;
      return next;
    }

    if (handle.includes('left')) {
      next.x = start.x + dx;
      next.w = start.w - dx;
    }

    if (handle.includes('right')) {
      next.w = start.w + dx;
    }

    if (handle.includes('top')) {
      next.y = start.y + dy;
      next.h = start.h - dy;
    }

    if (handle.includes('bottom')) {
      next.h = start.h + dy;
    }

    return next;
  }
}
