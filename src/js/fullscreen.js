/**
 * Returns whether the current Tauri window is in fullscreen mode.
 * @returns {Promise<boolean>}
 */
export async function isFullscreen() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().isFullscreen();
}

/**
 * Toggles the current Tauri window between fullscreen and normal mode.
 */
export async function toggle() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  const current = await win.isFullscreen();
  await win.setFullscreen(!current);
}

/**
 * Exits fullscreen mode. Safe to call when already in normal mode.
 */
export async function exit() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setFullscreen(false);
}
