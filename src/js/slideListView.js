import * as pdfViewer from "./pdfViewer.js";

const CONTAINER_ID = "slide-list-view";
const THUMBNAIL_MAX_WIDTH = 200;

let containerElement = null;

/** @returns {boolean} whether the slide list view is currently shown */
export function isActive() {
  return containerElement !== null;
}

/**
 * Moves the `.current` highlight to the tile for `pageNumber`, if the grid
 * is currently shown.
 * @param {number} pageNumber
 */
function highlightTile(pageNumber) {
  if (!containerElement) return;
  const current = containerElement.querySelector(".slide-list-tile.current");
  if (current) current.classList.remove("current");

  const tiles = containerElement.querySelectorAll(".slide-list-tile");
  tiles[pageNumber - 1]?.classList.add("current");
}

/**
 * Shows the slide list view: a grid of page-number + thumbnail tiles for
 * every page, with the tile matching `currentPage` highlighted. Replaces any
 * already-shown grid.
 * @param {number} totalPages
 * @param {number} currentPage
 * @param {{ onSelectSlide: (pageNumber: number) => void, onHighlightSlide: (pageNumber: number) => void }} callbacks
 */
export function show(totalPages, currentPage, { onSelectSlide, onHighlightSlide }) {
  hide();

  const container = document.createElement("div");
  container.id = CONTAINER_ID;
  container.className = "slide-list-view";

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const tile = document.createElement("div");
    tile.className = "slide-list-tile";
    if (pageNumber === currentPage) {
      tile.classList.add("current");
    }

    const numberLabel = document.createElement("div");
    numberLabel.className = "slide-list-page-number";
    numberLabel.textContent = String(pageNumber);
    tile.appendChild(numberLabel);

    const canvas = document.createElement("canvas");
    canvas.className = "slide-list-thumbnail";
    tile.appendChild(canvas);

    tile.addEventListener("click", () => {
      highlightTile(pageNumber);
      onHighlightSlide(pageNumber);
    });
    tile.addEventListener("dblclick", () => {
      highlightTile(pageNumber);
      onSelectSlide(pageNumber);
    });
    container.appendChild(tile);

    pdfViewer
      .renderThumbnail(pageNumber, canvas, THUMBNAIL_MAX_WIDTH)
      .catch((error) =>
        console.error(`Failed to render thumbnail for page ${pageNumber}`, error)
      );
  }

  document.body.appendChild(container);
  containerElement = container;
}

/** Hides and discards the currently shown slide list view, if any. */
export function hide() {
  if (containerElement) {
    containerElement.remove();
    containerElement = null;
  }
}
