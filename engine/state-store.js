export class StateStore {
  constructor(initialState) {
    this.state = structuredClone(initialState);
    this.undoStack = [];
    this.redoStack = [];
    this.subscribers = new Set();
  }

  getState() {
    return this.state;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  commit(nextState) {
    this.undoStack.push(structuredClone(this.state));
    this.redoStack = [];
    this.state = structuredClone(nextState);
    this.subscribers.forEach((cb) => cb(this.state));
  }

  update(updater) {
    const draft = structuredClone(this.state);
    updater(draft);
    this.commit(draft);
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(structuredClone(this.state));
    this.state = this.undoStack.pop();
    this.subscribers.forEach((cb) => cb(this.state));
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(structuredClone(this.state));
    this.state = this.redoStack.pop();
    this.subscribers.forEach((cb) => cb(this.state));
  }
}
