import { invoke } from "@tauri-apps/api/core";

const MAX_ENTRIES = 10;

let entries = [];

/**
 * Loads the persisted file history and keeps it in memory.
 * @returns {Promise<string[]>} the loaded history (newest first)
 */
export async function load() {
  entries = await invoke("load_history");
  return entries;
}

/**
 * Records that `path` was opened: moves it to the front if already present,
 * otherwise inserts it at the front. Caps the history at MAX_ENTRIES,
 * dropping the oldest entry when exceeded, and persists the result.
 * @param {string} path
 */
export async function add(path) {
  entries = [path, ...entries.filter((entry) => entry !== path)].slice(0, MAX_ENTRIES);
  await invoke("save_history", { history: entries });
}

/**
 * @returns {string[]} the current history, newest first
 */
export function getAll() {
  return [...entries];
}
