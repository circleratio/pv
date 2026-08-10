import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as historyMenu from "../src/js/historyMenu.js";

describe("historyMenu", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    historyMenu.hide();
  });

  it("renders each history entry as a clickable item", () => {
    historyMenu.show(10, 20, ["a.pdf", "b.pdf"], vi.fn());

    const items = document.querySelectorAll(".history-menu-item");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe("a.pdf");
    expect(items[1].textContent).toBe("b.pdf");
  });

  it("calls onSelect with the clicked path and hides the menu", () => {
    const onSelect = vi.fn();
    historyMenu.show(0, 0, ["a.pdf", "b.pdf"], onSelect);

    document.querySelectorAll(".history-menu-item")[1].dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );

    expect(onSelect).toHaveBeenCalledWith("b.pdf");
    expect(document.getElementById("history-menu")).toBeNull();
  });

  it("shows a non-clickable placeholder when there is no history", () => {
    historyMenu.show(0, 0, [], vi.fn());

    expect(document.querySelectorAll(".history-menu-item")).toHaveLength(0);
    const empty = document.querySelector(".history-menu-empty");
    expect(empty).not.toBeNull();
    expect(empty.textContent).toBe("履歴なし");
  });

  it("hide() removes the menu from the DOM", () => {
    historyMenu.show(0, 0, ["a.pdf"], vi.fn());
    expect(document.getElementById("history-menu")).not.toBeNull();

    historyMenu.hide();

    expect(document.getElementById("history-menu")).toBeNull();
  });

  it("removes a menu that was already open when show() is called again", () => {
    historyMenu.show(0, 0, ["a.pdf"], vi.fn());
    historyMenu.show(0, 0, ["b.pdf"], vi.fn());

    expect(document.querySelectorAll("#history-menu")).toHaveLength(1);
    expect(document.querySelector(".history-menu-item").textContent).toBe("b.pdf");
  });

  it("hides when clicking outside the menu", () => {
    historyMenu.show(0, 0, ["a.pdf"], vi.fn());

    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(document.getElementById("history-menu")).toBeNull();
  });
});
