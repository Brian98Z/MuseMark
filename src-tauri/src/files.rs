use serde_json::{json, Map, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::UNIX_EPOCH,
};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_opener::OpenerExt;

const APP_NAME: &str = "MuseMark";
const AUTHOR_NAME: &str = "Brian98Z";
const AUTHOR_URL: &str = "https://github.com/Brian98Z";
const RECENT_LIMIT: usize = 20;

/// Register this as managed Tauri state before invoking file/config commands.
pub struct FileState {
    config_path: PathBuf,
    config: Mutex<Map<String, Value>>,
}

impl FileState {
    pub fn new<R: Runtime>(app: &AppHandle<R>) -> Result<Self, String> {
        let config_path = app.path().app_config_dir().map_err(|e| e.to_string())?.join("config.json");
        let config = load_config(&config_path, &legacy_config_path(app));
        Ok(Self { config_path, config: Mutex::new(config) })
    }

    pub fn setup<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
        app.manage(Self::new(app)?);
        Ok(())
    }
}

fn legacy_config_path<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    // Electron app.setName("MuseMark") stored config in %APPDATA%/MuseMark/config.json.
    let app_data = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::new());
    app_data.parent().unwrap_or(&app_data).join("MuseMark").join("config.json")
}

fn load_config(primary: &Path, legacy: &Path) -> Map<String, Value> {
    let load = |p: &Path| -> Option<Map<String, Value>> {
        let v: Value = serde_json::from_slice(&fs::read(p).ok()?).ok()?;
        v.as_object().cloned()
    };
    if let Some(v) = load(primary) { return v; }
    if legacy != primary {
        if let Some(v) = load(legacy) {
            if let Some(parent) = primary.parent() {
                let _ = fs::create_dir_all(parent);
                let _ = fs::write(primary, serde_json::to_vec_pretty(&v).unwrap_or_default());
            }
            return v;
        }
    }
    Map::new()
}

fn state_lock(state: &FileState) -> Result<std::sync::MutexGuard<'_, Map<String, Value>>, String> {
    state.config.lock().map_err(|_| "配置存储锁已损坏".to_string())
}

fn persist_config(state: &FileState, data: &Map<String, Value>) -> Result<(), String> {
    let parent = state.config_path.parent().ok_or_else(|| "配置路径无父目录".to_string())?;
    fs::create_dir_all(parent).map_err(|e| format!("创建配置目录失败：{e}"))?;
    let bytes = serde_json::to_vec_pretty(data).map_err(|e| format!("序列化配置失败：{e}"))?;
    let tmp = state.config_path.with_extension("json.tmp");
    fs::write(&tmp, bytes).map_err(|e| format!("写入配置失败：{e}"))?;
    fs::rename(&tmp, &state.config_path).map_err(|e| format!("替换配置失败：{e}"))
}

fn kind_of(path: &str) -> &'static str {
    match Path::new(path).extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase().as_str() {
        "png" | "jpg" | "jpeg" | "jfif" | "gif" | "webp" | "svg" | "bmp" | "avif" | "ico" => "image",
        "mp3" | "wav" | "ogg" | "oga" | "flac" | "m4a" | "aac" | "opus" | "wma" => "audio",
        "mp4" | "webm" | "mov" | "mkv" | "m4v" | "avi" | "ogv" | "wmv" => "video",
        "md" | "markdown" | "mdown" | "mkd" | "txt" => "md",
        _ => "other",
    }
}

fn grant_path<R: Runtime>(app: &AppHandle<R>, path: &Path, include_children: bool) -> Result<(), String> {
    // Required Tauri v2 asset-protocol API. Direct file grant covers selected media;
    // recursive parent grant enables relative images/media referenced by opened Markdown.
    let scope = app.asset_protocol_scope();
    if path.is_dir() {
        scope.allow_directory(path, include_children).map_err(|e| format!("授权资源路径失败：{e}"))?;
    } else {
        scope.allow_file(path).map_err(|e| format!("授权资源路径失败：{e}"))?;
        if let Some(parent) = path.parent() {
            scope.allow_directory(parent, false).map_err(|e| format!("授权相邻资源路径失败：{e}"))?;
        }
    }
    Ok(())
}

fn grant_dir<R: Runtime>(app: &AppHandle<R>, path: &Path) -> Result<(), String> {
    app.asset_protocol_scope().allow_directory(path, true).map_err(|e| format!("授权资源目录失败：{e}"))
}

fn default_dir<R: Runtime>(_state: &FileState, app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().desktop_dir().ok()
}

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| format!("后台任务失败：{e}"))
}

#[tauri::command]
pub fn info() -> Value {
    json!({
        "name": APP_NAME,
        "version": env!("CARGO_PKG_VERSION"),
        "author": AUTHOR_NAME,
        "authorUrl": AUTHOR_URL,
        "tauri": tauri::VERSION,
        "webview": {"name": if cfg!(target_os = "windows") { "WebView2" } else if cfg!(target_os = "macos") { "WKWebView" } else { "WebKitGTK" }, "version": null},
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH
    })
}

#[tauri::command]
pub async fn about<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    let version = env!("CARGO_PKG_VERSION");
    let detail = format!("本地 Markdown 编辑器 · 图片 / 音频 / 视频预览\n无许可证校验、无账号登录、无遥测、无网络请求。\n\n作者：{AUTHOR_NAME}  {AUTHOR_URL}\n\n渲染内核：Vditor 3.11.3 / Lute（MIT 许可，© Vanessa219 及贡献者）\n运行时：Tauri {} · 系统 WebView ({})", tauri::VERSION, std::env::consts::OS);
    let app2 = app.clone();
    blocking(move || {
        app2.dialog().message(format!("{APP_NAME} {version}\n\n{detail}")).title(format!("关于 {APP_NAME}")).blocking_show();
    }).await?;
    Ok(json!({"author": AUTHOR_NAME, "authorUrl": AUTHOR_URL}))
}

#[tauri::command]
pub async fn open_dialog<R: Runtime>(app: AppHandle<R>, state: tauri::State<'_, FileState>) -> Result<Option<String>, String> {
    let initial = default_dir(&state, &app);
    let app2 = app.clone();
    let selected = blocking(move || {
        let mut d = app2.dialog().file().set_title("打开文件（文档 / 图片 / 音频 / 视频）");
        if let Some(p) = initial { d = d.set_directory(p); }
        d = d.add_filter("支持的文档", &["md", "markdown", "mdown", "mkd", "txt"])
            .add_filter("图片", &["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif", "ico"])
            .add_filter("音频", &["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus"])
            .add_filter("视频", &["mp4", "webm", "mov", "mkv", "m4v", "avi"])
            .add_filter("所有文件", &["*"]);
        d.blocking_pick_file()
    }).await?;
    if let Some(FilePath::Path(p)) = selected {
        grant_path(&app, &p, false)?;
        if let Some(parent) = p.parent() { grant_dir(&app, parent)?; }
        Ok(Some(p.to_string_lossy().into_owned()))
    } else { Ok(None) }
}

#[tauri::command]
pub async fn open_folder_dialog<R: Runtime>(app: AppHandle<R>, state: tauri::State<'_, FileState>) -> Result<Option<String>, String> {
    let initial = default_dir(&state, &app);
    let app2 = app.clone();
    let selected = blocking(move || {
        let mut d = app2.dialog().file().set_title("打开文件夹");
        if let Some(p) = initial { d = d.set_directory(p); }
        d.blocking_pick_folder()
    }).await?;
    if let Some(FilePath::Path(p)) = selected {
        grant_dir(&app, &p)?;
        Ok(Some(p.to_string_lossy().into_owned()))
    } else { Ok(None) }
}

#[tauri::command]
pub async fn save_dialog<R: Runtime>(app: AppHandle<R>, state: tauri::State<'_, FileState>, default_name: Option<String>) -> Result<Option<String>, String> {
    let initial = default_dir(&state, &app);
    let app2 = app.clone();
    let selected = blocking(move || {
        let mut d = app2.dialog().file().set_title("另存为").add_filter("Markdown", &["md"]).add_filter("所有文件", &["*"]);
        if let Some(dir) = initial { d = d.set_directory(dir); }
        d = d.set_file_name(default_name.unwrap_or_else(|| "untitled.md".into()));
        d.blocking_save_file()
    }).await?;
    Ok(selected.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn read<R: Runtime>(app: AppHandle<R>, state: tauri::State<'_, FileState>, path: String) -> Result<Value, String> {
    let p = PathBuf::from(&path);
    grant_path(&app, &p, false)?;
    if let Some(parent) = p.parent() { grant_dir(&app, parent)?; }
    let bytes = fs::read(&p).map_err(|e| format!("读取文件失败：{e}"))?;
    let mut content = String::from_utf8(bytes).map_err(|e| format!("文件不是有效 UTF-8：{e}"))?;
    if content.starts_with('\u{feff}') { content.remove(0); }
    add_recent(&state, &path)?;
    Ok(json!({"path": path, "content": content}))
}

#[tauri::command]
pub async fn write(app: AppHandle, state: tauri::State<'_, FileState>, path: String, content: String) -> Result<Value, String> {
    let p = PathBuf::from(&path);
    let parent = p.parent().ok_or_else(|| "文件路径无父目录".to_string())?;
    fs::create_dir_all(parent).map_err(|e| format!("创建目录失败：{e}"))?;
    fs::write(&p, content.as_bytes()).map_err(|e| format!("写入文件失败：{e}"))?;
    add_recent(&state, &path)?;
    crate::refresh_menu(&app);
    Ok(json!({"path": path}))
}

#[tauri::command]
pub async fn read_tree<R: Runtime>(app: AppHandle<R>, root: String) -> Result<Value, String> {
    let root_path = PathBuf::from(&root);
    grant_dir(&app, &root_path)?;
    let mut count = 0usize;
    let children = walk_tree(&root_path, 0, &mut count);
    Ok(json!({"root": root, "children": children}))
}

fn walk_tree(root: &Path, depth: usize, count: &mut usize) -> Vec<Value> {
    const SKIP: &[&str] = &["node_modules", ".git", ".svn", "$RECYCLE.BIN", "System Volume Information", ".idea", ".vscode"];
    if depth > 4 || *count > 2000 { return Vec::new(); }
    let Ok(entries) = fs::read_dir(root) else { return Vec::new() };
    let mut dirs = Vec::new();
    let mut files = Vec::new();
    for entry in entries.flatten() {
        if *count > 2000 { break; }
        let name = entry.file_name().to_string_lossy().into_owned();
        let p = entry.path();
        let Ok(ft) = entry.file_type() else { continue };
        if name.starts_with('.') && name != ".md" && ft.is_dir() { continue; }
        if SKIP.contains(&name.as_str()) { continue; }
        if ft.is_dir() {
            *count += 1;
            dirs.push(json!({"name": name, "path": p.to_string_lossy(), "dir": true, "children": walk_tree(&p, depth + 1, count)}));
        } else if ft.is_file() && kind_of(&name) != "other" {
            *count += 1;
            files.push(json!({"name": name, "path": p.to_string_lossy(), "dir": false, "kind": kind_of(&name)}));
        }
    }
    dirs.sort_by(|a,b| a["name"].as_str().unwrap_or("").to_lowercase().cmp(&b["name"].as_str().unwrap_or("").to_lowercase()));
    files.sort_by(|a,b| a["name"].as_str().unwrap_or("").to_lowercase().cmp(&b["name"].as_str().unwrap_or("").to_lowercase()));
    dirs.extend(files);
    dirs
}

#[tauri::command]
pub async fn stat(app: AppHandle, path: String) -> Option<Value> {
    let p = PathBuf::from(&path);
    let metadata = fs::metadata(&p).ok()?;
    grant_path(&app, &p, false).ok()?;
    let mtime = metadata.modified().ok()?.duration_since(UNIX_EPOCH).ok()?.as_secs_f64() * 1000.0;
    Some(json!({"path": path, "size": metadata.len(), "mtime": mtime, "kind": kind_of(&path)}))
}

#[tauri::command]
pub async fn reveal<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    if path.is_empty() { return Ok(()); }
    app.opener().reveal_item_in_dir(path).map_err(|e| format!("在文件夹中显示失败：{e}"))
}

#[tauri::command]
pub async fn open_external<R: Runtime>(app: AppHandle<R>, url: String) -> Result<bool, String> {
    let lower = url.trim().to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://") || lower.starts_with("mailto:")) { return Ok(false); }
    app.opener().open_url(url, None::<&str>).map_err(|e| format!("打开链接失败：{e}"))?;
    Ok(true)
}

fn recent_list(data: &Map<String, Value>) -> Vec<String> {
    data.get("recent").and_then(Value::as_array).into_iter().flatten()
        .filter_map(Value::as_str).filter(|p| Path::new(p).is_file()).map(str::to_owned).collect()
}

fn add_recent(state: &FileState, path: &str) -> Result<Vec<String>, String> {
    let mut data = state_lock(state)?;
    let mut recent = recent_list(&data);
    recent.retain(|p| p != path);
    recent.insert(0, path.to_string());
    recent.truncate(RECENT_LIMIT);
    data.insert("recent".into(), json!(recent));
    persist_config(state, &data)?;
    Ok(recent_list(&data))
}

#[tauri::command]
pub fn recent(state: tauri::State<'_, FileState>) -> Result<Vec<String>, String> {
    Ok(recent_list(&*state_lock(&state)?))
}

#[tauri::command]
pub async fn export_html<R: Runtime>(app: AppHandle<R>, state: tauri::State<'_, FileState>, html: String, default_name: Option<String>) -> Result<Option<String>, String> {
    let initial = default_dir(&state, &app);
    let app2 = app.clone();
    let selected = blocking(move || {
        let mut d = app2.dialog().file().set_title("导出 HTML").add_filter("HTML", &["html"]);
        if let Some(dir) = initial { d = d.set_directory(dir); }
        let mut name = default_name.unwrap_or_else(|| "untitled".into());
        if !name.to_ascii_lowercase().ends_with(".html") { name.push_str(".html"); }
        d.set_file_name(name).blocking_save_file()
    }).await?;
    let Some(FilePath::Path(p)) = selected else { return Ok(None) };
    fs::write(&p, html.as_bytes()).map_err(|e| format!("导出 HTML 失败：{e}"))?;
    Ok(Some(p.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn config_get(state: tauri::State<'_, FileState>) -> Result<Value, String> {
    Ok(Value::Object(state_lock(&state)?.clone()))
}

#[tauri::command]
pub fn config_set(state: tauri::State<'_, FileState>, patch: Value) -> Result<Value, String> {
    let patch = patch.as_object().ok_or_else(|| "配置更新必须是 JSON 对象".to_string())?;
    let mut data = state_lock(&state)?;
    for (key, value) in patch { data.insert(key.clone(), value.clone()); }
    persist_config(&state, &data)?;
    Ok(Value::Object(data.clone()))
}
