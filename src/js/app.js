import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import * as pdfViewer from "./pdfViewer.js";
import * as pageNavigator from "./pageNavigator.js";
import * as inputHandler from "./inputHandler.js";
import * as fileHistory from "./fileHistory.js";

async function resolvePdfPath() {
  const initialPath = await invoke("get_initial_pdf_path");
  if (initialPath) return initialPath;
  return open({ filters: [{ name: "PDF", extensions: ["pdf"] }] });
}

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

  pageNavigator.init(totalPages, (page) => {
    pdfViewer.renderPage(page);
  });

  await pdfViewer.renderPage(1);
  await fileHistory.add(path);
  return true;
}

export async function start() {
  await fileHistory.load();

  let path;
  try {
    path = await resolvePdfPath();
  } catch (error) {
    console.error("Failed to resolve PDF path", error);
    showError("PDFファイルの選択に失敗しました。");
    return;
  }

  if (!path) {
    showError("PDFファイルが選択されませんでした。");
    return;
  }

  const opened = await openFile(path);
  if (!opened) return;

  inputHandler.init({ openHistoryFile: openFile });
  window.addEventListener("resize", () => pdfViewer.onResize());
}

if (typeof process === "undefined" || !process.env.VITEST) {
  start();
}
