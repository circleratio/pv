/**
 * Computes a window size with the given aspect ratio (width/height) that
 * preserves the current width*height area as closely as possible. If the
 * result would exceed `maxWidth`/`maxHeight` (e.g. the display's work area),
 * it is scaled down uniformly to fit within them while keeping the aspect
 * ratio.
 * @param {number} currentWidth
 * @param {number} currentHeight
 * @param {number} aspectRatio
 * @param {number} [maxWidth] upper bound for the resulting width; unbounded if omitted
 * @param {number} [maxHeight] upper bound for the resulting height; unbounded if omitted
 * @returns {{width: number, height: number}}
 */
export function calculateSize(currentWidth, currentHeight, aspectRatio, maxWidth, maxHeight) {
  const area = currentWidth * currentHeight;
  let height = Math.sqrt(area / aspectRatio);
  let width = height * aspectRatio;

  const scale = Math.min(
    1,
    typeof maxWidth === "number" ? maxWidth / width : 1,
    typeof maxHeight === "number" ? maxHeight / height : 1
  );
  if (scale < 1) {
    width *= scale;
    height *= scale;
  }

  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Resizes the current Tauri window so its aspect ratio matches `aspectRatio`,
 * preserving its current area as closely as possible, clamped to the current
 * display's size so the window never ends up larger than the screen.
 * Un-maximizes first if the window is currently maximized.
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

  let maxWidth;
  let maxHeight;
  try {
    const monitor = await win.currentMonitor();
    if (monitor) {
      maxWidth = monitor.size.width;
      maxHeight = monitor.size.height;
    }
  } catch (error) {
    console.error("Failed to get current monitor size, skipping the screen-size clamp", error);
  }

  const { width, height } = calculateSize(
    current.width,
    current.height,
    aspectRatio,
    maxWidth,
    maxHeight
  );
  await win.setSize(new PhysicalSize(width, height));
}
