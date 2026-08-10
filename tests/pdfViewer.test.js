import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  calculateFitScale,
  loadPdf,
  renderPage,
  renderThumbnail,
  onResize,
  getPageAspectRatio,
} from "../src/js/pdfViewer.js";

function fixturePath(name) {
  return path.join(process.cwd(), "tests", "fixtures", name);
}

describe("calculateFitScale", () => {
  it("fits a portrait page into a landscape window by height", () => {
    const viewport = { width: 595, height: 842 }; // portrait
    const scale = calculateFitScale(viewport, 1600, 900);
    expect(scale).toBeCloseTo(900 / 842);
  });

  it("fits a landscape page into a portrait window by width", () => {
    const viewport = { width: 842, height: 595 }; // landscape
    const scale = calculateFitScale(viewport, 900, 1600);
    expect(scale).toBeCloseTo(900 / 842);
  });

  it("returns the common ratio when page and window share the aspect ratio", () => {
    const viewport = { width: 400, height: 300 };
    const scale = calculateFitScale(viewport, 800, 600);
    expect(scale).toBeCloseTo(2);
  });
});

describe("loadPdf / renderPage / onResize", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <canvas id="pdf-canvas"></canvas>
      <canvas id="overlay-canvas"></canvas>
    `;
    window.innerWidth = 800;
    window.innerHeight = 600;
  });

  it("reports the correct page count for the sample PDF", async () => {
    const bytes = readFileSync(fixturePath("portrait.pdf"));
    const totalPages = await loadPdf(new Uint8Array(bytes));
    expect(totalPages).toBe(3);
  });

  it("renders a page without throwing", async () => {
    const bytes = readFileSync(fixturePath("landscape.pdf"));
    await loadPdf(new Uint8Array(bytes));
    await expect(renderPage(1)).resolves.not.toThrow();
  });

  it("re-renders the current page on resize", async () => {
    const bytes = readFileSync(fixturePath("portrait.pdf"));
    await loadPdf(new Uint8Array(bytes));
    await renderPage(2);
    const canvas = document.getElementById("pdf-canvas");
    const widthBeforeResize = canvas.width;

    window.innerWidth = 400;
    window.innerHeight = 300;
    await onResize();

    expect(canvas.width).not.toBe(widthBeforeResize);
  });

  it("cancels an in-flight render instead of erroring when renderPage() is called again before it finishes", async () => {
    const bytes = readFileSync(fixturePath("portrait.pdf"));
    await loadPdf(new Uint8Array(bytes));

    // Simulates a resize-triggered renderPage() overlapping with an explicit
    // one, e.g. from openFile()'s windowSizer.fitToAspectRatio() call firing
    // the window's resize listener while renderPage(1) is still in flight.
    const first = renderPage(1);
    const second = renderPage(2);

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
  });
});

describe("renderThumbnail", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <canvas id="pdf-canvas"></canvas>
      <canvas id="overlay-canvas"></canvas>
    `;
  });

  it("scales the thumbnail canvas to fit the given maxWidth, preserving aspect ratio", async () => {
    const bytes = readFileSync(fixturePath("landscape.pdf"));
    await loadPdf(new Uint8Array(bytes));

    const canvas = document.createElement("canvas");
    await renderThumbnail(1, canvas, 200);

    expect(canvas.width).toBe(200);
    expect(canvas.height).toBeGreaterThan(0);
    expect(canvas.height).toBeLessThan(canvas.width);
  });

  it("renders onto an independent canvas without throwing", async () => {
    const bytes = readFileSync(fixturePath("portrait.pdf"));
    await loadPdf(new Uint8Array(bytes));

    const canvas = document.createElement("canvas");
    await expect(renderThumbnail(2, canvas, 150)).resolves.not.toThrow();
    expect(canvas.width).toBe(150);
  });
});

describe("getPageAspectRatio", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <canvas id="pdf-canvas"></canvas>
      <canvas id="overlay-canvas"></canvas>
    `;
  });

  it("returns a ratio below 1 for a portrait page", async () => {
    const bytes = readFileSync(fixturePath("portrait.pdf"));
    await loadPdf(new Uint8Array(bytes));
    await expect(getPageAspectRatio(1)).resolves.toBeLessThan(1);
  });

  it("returns a ratio above 1 for a landscape page", async () => {
    const bytes = readFileSync(fixturePath("landscape.pdf"));
    await loadPdf(new Uint8Array(bytes));
    await expect(getPageAspectRatio(1)).resolves.toBeGreaterThan(1);
  });

  it("throws when called before a PDF is loaded", async () => {
    vi.resetModules();
    const freshPdfViewer = await import("../src/js/pdfViewer.js");
    await expect(freshPdfViewer.getPageAspectRatio(1)).rejects.toThrow(
      "PDF is not loaded"
    );
  });
});
