/**
 * Computes a window size with the given aspect ratio (width/height) that
 * preserves the current width*height area as closely as possible.
 * @param {number} currentWidth
 * @param {number} currentHeight
 * @param {number} aspectRatio
 * @returns {{width: number, height: number}}
 */
export function calculateSize(currentWidth, currentHeight, aspectRatio) {
  const area = currentWidth * currentHeight;
  const height = Math.round(Math.sqrt(area / aspectRatio));
  const width = Math.round(height * aspectRatio);
  return { width, height };
}

/**
 * Resizes the current Tauri window so its aspect ratio matches `aspectRatio`,
 * preserving its current area as closely as possible. Un-maximizes first if
 * the window is currently maximized.
 * @param {number} aspectRatio
 */
export async function fitToAspectRatio(aspectRatio) {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const { PhysicalSize } = await import("@tauri-apps/api/dpi");
  const win = getCurrentWindow();

  if (await win.isMaximized()) {
    await win.unmaximize();
  }

  const current = await win.innerSize();
  const { width, height } = calculateSize(current.width, current.height, aspectRatio);
  await win.setSize(new PhysicalSize(width, height));
}
