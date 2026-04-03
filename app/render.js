function windowCardHTML(id, title, copy, actions = []) {
  return `
    <section class="card" data-select-window="${id}">
      <div class="card-head">
        <div class="card-title">${title}</div>
        <div class="card-actions">
          ${actions.map((a) => `<button class="small-btn" data-action="${a.action}" data-window="${id}">${a.label}</button>`).join('')}
        </div>
      </div>
      <div class="card-copy">${copy}</div>
    </section>
  `;
}

function sidebarNavHTML(state) {
  const views = [
    ['app', 'App'],
    ['funktion1', 'Funktion 1'],
    ['funktion2', 'Funktion 2'],
    ['einstellungen', 'Einstellungen'],
  ];
  return `
    <div class="sidebar-content-block">
      <div class="side-head">Menü</div>
      <div class="nav-list">
        ${views.map(([key, label]) => `
          <button class="nav-btn ${state.ui.activeView === key ? 'active' : ''}" data-nav="${key}">${label}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function controlCenterHTML() {
  return `
    <div class="sidebar-content-block">
      <div class="side-head">Control Center</div>
      <div class="control-grid">
        <button class="menu-btn" data-toggle="left">Linke Sidebar</button>
        <button class="menu-btn" data-toggle="right">Rechte Sidebar</button>
        <button class="menu-btn" data-toggle="bottom">Bottom Panel</button>
        <button class="menu-btn" data-action="openFloating" data-window="floating">Floating Window</button>
      </div>
    </div>
  `;
}

function mainViewHTML(state) {
  if (state.ui.activeView === 'funktion1') {
    return windowCardHTML('view.function1', 'Funktion 1', 'Hier kann später eine zweite Produktansicht oder ein Spezial-Workspace andocken.');
  }
  if (state.ui.activeView === 'funktion2') {
    return windowCardHTML('view.function2', 'Funktion 2', 'Sprint 2 ist aktiv: Fensterzustand und Shell-Metriken sind jetzt state-getrieben.');
  }
  if (state.ui.activeView === 'einstellungen') {
    return windowCardHTML('view.settings', 'Einstellungen', 'Save, Load, Undo, Redo, Fullscreen und Resize sind jetzt sauber in Module und Store getrennt.');
  }

  return `
    <div class="two-col">
      ${windowCardHTML('window.A', 'Window A', 'Die modulare v4.9 hat nun einen echten Window-State mit Position und Größe im Store.', [
        { action: 'toggleBottom', label: 'Bottom' },
        { action: 'openFloating', label: 'Float' },
      ])}
      ${windowCardHTML('window.B', 'Window B', 'Sprint 2 macht die App ehrlicher: Fenstergröße und Position leben jetzt nicht mehr nur im DOM.', [
        { action: 'toggleLeft', label: 'Links' },
        { action: 'toggleRight', label: 'Rechts' },
      ])}
    </div>
  `;
}

function floatingWindowHTML(state) {
  if (!state.ui.floatingOpen) return '';
  return `
    <section class="card" style="position:absolute; right:24px; bottom:24px; width:320px; z-index:4;">
      <div class="card-head">
        <div class="card-title">Floating Window</div>
        <div class="card-actions"><button class="small-btn" data-action="closeFloating" data-window="floating">Schließen</button></div>
      </div>
      <div class="card-copy">Dieses Overlay zeigt die Richtung: modulare Shell außen, tiefere Engine innen.</div>
    </section>
  `;
}

function bottomHTML(state) {
  return `
    <div class="side-head">Logbuch</div>
    <div class="log-list">
      ${state.ui.logs.slice().reverse().map((entry) => `<div class="log-item">${entry}</div>`).join('')}
    </div>
  `;
}

export function render(state, metrics) {
  const appWindow = document.getElementById('appWindow');
  const leftSidebar = document.getElementById('leftSidebarContent');
  const rightSidebar = document.getElementById('rightSidebarContent');
  const mainCanvas = document.getElementById('mainCanvas');
  const bottomPanel = document.getElementById('bottomPanel');
  const modeChip = document.getElementById('modeChip');
  const sizeChip = document.getElementById('sizeChip');
  const tooltipBar = document.getElementById('tooltipBar');
  const leftRail = document.getElementById('leftRail');
  const rightRail = document.getElementById('rightRail');

  appWindow.classList.toggle('fullscreen', state.ui.fullscreen);
  appWindow.classList.toggle('left-open', state.layout.leftOpen);
  appWindow.classList.toggle('right-open', state.layout.rightOpen);
  appWindow.classList.toggle('bottom-open', state.layout.bottomOpen);

  appWindow.style.left = `${state.window.x}px`;
  appWindow.style.top = `${state.window.y}px`;
  appWindow.style.width = `${state.window.width}px`;
  appWindow.style.height = `${state.window.height}px`;

  leftSidebar.innerHTML = sidebarNavHTML(state);
  rightSidebar.innerHTML = controlCenterHTML();
  mainCanvas.innerHTML = mainViewHTML(state) + floatingWindowHTML(state);
  bottomPanel.innerHTML = bottomHTML(state);
  bottomPanel.classList.toggle('hidden', !state.layout.bottomOpen);

  modeChip.textContent = state.ui.fullscreen ? 'Vollbild aktiv · Sprint 2' : 'Fenstermodus aktiv · Sprint 2';
  sizeChip.textContent = `${Math.round(state.window.width)}×${Math.round(state.window.height)} · L${metrics.leftWidth}/R${metrics.rightWidth}/B${metrics.bottomHeight}`;
  tooltipBar.textContent = state.ui.tooltip;
  leftRail.textContent = state.layout.leftOpen ? '❮' : '❯';
  rightRail.textContent = state.layout.rightOpen ? '❯' : '❮';
}
