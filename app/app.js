import { createConstraintEngine } from '../engine/constraint-engine.js';
import { StateStore } from '../engine/state-store.js';
import { render } from './render.js';

const STORAGE_KEY = 'app-ui-design-v49';

const initialState = {
  layout: {
    leftOpen: false,
    rightOpen: false,
    bottomOpen: false,
  },
  window: {
    x: 24,
    y: 24,
    width: 1120,
    height: 720,
    minWidth: 880,
    minHeight: 560,
    maxWidth: 5000,
    maxHeight: 4000,
  },
  ui: {
    activeView: 'app',
    floatingOpen: false,
    fullscreen: false,
    tooltip: 'Sprint 2 aktiv: Window-State und Constraint-Helfer sind modular verdrahtet.',
    logs: ['Sprint 2 initialisiert', 'Archivdateien werden im Repo erhalten'],
  },
};

function serialize(state) {
  return JSON.stringify(state);
}

function deserialize(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? deserialize(raw) : null;
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, serialize(state));
}

const engine = createConstraintEngine();
const bootState = loadState() ?? initialState;
const store = new StateStore(bootState);

function addLog(draft, text) {
  draft.ui.logs.push(text);
  draft.ui.logs = draft.ui.logs.slice(-14);
}

function togglePanel(key, label) {
  store.update((draft) => {
    draft.layout[key] = !draft.layout[key];
    draft.ui.tooltip = `${label} ${draft.layout[key] ? 'geöffnet' : 'geschlossen'}`;
    addLog(draft, `${label} ${draft.layout[key] ? 'geöffnet' : 'geschlossen'}`);
  });
}

function updateWindowBounds(mutator) {
  store.update((draft) => {
    const next = engine.applyWindowBounds(mutator(structuredClone(draft.window)), {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    draft.window = next;
  });
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.id === 'btnFullscreen') {
      store.update((draft) => {
        draft.ui.fullscreen = !draft.ui.fullscreen;
        draft.ui.tooltip = draft.ui.fullscreen ? 'Vollbild aktiviert' : 'Vollbild deaktiviert';
        addLog(draft, draft.ui.tooltip);
      });
      return;
    }
    if (target.id === 'btnUndo') return store.undo();
    if (target.id === 'btnRedo') return store.redo();
    if (target.id === 'btnSaveLayout') {
      saveState(store.getState());
      store.update((draft) => {
        draft.ui.tooltip = 'Layout gespeichert';
        addLog(draft, 'Layout in localStorage gespeichert');
      });
      return;
    }
    if (target.id === 'btnLoadLayout') {
      const loaded = loadState();
      if (!loaded) return;
      store.commit(loaded);
      return;
    }
    if (target.id === 'leftRail') return togglePanel('leftOpen', 'Linke Sidebar');
    if (target.id === 'rightRail') return togglePanel('rightOpen', 'Rechte Sidebar');

    if (target.dataset.toggle === 'left') return togglePanel('leftOpen', 'Linke Sidebar');
    if (target.dataset.toggle === 'right') return togglePanel('rightOpen', 'Rechte Sidebar');
    if (target.dataset.toggle === 'bottom') return togglePanel('bottomOpen', 'Bottom Panel');

    if (target.dataset.nav) {
      const nextView = target.dataset.nav;
      store.update((draft) => {
        draft.ui.activeView = nextView;
        draft.ui.tooltip = `Ansicht gewechselt: ${nextView}`;
        addLog(draft, `Ansicht gewechselt: ${nextView}`);
      });
      return;
    }

    if (target.dataset.action === 'openFloating') {
      store.update((draft) => {
        draft.ui.floatingOpen = true;
        addLog(draft, 'Floating Window geöffnet');
      });
      return;
    }

    if (target.dataset.action === 'closeFloating') {
      store.update((draft) => {
        draft.ui.floatingOpen = false;
        addLog(draft, 'Floating Window geschlossen');
      });
      return;
    }

    if (target.dataset.action === 'toggleBottom') return togglePanel('bottomOpen', 'Bottom Panel');
    if (target.dataset.action === 'toggleLeft') return togglePanel('leftOpen', 'Linke Sidebar');
    if (target.dataset.action === 'toggleRight') return togglePanel('rightOpen', 'Rechte Sidebar');
  });

  const appHeader = document.getElementById('appHeader');
  const resizeHandle = document.getElementById('appResizeHandle');

  let dragSession = null;
  let resizeSession = null;

  appHeader.addEventListener('pointerdown', (event) => {
    if (store.getState().ui.fullscreen) return;
    appHeader.classList.add('dragging');
    const current = store.getState().window;
    dragSession = { startX: event.clientX, startY: event.clientY, x: current.x, y: current.y };
  });

  resizeHandle.addEventListener('pointerdown', (event) => {
    if (store.getState().ui.fullscreen) return;
    const current = store.getState().window;
    resizeSession = { startX: event.clientX, startY: event.clientY, width: current.width, height: current.height, x: current.x, y: current.y };
    event.stopPropagation();
  });

  window.addEventListener('pointermove', (event) => {
    if (dragSession) {
      updateWindowBounds((current) => ({
        ...current,
        x: dragSession.x + (event.clientX - dragSession.startX),
        y: dragSession.y + (event.clientY - dragSession.startY),
      }));
    }

    if (resizeSession) {
      updateWindowBounds((current) => ({
        ...current,
        x: resizeSession.x,
        y: resizeSession.y,
        width: resizeSession.width + (event.clientX - resizeSession.startX),
        height: resizeSession.height + (event.clientY - resizeSession.startY),
      }));
    }
  });

  window.addEventListener('pointerup', () => {
    if (dragSession || resizeSession) {
      store.update((draft) => {
        addLog(draft, `Window aktualisiert: ${Math.round(draft.window.width)}×${Math.round(draft.window.height)} @ ${Math.round(draft.window.x)},${Math.round(draft.window.y)}`);
      });
    }
    dragSession = null;
    resizeSession = null;
    appHeader.classList.remove('dragging');
  });
}

function doRender(state) {
  const metrics = engine.getShellMetrics(state.layout);
  render(state, metrics);
}

store.subscribe((state) => {
  doRender(state);
  saveState(state);
});

bindEvents();
doRender(store.getState());
