/**
 * Wires up native OS drag-and-drop of files onto the window. When one or
 * more files are dropped, opens only the first one via `onDrop`.
 * @param {{ onDrop: (path: string) => void }} callbacks
 */
export async function init({ onDrop }) {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().onDragDropEvent((event) => {
    if (event.payload.type !== "drop") return;
    const [path] = event.payload.paths;
    if (path) onDrop(path);
  });
}
