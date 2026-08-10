import * as pageNavigator from "./pageNavigator.js";
import * as laserPointer from "./laserPointer.js";
import * as fileHistory from "./fileHistory.js";
import * as historyMenu from "./historyMenu.js";
import * as fullscreen from "./fullscreen.js";
import * as slideListView from "./slideListView.js";

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
  if (event.key === "Escape") {
    handleEscape();
    return;
  }
  if (slideListView.isActive()) return; // page-turning keys are disabled while the slide list is open

  if (NEXT_KEYS.includes(event.key)) {
    pageNavigator.next();
  } else if (PREV_KEYS.includes(event.key)) {
    pageNavigator.prev();
  }
}

async function handleEscape() {
  if (slideListView.isActive()) {
    slideListView.hide();
    return;
  }

  let inFullscreen = false;
  try {
    inFullscreen = await fullscreen.isFullscreen();
  } catch (error) {
    console.error("Failed to check fullscreen state", error);
  }

  if (inFullscreen) {
    try {
      await fullscreen.exit();
    } catch (error) {
      console.error("Failed to exit fullscreen", error);
    }
  } else {
    closeWindow();
  }
}

function handleWheel(event) {
  if (slideListView.isActive()) return; // page-turning is disabled while the slide list is open

  if (event.deltaY > 0) {
    pageNavigator.next();
  } else if (event.deltaY < 0) {
    pageNavigator.prev();
  }
}

/** Toggles the slide list view on/off, wiring up slide selection to jump the current page. */
function toggleSlideListView() {
  if (slideListView.isActive()) {
    slideListView.hide();
    return;
  }

  slideListView.show(pageNavigator.getTotalPages(), pageNavigator.getCurrentPage(), {
    onHighlightSlide: (page) => pageNavigator.goTo(page),
    onSelectSlide: (page) => {
      pageNavigator.goTo(page);
      slideListView.hide();
    },
  });
}

/**
 * Whether `target` is inside the presentation surface (#viewer), as opposed
 * to overlay UI such as the right-click history menu. Targets that aren't
 * real DOM elements (e.g. test doubles) are treated as on the surface.
 */
function isOnPresentationSurface(target) {
  if (!target || typeof target.closest !== "function") return true;
  return !!target.closest("#viewer");
}

function handleMousedown(event) {
  if (event.button !== LASER_POINTER_BUTTON) return;
  if (!isOnPresentationSurface(event.target)) return;
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
  const { clientX, clientY } = event;
  const entries = fileHistory.getAll();
  const canShowSlideList = pageNavigator.getTotalPages() > 0;
  const isSlideListActive = slideListView.isActive();

  fullscreen
    .isFullscreen()
    .catch((error) => {
      console.error("Failed to check fullscreen state", error);
      return false;
    })
    .then((inFullscreen) => {
      historyMenu.show(clientX, clientY, entries, {
        onSelectEntry: (path) => openHistoryFile(path),
        onOpenFile: () => openFileDialog(),
        onToggleFullscreen: () => {
          fullscreen
            .toggle()
            .catch((error) => console.error("Failed to toggle fullscreen", error));
        },
        isFullscreen: inFullscreen,
        onToggleSlideList: () => toggleSlideListView(),
        isSlideListActive,
        canShowSlideList,
      });
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
