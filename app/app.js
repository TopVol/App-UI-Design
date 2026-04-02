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
  ui: {
    activeView: 'app',
    floatingOpen: false,
    fullscreen: false,
    tooltip: 'Die modulare v4.9 ist aktiv. Struktur vor Tiefenumbau.',
    logs: ['v4.9 initialisiert', 'HTML/CSS/Render/State getrennt'],
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
  draft.ui.logs = draft.ui.logs.slice(-12);
}

function togglePanel(key, label) {
  store.update((draft) => {
    draft.layout[key] = !draft.layout[key];
    draft.ui.tooltip = `${label} ${draft.layout[key] ? 'geöffnet' : 'geschlossen'}`;
    addLog(draft, `${label} ${draft.layout[key] ? 'geöffnet' : 'geschlossen'}`);
  });
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.id === 'btnFullscreen') {
      store.update((draft) => {
        draft.ui.fullscreen = !draft.ui.fullscreen;
        addLog(draft, `Vollbild ${draft.ui.fullscreen ? 'aktiviert' : 'deaktiviert'}`);
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

  const appWindow = document.getElementById('appWindow');
  const appHeader = document.getElementById('appHeader');
  const resizeHandle = document.getElementById('appResizeHandle');

  let dragSession = null;
  let resizeSession = null;

  appHeader.addEventListener('pointerdown', (event) => {
    if (store.getState().ui.fullscreen) return;
    appHeader.classList.add('dragging');
    const rect = appWindow.getBoundingClientRect();
    dragSession = { startX: event.clientX, startY: event.clientY, x: rect.left, y: rect.top };
  });

  resizeHandle.addEventListener('pointerdown', (event) => {
    if (store.getState().ui.fullscreen) return;
    const rect = appWindow.getBoundingClientRect();
    resizeSession = { startX: event.clientX, startY: event.clientY, width: rect.width, height: rect.height, x: rect.left, y: rect.top };
    event.stopPropagation();
  });

  window.addEventListener('pointermove', (event) => {
    if (dragSession) {
      const next = engine.applyWindowBounds({
        x: dragSession.x + (event.clientX - dragSession.startX),
        y: dragSession.y + (event.clientY - dragSession.startY),
        width: appWindow.offsetWidth,
        height: appWindow.offsetHeight,
        minWidth: 880,
        minHeight: 560,
        maxWidth: window.innerWidth,
        maxHeight: window.innerHeight,
      }, { width: window.innerWidth, height: window.innerHeight });
      appWindow.style.left = `${next.x}px`;
      appWindow.style.top = `${next.y}px`;
    }

    if (resizeSession) {
      const next = engine.applyWindowBounds({
        x: resizeSession.x,
        y: resizeSession.y,
        width: resizeSession.width + (event.clientX - resizeSession.startX),
        height: resizeSession.height + (event.clientY - resizeSession.startY),
        minWidth: 880,
        minHeight: 560,
        maxWidth: window.innerWidth - 16,
        maxHeight: window.innerHeight - 16,
      }, { width: window.innerWidth, height: window.innerHeight });
      appWindow.style.width = `${next.width}px`;
      appWindow.style.height = `${next.height}px`;
    }
  });

  window.addEventListener('pointerup', () => {
    dragSession = null;
    resizeSession = null;
    appHeader.classList.remove('dragging');
  });
}

store.subscribe((state) => {
  render(state);
  saveState(state);
});

bindEvents();
render(store.getState());
