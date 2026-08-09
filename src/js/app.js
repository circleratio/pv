import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import * as pdfViewer from "./pdfViewer.js";
import * as pageNavigator from "./pageNavigator.js";
import * as inputHandler from "./inputHandler.js";

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

export async function start() {
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

  let binaryData;
  try {
    binaryData = await invoke("read_pdf_file", { path });
  } catch (error) {
    console.error("Failed to read PDF file", error);
    showError("PDFファイルの読み込みに失敗しました。");
    return;
  }

  let totalPages;
  try {
    totalPages = await pdfViewer.loadPdf(new Uint8Array(binaryData));
  } catch (error) {
    console.error("Failed to parse PDF", error);
    showError("PDFファイルの解析に失敗しました。");
    return;
  }

  pageNavigator.init(totalPages, (page) => {
    pdfViewer.renderPage(page);
  });

  await pdfViewer.renderPage(1);

  inputHandler.init();
  window.addEventListener("resize", () => pdfViewer.onResize());
}

if (typeof process === "undefined" || !process.env.VITEST) {
  start();
}
