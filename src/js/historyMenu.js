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
 * Shows a popup menu at the given viewport position: an always-present
 * "open file" item followed by the file history.
 * @param {number} x
 * @param {number} y
 * @param {string[]} entries file paths, newest first
 * @param {{ onSelectEntry: (path: string) => void, onOpenFile: () => void }} callbacks
 */
export function show(x, y, entries, { onSelectEntry, onOpenFile }) {
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
