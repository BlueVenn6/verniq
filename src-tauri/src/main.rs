#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod secrets;
mod http;
mod workspace;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            secrets::secret_store_status,
            secrets::secret_save,
            secrets::secret_read,
            secrets::secret_delete,
            http::desktop_http_post_json,
            workspace::workspace_write_atomic
        ])
        .run(tauri::generate_context!())
        .expect("error while running Verniq");
}
