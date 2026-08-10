import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateSize, fitToAspectRatio } from "../src/js/windowSizer.js";

const isMaximized = vi.fn();
const unmaximize = vi.fn();
const innerSize = vi.fn();
const setSize = vi.fn();

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ isMaximized, unmaximize, innerSize, setSize }),
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
});

describe("fitToAspectRatio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    innerSize.mockResolvedValue({ width: 1000, height: 1000 });
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
});
