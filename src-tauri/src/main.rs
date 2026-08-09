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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_initial_pdf_path,
            read_pdf_file
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
}
