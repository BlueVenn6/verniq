use fs2::FileExt;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{fs, fs::OpenOptions, io::Write, path::Path};
use tauri_plugin_fs::FsExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteResult {
    content_hash: String,
    backup_count: u64,
}

#[tauri::command]
pub fn workspace_write_atomic(
    app: tauri::AppHandle,
    file_path: String,
    json: String,
    expected_hash: Option<String>,
    backup: bool,
) -> Result<WriteResult, String> {
    let selected = Path::new(&file_path);
    if !selected.is_absolute() || !app.fs_scope().is_allowed(selected) {
        return Err("WORKSPACE_SCOPE: Open the workspace file again to grant access.".into());
    }
    let target = if selected.exists() {
        selected.canonicalize()
    } else {
        selected.parent().unwrap_or(selected).canonicalize().map(|parent| {
            parent.join(selected.file_name().unwrap_or_default())
        })
    }.map_err(|error| format!("WORKSPACE_PATH: {error}"))?;

    write_atomic(&target, &json, expected_hash.as_deref(), backup)
}

fn content_hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn write_atomic(path: &Path, json: &str, expected_hash: Option<&str>, backup: bool) -> Result<WriteResult, String> {
    let parent = path.parent().ok_or("WORKSPACE_PATH: Missing parent directory")?;
    let lock_path = path.with_file_name(format!("{}.verniq-lock", path.file_name().unwrap_or_default().to_string_lossy()));
    // Keep this tiny lock file: deleting it creates a race with another process
    // that already opened it. OS locks are released even after a crash.
    let lock = OpenOptions::new().create(true).truncate(false).read(true).write(true)
        .open(lock_path).map_err(|error| format!("WORKSPACE_LOCK: {error}"))?;
    lock.try_lock_exclusive().map_err(|_| "WORKSPACE_BUSY: Another window is saving this file. Try again.".to_string())?;

    let current = match fs::read(path) {
        Ok(bytes) => Some(bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(format!("WORKSPACE_READ: {error}")),
    };
    if let Some(expected) = expected_hash {
        if current.as_ref().map(|bytes| content_hash(bytes)).as_deref() != Some(expected) {
            return Err("WORKSPACE_CONFLICT: The file changed in another window or program. Reopen it or save your recovery copy as a new file.".into());
        }
    }
    let mut document: serde_json::Value = serde_json::from_str(json)
        .map_err(|error| format!("WORKSPACE_INVALID: {error}"))?;
    if !document.get("workspace").is_some_and(|value| value.is_object()) {
        return Err("WORKSPACE_INVALID: Missing workspace object".into());
    }
    let metadata = document
        .get_mut("metadata")
        .and_then(|value| value.as_object_mut())
        .ok_or("WORKSPACE_INVALID: metadata must be a JSON object")?;
    let mut backup_count = metadata.get("backupCount").and_then(|value| value.as_u64()).unwrap_or(0);
    if backup {
        if let Some(bytes) = current.as_ref() {
            // A unique backup is durable before the original is replaced.
            let mut snapshot = tempfile::Builder::new().prefix("verniq-backup-").suffix(".json")
                .tempfile_in(parent).map_err(|error| format!("WORKSPACE_BACKUP: {error}"))?;
            snapshot.write_all(bytes).and_then(|_| snapshot.as_file().sync_all())
                .map_err(|error| format!("WORKSPACE_BACKUP: {error}"))?;
            snapshot.keep().map_err(|error| format!("WORKSPACE_BACKUP: {error}"))?;
            backup_count += 1;
        }
    }
    metadata.insert("backupCount".to_string(), backup_count.into());
    let contents = serde_json::to_vec_pretty(&document).map_err(|error| error.to_string())?;
    let mut temporary = tempfile::Builder::new().prefix(".verniq-save-")
        .tempfile_in(parent).map_err(|error| format!("WORKSPACE_WRITE: {error}"))?;
    temporary.write_all(&contents).and_then(|_| temporary.as_file().sync_all())
        .map_err(|error| format!("WORKSPACE_WRITE: {error}"))?;
    temporary.persist(path).map_err(|error| format!("WORKSPACE_REPLACE: {}", error.error))?;

    Ok(WriteResult { content_hash: content_hash(&contents), backup_count })
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIRST: &str = r#"{"workspace":{"title":"first"},"metadata":{"backupCount":0}}"#;
    const SECOND: &str = r#"{"workspace":{"title":"second"},"metadata":{"backupCount":0}}"#;

    #[test]
    fn atomic_replace_keeps_previous_bytes_as_backup() {
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join("workspace.json");
        let first = write_atomic(&path, FIRST, None, true).unwrap();
        let old_bytes = fs::read(&path).unwrap();
        let second = write_atomic(&path, SECOND, Some(&first.content_hash), true).unwrap();
        assert_eq!(second.backup_count, 1);
        assert_ne!(first.content_hash, second.content_hash);
        let backups: Vec<_> = fs::read_dir(folder.path()).unwrap().filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().starts_with("verniq-backup-")).collect();
        assert_eq!(backups.len(), 1);
        assert_eq!(fs::read(backups[0].path()).unwrap(), old_bytes);
        assert!(!fs::read_dir(folder.path()).unwrap().filter_map(Result::ok)
            .any(|entry| entry.file_name().to_string_lossy().starts_with(".verniq-save-")));
    }

    #[test]
    fn stale_window_cannot_overwrite_even_when_metadata_timestamp_did_not_change() {
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join("workspace.json");
        let first = write_atomic(&path, FIRST, None, false).unwrap();
        fs::write(&path, SECOND).unwrap();
        assert!(write_atomic(&path, FIRST, Some(&first.content_hash), true).err().unwrap().starts_with("WORKSPACE_CONFLICT"));
        assert_eq!(fs::read_to_string(&path).unwrap(), SECOND);
    }

    #[test]
    fn invalid_input_and_held_lock_leave_original_untouched() {
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join("workspace.json");
        fs::write(&path, FIRST).unwrap();
        assert!(write_atomic(&path, "bad json", None, true).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), FIRST);
        let lock = OpenOptions::new().read(true).write(true).open(folder.path().join("workspace.json.verniq-lock")).unwrap();
        lock.try_lock_exclusive().unwrap();
        assert!(write_atomic(&path, SECOND, None, false).err().unwrap().starts_with("WORKSPACE_BUSY"));
        assert_eq!(fs::read_to_string(&path).unwrap(), FIRST);
    }

    #[test]
    fn non_object_metadata_is_rejected_without_panicking() {
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join("workspace.json");
        assert!(write_atomic(&path, r#"{"workspace":{},"metadata":"x"}"#, None, false)
            .err()
            .unwrap()
            .starts_with("WORKSPACE_INVALID"));
        assert!(!path.exists());
    }

    #[cfg(windows)]
    #[test]
    fn failed_windows_replace_preserves_the_original_and_cleans_temporary_file() {
        use std::os::windows::fs::OpenOptionsExt;
        let folder = tempfile::tempdir().unwrap();
        let path = folder.path().join("workspace.json");
        fs::write(&path, FIRST).unwrap();
        let _reader = OpenOptions::new().read(true).share_mode(1).open(&path).unwrap();
        assert!(write_atomic(&path, SECOND, None, true).err().unwrap().starts_with("WORKSPACE_REPLACE"));
        assert_eq!(fs::read_to_string(&path).unwrap(), FIRST);
        assert!(!fs::read_dir(folder.path()).unwrap().filter_map(Result::ok)
            .any(|entry| entry.file_name().to_string_lossy().starts_with(".verniq-save-")));
    }
}
