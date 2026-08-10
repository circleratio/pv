let currentPage = 1;
let totalPages = 0;
let onPageChange = null;

/**
 * @param {number} total total page count
 * @param {(page: number) => void} [onChange] called with the new page number whenever it changes
 */
export function init(total, onChange) {
  totalPages = total;
  currentPage = 1;
  onPageChange = onChange ?? null;
}

export function next() {
  if (currentPage < totalPages) {
    currentPage += 1;
    onPageChange?.(currentPage);
  }
}

export function prev() {
  if (currentPage > 1) {
    currentPage -= 1;
    onPageChange?.(currentPage);
  }
}

export function getCurrentPage() {
  return currentPage;
}

export function getTotalPages() {
  return totalPages;
}

/**
 * Jumps directly to `pageNumber`, clamped to [1, totalPages]. Used by the
 * slide list view's double-click selection.
 * @param {number} pageNumber
 */
export function goTo(pageNumber) {
  const clamped = Math.min(Math.max(pageNumber, 1), totalPages);
  if (clamped !== currentPage) {
    currentPage = clamped;
    onPageChange?.(currentPage);
  }
}
