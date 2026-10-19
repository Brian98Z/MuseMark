mod files;
mod pdf;

use serde_json::{json, Value};
use std::{collections::{HashMap, HashSet}, sync::atomic::{AtomicUsize, Ordering}};
use parking_lot::Mutex;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

#[derive(Default)]
struct Windows {
    dirty: Mutex<HashMap<String, bool>>,
    startup: Mutex<HashMap<String, Vec<Value>>>,
    confirming: Mutex<HashSet<String>>,
}
static NEXT_WINDOW: AtomicUsize = AtomicUsize::new(1);

#[tauri::command]
fn set_dirty(window: WebviewWindow, dirty: bool, state: tauri::State<Windows>) -> Result<(), String> {
    state.dirty.lock().insert(window.label().into(), dirty);
    Ok(())
}
#[tauri::command]
fn frontend_ready(window: WebviewWindow, state: tauri::State<Windows>) -> Result<Vec<Value>, String> {
    Ok(state.startup.lock().remove(window.label()).unwrap_or_default())
}

fn open_window(app: &tauri::AppHandle, file: Option<String>) -> tauri::Result<()> {
    let label = format!("editor-{}", NEXT_WINDOW.fetch_add(1, Ordering::Relaxed));
    let events = if let Some(path) = file { vec![json!({"cmd":"open-path","arg":path})] } else {
        let folder = app.path().desktop_dir().ok().map(|p| p.to_string_lossy().into_owned());
        folder.map(|arg|vec![json!({"cmd":"open-folder-path","arg":arg})]).unwrap_or_default()
    };
    app.state::<Windows>().startup.lock().insert(label.clone(), events);
    WebviewWindowBuilder::new(app, label, WebviewUrl::App("renderer/index.html".into()))
        .title("MuseMark").inner_size(1280., 840.).min_inner_size(720., 480.)
        .on_navigation(|url| matches!(url.scheme(), "tauri" | "about") || matches!(url.host_str(), Some("tauri.localhost")))
        .build()?;
    Ok(())
}

fn focused(app: &tauri::AppHandle) -> Option<WebviewWindow> {
    let windows = app.webview_windows();
    windows.values().find(|w| w.label().starts_with("editor-") && w.is_focused().unwrap_or(false)).cloned()
        .or_else(|| windows.values().find(|w|w.label().starts_with("editor-")).cloned())
}
fn menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;
    let groups: &[(&str, &[(&str,&str,&str)])] = &[
      ("文件", &[("new","新建","CmdOrCtrl+N"),("new-window","新建窗口","CmdOrCtrl+Shift+N"),("open-dialog","打开…","CmdOrCtrl+O"),("open-folder","打开文件夹…","CmdOrCtrl+Shift+O"),("recent-menu","最近文件",""),("save","保存","CmdOrCtrl+S"),("save-as","另存为…","CmdOrCtrl+Shift+S"),("export-html","导出 HTML","CmdOrCtrl+Shift+E"),("export-pdf","导出 PDF","CmdOrCtrl+Shift+P"),("reveal","在文件管理器中显示",""),("close-window","关闭窗口","CmdOrCtrl+W"),("quit","退出","CmdOrCtrl+Q")]),
      ("编辑", &[("undo","撤销","CmdOrCtrl+Z"),("redo","重做","CmdOrCtrl+Shift+Z"),("cut","剪切",""),("copy","复制",""),("paste","粘贴",""),("select-all","全选","CmdOrCtrl+A"),("find","查找","CmdOrCtrl+F"),("replace","替换","CmdOrCtrl+H")]),
      ("段落", &[("h1","标题 1","CmdOrCtrl+1"),("h2","标题 2","CmdOrCtrl+2"),("h3","标题 3","CmdOrCtrl+3"),("h4","标题 4","CmdOrCtrl+4"),("h5","标题 5","CmdOrCtrl+5"),("h6","标题 6","CmdOrCtrl+6"),("paragraph","正文","CmdOrCtrl+0"),("quote","引用","CmdOrCtrl+Shift+Q"),("olist","有序列表","CmdOrCtrl+Shift+["),("ulist","无序列表","CmdOrCtrl+Shift+]"),("task","任务列表","CmdOrCtrl+Shift+X"),("code","代码块","CmdOrCtrl+Shift+K"),("table","表格","CmdOrCtrl+T"),("math","公式块","CmdOrCtrl+Shift+M"),("mermaid","Mermaid 图",""),("hr","分隔线","")]),
      ("格式", &[("bold","加粗","CmdOrCtrl+B"),("italic","斜体","CmdOrCtrl+I"),("underline","下划线","CmdOrCtrl+U"),("strike","删除线","Alt+Shift+5"),("inline-code","行内代码","CmdOrCtrl+Shift+`"),("mark","高亮","CmdOrCtrl+Shift+H"),("link","超链接","CmdOrCtrl+K"),("image","图片","CmdOrCtrl+Shift+I"),("clear-format","清除格式","CmdOrCtrl+\\"),("open-link","打开链接","CmdOrCtrl+Enter")]),
      ("视图", &[("toggle-sidebar","文件树侧栏","CmdOrCtrl+Shift+1"),("toggle-outline","大纲","CmdOrCtrl+Shift+2"),("toggle-source","源码模式","CmdOrCtrl+/"),("focus-mode","专注模式","F8"),("typewriter-mode","打字机模式","F9"),("zoom-in","放大","CmdOrCtrl+="),("zoom-out","缩小","CmdOrCtrl+-"),("zoom-reset","实际大小","CmdOrCtrl+Alt+0"),("reload","重新加载","CmdOrCtrl+R")]),
      ("主题", &[("theme-light","浅色","CmdOrCtrl+Alt+1"),("theme-dark","深色","CmdOrCtrl+Alt+2"),("theme-warm","暖色","CmdOrCtrl+Alt+3"),("theme-system","随系统","")]),
      ("帮助", &[("shortcuts","快捷键说明","F1"),("author","作者主页",""),("about","关于 MuseMark","")])
    ];
    for (title, items) in groups {
        let sub = Submenu::new(app, *title, true)?;
        for (id, text, accelerator) in *items {
            match *id {
                "cut" => sub.append(&PredefinedMenuItem::cut(app, Some(text))?)?,
                "copy" => sub.append(&PredefinedMenuItem::copy(app, Some(text))?)?,
                "paste" => sub.append(&PredefinedMenuItem::paste(app, Some(text))?)?,
                "recent-menu" => {
                    let recent = Submenu::new(app, *text, true)?;
                    let paths = files::recent(app.state()).unwrap_or_default();
                    for (i, path) in paths.iter().enumerate() {
                        recent.append(&MenuItem::with_id(app, format!("recent-{i}"), path, true, None::<&str>)?)?;
                    }
                    recent.append(&MenuItem::with_id(app,"clear-recent","清除记录",true,None::<&str>)?)?;
                    sub.append(&recent)?;
                },
                _ => sub.append(&MenuItem::with_id(app, *id, *text, true, if accelerator.is_empty(){None}else{Some(*accelerator)})?)?,
            }
        }
        menu.append(&sub)?;
    }
    Ok(menu)
}

pub fn refresh_menu(app: &tauri::AppHandle) {
    match menu(app).and_then(|m|app.set_menu(m).map(|_|())) { Ok(())=>{}, Err(e)=>eprintln!("menu: {e}") }
}

pub fn run() {
    tauri::Builder::default()
      .plugin(tauri_plugin_single_instance::init(|app, args, _| {
          let files: Vec<_> = args.into_iter().skip(1).filter(|p|!p.starts_with('-') && std::path::Path::new(p).is_file()).collect();
          if files.is_empty() { if let Some(w)=focused(app) { let _=w.unminimize(); let _=w.set_focus(); } }
          for path in files { if let Some(w)=focused(app) { let _=w.emit("menu",json!({"cmd":"open-path","arg":path}));let _=w.set_focus(); } else if let Err(e)=open_window(app,Some(path)) {eprintln!("{e}");} }
      }))
      .plugin(tauri_plugin_dialog::init())
      .plugin(tauri_plugin_opener::init())
      .manage(Windows::default())
      .setup(|app| {
          files::FileState::setup(app.handle()).map_err(std::io::Error::other)?;
          refresh_menu(app.handle());
          let paths:Vec<_>=std::env::args().skip(1).filter(|p|!p.starts_with('-') && std::path::Path::new(p).is_file()).collect();
          if paths.is_empty() {open_window(app.handle(),None)?;} else {for p in paths {open_window(app.handle(),Some(p))?;}}
          Ok(())
      })
      .on_menu_event(|app,event| {
          let id=event.id().as_ref();
          match id {
            "new-window"=>{if let Err(e)=open_window(app,None){eprintln!("{e}");}},
            "close-window"=>{if let Some(w)=focused(app){let _=w.close();}},
            "quit"=>{for w in app.webview_windows().values(){if w.label().starts_with("editor-"){let _=w.close();}}},
            "clear-recent"=>{let _=files::config_set(app.state(),json!({"recent":[]}));refresh_menu(app);},
            "author"=>{let app=app.clone();tauri::async_runtime::spawn(async move{let _=files::open_external(app,"https://github.com/Brian98Z".into()).await;});},
            _=>{if let Some(w)=focused(app){
                let payload=if let Some(theme)=id.strip_prefix("theme-"){json!({"cmd":"theme","arg":theme})}
                else if let Some(index)=id.strip_prefix("recent-").and_then(|s|s.parse::<usize>().ok()) {
                    let paths=files::recent(app.state()).unwrap_or_default();
                    if let Some(path)=paths.get(index){json!({"cmd":"open-path","arg":path})}else{return;}
                }else{json!({"cmd":id})};
                let _=w.emit("menu",payload);
            }}
          }
      })
      .on_window_event(|window,event| {
          if let WindowEvent::CloseRequested{api,..}=event {
              let state=window.state::<Windows>();
              if state.dirty.lock().get(window.label()).copied().unwrap_or(false) {
                  api.prevent_close();
                  if !state.confirming.lock().insert(window.label().into()){return;}
                  let w=window.clone();
                  window.dialog().message("有未保存的更改。放弃更改并关闭？").title("MuseMark")
                    .buttons(MessageDialogButtons::OkCancelCustom("放弃更改并关闭".into(),"取消".into())).show(move|discard|{
                        let state=w.state::<Windows>();state.confirming.lock().remove(w.label());
                        if discard {state.dirty.lock().remove(w.label());let _=w.destroy();}
                    });
              }
          }
      })
      .invoke_handler(tauri::generate_handler![set_dirty,frontend_ready,files::info,files::about,files::stat,files::open_dialog,files::open_folder_dialog,files::save_dialog,files::read,files::write,files::read_tree,files::reveal,files::open_external,files::recent,files::export_html,files::config_get,files::config_set,pdf::export_pdf])
      .run(tauri::generate_context!())
      .expect("MuseMark native application failed");
}
