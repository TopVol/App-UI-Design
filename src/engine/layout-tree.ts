import type { LayoutState, SharedEdge, WindowId, WindowNode } from '../types/window.types';

export const LayoutTree = {
  getWindow(state: LayoutState, id: WindowId): WindowNode | null {
    return state.windows[id] ?? null;
  },

  getParent(state: LayoutState, id: WindowId): WindowNode | null {
    const w = this.getWindow(state, id);
    return w?.parentId ? this.getWindow(state, w.parentId) : null;
  },

  getChildren(state: LayoutState, parentId: WindowId): WindowNode[] {
    return Object.values(state.windows).filter((w) => w.parentId === parentId);
  },

  getSiblings(state: LayoutState, id: WindowId): WindowNode[] {
    const w = this.getWindow(state, id);
    if (!w || !w.parentId) return [];
    return this.getChildren(state, w.parentId).filter((c) => c.id !== id);
  },

  getDescendants(state: LayoutState, id: WindowId): WindowNode[] {
    const out: WindowNode[] = [];
    const visit = (pid: WindowId) => {
      for (const child of this.getChildren(state, pid)) {
        out.push(child);
        visit(child.id);
      }
    };
    visit(id);
    return out;
  },

  topologicalOrder(state: LayoutState): WindowId[] {
    const visited = new Set<WindowId>();
    const result: WindowId[] = [];

    const visit = (id: WindowId) => {
      if (visited.has(id)) return;
      visited.add(id);
      const w = state.windows[id];
      if (w?.parentId && state.windows[w.parentId]) {
        visit(w.parentId);
      }
      result.push(id);
    };

    for (const id of Object.keys(state.windows)) {
      visit(id);
    }

    return result;
  },

  getLinkedEdges(state: LayoutState, windowId: WindowId): SharedEdge[] {
    return state.sharedEdges.filter(
      (e) => e.linked && (e.windowA === windowId || e.windowB === windowId),
    );
  },
};
