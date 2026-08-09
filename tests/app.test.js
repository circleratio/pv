import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import * as pdfViewer from "../src/js/pdfViewer.js";
import * as pageNavigator from "../src/js/pageNavigator.js";
import * as inputHandler from "../src/js/inputHandler.js";
import { start } from "../src/js/app.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../src/js/pdfViewer.js", () => ({
  loadPdf: vi.fn(),
  renderPage: vi.fn(),
  onResize: vi.fn(),
}));
vi.mock("../src/js/pageNavigator.js", () => ({ init: vi.fn() }));
vi.mock("../src/js/inputHandler.js", () => ({ init: vi.fn() }));

describe("app.start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `<div id="viewer"><canvas id="pdf-canvas"></canvas></div>`;
    pdfViewer.loadPdf.mockResolvedValue(3);
  });

  it("skips the dialog and shows the PDF when a path argument was given", async () => {
    invoke.mockImplementation((cmd) => {
      if (cmd === "get_initial_pdf_path") return Promise.resolve("foo.pdf");
      if (cmd === "read_pdf_file") return Promise.resolve(new Uint8Array([1, 2, 3]));
      throw new Error(`unexpected command: ${cmd}`);
    });

    await start();

    expect(open).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith("read_pdf_file", { path: "foo.pdf" });
    expect(pdfViewer.loadPdf).toHaveBeenCalledTimes(1);
    expect(pageNavigator.init).toHaveBeenCalledWith(3, expect.any(Function));
    expect(pdfViewer.renderPage).toHaveBeenCalledWith(1);
    expect(inputHandler.init).toHaveBeenCalledTimes(1);
  });

  it("shows the file dialog and then the PDF when no path argument was given", async () => {
    invoke.mockImplementation((cmd) => {
      if (cmd === "get_initial_pdf_path") return Promise.resolve(null);
      if (cmd === "read_pdf_file") return Promise.resolve(new Uint8Array([9]));
      throw new Error(`unexpected command: ${cmd}`);
    });
    open.mockResolvedValue("chosen.pdf");

    await start();

    expect(open).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("read_pdf_file", { path: "chosen.pdf" });
    expect(pdfViewer.renderPage).toHaveBeenCalledWith(1);
    expect(inputHandler.init).toHaveBeenCalledTimes(1);
  });

  it("shows an error and does not proceed when the file fails to read", async () => {
    invoke.mockImplementation((cmd) => {
      if (cmd === "get_initial_pdf_path") return Promise.resolve("missing.pdf");
      if (cmd === "read_pdf_file") return Promise.reject(new Error("not found"));
      throw new Error(`unexpected command: ${cmd}`);
    });

    await start();

    expect(pdfViewer.loadPdf).not.toHaveBeenCalled();
    expect(inputHandler.init).not.toHaveBeenCalled();
    expect(document.getElementById("viewer").textContent).not.toBe("");
  });
});
