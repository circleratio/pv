const MENU_ID = "history-menu";

let menuElement = null;
let outsideMousedownHandler = null;

/**
 * Shifts `menu` left/up, if needed, so it stays fully within the viewport
 * instead of being clipped at the right/bottom edge.
 * @param {HTMLElement} menu
 */
function clampToViewport(menu) {
  const rect = menu.getBoundingClientRect();

  if (rect.right > window.innerWidth) {
    menu.style.left = `${Math.max(0, window.innerWidth - rect.width)}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${Math.max(0, window.innerHeight - rect.height)}px`;
  }
}

function removeMenu() {
  if (menuElement) {
    menuElement.remove();
    menuElement = null;
  }
  if (outsideMousedownHandler) {
    document.removeEventListener("mousedown", outsideMousedownHandler);
    outsideMousedownHandler = null;
  }
}

/**
 * Shows a popup menu at the given viewport position: an always-present
 * "open file" item, a fullscreen toggle item, and the file history.
 * @param {number} x
 * @param {number} y
 * @param {string[]} entries file paths, newest first
 * @param {{ onSelectEntry: (path: string) => void, onOpenFile: () => void, onToggleFullscreen: () => void, isFullscreen: boolean }} callbacks
 */
export function show(
  x,
  y,
  entries,
  { onSelectEntry, onOpenFile, onToggleFullscreen, isFullscreen }
) {
  hide();

  const menu = document.createElement("ul");
  menu.id = MENU_ID;
  menu.className = "history-menu";
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const openFileItem = document.createElement("li");
  openFileItem.className = "history-menu-item history-menu-open-item";
  openFileItem.textContent = "ファイルを開く";
  openFileItem.addEventListener("click", () => {
    hide();
    onOpenFile();
  });
  menu.appendChild(openFileItem);

  const fullscreenItem = document.createElement("li");
  fullscreenItem.className = "history-menu-item history-menu-fullscreen-item";
  fullscreenItem.textContent = isFullscreen ? "全画面を解除" : "全画面にする";
  fullscreenItem.addEventListener("click", () => {
    hide();
    onToggleFullscreen();
  });
  menu.appendChild(fullscreenItem);

  if (entries.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-menu-empty";
    empty.textContent = "履歴なし";
    menu.appendChild(empty);
  } else {
    for (const path of entries) {
      const item = document.createElement("li");
      item.className = "history-menu-item";
      item.textContent = path;
      item.addEventListener("click", () => {
        hide();
        onSelectEntry(path);
      });
      menu.appendChild(item);
    }
  }

  document.body.appendChild(menu);
  menuElement = menu;
  clampToViewport(menu);

  outsideMousedownHandler = (event) => {
    if (menuElement && !menuElement.contains(event.target)) {
      hide();
    }
  };
  document.addEventListener("mousedown", outsideMousedownHandler);
}

/** Hides and discards the currently shown menu, if any. */
export function hide() {
  removeMenu();
}
