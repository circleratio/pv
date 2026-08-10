import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as historyMenu from "../src/js/historyMenu.js";

function historyItems() {
  return document.querySelectorAll(
    ".history-menu-item:not(.history-menu-open-item):not(.history-menu-fullscreen-item)"
  );
}

function openFileItem() {
  return document.querySelector(".history-menu-open-item");
}

function fullscreenItem() {
  return document.querySelector(".history-menu-fullscreen-item");
}

function callbacks(overrides = {}) {
  return {
    onSelectEntry: vi.fn(),
    onOpenFile: vi.fn(),
    onToggleFullscreen: vi.fn(),
    isFullscreen: false,
    ...overrides,
  };
}

describe("historyMenu", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    historyMenu.hide();
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
});
