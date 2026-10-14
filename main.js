'use strict';
/*
 * MuseMark — 本地 Markdown 桌面编辑器与媒体预览器（所见即所得 · 离线优先）
 * 设计原则：无许可证、无账号、无遥测、无任何联网请求。
 */
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session } = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');

const APP_NAME = 'MuseMark';
const AUTHOR_NAME = 'Brian98Z';
const AUTHOR_URL = 'https://github.com/Brian98Z';
const MD_EXT = new Set(['.md', '.markdown', '.mdown', '.mkd', '.txt']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.jfif', '.gif', '.webp', '.svg', '.bmp', '.avif', '.ico']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.oga', '.flac', '.m4a', '.aac', '.opus', '.wma']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.mkv', '.m4v', '.avi', '.ogv', '.wmv']);
const OPENABLE_EXT = new Set([...MD_EXT, ...IMAGE_EXT, ...AUDIO_EXT, ...VIDEO_EXT]);

function kindOf(p) {
  const ext = path.extname(p).toLowerCase();
  if (IMAGE_EXT.has(ext)) return 'image';
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (VIDEO_EXT.has(ext)) return 'video';
  if (MD_EXT.has(ext)) return 'md';
  return 'other';
}
const RECENT_LIMIT = 20;

app.setName(APP_NAME);

let mainWindows = new Set();
let pendingFiles = [];

/* ---------------------------------------------------------------- 配置存储 */
const storeFile = () => path.join(app.getPath('userData'), 'config.json');

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
  } catch {
    return {};
  }
}
function writeStore(patch) {
  const next = Object.assign(readStore(), patch);
  try {
    fs.mkdirSync(path.dirname(storeFile()), { recursive: true });
    fs.writeFileSync(storeFile(), JSON.stringify(next, null, 2), 'utf8');
  } catch {}
  return next;
}

/* 默认目录：优先上次使用的文件夹，其次桌面 */
function defaultDir() {
  try {
    const last = readStore().lastFolder;
    if (last && fs.existsSync(last)) return last;
  } catch {}
  try { return app.getPath('desktop'); } catch { return undefined; }
}

/* ------------------------------------------------------------------ 最近文件 */
function recentList() {
  return (readStore().recent || []).filter((p) => {
    try { return fs.statSync(p).isFile(); } catch { return false; }
  });
}
function recentAdd(file) {
  if (!file) return recentList();
  const list = recentList().filter((p) => p !== file);
  list.unshift(file);
  writeStore({ recent: list.slice(0, RECENT_LIMIT) });
  return recentList();
}

/* -------------------------------------------------------------------- 网络封锁 */
function hardenSession() {
  try {
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_d, cb) => cb({ cancel: true }));
  } catch {}
  try { session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false)); } catch {}
}

/* --------------------------------------------------------------------- 窗口 */
function createWindow(file) {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#ffffff',
    title: APP_NAME,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      sandbox: false,
    },
  });

  win.webContents.on('console-message', (_e, level, message, line, source) => {
    console.log(`[renderer:${level}] ${String(message).slice(0, 400)} (${String(source).split('/').pop()}:${line})`);
  });
  win.webContents.on('render-process-gone', (_e, details) => console.log('[renderer gone]', JSON.stringify(details)));
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    if (file) win.webContents.send('menu', { cmd: 'open-path', arg: file });
  });
  win.on('closed', () => mainWindows.delete(win));
  mainWindows.add(win);
  return win;
}

function focusWin() {
  return [...mainWindows].find((w) => w.isFocused()) || [...mainWindows][0];
}


function openInWindow(file) {
  const target = focusWin();
  if (target) {
    target.webContents.send('menu', { cmd: 'open-path', arg: file });
    target.show();
    target.focus();
  } else {
    createWindow(file);
  }
}

/* ---------------------------------------------------------------------- 菜单 */
function send(cmd, arg) {
  const win = focusWin();
  if (win) win.webContents.send('menu', { cmd, arg });
}

function buildMenu() {
  const tpl = [
    {
      label: '文件',
      submenu: [
        { label: '新建', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: '新建窗口', accelerator: 'CmdOrCtrl+Shift+N', click: () => createWindow() },
        { type: 'separator' },
        { label: '打开…', accelerator: 'CmdOrCtrl+O', click: () => send('open-dialog') },
        { label: '打开文件夹…', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('open-folder') },
        { label: '最近文件', submenu: recentSubmenu() },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: '另存为…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('save-as') },
        { type: 'separator' },
        {
          label: '导出',
          submenu: [
            { label: 'HTML（自包含）', accelerator: 'CmdOrCtrl+Shift+E', click: () => send('export-html') },
            { label: 'PDF…', accelerator: 'CmdOrCtrl+Shift+P', click: () => send('export-pdf') },
          ],
        },
        { type: 'separator' },
        { label: '在资源管理器中显示', click: () => send('reveal') },
        { label: '关闭窗口', accelerator: 'CmdOrCtrl+W', click: () => { const w = focusWin(); if (w) w.close(); } },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: () => send('undo') },
        { label: '重做', accelerator: 'CmdOrCtrl+Shift+Z', click: () => send('redo') },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', click: () => send('select-all') },
        { type: 'separator' },
        { label: '查找', accelerator: 'CmdOrCtrl+F', click: () => send('find') },
        { label: '替换', accelerator: 'CmdOrCtrl+H', click: () => send('replace') },
      ],
    },
    {
      label: '段落',
      submenu: [
        { label: '标题 1', accelerator: 'CmdOrCtrl+1', click: () => send('h1') },
        { label: '标题 2', accelerator: 'CmdOrCtrl+2', click: () => send('h2') },
        { label: '标题 3', accelerator: 'CmdOrCtrl+3', click: () => send('h3') },
        { label: '标题 4', accelerator: 'CmdOrCtrl+4', click: () => send('h4') },
        { label: '标题 5', accelerator: 'CmdOrCtrl+5', click: () => send('h5') },
        { label: '标题 6', accelerator: 'CmdOrCtrl+6', click: () => send('h6') },
        { label: '正文', accelerator: 'CmdOrCtrl+0', click: () => send('paragraph') },
        { type: 'separator' },
        { label: '引用', accelerator: 'CmdOrCtrl+Shift+Q', click: () => send('quote') },
        { label: '有序列表', accelerator: 'CmdOrCtrl+Shift+[', click: () => send('olist') },
        { label: '无序列表', accelerator: 'CmdOrCtrl+Shift+]', click: () => send('ulist') },
        { label: '任务列表', accelerator: 'CmdOrCtrl+Shift+X', click: () => send('task') },
        { label: '代码块', accelerator: 'CmdOrCtrl+Shift+K', click: () => send('code') },
        { label: '插入表格', accelerator: 'CmdOrCtrl+T', click: () => send('table') },
        { label: '插入公式块', accelerator: 'CmdOrCtrl+Shift+M', click: () => send('math') },
        { label: '插入 Mermaid 图', click: () => send('mermaid') },
        { label: '分隔线', click: () => send('hr') },
      ],
    },
    {
      label: '格式',
      submenu: [
        { label: '加粗', accelerator: 'CmdOrCtrl+B', click: () => send('bold') },
        { label: '斜体', accelerator: 'CmdOrCtrl+I', click: () => send('italic') },
        { label: '下划线', accelerator: 'CmdOrCtrl+U', click: () => send('underline') },
        { label: '删除线', accelerator: 'Alt+Shift+5', click: () => send('strike') },
        { label: '行内代码', accelerator: 'CmdOrCtrl+Shift+`', click: () => send('inline-code') },
        { label: '高亮', accelerator: 'CmdOrCtrl+Shift+H', click: () => send('mark') },
        { type: 'separator' },
        { label: '超链接', accelerator: 'CmdOrCtrl+K', click: () => send('link') },
        { label: '图片', accelerator: 'CmdOrCtrl+Shift+I', click: () => send('image') },
        { label: '清除格式', accelerator: 'CmdOrCtrl+\\', click: () => send('clear-format') },
        { type: 'separator' },
        { label: '打开链接', accelerator: 'CmdOrCtrl+Enter', click: () => send('open-link') },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '文件树侧栏', accelerator: 'CmdOrCtrl+Shift+1', click: () => send('toggle-sidebar') },
        { label: '大纲', accelerator: 'CmdOrCtrl+Shift+2', click: () => send('toggle-outline') },
        { type: 'separator' },
        { label: '源码模式', accelerator: 'CmdOrCtrl+/', click: () => send('toggle-source') },
        { label: '专注模式', accelerator: 'F8', click: () => send('focus-mode') },
        { label: '打字机模式', accelerator: 'F9', click: () => send('typewriter-mode') },
        { type: 'separator' },
        { label: '放大', accelerator: 'CmdOrCtrl+=', click: () => send('zoom-in') },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => send('zoom-out') },
        { label: '实际大小', accelerator: 'CmdOrCtrl+Shift+0', click: () => send('zoom-reset') },
        { type: 'separator' },
        
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => send('reload') },
      ],
    },
    {
      label: '主题',
      submenu: [
        { label: '浅色', accelerator: 'CmdOrCtrl+Alt+1', click: () => send('theme', 'light') },
        { label: '深色', accelerator: 'CmdOrCtrl+Alt+2', click: () => send('theme', 'dark') },
        { label: '暖色（护眼）', accelerator: 'CmdOrCtrl+Alt+3', click: () => send('theme', 'warm') },
        { label: '随系统', click: () => send('theme', 'system') },
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: '快捷键说明', accelerator: 'F1', click: () => send('shortcuts') },
        { label: `作者主页（${AUTHOR_NAME}）`, click: () => shell.openExternal(AUTHOR_URL) },
        { type: 'separator' },
        { label: `关于 ${APP_NAME}`, click: () => send('about') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

function recentSubmenu() {
  const list = recentList();
  const items = list.map((p) => ({
    label: path.basename(p),
    toolTip: p,
    click: () => openInWindow(p),
  }));
  if (!items.length) items.push({ label: '（空）', enabled: false });
  items.push({ type: 'separator' }, { label: '清除记录', click: () => { writeStore({ recent: [] }); buildMenu(); } });
  return items;
}

/* ------------------------------------------------------------------- IPC 接口 */
ipcMain.handle('app:info', () => {
  let vditor = null;
  try { vditor = require('vditor/package.json').version; } catch {}
  return { name: APP_NAME, version: app.getVersion(), author: AUTHOR_NAME, authorUrl: AUTHOR_URL, electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, vditor };
});

ipcMain.handle('app:about', async () => {
  let vditor = null;
  try { vditor = require('vditor/package.json').version; } catch {}
  const detail = [
    '本地 Markdown 编辑器 · 图片 / 音频 / 视频预览',
    '无许可证校验、无账号登录、无遥测、无网络请求。',
    '',
    `作者：${AUTHOR_NAME}  ${AUTHOR_URL}`,
    '',
    `渲染内核：Vditor ${vditor || '?'} / Lute（MIT 许可，© Vanessa219 及贡献者）`,
    `运行时：Electron ${process.versions.electron} · Chromium ${process.versions.chrome} · Node ${process.versions.node}`,
  ].join('\n');
  const r = await dialog.showMessageBox(focusWin(), {
    type: 'info',
    title: `关于 ${APP_NAME}`,
    message: `${APP_NAME} ${app.getVersion()}`,
    detail,
    buttons: ['关闭', '打开作者主页'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (r.response === 1) {
    try { await shell.openExternal(AUTHOR_URL); } catch {}
  }
  return { author: AUTHOR_NAME, authorUrl: AUTHOR_URL };
});

ipcMain.handle('file:open-dialog', async () => {
  const r = await dialog.showOpenDialog(focusWin(), {
    title: '打开文件（文档 / 图片 / 音频 / 视频）',
    defaultPath: defaultDir(),
    properties: ['openFile'],
    filters: [
      { name: '支持的文档', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
      { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'] },
      { name: '音频', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus'] },
      { name: '视频', extensions: ['mp4', 'webm', 'mov', 'mkv', 'm4v', 'avi'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('file:open-folder-dialog', async () => {
  const r = await dialog.showOpenDialog(focusWin(), { title: '打开文件夹', defaultPath: defaultDir(), properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('file:save-dialog', async (_e, defaultName) => {
  const r = await dialog.showSaveDialog(focusWin(), {
    title: '另存为',
    defaultPath: path.join(defaultDir() || '', defaultName || 'untitled.md'),
    filters: [{ name: 'Markdown', extensions: ['md'] }, { name: '所有文件', extensions: ['*'] }],
  });
  return r.canceled ? null : r.filePath;
});

ipcMain.handle('file:read', async (_e, p) => {
  const buf = await fsp.readFile(p);
  let text = buf.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  recentAdd(p); buildMenu();
  return { path: p, content: text };
});

ipcMain.handle('file:write', async (_e, p, content) => {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, content, 'utf8');
  recentAdd(p); buildMenu();
  return { path: p };
});

ipcMain.handle('tree:read', async (_e, root) => {
  const SKIP = new Set(['node_modules', '.git', '.svn', '$RECYCLE.BIN', 'System Volume Information', '.idea', '.vscode']);
  let count = 0;
  async function walk(dir, depth) {
    if (depth > 4 || count > 2000) return [];
    let entries = [];
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return []; }
    const dirs = [], files = [];
    for (const ent of entries) {
      if (count > 2000) break;
      if (ent.name.startsWith('.') && ent.name !== '.md') { if (ent.isDirectory()) continue; }
      if (SKIP.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        count++;
        dirs.push({ name: ent.name, path: full, dir: true, children: await walk(full, depth + 1) });
      } else if (OPENABLE_EXT.has(path.extname(ent.name).toLowerCase())) {
        count++;
        files.push({ name: ent.name, path: full, dir: false, kind: kindOf(ent.name) });
      }
    }
    const byName = (a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN');
    return dirs.sort(byName).concat(files.sort(byName));
  }
  return { root, children: await walk(root, 0) };
});

ipcMain.handle('file:stat', async (_e, p) => {
  try {
    const st = await fsp.stat(p);
    return { path: p, size: st.size, mtime: st.mtimeMs, kind: kindOf(p) };
  } catch { return null; }
});

ipcMain.handle('shell:reveal', (_e, p) => { if (p) shell.showItemInFolder(p); });

/* 超链接：仅允许 http/https/mailto 交给系统浏览器 */
ipcMain.handle('shell:open-external', async (_e, url) => {
  const u = String(url || '');
  if (!/^(https?:\/\/|mailto:)/i.test(u)) return false;
  await shell.openExternal(u);
  return true;
});

ipcMain.handle('recent:list', () => recentList());


/* 导出：HTML 自包含 / PDF */
ipcMain.handle('export:html', async (_e, html, defaultName) => {
  const r = await dialog.showSaveDialog(focusWin(), {
    title: '导出 HTML',
    defaultPath: path.join(defaultDir() || '', (defaultName || 'untitled') + '.html'),
    filters: [{ name: 'HTML', extensions: ['html'] }],
  });
  if (r.canceled || !r.filePath) return null;
  await fsp.writeFile(r.filePath, html, 'utf8');
  return r.filePath;
});

ipcMain.handle('export:pdf', async (_e, html, defaultName) => {
  const r = await dialog.showSaveDialog(focusWin(), {
    title: '导出 PDF',
    defaultPath: path.join(defaultDir() || '', (defaultName || 'untitled') + '.pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled || !r.filePath) return null;
  const tmp = path.join(os.tmpdir(), `musemark-${Date.now()}.html`);
  await fsp.writeFile(tmp, html, 'utf8');
  const hidden = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    await hidden.loadFile(tmp);
    const data = await hidden.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'custom', top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 },
      pageSize: 'A4',
    });
    await fsp.writeFile(r.filePath, data);
  } finally {
    hidden.destroy();
    fsp.unlink(tmp).catch(() => {});
  }
  return r.filePath;
});

/* --------------------------------------------------------------- 单实例/argv */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const files = argv.slice(1).filter((a) => !a.startsWith('-') && OPENABLE_EXT.has(path.extname(a).toLowerCase()));
    if (files.length) files.forEach(openInWindow);
    else { const w = focusWin(); if (w) { if (w.isMinimized()) w.restore(); w.focus(); } }
  });

  app.whenReady().then(() => {
    hardenSession();
    buildMenu();
    const files = process.argv.slice(1).filter((a) => !a.startsWith('-') && OPENABLE_EXT.has(path.extname(a).toLowerCase()));
    if (files.length) files.forEach((f) => createWindow(f));
    else {
      const dir = defaultDir();
      createWindow();
      if (dir) setTimeout(() => focusWin() && focusWin().webContents.send('menu', { cmd: 'open-folder-path', arg: dir }), 400);
    }
    app.on('activate', () => { if (!mainWindows.size) createWindow(); });
  });

  app.on('window-all-closed', () => app.quit());
}

/* 查找（Electron 原生 findInPage） */
const findState = new WeakMap();
ipcMain.handle('find:start', (e, text, forward) => {
  const wc = e.sender;
  const prev = findState.get(wc);
  const opts = { forward: forward !== false, findNext: !!(prev && prev.text === text) };
  findState.set(wc, { text });
  return new Promise((resolve) => {
    let done = false;
    const onFound = (_ev, r) => {
      if (done) return;
      done = true;
      wc.off('found-in-page', onFound);
      resolve({ matches: r.matches, activeMatchOrdinal: r.activeMatchOrdinal });
    };
    wc.on('found-in-page', onFound);
    wc.findInPage(text, opts);
    setTimeout(() => { if (!done) { done = true; wc.off('found-in-page', onFound); resolve(null); } }, 500);
  });
});
ipcMain.handle('find:stop', (e) => { findState.delete(e.sender); try { e.sender.stopFindInPage('clearSelection'); } catch {} });

/* 关闭前确认（同步，避免异步竞态） */
ipcMain.on('app:confirm-discard', (e) => {
  const r = dialog.showMessageBoxSync(focusWin(), {
    type: 'warning',
    buttons: ['放弃更改并关闭', '取消'],
    defaultId: 1,
    cancelId: 1,
    message: '有未保存的更改',
    detail: '关闭窗口会丢失尚未保存的内容。',
  });
  e.returnValue = r === 0;
});

ipcMain.handle('config:get', () => readStore());
ipcMain.handle('config:set', (_e, patch) => writeStore(patch));
