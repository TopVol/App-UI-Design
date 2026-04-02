export function createConstraintEngine() {
  return {
    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },
    applyWindowBounds(windowState, viewport) {
      const width = this.clamp(windowState.width, windowState.minWidth, Math.min(windowState.maxWidth, viewport.width));
      const height = this.clamp(windowState.height, windowState.minHeight, Math.min(windowState.maxHeight, viewport.height));
      const x = this.clamp(windowState.x, 0, Math.max(0, viewport.width - width));
      const y = this.clamp(windowState.y, 0, Math.max(0, viewport.height - height));
      return { ...windowState, x, y, width, height };
    },
  };
}
