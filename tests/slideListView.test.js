import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as pdfViewer from "../src/js/pdfViewer.js";
import * as slideListView from "../src/js/slideListView.js";

vi.mock("../src/js/pdfViewer.js", () => ({
  renderThumbnail: vi.fn(() => Promise.resolve()),
}));

function tiles() {
  return document.querySelectorAll(".slide-list-tile");
}

function callbacks(overrides = {}) {
  return {
    onSelectSlide: vi.fn(),
    onHighlightSlide: vi.fn(),
    ...overrides,
  };
}

describe("slideListView", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  afterEach(() => {
    slideListView.hide();
  });

  it("is inactive before show() is called", () => {
    expect(slideListView.isActive()).toBe(false);
  });

  it("renders one tile per page with the correct page numbers", () => {
    slideListView.show(3, 1, callbacks());

    const labels = [...document.querySelectorAll(".slide-list-page-number")].map(
      (el) => el.textContent
    );
    expect(labels).toEqual(["1", "2", "3"]);
    expect(slideListView.isActive()).toBe(true);
  });

  it("renders a thumbnail for every page via pdfViewer.renderThumbnail", () => {
    slideListView.show(2, 1, callbacks());

    expect(pdfViewer.renderThumbnail).toHaveBeenCalledTimes(2);
    expect(pdfViewer.renderThumbnail).toHaveBeenCalledWith(1, expect.any(HTMLCanvasElement), 200);
    expect(pdfViewer.renderThumbnail).toHaveBeenCalledWith(2, expect.any(HTMLCanvasElement), 200);
  });

  it("highlights the tile matching the current page", () => {
    slideListView.show(3, 2, callbacks());

    const allTiles = tiles();
    expect(allTiles[0].classList.contains("current")).toBe(false);
    expect(allTiles[1].classList.contains("current")).toBe(true);
    expect(allTiles[2].classList.contains("current")).toBe(false);
  });

  it("calls onSelectSlide with the page number when a tile is double-clicked", () => {
    const cb = callbacks();
    slideListView.show(3, 1, cb);

    tiles()[2].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    expect(cb.onSelectSlide).toHaveBeenCalledWith(3);
  });

  it("calls onHighlightSlide with the page number when a tile is single-clicked", () => {
    const cb = callbacks();
    slideListView.show(3, 1, cb);

    tiles()[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(cb.onHighlightSlide).toHaveBeenCalledWith(3);
    expect(cb.onSelectSlide).not.toHaveBeenCalled();
  });

  it("does not hide the grid when a tile is single-clicked", () => {
    const cb = callbacks();
    slideListView.show(3, 1, cb);

    tiles()[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(slideListView.isActive()).toBe(true);
    expect(document.getElementById("slide-list-view")).not.toBeNull();
  });

  it("moves the current highlight to the single-clicked tile", () => {
    slideListView.show(3, 1, callbacks());

    tiles()[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const allTiles = tiles();
    expect(allTiles[0].classList.contains("current")).toBe(false);
    expect(allTiles[2].classList.contains("current")).toBe(true);
  });

  it("moves the current highlight to the double-clicked tile", () => {
    slideListView.show(3, 1, callbacks());

    tiles()[1].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    const allTiles = tiles();
    expect(allTiles[0].classList.contains("current")).toBe(false);
    expect(allTiles[1].classList.contains("current")).toBe(true);
  });

  it("hide() removes the grid from the DOM and marks the view inactive", () => {
    slideListView.show(2, 1, callbacks());
    expect(document.getElementById("slide-list-view")).not.toBeNull();

    slideListView.hide();

    expect(document.getElementById("slide-list-view")).toBeNull();
    expect(slideListView.isActive()).toBe(false);
  });

  it("hide() is a no-op when nothing is shown", () => {
    expect(() => slideListView.hide()).not.toThrow();
  });

  it("replaces a previously shown grid when show() is called again", () => {
    slideListView.show(2, 1, callbacks());
    slideListView.show(4, 1, callbacks());

    expect(document.querySelectorAll("#slide-list-view")).toHaveLength(1);
    expect(tiles()).toHaveLength(4);
  });

  it("logs an error but keeps the grid when a thumbnail fails to render", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    pdfViewer.renderThumbnail.mockRejectedValueOnce(new Error("boom"));

    slideListView.show(1, 1, callbacks());
    await vi.waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());

    expect(tiles()).toHaveLength(1);
    consoleErrorSpy.mockRestore();
  });
});
