import { describe, it, expect, vi, beforeEach } from "vitest";
import { init } from "../src/js/dragDrop.js";

const onDragDropEvent = vi.fn();

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ onDragDropEvent }),
}));

describe("dragDrop.init", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function registeredHandler(onDrop) {
    await init({ onDrop });
    return onDragDropEvent.mock.calls[0][0];
  }

  it("opens the first dropped path", async () => {
    const onDrop = vi.fn();
    const handler = await registeredHandler(onDrop);

    handler({ payload: { type: "drop", paths: ["a.pdf", "b.pdf"] } });

    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith("a.pdf");
  });

  it("ignores paths beyond the first when multiple files are dropped", async () => {
    const onDrop = vi.fn();
    const handler = await registeredHandler(onDrop);

    handler({ payload: { type: "drop", paths: ["only.pdf"] } });

    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it.each([["enter"], ["over"], ["leave"]])(
    "does nothing for a %s event",
    async (type) => {
      const onDrop = vi.fn();
      const handler = await registeredHandler(onDrop);

      handler({ payload: { type } });

      expect(onDrop).not.toHaveBeenCalled();
    }
  );
});
