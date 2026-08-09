import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as laserPointer from "../src/js/laserPointer.js";

describe("laserPointer", () => {
  beforeEach(() => {
    document.body.innerHTML = `<canvas id="overlay-canvas" width="800" height="600"></canvas>`;
    // jsdom does not perform layout, so getBoundingClientRect() normally returns
    // all zeros. Stub it to match the canvas's own size with no offset, so the
    // canvas-relative coordinate conversion is a no-op for these tests.
    document.getElementById("overlay-canvas").getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    });
    laserPointer.reset();
    // Prevent the internal render loop from actually running asynchronously;
    // tests drive render() manually and only assert on its direct effects.
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("records a single-point stroke for a click without dragging", () => {
    laserPointer.startStroke(10, 20);
    laserPointer.endStroke();

    const strokes = laserPointer.getStrokes();
    expect(strokes).toHaveLength(1);
    expect(strokes[0].points).toEqual([{ x: 10, y: 20 }]);
  });

  it("records multiple points for a drag", () => {
    laserPointer.startStroke(10, 20);
    laserPointer.addPoint(15, 25);
    laserPointer.addPoint(20, 30);
    laserPointer.endStroke();

    const strokes = laserPointer.getStrokes();
    expect(strokes).toHaveLength(1);
    expect(strokes[0].points).toEqual([
      { x: 10, y: 20 },
      { x: 15, y: 25 },
      { x: 20, y: 30 },
    ]);
  });

  it("fades out opacity as time passes after endStroke", () => {
    laserPointer.startStroke(10, 20);
    laserPointer.endStroke();
    const [stroke] = laserPointer.getStrokes();

    const opacityAtEnd = laserPointer.calculateOpacity(stroke, Date.now());
    expect(opacityAtEnd).toBe(1);

    vi.advanceTimersByTime(750); // half of the 1500ms fade duration
    const opacityHalfway = laserPointer.calculateOpacity(stroke, Date.now());
    expect(opacityHalfway).toBeCloseTo(0.5);
    expect(opacityHalfway).toBeLessThan(opacityAtEnd);
  });

  it("discards a stroke once it has fully faded out", () => {
    laserPointer.startStroke(10, 20);
    laserPointer.endStroke();

    vi.advanceTimersByTime(1500);
    laserPointer.render();

    expect(laserPointer.getStrokes()).toHaveLength(0);
  });

  it("converts viewport coordinates to canvas-local coordinates when the canvas is offset (letterboxed)", () => {
    // Simulate the canvas being centered within a larger window, e.g. a
    // portrait PDF fit inside a landscape window (offset from the origin).
    document.getElementById("overlay-canvas").getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      width: 800,
      height: 600,
    });

    laserPointer.startStroke(110, 70); // 10px right / 20px down from the canvas's top-left
    laserPointer.endStroke();

    const strokes = laserPointer.getStrokes();
    expect(strokes[0].points).toEqual([{ x: 10, y: 20 }]);
  });

  it("scales viewport coordinates when the canvas's CSS size differs from its drawing buffer size", () => {
    document.getElementById("overlay-canvas").getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 400, // half of the 800x600 drawing buffer
      height: 300,
    });

    laserPointer.startStroke(20, 30);
    laserPointer.endStroke();

    const strokes = laserPointer.getStrokes();
    expect(strokes[0].points).toEqual([{ x: 40, y: 60 }]);
  });
});
