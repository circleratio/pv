import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import * as fileHistory from "../src/js/fileHistory.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("fileHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invoke.mockResolvedValue(undefined);
  });

  it("load() fetches the persisted history and exposes it via getAll()", async () => {
    invoke.mockResolvedValueOnce(["a.pdf", "b.pdf"]);

    const result = await fileHistory.load();

    expect(invoke).toHaveBeenCalledWith("load_history");
    expect(result).toEqual(["a.pdf", "b.pdf"]);
    expect(fileHistory.getAll()).toEqual(["a.pdf", "b.pdf"]);
  });

  it("add() inserts a new path at the front and persists it", async () => {
    invoke.mockResolvedValueOnce([]);
    await fileHistory.load();

    await fileHistory.add("new.pdf");

    expect(fileHistory.getAll()).toEqual(["new.pdf"]);
    expect(invoke).toHaveBeenCalledWith("save_history", { history: ["new.pdf"] });
  });

  it("add() moves an already-present path to the front without duplicating it", async () => {
    invoke.mockResolvedValueOnce(["a.pdf", "b.pdf", "c.pdf"]);
    await fileHistory.load();

    await fileHistory.add("b.pdf");

    expect(fileHistory.getAll()).toEqual(["b.pdf", "a.pdf", "c.pdf"]);
    expect(invoke).toHaveBeenCalledWith("save_history", {
      history: ["b.pdf", "a.pdf", "c.pdf"],
    });
  });

  it("add() drops the oldest entry once more than 10 distinct paths have been added", async () => {
    const initial = Array.from({ length: 10 }, (_, i) => `${i}.pdf`);
    invoke.mockResolvedValueOnce(initial);
    await fileHistory.load();

    await fileHistory.add("new.pdf");

    const result = fileHistory.getAll();
    expect(result).toHaveLength(10);
    expect(result[0]).toBe("new.pdf");
    expect(result).not.toContain("9.pdf");
  });
});
