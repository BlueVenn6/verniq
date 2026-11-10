use keyring::Entry;
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub fn secret_store_status<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let test_ref = "__verniq_secret_store_status_probe__";
    let service_name = service_name_for_app(&app);

    match probe_keyring(&service_name, test_ref) {
        Ok(()) => Ok("{\"kind\":\"desktop_os\",\"available\":true}".to_string()),
        Err(error) => Ok(format!(
            "{{\"kind\":\"unsupported\",\"available\":false,\"warning\":\"{}\"}}",
            escape_json_string(&error)
        )),
    }
}

#[tauri::command]
pub fn secret_save<R: Runtime>(
    app: AppHandle<R>,
    credential_ref: String,
    secret: String,
) -> Result<(), String> {
    let credential_ref = sanitize_credential_ref(credential_ref)?;
    let service_name = service_name_for_app(&app);

    if secret.is_empty() {
        return Err("Secret is empty. Please enter an API key before saving.".to_string());
    }

    entry_for(&service_name, &credential_ref)?
        .set_password(&secret)
        .map_err(|error| format_os_error("Failed to save credential", error))
}

#[tauri::command]
pub fn secret_read<R: Runtime>(
    app: AppHandle<R>,
    credential_ref: String,
) -> Result<Option<String>, String> {
    let credential_ref = sanitize_credential_ref(credential_ref)?;
    let service_name = service_name_for_app(&app);

    match entry_for(&service_name, &credential_ref)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => migrate_legacy_secret(&service_name, &credential_ref),
        Err(error) => Err(format_os_error("Failed to read credential", error)),
    }
}

#[tauri::command]
pub fn secret_delete<R: Runtime>(
    app: AppHandle<R>,
    credential_ref: String,
) -> Result<(), String> {
    let credential_ref = sanitize_credential_ref(credential_ref)?;
    let service_name = service_name_for_app(&app);

    // The old application identifier used a different service name. Delete from
    // both so a removed provider cannot leave a readable credential behind.
    let _ = delete_entry(&legacy_service_name(), &credential_ref);

    delete_entry(&service_name, &credential_ref)
}

fn delete_entry(service_name: &str, credential_ref: &str) -> Result<(), String> {
    match entry_for(service_name, credential_ref)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format_os_error("Failed to delete credential", error)),
    }
}

// The application identifier changed to io.github.bluevenn6.verniq. Credentials
// saved before that change live under the old service name; move one on first
// read so an upgrade does not silently lose a working API key.
fn migrate_legacy_secret(current_service: &str, credential_ref: &str) -> Result<Option<String>, String> {
    let legacy_service = legacy_service_name();
    if legacy_service == current_service {
        return Ok(None);
    }

    let secret = match entry_for(&legacy_service, credential_ref)?.get_password() {
        Ok(secret) => secret,
        Err(keyring::Error::NoEntry) => return Ok(None),
        Err(error) => return Err(format_os_error("Failed to read credential", error)),
    };

    if entry_for(current_service, credential_ref)?.set_password(&secret).is_ok() {
        let _ = entry_for(&legacy_service, credential_ref)?.delete_credential();
    }

    Ok(Some(secret))
}

fn entry_for(service_name: &str, credential_ref: &str) -> Result<Entry, String> {
    Entry::new(service_name, credential_ref)
        .map_err(|error| format_os_error("Failed to access OS secret storage", error))
}

fn probe_keyring(service_name: &str, credential_ref: &str) -> Result<(), String> {
    let entry = entry_for(service_name, credential_ref)?;
    let probe_secret = "verniq-secret-store-probe";

    entry
        .set_password(probe_secret)
        .map_err(|error| format_os_error("Failed to verify OS secret storage", error))?;

    let stored = entry
        .get_password()
        .map_err(|error| format_os_error("Failed to verify OS secret storage", error))?;

    if stored != probe_secret {
        return Err("Failed to verify OS secret storage: probe mismatch".to_string());
    }

    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format_os_error(
            "Failed to clean OS secret storage probe",
            error,
        )),
    }
}

fn sanitize_credential_ref(value: String) -> Result<String, String> {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        return Err("Credential reference is empty.".to_string());
    }

    if trimmed.len() > 180 {
        return Err("Credential reference is too long.".to_string());
    }

    if !trimmed.chars().all(|character| {
        character.is_ascii_alphanumeric() || matches!(character, ':' | '-' | '_' | '.')
    }) {
        return Err("Credential reference contains unsupported characters.".to_string());
    }

    Ok(trimmed.to_string())
}

fn service_name_for_app<R: Runtime>(app: &AppHandle<R>) -> String {
    format!("Verniq ({})", app.config().identifier)
}

fn legacy_service_name() -> String {
    "Verniq (com.openai.mylifemap)".to_string()
}

fn format_os_error(prefix: &str, error: keyring::Error) -> String {
    format!("{prefix}: {error}")
}

fn escape_json_string(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}
