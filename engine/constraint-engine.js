export function createConstraintEngine(config = {}) {
  const snapThreshold = config.snapThreshold ?? 8;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function snap(value, refs, threshold = snapThreshold) {
    for (const ref of refs) {
      if (Math.abs(value - ref) <= threshold) return ref;
    }
    return value;
  }

  function applyWindowBounds(windowState, viewport, options = {}) {
    const threshold = options.snapThreshold ?? snapThreshold;
    const refsX = [0, 24, Math.max(0, viewport.width - windowState.width), Math.max(0, viewport.width - 24 - windowState.width)];
    const refsY = [0, 24, Math.max(0, viewport.height - windowState.height), Math.max(0, viewport.height - 24 - windowState.height)];

    const width = clamp(windowState.width, windowState.minWidth, Math.min(windowState.maxWidth, viewport.width));
    const height = clamp(windowState.height, windowState.minHeight, Math.min(windowState.maxHeight, viewport.height));
    const x = clamp(snap(windowState.x, refsX, threshold), 0, Math.max(0, viewport.width - width));
    const y = clamp(snap(windowState.y, refsY, threshold), 0, Math.max(0, viewport.height - height));

    return { ...windowState, x, y, width, height };
  }

  function getShellMetrics(layout) {
    return {
      leftWidth: layout.leftOpen ? 230 : 0,
      rightWidth: layout.rightOpen ? 300 : 0,
      bottomHeight: layout.bottomOpen ? 150 : 0,
    };
  }

  return {
    clamp,
    snap,
    applyWindowBounds,
    getShellMetrics,
  };
}
