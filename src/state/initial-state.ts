/**
 * initial-state.ts
 *
 * Sichtbarer Seed-State für die Core-Architektur.
 * Ziel: nicht UI-first, sondern ein startfähiger LayoutTree,
 * der in andere Apps eingebettet werden kann.
 */

import { LayoutTree, WindowNode } from "../types/window.types";
import { createWindow, createSharedEdge } from "../engine/constraint-engine";

export interface UIState {
  fullscreen: boolean;
  activeView: string;
  processLog: string[];
  selectedWindowId: string | null;
}

export interface AppState {
  tree: LayoutTree;
  ui: UIState;
}

function nodeEntries(nodes: WindowNode[]): Map<string, WindowNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

export function createInitialState(): AppState {
  const appRoot = createWindow({
    id: "app.root",
    name: "App Root",
    parentId: null,
    bounds: { x: 24, y: 24, width: 1120, height: 720 },
    minSize: { width: 900, height: 580 },
    maxSize: { width: 1600, height: 1000 },
    defaultSize: { width: 1120, height: 720 },
    currentSize: { width: 1120, height: 720 },
    adaptSize: { width: 1280, height: 820 },
    previousSize: { width: 1120, height: 720 },
    metadata: { devLabelVisible: true, role: "root" },
  });

  const sidebarLeft = createWindow({
    id: "sidebar.left",
    name: "Left Sidebar",
    parentId: "app.root",
    bounds: { x: 0, y: 0, width: 240, height: 668 },
    minSize: { width: 180, height: 320 },
    maxSize: { width: 420, height: 900 },
    defaultSize: { width: 240, height: 668 },
    currentSize: { width: 240, height: 668 },
    adaptSize: { width: 280, height: 668 },
    previousSize: { width: 240, height: 668 },
    metadata: { devLabelVisible: true, role: "sidebar-left" },
  });

  const sidebarRight = createWindow({
    id: "sidebar.right",
    name: "Right Sidebar",
    parentId: "app.root",
    bounds: { x: 860, y: 0, width: 260, height: 668 },
    minSize: { width: 180, height: 320 },
    maxSize: { width: 420, height: 900 },
    defaultSize: { width: 260, height: 668 },
    currentSize: { width: 260, height: 668 },
    adaptSize: { width: 300, height: 668 },
    previousSize: { width: 260, height: 668 },
    metadata: { devLabelVisible: true, role: "sidebar-right" },
  });

  const panelBottom = createWindow({
    id: "panel.bottom",
    name: "Bottom Panel",
    parentId: "app.root",
    bounds: { x: 240, y: 540, width: 620, height: 128 },
    minSize: { width: 360, height: 110 },
    maxSize: { width: 1400, height: 280 },
    defaultSize: { width: 620, height: 128 },
    currentSize: { width: 620, height: 128 },
    adaptSize: { width: 620, height: 180 },
    previousSize: { width: 620, height: 128 },
    metadata: { devLabelVisible: true, role: "bottom-panel" },
  });

  const mainCanvas = createWindow({
    id: "main.canvas",
    name: "Main Canvas",
    parentId: "app.root",
    bounds: { x: 240, y: 0, width: 620, height: 540 },
    minSize: { width: 360, height: 260 },
    maxSize: { width: 1400, height: 1200 },
    defaultSize: { width: 620, height: 540 },
    currentSize: { width: 620, height: 540 },
    adaptSize: { width: 760, height: 620 },
    previousSize: { width: 620, height: 540 },
    metadata: { devLabelVisible: true, role: "main-canvas" },
  });

  const floatingWindow = createWindow({
    id: "window.floating",
    name: "Floating Window",
    parentId: "app.root",
    bounds: { x: 720, y: 120, width: 280, height: 220 },
    minSize: { width: 220, height: 160 },
    maxSize: { width: 480, height: 420 },
    defaultSize: { width: 280, height: 220 },
    currentSize: { width: 280, height: 220 },
    adaptSize: { width: 320, height: 240 },
    previousSize: { width: 280, height: 220 },
    metadata: { devLabelVisible: true, role: "floating" },
    overlay: true,
  });

  const tree: LayoutTree = {
    rootId: "app.root",
    nodes: nodeEntries([
      appRoot,
      sidebarLeft,
      sidebarRight,
      panelBottom,
      mainCanvas,
      floatingWindow,
    ]),
  };

  return {
    tree: {
      ...tree,
      nodes: tree.nodes,
    },
    ui: {
      fullscreen: false,
      activeView: "app",
      processLog: ["Initial layout state created"],
      selectedWindowId: "main.canvas",
    },
  };
}

export function createInitialSharedEdges() {
  return [
    createSharedEdge({
      id: "edge.sidebar-left-main",
      windowA: "sidebar.left",
      edgeA: "right",
      windowB: "main.canvas",
      edgeB: "left",
      linked: true,
    }),
    createSharedEdge({
      id: "edge.main-sidebar-right",
      windowA: "main.canvas",
      edgeA: "right",
      windowB: "sidebar.right",
      edgeB: "left",
      linked: true,
    }),
    createSharedEdge({
      id: "edge.main-bottom-panel",
      windowA: "main.canvas",
      edgeA: "bottom",
      windowB: "panel.bottom",
      edgeB: "top",
      linked: true,
    }),
  ];
}
