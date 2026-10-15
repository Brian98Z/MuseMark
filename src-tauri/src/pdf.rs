//! PDF export via native WebView printing. Windows uses WebView2 PrintToPdf;
//! other platforms return an explicit unsupported-platform error rather than
//! pretending to have saved a PDF.

use std::path::PathBuf;

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_dialog::{DialogExt, FilePath};

fn pdf_name(name: Option<String>) -> String {
    let mut name = name.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "untitled".into());
    if !name.to_ascii_lowercase().ends_with(".pdf") { name.push_str(".pdf"); }
    name
}

async fn choose_path<R: Runtime>(app: &AppHandle<R>, name: String) -> Result<Option<PathBuf>, String> {
    let app = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app.dialog().file().set_title("导出 PDF").add_filter("PDF", &["pdf"]);
        if let Ok(desktop) = app.path().desktop_dir() { dialog = dialog.set_directory(desktop); }
        dialog.set_file_name(name).blocking_save_file()
    }).await.map_err(|e| format!("保存对话框失败：{e}"))?;
    match selected {
        Some(FilePath::Path(path)) => Ok(Some(path)),
        Some(_) => Err("无法解析保存位置".into()),
        None => Ok(None),
    }
}

/// Export the supplied standalone HTML. `None` means the user canceled.
#[tauri::command]
pub async fn export_pdf<R: Runtime>(
    app: AppHandle<R>, html: String, name: Option<String>,
) -> Result<Option<String>, String> {
    let Some(path) = choose_path(&app, pdf_name(name)).await? else { return Ok(None) };
    #[cfg(target_os = "windows")]
    return windows::print_to_pdf(app, html, path).await.map(Some);
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, html, path);
        Err("PDF 导出目前仅支持 Windows；此平台尚无可静默写入文件的原生 WebView PDF API。".into())
    }
}

#[cfg(target_os = "windows")]
mod windows {
    use std::{fs, path::PathBuf, sync::mpsc, time::{SystemTime, UNIX_EPOCH}};

    use tauri::{webview::PageLoadEvent, WebviewWindowBuilder};
    use webview2_com::{Microsoft::Web::WebView2::Win32::*, PrintToPdfCompletedHandler};
    use ::windows::core::{Interface, PCWSTR};

    pub async fn print_to_pdf<R: tauri::Runtime>(
        app: tauri::AppHandle<R>, html: String, target: PathBuf,
    ) -> Result<String, String> {
        let id = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
        let label = format!("pdf-export-{id}");
        let (tx, rx) = mpsc::channel::<Result<(), String>>();
        let callback_tx = tx.clone();
        let target_cb = target.clone();
        let html_json = serde_json::to_string(&html).map_err(|e| format!("序列化导出 HTML 失败：{e}"))?;
        let app_page_url = tauri::WebviewUrl::App("renderer/pdf.html".into());
        let window = WebviewWindowBuilder::new(&app, &label, app_page_url)
            .title("MuseMark PDF export").visible(false).focused(false).devtools(false)
            .disable_drag_drop_handler()
            .on_navigation(|url| url.scheme() == "tauri" || url.scheme() == "http")
            .on_page_load(move |webview, payload| {
                if payload.event() != PageLoadEvent::Finished { return; }
                let tx = callback_tx.clone();
                let target = target_cb.clone();
                let content = html_json.clone();
                let webview_for_ready = webview.clone();
                let code = format!(r#"(async()=>{{
                    const source={content};
                    const parsed=new DOMParser().parseFromString(source,'text/html');
                    for(const node of parsed.querySelectorAll('script,iframe,frame,object,embed,applet,base,meta[http-equiv]')) node.remove();
                    for(const el of parsed.querySelectorAll('*')) for(const a of [...el.attributes]) if(/^on/i.test(a.name)||a.name==='srcdoc') el.removeAttribute(a.name);
                    document.title=parsed.title||'MuseMark';
                    const head=document.head;
                    for(const node of [...parsed.head.children]) if(node.tagName==='LINK'||node.tagName==='STYLE') head.append(node.cloneNode(true));
                    document.body.replaceChildren(...[...parsed.body.childNodes].map(n=>document.importNode(n,true)));
                    const imgs=[...document.images];
                    await Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{{img.addEventListener('load',resolve,{{once:true}});img.addEventListener('error',resolve,{{once:true}});}})));
                    if(document.fonts) await document.fonts.ready;
                    window.__pdfReady='ready';
                }})()"#);
                let eval_result = wait_ready(webview.clone(), code, move |result| {
                    if result.trim_matches('"') != "ready" {
                        let _ = tx.send(Err(format!("PDF 渲染页面未就绪：{result}")));
                        return;
                    }
                    let send = tx.clone();
                    let path = target.clone();
                    let _ = webview_for_ready.with_webview(move |platform| unsafe {
                        let result = (|| -> Result<(), String> {
                            let core = platform.controller().CoreWebView2().map_err(err)?;
                            let settings: ICoreWebView2Settings = core.Settings().map_err(err)?;
                            settings.SetIsScriptEnabled(false).map_err(err)?;
                            let webview7: ICoreWebView2_7 = core.cast().map_err(err)?;
                            let environment6: ICoreWebView2Environment6 = platform.environment().cast().map_err(err)?;
                            let print = environment6.CreatePrintSettings().map_err(err)?;
                            print.SetPageWidth(8.27).map_err(err)?;
                            print.SetPageHeight(11.69).map_err(err)?;
                            print.SetMarginTop(0.6).map_err(err)?;
                            print.SetMarginBottom(0.6).map_err(err)?;
                            print.SetMarginLeft(0.6).map_err(err)?;
                            print.SetMarginRight(0.6).map_err(err)?;
                            print.SetShouldPrintBackgrounds(true).map_err(err)?;
                            print.SetShouldPrintHeaderAndFooter(false).map_err(err)?;
                            let wide: Vec<u16> = path.to_string_lossy().encode_utf16().chain(Some(0)).collect();
                            let completion_tx = send.clone();
                            let handler = PrintToPdfCompletedHandler::create(Box::new(move |status, success| {
                                let completion = match status {
                                    Err(e) => Err(format!("WebView2 PDF 打印失败：{e}")),
                                    Ok(()) if !success => Err("WebView2 未能生成 PDF".into()),
                                    Ok(()) => Ok(()),
                                };
                                let _ = completion_tx.send(completion);
                                Ok(())
                            }));
                            webview7.PrintToPdf(PCWSTR(wide.as_ptr()), &print, &handler).map_err(err)
                        })();
                        if let Err(e) = result { let _ = send.send(Err(e)); }
                    });
                });
                if let Err(e) = eval_result { let _ = callback_tx.send(Err(format!("启动 PDF 渲染失败：{e}"))); }
            })
            .build().map_err(|e| format!("创建 PDF 渲染窗口失败：{e}"))?;

        let result = tauri::async_runtime::spawn_blocking(move || rx.recv()).await
            .map_err(|e| format!("PDF 打印任务失败：{e}"))?
            .map_err(|e| format!("PDF 打印回调失败：{e}"))?;
        let _ = window.destroy();
        result?;
        if !target.is_file() || fs::metadata(&target).map(|m| m.len() == 0).unwrap_or(true) {
            return Err("WebView2 已完成打印，但没有生成有效 PDF 文件".into());
        }
        Ok(target.to_string_lossy().into_owned())
    }

    fn wait_ready<R: tauri::Runtime>(webview: tauri::WebviewWindow<R>, code: String, callback: impl FnOnce(String) + Send + 'static) -> tauri::Result<()> {
        webview.eval(format!("window.__pdfReady='pending';{code}.catch(e=>window.__pdfReady='error:'+String(e));"))?;
        std::thread::spawn(move || {
            for _ in 0..150 {
                let (tx, rx) = mpsc::channel();
                if let Err(e) = webview.eval_with_callback("window.__pdfReady || 'pending'", move |s| { let _=tx.send(s); }) { callback(format!("error:{e}")); return; }
                match rx.recv_timeout(std::time::Duration::from_secs(2)) {
                    Ok(s) if s.trim_matches('"') == "ready" => { callback(s); return; },
                    Ok(s) if s.contains("error:") => { callback(s); return; },
                    _ => std::thread::sleep(std::time::Duration::from_millis(100)),
                }
            }
            callback("error:render timeout".into());
        });
        Ok(())
    }

    fn err(error: impl std::fmt::Display) -> String { format!("WebView2 PDF 导出失败：{error}") }
}
