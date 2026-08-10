const MENU_ID = "history-menu";

let menuElement = null;
let outsideMousedownHandler = null;

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
 * Shows a popup menu listing the file history at the given viewport position.
 * Selecting an entry hides the menu and calls `onSelect` with its path.
 * @param {number} x
 * @param {number} y
 * @param {string[]} entries file paths, newest first
 * @param {(path: string) => void} onSelect
 */
export function show(x, y, entries, onSelect) {
  hide();

  const menu = document.createElement("ul");
  menu.id = MENU_ID;
  menu.className = "history-menu";
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

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
        onSelect(path);
      });
      menu.appendChild(item);
    }
  }

  document.body.appendChild(menu);
  menuElement = menu;

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
