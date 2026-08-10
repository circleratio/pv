import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

if (typeof process !== "undefined" && process.env.VITEST) {
  // Under Vitest (Node.js), import.meta.url is a virtual dev-server URL, and the
  // Vite-resolved asset URL above is not import()-able either, so point the
  // fake-worker fallback directly at the file on disk via the working directory.
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "file:///" +
    process.cwd().replace(/\\/g, "/") +
    "/node_modules/pdfjs-dist/build/pdf.worker.mjs";
} else {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
}

let pdfDocument = null;
let currentPageNumber = 1;
let currentRenderTask = null;
let renderGeneration = 0;

/**
 * Computes the largest scale that fits `viewport` (at scale 1) inside the given
 * window size while preserving its aspect ratio.
 * @param {{width: number, height: number}} viewport
 * @param {number} windowWidth
 * @param {number} windowHeight
 */
export function calculateFitScale(viewport, windowWidth, windowHeight) {
  const scaleX = windowWidth / viewport.width;
  const scaleY = windowHeight / viewport.height;
  return Math.min(scaleX, scaleY);
}

/**
 * Loads a PDF document from binary data.
 * @param {Uint8Array | ArrayBuffer} binaryData
 * @returns {Promise<number>} total page count
 */
export async function loadPdf(binaryData) {
  const data =
    binaryData instanceof Uint8Array ? binaryData : new Uint8Array(binaryData);
  pdfDocument = await pdfjsLib.getDocument({ data }).promise;
  currentPageNumber = 1;
  return pdfDocument.numPages;
}

/**
 * Returns the width/height aspect ratio of the given page (at scale 1).
 * @param {number} [pageNumber]
 * @returns {Promise<number>}
 */
export async function getPageAspectRatio(pageNumber = 1) {
  if (!pdfDocument) {
    throw new Error("PDF is not loaded");
  }
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  return viewport.width / viewport.height;
}

/**
 * Renders the given page number onto #pdf-canvas, fit to the current window size.
 *
 * Overlapping render() calls on the same canvas corrupt each other's output
 * (one call's `canvas.width` reset clears the canvas out from under the
 * other's in-flight draw), which can happen when a window resize (e.g. from
 * windowSizer fitting the window to a newly opened PDF) triggers onResize()
 * while an explicit renderPage() call from openFile() is still in progress.
 * Two safeguards handle this: any already-running render task is cancelled
 * up front, and a generation counter detects the case where two calls' async
 * `getPage()` lookups resolve out of order (so the stale one, once it
 * resumes, bails out before touching the canvas at all instead of racing the
 * newer call's task-cancellation check).
 * @param {number} pageNumber
 */
export async function renderPage(pageNumber) {
  if (!pdfDocument) {
    throw new Error("PDF is not loaded");
  }
  currentPageNumber = pageNumber;

  const generation = ++renderGeneration;
  if (currentRenderTask) {
    currentRenderTask.cancel();
    currentRenderTask = null;
  }

  const page = await pdfDocument.getPage(pageNumber);
  if (generation !== renderGeneration) {
    return; // superseded by a newer renderPage() call while awaiting getPage()
  }

  const baseViewport = page.getViewport({ scale: 1 });
  const scale = calculateFitScale(baseViewport, window.innerWidth, window.innerHeight);
  const viewport = page.getViewport({ scale });

  const canvas = document.getElementById("pdf-canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const overlayCanvas = document.getElementById("overlay-canvas");
  if (overlayCanvas) {
    overlayCanvas.width = viewport.width;
    overlayCanvas.height = viewport.height;
  }

  const context = canvas.getContext("2d");
  const renderTask = page.render({ canvasContext: context, viewport });
  currentRenderTask = renderTask;

  try {
    await renderTask.promise;
  } catch (error) {
    if (!(error instanceof pdfjsLib.RenderingCancelledException)) {
      throw error;
    }
  } finally {
    if (currentRenderTask === renderTask) {
      currentRenderTask = null;
    }
  }
}

/**
 * Re-renders the currently displayed page for the new window size.
 */
export function onResize() {
  if (!pdfDocument) {
    return Promise.resolve();
  }
  return renderPage(currentPageNumber);
}
