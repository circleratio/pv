import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as historyMenu from "../src/js/historyMenu.js";

function historyItems() {
  return document.querySelectorAll(".history-menu-item:not(.history-menu-open-item)");
}

function openFileItem() {
  return document.querySelector(".history-menu-open-item");
}

describe("historyMenu", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    historyMenu.hide();
  });

  it("always shows a clickable 'open file' item", () => {
    historyMenu.show(0, 0, [], { onSelectEntry: vi.fn(), onOpenFile: vi.fn() });

    const item = openFileItem();
    expect(item).not.toBeNull();
    expect(item.textContent).toBe("ファイルを開く");
  });

  it("calls onOpenFile and hides the menu when the 'open file' item is clicked", () => {
    const onOpenFile = vi.fn();
    historyMenu.show(0, 0, ["a.pdf"], { onSelectEntry: vi.fn(), onOpenFile });

    openFileItem().dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onOpenFile).toHaveBeenCalledTimes(1);
    expect(document.getElementById("history-menu")).toBeNull();
  });

  it("renders each history entry as a clickable item", () => {
    historyMenu.show(10, 20, ["a.pdf", "b.pdf"], {
      onSelectEntry: vi.fn(),
      onOpenFile: vi.fn(),
    });

    const items = historyItems();
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe("a.pdf");
    expect(items[1].textContent).toBe("b.pdf");
  });

  it("calls onSelectEntry with the clicked path and hides the menu", () => {
    const onSelectEntry = vi.fn();
    historyMenu.show(0, 0, ["a.pdf", "b.pdf"], { onSelectEntry, onOpenFile: vi.fn() });

    historyItems()[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onSelectEntry).toHaveBeenCalledWith("b.pdf");
    expect(document.getElementById("history-menu")).toBeNull();
  });

  it("shows a non-clickable placeholder when there is no history", () => {
    historyMenu.show(0, 0, [], { onSelectEntry: vi.fn(), onOpenFile: vi.fn() });

    expect(historyItems()).toHaveLength(0);
    const empty = document.querySelector(".history-menu-empty");
    expect(empty).not.toBeNull();
    expect(empty.textContent).toBe("履歴なし");
  });

  it("hide() removes the menu from the DOM", () => {
    historyMenu.show(0, 0, ["a.pdf"], { onSelectEntry: vi.fn(), onOpenFile: vi.fn() });
    expect(document.getElementById("history-menu")).not.toBeNull();

    historyMenu.hide();

    expect(document.getElementById("history-menu")).toBeNull();
  });

  it("removes a menu that was already open when show() is called again", () => {
    historyMenu.show(0, 0, ["a.pdf"], { onSelectEntry: vi.fn(), onOpenFile: vi.fn() });
    historyMenu.show(0, 0, ["b.pdf"], { onSelectEntry: vi.fn(), onOpenFile: vi.fn() });

    expect(document.querySelectorAll("#history-menu")).toHaveLength(1);
    expect(historyItems()[0].textContent).toBe("b.pdf");
  });

  it("hides when clicking outside the menu", () => {
    historyMenu.show(0, 0, ["a.pdf"], { onSelectEntry: vi.fn(), onOpenFile: vi.fn() });

    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(document.getElementById("history-menu")).toBeNull();
  });
});
