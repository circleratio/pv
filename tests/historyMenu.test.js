import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as historyMenu from "../src/js/historyMenu.js";

function historyItems() {
  return document.querySelectorAll(
    ".history-menu-item:not(.history-menu-open-item):not(.history-menu-fullscreen-item):not(.history-menu-slidelist-item)"
  );
}

function openFileItem() {
  return document.querySelector(".history-menu-open-item");
}

function fullscreenItem() {
  return document.querySelector(".history-menu-fullscreen-item");
}

function slideListItem() {
  return document.querySelector(".history-menu-slidelist-item");
}

function callbacks(overrides = {}) {
  return {
    onSelectEntry: vi.fn(),
    onOpenFile: vi.fn(),
    onToggleFullscreen: vi.fn(),
    isFullscreen: false,
    onToggleSlideList: vi.fn(),
    isSlideListActive: false,
    canShowSlideList: true,
    ...overrides,
  };
}

/**
 * jsdom does not perform real layout, so getBoundingClientRect() normally
 * returns an all-zero rect. Stub it to reflect the menu's inline left/top
 * plus a fixed size, so viewport-clamping logic can be exercised.
 */
function mockMenuRect(width, height) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function () {
      const left = parseFloat(this.style.left) || 0;
      const top = parseFloat(this.style.top) || 0;
      return { left, top, width, height, right: left + width, bottom: top + height };
    }
  );
}

describe("historyMenu", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.innerWidth = 1024;
    window.innerHeight = 768;
  });

  afterEach(() => {
    historyMenu.hide();
    vi.restoreAllMocks();
  });

  it("always shows a clickable 'open file' item", () => {
    historyMenu.show(0, 0, [], callbacks());

    const item = openFileItem();
    expect(item).not.toBeNull();
    expect(item.textContent).toBe("ファイルを開く");
  });

  it("calls onOpenFile and hides the menu when the 'open file' item is clicked", () => {
    const cb = callbacks();
    historyMenu.show(0, 0, ["a.pdf"], cb);

    openFileItem().dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(cb.onOpenFile).toHaveBeenCalledTimes(1);
    expect(document.getElementById("history-menu")).toBeNull();
  });

  it("shows 'full screen' wording when not currently fullscreen", () => {
    historyMenu.show(0, 0, [], callbacks({ isFullscreen: false }));

    expect(fullscreenItem().textContent).toBe("全画面にする");
  });

  it("shows 'exit full screen' wording when currently fullscreen", () => {
    historyMenu.show(0, 0, [], callbacks({ isFullscreen: true }));

    expect(fullscreenItem().textContent).toBe("全画面を解除");
  });

  it("calls onToggleFullscreen and hides the menu when the fullscreen item is clicked", () => {
    const cb = callbacks();
    historyMenu.show(0, 0, ["a.pdf"], cb);

    fullscreenItem().dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(cb.onToggleFullscreen).toHaveBeenCalledTimes(1);
    expect(document.getElementById("history-menu")).toBeNull();
  });

  it("shows 'show slide list' wording when the slide list view is not active", () => {
    historyMenu.show(0, 0, [], callbacks({ isSlideListActive: false }));

    expect(slideListItem().textContent).toBe("スライド一覧表示にする");
  });

  it("shows 'hide slide list' wording when the slide list view is active", () => {
    historyMenu.show(0, 0, [], callbacks({ isSlideListActive: true }));

    expect(slideListItem().textContent).toBe("スライド一覧表示を解除");
  });

  it("calls onToggleSlideList and hides the menu when the slide list item is clicked", () => {
    const cb = callbacks();
    historyMenu.show(0, 0, ["a.pdf"], cb);

    slideListItem().dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(cb.onToggleSlideList).toHaveBeenCalledTimes(1);
    expect(document.getElementById("history-menu")).toBeNull();
  });

  it("disables the slide list item when no PDF is loaded", () => {
    const cb = callbacks({ canShowSlideList: false });
    historyMenu.show(0, 0, [], cb);

    const item = slideListItem();
    expect(item.classList.contains("disabled")).toBe(true);

    item.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(cb.onToggleSlideList).not.toHaveBeenCalled();
    expect(document.getElementById("history-menu")).not.toBeNull();
  });

  it("renders each history entry as a clickable item", () => {
    historyMenu.show(10, 20, ["a.pdf", "b.pdf"], callbacks());

    const items = historyItems();
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe("a.pdf");
    expect(items[1].textContent).toBe("b.pdf");
  });

  it("calls onSelectEntry with the clicked path and hides the menu", () => {
    const cb = callbacks();
    historyMenu.show(0, 0, ["a.pdf", "b.pdf"], cb);

    historyItems()[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(cb.onSelectEntry).toHaveBeenCalledWith("b.pdf");
    expect(document.getElementById("history-menu")).toBeNull();
  });

  it("shows a non-clickable placeholder when there is no history", () => {
    historyMenu.show(0, 0, [], callbacks());

    expect(historyItems()).toHaveLength(0);
    const empty = document.querySelector(".history-menu-empty");
    expect(empty).not.toBeNull();
    expect(empty.textContent).toBe("履歴なし");
  });

  it("hide() removes the menu from the DOM", () => {
    historyMenu.show(0, 0, ["a.pdf"], callbacks());
    expect(document.getElementById("history-menu")).not.toBeNull();

    historyMenu.hide();

    expect(document.getElementById("history-menu")).toBeNull();
  });

  it("removes a menu that was already open when show() is called again", () => {
    historyMenu.show(0, 0, ["a.pdf"], callbacks());
    historyMenu.show(0, 0, ["b.pdf"], callbacks());

    expect(document.querySelectorAll("#history-menu")).toHaveLength(1);
    expect(historyItems()[0].textContent).toBe("b.pdf");
  });

  it("hides when clicking outside the menu", () => {
    historyMenu.show(0, 0, ["a.pdf"], callbacks());

    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(document.getElementById("history-menu")).toBeNull();
  });

  it("keeps the click position when the menu fits within the viewport", () => {
    mockMenuRect(200, 150);

    historyMenu.show(50, 50, [], callbacks());

    const menu = document.getElementById("history-menu");
    expect(menu.style.left).toBe("50px");
    expect(menu.style.top).toBe("50px");
  });

  it("shifts the menu left so it does not overflow the right edge", () => {
    mockMenuRect(200, 150);
    window.innerWidth = 300;

    historyMenu.show(250, 50, [], callbacks());

    const menu = document.getElementById("history-menu");
    expect(menu.style.left).toBe("100px");
  });

  it("shifts the menu up so it does not overflow the bottom edge", () => {
    mockMenuRect(200, 150);
    window.innerHeight = 300;

    historyMenu.show(50, 250, [], callbacks());

    const menu = document.getElementById("history-menu");
    expect(menu.style.top).toBe("150px");
  });

  it("clamps to the left/top edge when the menu is wider/taller than the viewport", () => {
    mockMenuRect(500, 500);
    window.innerWidth = 300;
    window.innerHeight = 300;

    historyMenu.show(250, 250, [], callbacks());

    const menu = document.getElementById("history-menu");
    expect(menu.style.left).toBe("0px");
    expect(menu.style.top).toBe("0px");
  });
});
