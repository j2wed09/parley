//! Pre-meeting checklists for this fork.
//!
//! Three jobs, all on the Rust side so secrets and the Claude login stay out
//! of the webview:
//!
//! - read `~/Parley/checklists` (JSON and Markdown an assistant dropped there)
//! - shell out to the Claude Code CLI (`claude -p --output-format json`)
//! - call TypeSafe Jev with a key that lives in the macOS keychain, or in a
//!   `0600` file under the app config dir when the keychain is not available
//!
//! The request and response *shape* is built and interpreted in
//! `src/lib/checklist`. This module only moves bytes.

use std::io::Write;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::AppHandle;

use crate::commands::config::app_config_file;

const KEYCHAIN_SERVICE: &str = "parley-typesafe-api-key";
const KEYCHAIN_ACCOUNT: &str = "parley";
const KEY_FILE: &str = "typesafe-api-key";
const JEV_URL: &str = "https://api.typesafe.ai/v1/systemone";
const CLAUDE_TIMEOUT: Duration = Duration::from_secs(180);
const JEV_TIMEOUT: Duration = Duration::from_secs(60);
const MAX_CHECKLIST_BYTES: u64 = 1_000_000;
const MAX_CLAUDE_IO: usize = 200_000;
const MAX_JEV_BODY: usize = 2_000_000;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedFile {
    pub name: String,
    pub body: String,
    pub error: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeRun {
    pub not_found: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

fn home_dir() -> Result<PathBuf, String> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "Could not find the home directory.".to_string())
}

fn checklists_dir() -> Result<PathBuf, String> {
    let dir = home_dir()?.join("Parley").join("checklists");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    Ok(dir)
}

/// A file name that cannot escape the checklists directory.
fn plain_file_name(name: &str) -> Result<(), String> {
    if name.is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name.contains('\0')
        || name == "."
        || name == ".."
        || name.starts_with('.')
    {
        return Err("Invalid checklist file name.".into());
    }
    Ok(())
}

fn is_checklist_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".json") || lower.ends_with(".md") || lower.ends_with(".markdown")
}

fn checklist_file(name: &str) -> Result<PathBuf, String> {
    plain_file_name(name)?;
    if !is_checklist_name(name) {
        return Err("Checklist files must be .json or .md.".into());
    }
    let dir = checklists_dir()?;
    let path = dir.join(name);
    // `join` of a plain name stays inside `dir`. Canonicalize the parent to
    // reject a symlink that points somewhere else.
    let parent = path
        .parent()
        .ok_or_else(|| "Invalid checklist file name.".to_string())?;
    let canon_dir = dir.canonicalize().map_err(|e| e.to_string())?;
    let canon_parent = parent.canonicalize().map_err(|e| e.to_string())?;
    if canon_parent != canon_dir {
        return Err("Invalid checklist file name.".into());
    }
    Ok(path)
}

#[tauri::command]
pub fn checklist_folder() -> Result<String, String> {
    Ok(checklists_dir()?.display().to_string())
}

#[tauri::command]
pub fn list_prepared_checklists() -> Result<Vec<PreparedFile>, String> {
    let dir = checklists_dir()?;
    let mut files = Vec::new();
    let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !is_checklist_name(&name) || plain_file_name(&name).is_err() {
            continue;
        }
        let path = entry.path();
        if !path.is_file() || !stays_in_dir(&dir, &path) {
            continue;
        }
        let len = entry.metadata().map(|meta| meta.len()).unwrap_or(0);
        if len > MAX_CHECKLIST_BYTES {
            files.push(PreparedFile {
                name,
                body: String::new(),
                error: Some("That checklist file is over 1 MB.".into()),
            });
            continue;
        }
        match std::fs::read_to_string(&path) {
            Ok(body) => files.push(PreparedFile {
                name,
                body,
                error: None,
            }),
            Err(error) => files.push(PreparedFile {
                name,
                body: String::new(),
                error: Some(format!("Could not read the file: {error}")),
            }),
        }
    }
    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(files)
}

/// Move a checklist into `~/Parley/checklists/applied` so it leaves the
/// pending list. The file is kept, not deleted.
#[tauri::command]
pub fn consume_prepared_checklist(name: String) -> Result<(), String> {
    let src = checklist_file(&name)?;
    if !src.is_file() || !stays_in_dir(&checklists_dir()?, &src) {
        return Err(format!("No checklist named {name}."));
    }
    let applied = checklists_dir()?.join("applied");
    std::fs::create_dir_all(&applied).map_err(|e| e.to_string())?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let dest = applied.join(format!("{stamp}-{name}"));
    std::fs::rename(&src, &dest).map_err(|e| format!("Could not file the checklist away: {e}"))
}

fn claude_program() -> String {
    std::env::var("PARLEY_CLAUDE_BIN")
        .ok()
        .filter(|path| !path.trim().is_empty())
        .unwrap_or_else(|| "claude".to_string())
}

/// Dock-launched apps inherit a tiny PATH. Add the places the Claude Code
/// installer and Homebrew actually put the binary.
fn claude_path() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let current = std::env::var("PATH").unwrap_or_else(|_| "/usr/bin:/bin".to_string());
    format!("/opt/homebrew/bin:/usr/local/bin:{home}/.local/bin:{home}/.claude/local:{current}")
}

/// True when `path` resolves to a file inside `dir`. A symlink that points
/// somewhere else is refused, so a planted link cannot be read or moved.
fn stays_in_dir(dir: &std::path::Path, path: &std::path::Path) -> bool {
    let (Ok(dir), Ok(path)) = (dir.canonicalize(), path.canonicalize()) else {
        return false;
    };
    path.starts_with(dir)
}

fn clip(text: &str) -> String {
    if text.len() <= MAX_CLAUDE_IO {
        return text.to_string();
    }
    let mut end = MAX_CLAUDE_IO;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    text[..end].to_string()
}

/// Run `claude -p --output-format json` with the prompt on stdin.
/// A missing binary is `not_found`, not a hard error, so the UI can say
/// "install the CLI and log in" instead of a raw spawn failure.
#[tauri::command]
pub async fn run_claude(prompt: String) -> Result<ClaudeRun, String> {
    if prompt.trim().is_empty() {
        return Err("Nothing to send to Claude.".into());
    }
    if prompt.len() > MAX_CLAUDE_IO {
        return Err("Those notes are too long to send to Claude.".into());
    }
    let mut command = tokio::process::Command::new(claude_program());
    command
        .arg("-p")
        .arg("--output-format")
        .arg("json")
        .env("PATH", claude_path())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(ClaudeRun {
                not_found: true,
                exit_code: 127,
                stdout: String::new(),
                stderr: error.to_string(),
            });
        }
        Err(error) => return Err(format!("Could not start the Claude Code CLI: {error}")),
    };
    if let Some(mut stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        stdin
            .write_all(prompt.as_bytes())
            .await
            .map_err(|error| format!("Could not send the notes to Claude: {error}"))?;
    }
    let finished = tokio::time::timeout(CLAUDE_TIMEOUT, child.wait_with_output()).await;
    let output = match finished {
        Ok(Ok(output)) => output,
        Ok(Err(error)) => return Err(format!("Claude Code failed: {error}")),
        Err(_) => return Err("Claude Code took too long and was stopped.".into()),
    };
    Ok(ClaudeRun {
        not_found: false,
        exit_code: output.status.code().unwrap_or(1),
        stdout: clip(&String::from_utf8_lossy(&output.stdout)),
        stderr: clip(&String::from_utf8_lossy(&output.stderr)),
    })
}

fn write_key_file(app: &AppHandle, key: &str) -> Result<(), String> {
    let path = app_config_file(app, KEY_FILE)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&path)
            .map_err(|error| error.to_string())?;
        file.write_all(key.as_bytes())
            .map_err(|error| error.to_string())?;
    }
    #[cfg(not(unix))]
    {
        std::fs::write(&path, key).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn read_key_file(app: &AppHandle) -> Option<String> {
    let path = app_config_file(app, KEY_FILE).ok()?;
    let key = std::fs::read_to_string(path).ok()?;
    let trimmed = key.trim().to_string();
    (!trimmed.is_empty()).then_some(trimmed)
}

fn delete_key_file(app: &AppHandle) {
    if let Ok(path) = app_config_file(app, KEY_FILE) {
        let _ = std::fs::remove_file(path);
    }
}

#[cfg(target_os = "macos")]
fn keychain_set(key: &str) -> Result<(), String> {
    let output = std::process::Command::new("security")
        .args([
            "add-generic-password",
            "-U",
            "-s",
            KEYCHAIN_SERVICE,
            "-a",
            KEYCHAIN_ACCOUNT,
            "-w",
            key,
        ])
        .output()
        .map_err(|error| format!("Could not reach the macOS keychain: {error}"))?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(format!(
        "Keychain refused the TypeSafe key: {}",
        stderr.trim()
    ))
}

#[cfg(target_os = "macos")]
fn keychain_get() -> Option<String> {
    let output = std::process::Command::new("security")
        .args([
            "find-generic-password",
            "-s",
            KEYCHAIN_SERVICE,
            "-a",
            KEYCHAIN_ACCOUNT,
            "-w",
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let key = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!key.is_empty()).then_some(key)
}

#[cfg(target_os = "macos")]
fn keychain_delete() {
    let _ = std::process::Command::new("security")
        .args([
            "delete-generic-password",
            "-s",
            KEYCHAIN_SERVICE,
            "-a",
            KEYCHAIN_ACCOUNT,
        ])
        .output();
}

fn load_key(app: &AppHandle) -> Option<String> {
    #[cfg(target_os = "macos")]
    if let Some(key) = keychain_get() {
        return Some(key);
    }
    read_key_file(app)
}

#[tauri::command]
pub fn typesafe_key_configured(app: AppHandle) -> bool {
    load_key(&app).is_some()
}

#[tauri::command]
pub fn set_typesafe_api_key(app: AppHandle, key: String) -> Result<(), String> {
    let key = key.trim().to_string();
    if key.is_empty() {
        return Err("The TypeSafe API key is empty.".into());
    }
    if key.len() > 512 {
        return Err("That TypeSafe API key is unexpectedly long.".into());
    }
    #[cfg(target_os = "macos")]
    {
        match keychain_set(&key) {
            Ok(()) => {
                delete_key_file(&app);
                log::info!("typesafe: key stored in the login keychain");
                return Ok(());
            }
            Err(error) => {
                log::warn!("typesafe: keychain save failed, storing a local file instead: {error}");
            }
        }
    }
    write_key_file(&app, &key)?;
    log::info!("typesafe: key stored in the app config dir");
    Ok(())
}

#[tauri::command]
pub fn clear_typesafe_api_key(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    keychain_delete();
    delete_key_file(&app);
    log::info!("typesafe: key removed");
    Ok(())
}

/// POST a System One request. The webview sends the body (state + questions)
/// and never the key; this command adds `Authorization: Bearer` from the
/// keychain and returns the JSON body.
#[tauri::command]
pub async fn classify_with_jev(
    app: AppHandle,
    request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let key = load_key(&app)
        .ok_or_else(|| "TypeSafe API key is not set. Add it in Settings → To-dos.".to_string())?;
    let raw = serde_json::to_string(&request).map_err(|error| error.to_string())?;
    if raw.len() > MAX_JEV_BODY {
        return Err("The checklist request is too large for Jev.".into());
    }
    let client = reqwest::Client::builder()
        .timeout(JEV_TIMEOUT)
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .post(JEV_URL)
        .bearer_auth(key)
        .json(&request)
        .send()
        .await
        .map_err(|error| format!("Could not reach TypeSafe: {error}"))?;
    let status = response.status();
    let body = response.text().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        let snippet: String = body.chars().take(400).collect();
        log::warn!("typesafe: classify status {status}");
        return Err(format!("TypeSafe returned {status}: {snippet}"));
    }
    log::info!("typesafe: classify status {status}");
    serde_json::from_str(&body)
        .map_err(|error| format!("TypeSafe returned unreadable JSON: {error}"))
}

#[cfg(test)]
mod tests {
    use super::plain_file_name;

    #[test]
    fn file_names_cannot_escape_the_folder() {
        assert!(plain_file_name("acme.json").is_ok());
        assert!(plain_file_name("../secret.json").is_err());
        assert!(plain_file_name("nested/acme.json").is_err());
        assert!(plain_file_name(".hidden.json").is_err());
        assert!(plain_file_name("").is_err());
    }
}
