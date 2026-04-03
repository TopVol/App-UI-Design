import { LayoutTree } from './layout-tree';
import type {
  ApplyConstraintOptions,
  Bounds,
  ConstraintResult,
  ConstraintViolation,
  LayoutState,
  ProposedUpdates,
  SharedEdge,
  Size,
  WindowNode,
} from '../types/window.types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function cloneState(state: LayoutState): LayoutState {
  return {
    ...state,
    windows: Object.fromEntries(
      Object.entries(state.windows).map(([id, w]) => [
        id,
        {
          ...w,
          bounds: { ...w.bounds },
          minSize: { ...w.minSize },
          maxSize: { ...w.maxSize },
          defaultSize: { ...w.defaultSize },
          currentSize: { ...w.currentSize },
          adaptSize: { ...w.adaptSize },
          previousSize: { ...w.previousSize },
          innerPadding: { ...w.innerPadding },
          metadata: { ...w.metadata },
        },
      ]),
    ),
    sharedEdges: state.sharedEdges.map((e) => ({ ...e })),
    settings: { ...state.settings },
    ui: { ...state.ui, processLog: [...state.ui.processLog] },
  };
}

function getParentInnerBounds(parent: WindowNode): Size {
  const p = parent.innerPadding;
  return {
    w: parent.currentSize.w - p.left - p.right,
    h: parent.currentSize.h - p.top - p.bottom,
  };
}

function getEdgeValue(bounds: Bounds, edge: SharedEdge['edgeA']): number {
  if (edge === 'left') return bounds.x;
  if (edge === 'right') return bounds.x + bounds.w;
  if (edge === 'top') return bounds.y;
  return bounds.y + bounds.h;
}

function syncCurrentSize(node: WindowNode): void {
  node.currentSize = { w: node.bounds.w, h: node.bounds.h };
}

function applyEdgeDelta(node: WindowNode, edge: SharedEdge['edgeA'], delta: number): void {
  if (edge === 'left') {
    node.bounds.x += delta;
    node.bounds.w -= delta;
  } else if (edge === 'right') {
    node.bounds.w += delta;
  } else if (edge === 'top') {
    node.bounds.y += delta;
    node.bounds.h -= delta;
  } else {
    node.bounds.h += delta;
  }
  syncCurrentSize(node);
}

function propagateSharedEdges(working: LayoutState, originalBounds: Record<string, Bounds>, proposedUpdates: ProposedUpdates): Set<string> {
  const affected = new Set<string>(Object.keys(proposedUpdates));

  for (const [windowId, update] of Object.entries(proposedUpdates)) {
    if (!update.bounds) continue;
    const current = working.windows[windowId];
    const original = originalBounds[windowId];
    if (!current || !original) continue;

    for (const edge of LayoutTree.getLinkedEdges(working, windowId)) {
      const isA = edge.windowA === windowId;
      const myEdge = isA ? edge.edgeA : edge.edgeB;
      const theirId = isA ? edge.windowB : edge.windowA;
      const theirEdge = isA ? edge.edgeB : edge.edgeA;
      const target = working.windows[theirId];
      if (!target) continue;

      const delta = getEdgeValue(current.bounds, myEdge) - getEdgeValue(original, myEdge);
      if (Math.abs(delta) < Number.EPSILON) continue;

      applyEdgeDelta(target, theirEdge, delta);
      affected.add(theirId);
    }
  }

  return affected;
}

function snapValue(value: number, refs: number[], threshold: number): number {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const ref of refs) {
    const dist = Math.abs(value - ref);
    if (dist <= threshold && dist < bestDistance) {
      best = ref;
      bestDistance = dist;
    }
  }
  return best ?? value;
}

export function applyConstraints(
  state: LayoutState,
  proposedUpdates: ProposedUpdates,
  options: ApplyConstraintOptions = {},
): ConstraintResult {
  const viewport = options.viewportBounds ?? { w: Number.POSITIVE_INFINITY, h: Number.POSITIVE_INFINITY };
  const working = cloneState(state);
  const errors: ConstraintViolation[] = [];

  for (const id of Object.keys(proposedUpdates)) {
    if (!working.windows[id]) {
      errors.push({ code: 'INVALID_WINDOW_ID', severity: 'error', windowId: id, detail: `Window '${id}' existiert nicht` });
    }
  }
  if (errors.some((e) => e.severity === 'error')) return { ok: false, state: null, errors };

  const originalBounds = Object.fromEntries(
    Object.entries(working.windows).map(([id, w]) => [id, { ...w.bounds }]),
  ) as Record<string, Bounds>;

  for (const [id, patch] of Object.entries(proposedUpdates)) {
    const w = working.windows[id];
    if (!w) continue;
    if (patch.bounds) w.bounds = { ...w.bounds, ...patch.bounds };
    if (patch.currentSize) w.currentSize = { ...w.currentSize, ...patch.currentSize };
    if (patch.previousSize) w.previousSize = { ...w.previousSize, ...patch.previousSize };
    if (typeof patch.collapsed === 'boolean') w.collapsed = patch.collapsed;
    syncCurrentSize(w);
  }

  const affected = propagateSharedEdges(working, originalBounds, proposedUpdates);
  const ordered = LayoutTree.topologicalOrder(working).filter((id) => affected.has(id));

  for (const id of ordered) {
    const w = working.windows[id];
    const parent = LayoutTree.getParent(working, id);
    const available = parent ? getParentInnerBounds(parent) : viewport;

    w.bounds.x = clamp(w.bounds.x, 0, Math.max(0, available.w - w.minSize.w));
    w.bounds.y = clamp(w.bounds.y, 0, Math.max(0, available.h - w.minSize.h));

    const maxW = Math.min(w.maxSize.w, available.w - w.bounds.x);
    const maxH = Math.min(w.maxSize.h, available.h - w.bounds.y);
    w.bounds.w = clamp(w.bounds.w, w.minSize.w, maxW);
    w.bounds.h = clamp(w.bounds.h, w.minSize.h, maxH);
    syncCurrentSize(w);

    if (w.minSize.w > w.maxSize.w || w.minSize.h > w.maxSize.h) {
      errors.push({ code: 'MIN_EXCEEDS_MAX', severity: 'error', windowId: id, detail: 'minSize überschreitet maxSize' });
    }
  }

  if (errors.some((e) => e.severity === 'error')) return { ok: false, state: null, errors };

  for (const id of ordered) {
    const node = working.windows[id];
    if (node.overlay) continue;
    for (const sibling of LayoutTree.getSiblings(working, id)) {
      if (sibling.overlay) continue;
      if (rectsOverlap(node.bounds, sibling.bounds)) {
        errors.push({ code: 'SIBLING_OVERLAP', severity: 'error', windowId: id, otherWindowId: sibling.id, detail: `${id} überlappt ${sibling.id}` });
      }
    }
  }

  if (!options.snapOverride && working.settings.snapEnabled) {
    const threshold = working.settings.snapThreshold;
    for (const id of affected) {
      const w = working.windows[id];
      const parent = LayoutTree.getParent(working, id);
      const refsX: number[] = [];
      const refsY: number[] = [];
      if (parent) {
        const inner = getParentInnerBounds(parent);
        refsX.push(0, inner.w);
        refsY.push(0, inner.h);
      }
      for (const s of LayoutTree.getSiblings(working, id)) {
        refsX.push(s.bounds.x, s.bounds.x + s.bounds.w);
        refsY.push(s.bounds.y, s.bounds.y + s.bounds.h);
      }
      w.bounds.x = snapValue(w.bounds.x, refsX, threshold);
      w.bounds.y = snapValue(w.bounds.y, refsY, threshold);
      const snappedRight = snapValue(w.bounds.x + w.bounds.w, refsX, threshold);
      const snappedBottom = snapValue(w.bounds.y + w.bounds.h, refsY, threshold);
      w.bounds.w = snappedRight - w.bounds.x;
      w.bounds.h = snappedBottom - w.bounds.y;
      syncCurrentSize(w);
    }
  }

  if (errors.some((e) => e.severity === 'error')) return { ok: false, state: null, errors };
  return { ok: true, state: working, errors };
}
