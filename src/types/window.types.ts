export type WindowId = string;

export type Edge = 'left' | 'right' | 'top' | 'bottom';
export type ResizePolicy = 'fixed' | 'flexible' | 'proportional';
export type VisibilityPolicy = 'noOverflow' | 'allowOverflowWithScroll';
export type SnapPolicy = 'enabled' | 'disabled';

export interface Size {
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds extends Point, Size {}

export interface InnerPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface WindowNode {
  id: WindowId;
  name: string;
  parentId: WindowId | null;
  bounds: Bounds;
  minSize: Size;
  maxSize: Size;
  defaultSize: Size;
  currentSize: Size;
  adaptSize: Size;
  previousSize: Size;
  innerPadding: InnerPadding;
  visibilityPolicy: VisibilityPolicy;
  resizePolicy: ResizePolicy;
  snapPolicy: SnapPolicy;
  collapsed: boolean;
  overlay: boolean;
  metadata: Record<string, unknown>;
}

export interface SharedEdge {
  id: string;
  windowA: WindowId;
  edgeA: Edge;
  windowB: WindowId;
  edgeB: Edge;
  linked: boolean;
}

export interface LayoutSettings {
  snapEnabled: boolean;
  snapThreshold: number;
  adjacencyTolerance: number;
  devMode: boolean;
}

export interface LayoutUiState {
  selectedWindowId: WindowId | null;
  activeView: string;
  processLog: string[];
}

export interface LayoutState {
  windows: Record<WindowId, WindowNode>;
  sharedEdges: SharedEdge[];
  settings: LayoutSettings;
  ui: LayoutUiState;
}

export interface ConstraintViolation {
  code: string;
  severity: 'info' | 'warn' | 'error';
  windowId: WindowId;
  detail: string;
  otherWindowId?: WindowId;
  original?: Partial<Size>;
  clamped?: Partial<Size>;
}

export interface ProposedWindowUpdate {
  bounds?: Partial<Bounds>;
  currentSize?: Partial<Size>;
  previousSize?: Partial<Size>;
  collapsed?: boolean;
}

export type ProposedUpdates = Record<WindowId, ProposedWindowUpdate>;

export interface ApplyConstraintOptions {
  snapOverride?: boolean;
  viewportBounds?: Size;
}

export interface ConstraintSuccess {
  ok: true;
  state: LayoutState;
  errors: ConstraintViolation[];
}

export interface ConstraintFailure {
  ok: false;
  state: null;
  errors: ConstraintViolation[];
}

export type ConstraintResult = ConstraintSuccess | ConstraintFailure;
