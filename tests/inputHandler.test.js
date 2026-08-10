import { describe, it, expect, vi, beforeEach } from "vitest";
import * as pageNavigator from "../src/js/pageNavigator.js";
import * as laserPointer from "../src/js/laserPointer.js";
import * as fileHistory from "../src/js/fileHistory.js";
import * as historyMenu from "../src/js/historyMenu.js";
import * as fullscreen from "../src/js/fullscreen.js";
import * as slideListView from "../src/js/slideListView.js";
import { init } from "../src/js/inputHandler.js";

vi.mock("../src/js/pageNavigator.js", () => ({
  next: vi.fn(),
  prev: vi.fn(),
  getTotalPages: vi.fn(() => 0),
  getCurrentPage: vi.fn(() => 1),
  goTo: vi.fn(),
}));

vi.mock("../src/js/laserPointer.js", () => ({
  startStroke: vi.fn(),
  addPoint: vi.fn(),
  endStroke: vi.fn(),
}));

vi.mock("../src/js/fileHistory.js", () => ({
  getAll: vi.fn(() => []),
}));

vi.mock("../src/js/historyMenu.js", () => ({
  show: vi.fn(),
}));

vi.mock("../src/js/fullscreen.js", () => ({
  isFullscreen: vi.fn(),
  toggle: vi.fn(),
  exit: vi.fn(),
}));

vi.mock("../src/js/slideListView.js", () => ({
  isActive: vi.fn(() => false),
  show: vi.fn(),
  hide: vi.fn(),
}));

function setUp(overrides = {}) {
  const target = new EventTarget();
  const closeWindow = vi.fn();
  const openHistoryFile = vi.fn();
  const openFileDialog = vi.fn();
  init({ target, closeWindow, openHistoryFile, openFileDialog, ...overrides });
  return { target, closeWindow, openHistoryFile, openFileDialog };
}

describe("inputHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fullscreen.isFullscreen.mockResolvedValue(false);
    fullscreen.toggle.mockResolvedValue(undefined);
    fullscreen.exit.mockResolvedValue(undefined);
    slideListView.isActive.mockReturnValue(false);
    pageNavigator.getTotalPages.mockReturnValue(0);
    pageNavigator.getCurrentPage.mockReturnValue(1);
  });

  it.each([
    ["ArrowRight"],
    ["ArrowDown"],
    [" "],
  ])("calls pageNavigator.next() on keydown %s", (key) => {
    const { target } = setUp();
    target.dispatchEvent(new KeyboardEvent("keydown", { key }));
    expect(pageNavigator.next).toHaveBeenCalledTimes(1);
    expect(pageNavigator.prev).not.toHaveBeenCalled();
  });

  it.each([
    ["ArrowLeft"],
    ["ArrowUp"],
    ["Backspace"],
  ])("calls pageNavigator.prev() on keydown %s", (key) => {
    const { target } = setUp();
    target.dispatchEvent(new KeyboardEvent("keydown", { key }));
    expect(pageNavigator.prev).toHaveBeenCalledTimes(1);
    expect(pageNavigator.next).not.toHaveBeenCalled();
  });

  it("calls pageNavigator.next() on wheel down", () => {
    const { target } = setUp();
    target.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
    expect(pageNavigator.next).toHaveBeenCalledTimes(1);
  });

  it("calls pageNavigator.prev() on wheel up", () => {
    const { target } = setUp();
    target.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }));
    expect(pageNavigator.prev).toHaveBeenCalledTimes(1);
  });

  it("closes the window on Escape when not in fullscreen", async () => {
    const { target, closeWindow } = setUp();
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await vi.waitFor(() => expect(closeWindow).toHaveBeenCalledTimes(1));
    expect(fullscreen.exit).not.toHaveBeenCalled();
  });

  it("exits fullscreen instead of closing the window on Escape when in fullscreen", async () => {
    fullscreen.isFullscreen.mockResolvedValue(true);
    const { target, closeWindow } = setUp();

    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    await vi.waitFor(() => expect(fullscreen.exit).toHaveBeenCalledTimes(1));
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it("drives laserPointer through mousedown -> mousemove -> mouseup on the left button", () => {
    const { target } = setUp();
    target.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, clientX: 10, clientY: 20 })
    );
    target.dispatchEvent(
      new MouseEvent("mousemove", { button: 0, clientX: 15, clientY: 25 })
    );
    target.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));

    expect(laserPointer.startStroke).toHaveBeenCalledWith(10, 20);
    expect(laserPointer.addPoint).toHaveBeenCalledWith(15, 25);
    expect(laserPointer.endStroke).toHaveBeenCalledTimes(1);
  });

  it("ignores mousedown/mouseup for buttons other than the left button", () => {
    const { target } = setUp();
    target.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
    target.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));

    expect(laserPointer.startStroke).not.toHaveBeenCalled();
    expect(laserPointer.endStroke).not.toHaveBeenCalled();
  });

  it("starts the laser pointer when clicking inside the presentation surface (#viewer)", () => {
    const target = document.createElement("div");
    const viewer = document.createElement("div");
    viewer.id = "viewer";
    const canvas = document.createElement("canvas");
    viewer.appendChild(canvas);
    target.appendChild(viewer);
    init({ target });

    canvas.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, bubbles: true, clientX: 10, clientY: 20 })
    );

    expect(laserPointer.startStroke).toHaveBeenCalledWith(10, 20);
  });

  it("does not start the laser pointer when clicking outside the presentation surface (e.g. the history menu)", () => {
    const target = document.createElement("div");
    const viewer = document.createElement("div");
    viewer.id = "viewer";
    const menu = document.createElement("ul");
    menu.id = "history-menu";
    const menuItem = document.createElement("li");
    menu.appendChild(menuItem);
    target.appendChild(viewer);
    target.appendChild(menu);
    init({ target });

    menuItem.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, bubbles: true, clientX: 10, clientY: 20 })
    );

    expect(laserPointer.startStroke).not.toHaveBeenCalled();
  });

  it("prevents the default context menu", () => {
    const { target } = setUp();
    const event = new MouseEvent("contextmenu", { cancelable: true });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("shows the history menu with the current history and fullscreen state on right-click", async () => {
    fileHistory.getAll.mockReturnValue(["a.pdf", "b.pdf"]);
    fullscreen.isFullscreen.mockResolvedValue(false);
    const { target } = setUp();

    target.dispatchEvent(
      new MouseEvent("contextmenu", { clientX: 30, clientY: 40, cancelable: true })
    );

    await vi.waitFor(() => expect(historyMenu.show).toHaveBeenCalledTimes(1));
    expect(historyMenu.show).toHaveBeenCalledWith(30, 40, ["a.pdf", "b.pdf"], {
      onSelectEntry: expect.any(Function),
      onOpenFile: expect.any(Function),
      onToggleFullscreen: expect.any(Function),
      isFullscreen: false,
      onToggleSlideList: expect.any(Function),
      isSlideListActive: false,
      canShowSlideList: false,
    });
  });

  it("passes the current fullscreen state to the history menu when in fullscreen", async () => {
    fullscreen.isFullscreen.mockResolvedValue(true);
    const { target } = setUp();

    target.dispatchEvent(new MouseEvent("contextmenu", { cancelable: true }));

    await vi.waitFor(() =>
      expect(historyMenu.show).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ isFullscreen: true })
      )
    );
  });

  it("calls openHistoryFile with the selected path from the history menu", async () => {
    const { target, openHistoryFile } = setUp();

    target.dispatchEvent(new MouseEvent("contextmenu", { cancelable: true }));
    await vi.waitFor(() => expect(historyMenu.show).toHaveBeenCalledTimes(1));
    const { onSelectEntry } = historyMenu.show.mock.calls[0][3];
    onSelectEntry("picked.pdf");

    expect(openHistoryFile).toHaveBeenCalledWith("picked.pdf");
  });

  it("calls openFileDialog when the history menu's 'open file' item is chosen", async () => {
    const { target, openFileDialog } = setUp();

    target.dispatchEvent(new MouseEvent("contextmenu", { cancelable: true }));
    await vi.waitFor(() => expect(historyMenu.show).toHaveBeenCalledTimes(1));
    const { onOpenFile } = historyMenu.show.mock.calls[0][3];
    onOpenFile();

    expect(openFileDialog).toHaveBeenCalledTimes(1);
  });

  it("toggles fullscreen when the history menu's fullscreen item is chosen", async () => {
    const { target } = setUp();

    target.dispatchEvent(new MouseEvent("contextmenu", { cancelable: true }));
    await vi.waitFor(() => expect(historyMenu.show).toHaveBeenCalledTimes(1));
    const { onToggleFullscreen } = historyMenu.show.mock.calls[0][3];
    onToggleFullscreen();

    expect(fullscreen.toggle).toHaveBeenCalledTimes(1);
  });

  it("passes canShowSlideList=true and the current slide list state to the history menu", async () => {
    pageNavigator.getTotalPages.mockReturnValue(5);
    slideListView.isActive.mockReturnValue(true);
    const { target } = setUp();

    target.dispatchEvent(new MouseEvent("contextmenu", { cancelable: true }));

    await vi.waitFor(() =>
      expect(historyMenu.show).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ canShowSlideList: true, isSlideListActive: true })
      )
    );
  });

  it("shows the slide list view when the history menu's slide list item is chosen while inactive", async () => {
    pageNavigator.getTotalPages.mockReturnValue(5);
    pageNavigator.getCurrentPage.mockReturnValue(3);
    slideListView.isActive.mockReturnValue(false);
    const { target } = setUp();

    target.dispatchEvent(new MouseEvent("contextmenu", { cancelable: true }));
    await vi.waitFor(() => expect(historyMenu.show).toHaveBeenCalledTimes(1));
    const { onToggleSlideList } = historyMenu.show.mock.calls[0][3];
    onToggleSlideList();

    expect(slideListView.show).toHaveBeenCalledWith(5, 3, {
      onHighlightSlide: expect.any(Function),
      onSelectSlide: expect.any(Function),
    });
    expect(slideListView.hide).not.toHaveBeenCalled();
  });

  it("hides the slide list view when the history menu's slide list item is chosen while active", async () => {
    slideListView.isActive.mockReturnValue(true);
    const { target } = setUp();

    target.dispatchEvent(new MouseEvent("contextmenu", { cancelable: true }));
    await vi.waitFor(() => expect(historyMenu.show).toHaveBeenCalledTimes(1));
    const { onToggleSlideList } = historyMenu.show.mock.calls[0][3];
    onToggleSlideList();

    expect(slideListView.hide).toHaveBeenCalledTimes(1);
    expect(slideListView.show).not.toHaveBeenCalled();
  });

  it("jumps to the selected page and hides the slide list view when a slide is selected", async () => {
    pageNavigator.getTotalPages.mockReturnValue(5);
    slideListView.isActive.mockReturnValue(false);
    const { target } = setUp();

    target.dispatchEvent(new MouseEvent("contextmenu", { cancelable: true }));
    await vi.waitFor(() => expect(historyMenu.show).toHaveBeenCalledTimes(1));
    const { onToggleSlideList } = historyMenu.show.mock.calls[0][3];
    onToggleSlideList();
    const { onSelectSlide } = slideListView.show.mock.calls[0][2];
    onSelectSlide(4);

    expect(pageNavigator.goTo).toHaveBeenCalledWith(4);
    expect(slideListView.hide).toHaveBeenCalledTimes(1);
  });

  it("jumps to the highlighted page without hiding the slide list view on single-click selection", async () => {
    pageNavigator.getTotalPages.mockReturnValue(5);
    slideListView.isActive.mockReturnValue(false);
    const { target } = setUp();

    target.dispatchEvent(new MouseEvent("contextmenu", { cancelable: true }));
    await vi.waitFor(() => expect(historyMenu.show).toHaveBeenCalledTimes(1));
    const { onToggleSlideList } = historyMenu.show.mock.calls[0][3];
    onToggleSlideList();
    const { onHighlightSlide } = slideListView.show.mock.calls[0][2];
    onHighlightSlide(2);

    expect(pageNavigator.goTo).toHaveBeenCalledWith(2);
    expect(slideListView.hide).not.toHaveBeenCalled();
  });

  it.each([["ArrowRight"], ["ArrowLeft"], [" "], ["Backspace"]])(
    "ignores keydown %s while the slide list view is active",
    (key) => {
      slideListView.isActive.mockReturnValue(true);
      const { target } = setUp();

      target.dispatchEvent(new KeyboardEvent("keydown", { key }));

      expect(pageNavigator.next).not.toHaveBeenCalled();
      expect(pageNavigator.prev).not.toHaveBeenCalled();
    }
  );

  it("ignores wheel events while the slide list view is active", () => {
    slideListView.isActive.mockReturnValue(true);
    const { target } = setUp();

    target.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
    target.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }));

    expect(pageNavigator.next).not.toHaveBeenCalled();
    expect(pageNavigator.prev).not.toHaveBeenCalled();
  });

  it("hides the slide list view instead of exiting fullscreen or closing the window on Escape while active", async () => {
    slideListView.isActive.mockReturnValue(true);
    const { target, closeWindow } = setUp();

    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    await vi.waitFor(() => expect(slideListView.hide).toHaveBeenCalledTimes(1));
    expect(fullscreen.isFullscreen).not.toHaveBeenCalled();
    expect(fullscreen.exit).not.toHaveBeenCalled();
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it("keeps page navigation active while the laser pointer is in use", () => {
    const { target } = setUp();
    target.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, clientX: 0, clientY: 0 })
    );
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

    expect(pageNavigator.next).toHaveBeenCalledTimes(1);
    expect(laserPointer.startStroke).toHaveBeenCalledTimes(1);
  });
});
