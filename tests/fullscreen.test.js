import { describe, it, expect, vi, beforeEach } from "vitest";
import { isFullscreen, toggle, exit } from "../src/js/fullscreen.js";

const isFullscreenMock = vi.fn();
const setFullscreen = vi.fn();

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ isFullscreen: isFullscreenMock, setFullscreen }),
}));

describe("fullscreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isFullscreen() returns the window's current state", async () => {
    isFullscreenMock.mockResolvedValue(true);
    await expect(isFullscreen()).resolves.toBe(true);

    isFullscreenMock.mockResolvedValue(false);
    await expect(isFullscreen()).resolves.toBe(false);
  });

  it("toggle() switches to normal mode when currently fullscreen", async () => {
    isFullscreenMock.mockResolvedValue(true);

    await toggle();

    expect(setFullscreen).toHaveBeenCalledWith(false);
  });

  it("toggle() switches to fullscreen mode when currently normal", async () => {
    isFullscreenMock.mockResolvedValue(false);

    await toggle();

    expect(setFullscreen).toHaveBeenCalledWith(true);
  });

  it("exit() sets fullscreen to false", async () => {
    await exit();

    expect(setFullscreen).toHaveBeenCalledWith(false);
  });
});
