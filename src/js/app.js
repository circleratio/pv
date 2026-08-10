import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import * as pdfViewer from "./pdfViewer.js";
import * as pageNavigator from "./pageNavigator.js";
import * as inputHandler from "./inputHandler.js";
import * as fileHistory from "./fileHistory.js";
import * as windowSizer from "./windowSizer.js";
import * as dragDrop from "./dragDrop.js";
import * as fullscreen from "./fullscreen.js";

function showError(message) {
  const viewer = document.getElementById("viewer");
  if (viewer) {
    viewer.innerHTML = `<p class="error-message">${message}</p>`;
  }
}

/**
 * Opens the PDF at `path`: reads it, shows its first page, and records it in
 * the file history. Shared by the initial launch, the file dialog and the
 * history menu.
 * @param {string} path
 * @returns {Promise<boolean>} whether the file was opened successfully
 */
export async function openFile(path) {
  let binaryData;
  try {
    binaryData = await invoke("read_pdf_file", { path });
  } catch (error) {
    console.error("Failed to read PDF file", error);
    showError("PDFファイルの読み込みに失敗しました。");
    return false;
  }

  let totalPages;
  try {
    totalPages = await pdfViewer.loadPdf(new Uint8Array(binaryData));
  } catch (error) {
    console.error("Failed to parse PDF", error);
    showError("PDFファイルの解析に失敗しました。");
    return false;
  }

  try {
    const inFullscreen = await fullscreen.isFullscreen();
    if (!inFullscreen) {
      const aspectRatio = await pdfViewer.getPageAspectRatio(1);
      await windowSizer.fitToAspectRatio(aspectRatio);
    }
  } catch (error) {
    console.error("Failed to resize window to fit the PDF", error);
  }

  pageNavigator.init(totalPages, (page) => {
    pdfViewer.renderPage(page);
  });

  await pdfViewer.renderPage(1);
  await fileHistory.add(path);
  return true;
}

/**
 * Shows the file selection dialog and opens the chosen PDF, if any.
 * Does nothing if the dialog is cancelled. Invoked from the right-click
 * history menu's "open file" item.
 */
export async function openFileViaDialog() {
  let path;
  try {
    path = await open({ filters: [{ name: "PDF", extensions: ["pdf"] }] });
  } catch (error) {
    console.error("Failed to open file dialog", error);
    return;
  }

  if (!path) return;
  await openFile(path);
}

export async function start() {
  await fileHistory.load();

  const initialPath = await invoke("get_initial_pdf_path").catch((error) => {
    console.error("Failed to resolve initial PDF path", error);
    return null;
  });

  if (initialPath) {
    const opened = await openFile(initialPath);
    if (!opened) return;
  }

  inputHandler.init({ openHistoryFile: openFile, openFileDialog: openFileViaDialog });
  await dragDrop.init({ onDrop: openFile });
  window.addEventListener("resize", () => pdfViewer.onResize());
}

if (typeof process === "undefined" || !process.env.VITEST) {
  start();
}
