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
