import { applyConstraints } from './constraint-engine';
import type {
  Bounds,
  LayoutState,
  SharedEdge,
  WindowNode,
} from '../types/window.types';

export { applyConstraints };

export function createWindow(options: Partial<WindowNode> & Pick<WindowNode, 'id' | 'name'>): WindowNode {
  const bounds: Bounds = options.bounds ?? { x: 0, y: 0, w: 0, h: 0 };
  const defaultSize = options.defaultSize ?? { w: bounds.w, h: bounds.h };
  const currentSize = options.currentSize ?? { ...defaultSize };
  const adaptSize = options.adaptSize ?? { ...defaultSize };
  const previousSize = options.previousSize ?? { ...currentSize };

  return {
    id: options.id,
    name: options.name,
    parentId: options.parentId ?? null,
    bounds: { ...bounds },
    minSize: options.minSize ?? { w: 0, h: 0 },
    maxSize: options.maxSize ?? { w: Number.POSITIVE_INFINITY, h: Number.POSITIVE_INFINITY },
    defaultSize: { ...defaultSize },
    currentSize: { ...currentSize },
    adaptSize: { ...adaptSize },
    previousSize: { ...previousSize },
    innerPadding: options.innerPadding ?? { top: 0, right: 0, bottom: 0, left: 0 },
    visibilityPolicy: options.visibilityPolicy ?? 'noOverflow',
    resizePolicy: options.resizePolicy ?? 'flexible',
    snapPolicy: options.snapPolicy ?? 'enabled',
    collapsed: options.collapsed ?? false,
    overlay: options.overlay ?? false,
    metadata: { devLabelVisible: false, ...(options.metadata ?? {}) },
  };
}

export function createSharedEdge(options: SharedEdge): SharedEdge {
  return { ...options, linked: options.linked ?? true };
}

export function buildCollapseUpdate(state: LayoutState, windowId: string) {
  const node = state.windows[windowId];
  if (!node || node.collapsed) return null;

  return {
    [windowId]: {
      bounds: {
        ...node.bounds,
        h: node.minSize.h,
      },
    },
  };
}

export function buildExpandUpdate(state: LayoutState, windowId: string) {
  const node = state.windows[windowId];
  if (!node || !node.collapsed) return null;

  const parent = node.parentId ? state.windows[node.parentId] : null;
  const useAdapt = !!parent && (
    parent.currentSize.w > parent.defaultSize.w ||
    parent.currentSize.h > parent.defaultSize.h
  );
  const target = useAdapt ? node.adaptSize : node.defaultSize;

  return {
    [windowId]: {
      bounds: {
        ...node.bounds,
        w: target.w,
        h: target.h,
      },
    },
  };
}
