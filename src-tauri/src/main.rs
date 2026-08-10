// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Extracts the PDF file path from command-line arguments (args[0] is the executable path).
fn initial_pdf_path_from_args(args: &[String]) -> Option<String> {
    args.get(1).cloned()
}

#[tauri::command]
fn get_initial_pdf_path() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    initial_pdf_path_from_args(&args)
}

#[tauri::command]
fn read_pdf_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("failed to read '{path}': {e}"))
}

const HISTORY_FILE_NAME: &str = "history.json";

/// Reads the file history (PDF paths, newest first) from the given JSON file.
/// Returns an empty list if the file is missing or cannot be parsed.
fn load_history_from_file(path: &std::path::Path) -> Vec<String> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_default()
}

/// Writes the file history to the given JSON file, creating the parent directory if needed.
fn save_history_to_file(path: &std::path::Path, history: &[String]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create '{}': {e}", parent.display()))?;
    }
    let content =
        serde_json::to_string(history).map_err(|e| format!("failed to serialize history: {e}"))?;
    std::fs::write(path, content).map_err(|e| format!("failed to write '{}': {e}", path.display()))
}

fn history_file_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(HISTORY_FILE_NAME))
        .map_err(|e| format!("failed to resolve app data dir: {e}"))
}

#[tauri::command]
fn load_history(app: tauri::AppHandle) -> Vec<String> {
    match history_file_path(&app) {
        Ok(path) => load_history_from_file(&path),
        Err(_) => Vec::new(),
    }
}

#[tauri::command]
fn save_history(app: tauri::AppHandle, history: Vec<String>) -> Result<(), String> {
    let path = history_file_path(&app)?;
    save_history_to_file(&path, &history)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_initial_pdf_path,
            read_pdf_file,
            load_history,
            save_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_path_when_argument_given() {
        let args = vec!["pv.exe".to_string(), "sample.pdf".to_string()];
        assert_eq!(
            initial_pdf_path_from_args(&args),
            Some("sample.pdf".to_string())
        );
    }

    #[test]
    fn returns_none_when_no_argument_given() {
        let args = vec!["pv.exe".to_string()];
        assert_eq!(initial_pdf_path_from_args(&args), None);
    }

    fn fixture_path(name: &str) -> String {
        format!("{}/../tests/fixtures/{name}", env!("CARGO_MANIFEST_DIR"))
    }

    #[test]
    fn read_pdf_file_returns_bytes_for_existing_file() {
        let bytes = read_pdf_file(fixture_path("portrait.pdf")).unwrap();
        assert!(bytes.starts_with(b"%PDF-"));
    }

    #[test]
    fn read_pdf_file_returns_err_for_missing_file() {
        let result = read_pdf_file(fixture_path("does_not_exist.pdf"));
        assert!(result.is_err());
    }

    #[test]
    fn load_history_returns_empty_when_file_missing() {
        let path = std::env::temp_dir().join("pv_test_history_missing.json");
        let _ = std::fs::remove_file(&path);
        assert_eq!(load_history_from_file(&path), Vec::<String>::new());
    }

    #[test]
    fn save_then_load_history_round_trips() {
        let dir = std::env::temp_dir().join("pv_test_history_round_trip");
        let _ = std::fs::remove_dir_all(&dir);
        let path = dir.join(HISTORY_FILE_NAME);
        let history = vec!["a.pdf".to_string(), "b.pdf".to_string()];
        save_history_to_file(&path, &history).unwrap();
        assert_eq!(load_history_from_file(&path), history);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn save_history_creates_missing_parent_directory() {
        let dir = std::env::temp_dir().join("pv_test_history_new_dir");
        let _ = std::fs::remove_dir_all(&dir);
        let path = dir.join(HISTORY_FILE_NAME);
        assert!(!dir.exists());
        save_history_to_file(&path, &[]).unwrap();
        assert!(dir.exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
