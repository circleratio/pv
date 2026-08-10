import { describe, it, expect, vi, beforeEach } from "vitest";
import * as pageNavigator from "../src/js/pageNavigator.js";
import * as laserPointer from "../src/js/laserPointer.js";
import * as fileHistory from "../src/js/fileHistory.js";
import * as historyMenu from "../src/js/historyMenu.js";
import { init } from "../src/js/inputHandler.js";

vi.mock("../src/js/pageNavigator.js", () => ({
  next: vi.fn(),
  prev: vi.fn(),
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

function setUp(overrides = {}) {
  const target = new EventTarget();
  const closeWindow = vi.fn();
  const openHistoryFile = vi.fn();
  init({ target, closeWindow, openHistoryFile, ...overrides });
  return { target, closeWindow, openHistoryFile };
}

describe("inputHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("closes the window on Escape", () => {
    const { target, closeWindow } = setUp();
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(closeWindow).toHaveBeenCalledTimes(1);
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

  it("prevents the default context menu", () => {
    const { target } = setUp();
    const event = new MouseEvent("contextmenu", { cancelable: true });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("shows the history menu with the current history on right-click", () => {
    fileHistory.getAll.mockReturnValue(["a.pdf", "b.pdf"]);
    const { target } = setUp();

    target.dispatchEvent(
      new MouseEvent("contextmenu", { clientX: 30, clientY: 40, cancelable: true })
    );

    expect(historyMenu.show).toHaveBeenCalledWith(
      30,
      40,
      ["a.pdf", "b.pdf"],
      expect.any(Function)
    );
  });

  it("calls openHistoryFile with the selected path from the history menu", () => {
    const { target, openHistoryFile } = setUp();

    target.dispatchEvent(new MouseEvent("contextmenu", { cancelable: true }));
    const onSelect = historyMenu.show.mock.calls[0][3];
    onSelect("picked.pdf");

    expect(openHistoryFile).toHaveBeenCalledWith("picked.pdf");
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
