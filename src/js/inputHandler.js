import * as pageNavigator from "./pageNavigator.js";
import * as laserPointer from "./laserPointer.js";
import * as fileHistory from "./fileHistory.js";
import * as historyMenu from "./historyMenu.js";

const NEXT_KEYS = ["ArrowRight", "ArrowDown", " "];
const PREV_KEYS = ["ArrowLeft", "ArrowUp", "Backspace"];
const LASER_POINTER_BUTTON = 0; // left mouse button

let isPointerActive = false;
let closeWindow = defaultCloseWindow;
let openHistoryFile = () => {};
let openFileDialog = () => {};

function defaultCloseWindow() {
  import("@tauri-apps/api/window")
    .then(({ getCurrentWindow }) => getCurrentWindow().close())
    .catch((error) => console.error("Failed to close window", error));
}

function handleKeydown(event) {
  if (NEXT_KEYS.includes(event.key)) {
    pageNavigator.next();
  } else if (PREV_KEYS.includes(event.key)) {
    pageNavigator.prev();
  } else if (event.key === "Escape") {
    closeWindow();
  }
}

function handleWheel(event) {
  if (event.deltaY > 0) {
    pageNavigator.next();
  } else if (event.deltaY < 0) {
    pageNavigator.prev();
  }
}

function handleMousedown(event) {
  if (event.button !== LASER_POINTER_BUTTON) return;
  isPointerActive = true;
  laserPointer.startStroke(event.clientX, event.clientY);
}

function handleMousemove(event) {
  if (!isPointerActive) return;
  laserPointer.addPoint(event.clientX, event.clientY);
}

function handleMouseup(event) {
  if (event.button !== LASER_POINTER_BUTTON || !isPointerActive) return;
  isPointerActive = false;
  laserPointer.endStroke();
}

function handleContextmenu(event) {
  event.preventDefault();
  const entries = fileHistory.getAll();
  historyMenu.show(event.clientX, event.clientY, entries, {
    onSelectEntry: (path) => openHistoryFile(path),
    onOpenFile: () => openFileDialog(),
  });
}

/**
 * Wires up keyboard, wheel, left-click (laser pointer) and right-click
 * (file history menu) event handling.
 * @param {{ target?: EventTarget, closeWindow?: () => void, openHistoryFile?: (path: string) => void, openFileDialog?: () => void }} [options]
 */
export function init({
  target = window,
  closeWindow: closeWindowOverride,
  openHistoryFile: openHistoryFileOverride,
  openFileDialog: openFileDialogOverride,
} = {}) {
  if (closeWindowOverride) {
    closeWindow = closeWindowOverride;
  }
  if (openHistoryFileOverride) {
    openHistoryFile = openHistoryFileOverride;
  }
  if (openFileDialogOverride) {
    openFileDialog = openFileDialogOverride;
  }
  target.addEventListener("keydown", handleKeydown);
  target.addEventListener("wheel", handleWheel);
  target.addEventListener("mousedown", handleMousedown);
  target.addEventListener("mousemove", handleMousemove);
  target.addEventListener("mouseup", handleMouseup);
  target.addEventListener("contextmenu", handleContextmenu);
}
