import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateSize, fitToAspectRatio } from "../src/js/windowSizer.js";

const isMaximized = vi.fn();
const unmaximize = vi.fn();
const innerSize = vi.fn();
const setSize = vi.fn();
const currentMonitor = vi.fn();

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ isMaximized, unmaximize, innerSize, setSize, currentMonitor }),
}));

vi.mock("@tauri-apps/api/dpi", () => ({
  PhysicalSize: class PhysicalSize {
    constructor(width, height) {
      this.width = width;
      this.height = height;
    }
  },
}));

describe("calculateSize", () => {
  it("preserves area while matching a landscape aspect ratio", () => {
    const { width, height } = calculateSize(1000, 1000, 2);
    expect(width / height).toBeCloseTo(2, 1);
    expect(width * height).toBeCloseTo(1000 * 1000, -3);
  });

  it("preserves area while matching a portrait aspect ratio", () => {
    const { width, height } = calculateSize(800, 600, 0.5);
    expect(width / height).toBeCloseTo(0.5, 1);
    expect(width * height).toBeCloseTo(800 * 600, -3);
  });

  it("returns the same size when already at the target aspect ratio", () => {
    const { width, height } = calculateSize(800, 600, 800 / 600);
    expect(width).toBeCloseTo(800, -1);
    expect(height).toBeCloseTo(600, -1);
  });

  it("returns the unclamped size when it already fits within maxWidth/maxHeight", () => {
    const { width, height } = calculateSize(1000, 1000, 2, 4000, 4000);
    expect(width / height).toBeCloseTo(2, 1);
    expect(width * height).toBeCloseTo(1000 * 1000, -3);
  });

  it("scales down to fit within maxWidth while preserving the aspect ratio", () => {
    // A very wide/short target (aspect ratio 10) driven by a huge current
    // area would naturally exceed a modest screen width.
    const { width, height } = calculateSize(2000, 2000, 10, 1920, 1080);
    expect(width).toBeLessThanOrEqual(1920);
    expect(height).toBeLessThanOrEqual(1080);
    expect(width / height).toBeCloseTo(10, 1);
  });

  it("scales down to fit within maxHeight while preserving the aspect ratio", () => {
    // A very tall/narrow target (aspect ratio 0.1) would naturally exceed a
    // modest screen height.
    const { width, height } = calculateSize(2000, 2000, 0.1, 1920, 1080);
    expect(width).toBeLessThanOrEqual(1920);
    expect(height).toBeLessThanOrEqual(1080);
    expect(width / height).toBeCloseTo(0.1, 1);
  });
});

describe("fitToAspectRatio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    innerSize.mockResolvedValue({ width: 1000, height: 1000 });
    // Large enough that it never clamps the sizes computed in the tests below
    // unless a test overrides it to exercise the clamping path.
    currentMonitor.mockResolvedValue({ size: { width: 4000, height: 4000 } });
  });

  it("resizes without unmaximizing when the window is not maximized", async () => {
    isMaximized.mockResolvedValue(false);

    await fitToAspectRatio(2);

    expect(unmaximize).not.toHaveBeenCalled();
    expect(setSize).toHaveBeenCalledTimes(1);
    const sizeArg = setSize.mock.calls[0][0];
    expect(sizeArg.width / sizeArg.height).toBeCloseTo(2, 1);
  });

  it("unmaximizes before resizing when the window is maximized", async () => {
    isMaximized.mockResolvedValue(true);

    await fitToAspectRatio(2);

    expect(unmaximize).toHaveBeenCalledTimes(1);
    expect(setSize).toHaveBeenCalledTimes(1);
  });

  it("passes the current monitor's size as the clamp bound", async () => {
    isMaximized.mockResolvedValue(false);
    currentMonitor.mockResolvedValue({ size: { width: 500, height: 500 } });
    innerSize.mockResolvedValue({ width: 2000, height: 2000 });

    await fitToAspectRatio(10); // would naturally be far wider than the 500px-wide monitor

    const sizeArg = setSize.mock.calls[0][0];
    expect(sizeArg.width).toBeLessThanOrEqual(500);
    expect(sizeArg.height).toBeLessThanOrEqual(500);
  });

  it("falls back to an unclamped size when currentMonitor() resolves to null", async () => {
    isMaximized.mockResolvedValue(false);
    currentMonitor.mockResolvedValue(null);

    await fitToAspectRatio(2);

    expect(setSize).toHaveBeenCalledTimes(1);
    const sizeArg = setSize.mock.calls[0][0];
    expect(sizeArg.width / sizeArg.height).toBeCloseTo(2, 1);
  });

  it("falls back to an unclamped size when currentMonitor() rejects", async () => {
    isMaximized.mockResolvedValue(false);
    currentMonitor.mockRejectedValue(new Error("monitor lookup failed"));

    await fitToAspectRatio(2);

    expect(setSize).toHaveBeenCalledTimes(1);
    const sizeArg = setSize.mock.calls[0][0];
    expect(sizeArg.width / sizeArg.height).toBeCloseTo(2, 1);
  });
});
