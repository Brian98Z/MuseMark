'use strict';
/* MuseMark renderer —— 文档编辑（实时渲染）+ 图片/音频/视频预览 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.jfif', '.gif', '.webp', '.svg', '.bmp', '.avif', '.ico']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.oga', '.flac', '.m4a', '.aac', '.opus', '.wma']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.mkv', '.m4v', '.avi', '.ogv', '.wmv']);

const state = {
  path: null,
  kind: 'md',          // md | image | audio | video
  dirty: false,
  zoom: 1,             // 文档缩放
  viewerZoom: 1,       // 媒体缩放
  theme: 'light',
  focusMode: false,
  typewriter: false,
  sourceMode: false,
  tbSel: '',           // 工具栏自定义项点击前缓存的行内选区
};

let vditor = null;
let appReady = false;
const pendingCmds = [];

/* -------------------------------------------------------------------- 工具 */
const extOf = (p) => { const m = /\.[^.\\/]+$/.exec(p || ''); return m ? m[0].toLowerCase() : ''; };
function kindOfPath(p) {
  const e = extOf(p);
  if (IMAGE_EXT.has(e)) return 'image';
  if (AUDIO_EXT.has(e)) return 'audio';
  if (VIDEO_EXT.has(e)) return 'video';
  if (e === '.md' || e === '.markdown' || e === '.mdown' || e === '.mkd' || e === '.txt') return 'md';
  return 'other';
}
const baseName = (p) => (p ? p.split(/[\\/]/).pop() : '未命名');
const toFileUrl = (p) => {
  const normalized = String(p).replace(/\\/g, '/');
  const absolute = /^[A-Za-z]:\//.test(normalized) ? `/${normalized}` : normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `file://${absolute.split('/').map((part, index) => index === 0 ? '' : index === 1 && /^[A-Za-z]:$/.test(part) ? part : encodeURIComponent(part)).join('/')}`;
};
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cssEscape = (s) => String(s).replace(/["\\]/g, '\\$&');
function fmtSize(n) {
  if (n == null) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 ** 3) return (n / 1024 ** 2).toFixed(1) + ' MB';
  return (n / 1024 ** 3).toFixed(2) + ' GB';
}
function fmtTime(sec) {
  if (!isFinite(sec)) return '';
  const s = Math.floor(sec % 60), m = Math.floor(sec / 60) % 60, h = Math.floor(sec / 3600);
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
const ICON = {
  md: '<use href="#i-doc"/>', image: '<use href="#i-image"/>', audio: '<use href="#i-audio"/>',
  video: '<use href="#i-video"/>', open: '<use href="#i-chev-d"/>', closed: '<use href="#i-chev-r"/>',
};

/* 工具栏自定义项图标：内核 CSS 对工具栏内的 svg 设了 fill:currentColor / stroke-width:0（面向填充型图标集），
   本项目的 Lucide 线性图标用内联样式覆盖，否则会被压成不可见 */
const tbIcon = (id) =>
  `<svg viewBox="0 0 24 24" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;width:15px;height:15px"><use href="#${id}"/></svg>`;

let publishMenuDismiss = null;

/* 公众号编辑器会剥离 <style> 标签与 class（保留内联 style），参考 doocs/md 的做法：
   把 vditor-reset 的基础排版逐节点内联，粘贴后无需选主题也能保持可读排版。 */
function inlinePublishStyles(holder) {
  const rules = [
    ['h1', 'margin:24px 0 16px;font-size:22px;font-weight:700;line-height:1.4;'],
    ['h2', 'margin:20px 0 14px;font-size:20px;font-weight:700;line-height:1.4;'],
    ['h3', 'margin:18px 0 12px;font-size:18px;font-weight:700;line-height:1.4;'],
    ['h4', 'margin:16px 0 10px;font-size:16px;font-weight:700;line-height:1.4;'],
    ['h5', 'margin:14px 0 10px;font-size:15px;font-weight:700;line-height:1.4;'],
    ['h6', 'margin:14px 0 10px;font-size:14px;font-weight:700;color:#888;line-height:1.4;'],
    ['p', 'margin:0 0 14px;line-height:1.75;font-size:15px;letter-spacing:0.5px;white-space:pre-wrap;'],
    ['ul', 'margin:0 0 14px;padding-left:24px;line-height:1.75;font-size:15px;'],
    ['ol', 'margin:0 0 14px;padding-left:24px;line-height:1.75;font-size:15px;'],
    ['li', 'margin:4px 0;line-height:1.75;'],
    ['blockquote', 'margin:0 0 14px;padding:10px 14px;border-left:3px solid #42b983;background:#f7f7f7;color:#666;line-height:1.75;font-size:14px;'],
    ['blockquote p', 'margin:0;line-height:1.75;'],
    ['pre', 'margin:0 0 14px;padding:12px;overflow-x:auto;background:#f6f8fa;border-radius:4px;font-size:13px;line-height:1.6;'],
    ['pre code', 'background:transparent;padding:0;border-radius:0;font-family:Consolas,Menlo,monospace;white-space:pre;'],
    ['code', 'background:rgba(66,185,131,0.12);padding:2px 5px;border-radius:3px;font-family:Consolas,Menlo,monospace;font-size:13px;color:#c7254e;'],
    ['table', 'border-collapse:collapse;margin:0 0 14px;width:100%;font-size:14px;'],
    ['th', 'border:1px solid #d9d9d9;padding:8px 12px;background:#f2f2f2;font-weight:700;text-align:left;'],
    ['td', 'border:1px solid #d9d9d9;padding:8px 12px;text-align:left;'],
    ['a', 'color:#42b983;text-decoration:none;border-bottom:1px solid #42b983;word-break:break-all;'],
    ['img', 'max-width:100%;height:auto;display:block;margin:10px auto;border-radius:4px;'],
    ['hr', 'border:none;border-top:1px solid #ddd;margin:20px 0;'],
    ['strong', 'font-weight:700;color:#0f0f0f;'],
    ['del', 'text-decoration:line-through;color:#999;'],
    ['sup', 'font-size:11px;'],
  ];
  for (const [selector, style] of rules) {
    holder.querySelectorAll(selector).forEach((el) => {
      el.style.cssText = style + el.style.cssText;
    });
  }
  // KaTeX 展示公式块居中
  holder.querySelectorAll('.katex-display').forEach((el) => {
    el.style.cssText += 'margin:14px 0;overflow-x:auto;';
  });
}

/* 第三方发布：把当前文档渲染成 HTML（复用导出的独立渲染管线），按平台修正格式
   （知乎公式转图片、公众号 KaTeX 修正）后写入剪贴板。
   不依赖 previewElement，源码/实时渲染模式、是否开过预览都可用。 */
async function copyForPublish(target) {
  if (state.kind !== 'md') { toast('仅文档可发布'); return; }
  if (!window.Vditor || typeof Vditor.preview !== 'function') { toast('发布复制暂不可用'); return; }
  toast('正在生成发布内容…');
  try {
    const holder = document.createElement('div');
    holder.className = 'vditor-reset';
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:920px;pointer-events:none';
    document.body.appendChild(holder);
    await Vditor.preview(holder, vditor.getValue(), {
      cdn: './vendor/vditor', lang: 'zh_CN',
      math: { engine: 'KaTeX', inlineDigit: true },
      hljs: { style: 'github', lineNumber: true },
      markdown: { toc: false, mark: true, footnotes: true, autoSpace: true },
    });
    // 等公式/图表渲染完成（同导出管线的等待策略）
    const pending = () => [...holder.querySelectorAll('[data-type="math-block"],.language-math')]
      .some((el) => !el.querySelector('.katex'))
      || [...holder.querySelectorAll('.language-mermaid')].some((el) => !el.querySelector('svg'));
    const until = Date.now() + 15000;
    while (pending() && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
    if (pending()) throw new Error('公式或图表尚未渲染完成');
    // 清理脚本/内联事件，避免粘贴内容携带可执行代码
    holder.querySelectorAll('script,iframe,object,embed').forEach((el) => el.remove());
    holder.querySelectorAll('*').forEach((el) => {
      for (const attr of [...el.attributes]) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    });
    // 复刻 vditor copyToX 的平台修正（知乎公式转图片、公众号 KaTeX 展示修正）
    if (target === 'zhihu') {
      holder.querySelectorAll('.language-math').forEach((item) => {
        item.outerHTML = `<img class="Formula-image" data-eeimg="true" src="//www.zhihu.com/equation?tex=" alt="${item.getAttribute('data-math') || ''}" style="display:block;margin:0 auto;max-width:100%;">`;
      });
    } else {
      holder.querySelectorAll('.katex-html .base').forEach((item) => { item.style.display = 'initial'; });
    }
    holder.style.backgroundColor = '#fff';
    holder.querySelectorAll('code').forEach((item) => { item.style.backgroundImage = 'none'; });
    // 公众号编辑器会剥离 <style>，参考 doocs/md：把基础排版内联到每个节点
    inlinePublishStyles(holder);
    // 首尾插入空段，避免粘贴后与已有内容挤在一起（doocs/md createEmptyNode 同款）
    const empty = () => {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      return p;
    };
    holder.insertBefore(empty(), holder.firstChild);
    holder.appendChild(empty());

    const html = holder.innerHTML;
    const plain = holder.textContent || '';
    holder.remove();
    // execCommand('copy') 在 await 之后会丢失点击带来的瞬时用户激活而被浏览器静默拦截；
    // 异步 Clipboard API 的 Promise 载荷则明确允许在手势后完成写入
    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
    } else {
      const box = document.createElement('div');
      box.contentEditable = 'true';
      box.style.cssText = 'position:fixed;left:-10000px;top:0';
      box.innerHTML = html;
      document.body.appendChild(box);
      const range = document.createRange();
      range.selectNodeContents(box);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      const ok = document.execCommand('copy');
      box.remove();
      sel.removeAllRanges();
      if (!ok) throw new Error('剪贴板写入被拒绝');
    }
    toast(target === 'zhihu' ? '已复制，可到知乎进行粘贴' : '已复制，可到平台编辑器粘贴');
  } catch (err) {
    toast('发布复制失败：' + err.message);
  }
}

function closePublishMenu() {
  document.querySelector('#publish-menu')?.remove();
  document.querySelector('.vditor-toolbar [data-type="publish"]')?.setAttribute('aria-expanded', 'false');
  if (publishMenuDismiss) {
    document.removeEventListener('mousedown', publishMenuDismiss, true);
    document.removeEventListener('keydown', publishMenuDismiss, true);
    publishMenuDismiss = null;
  }
}
function togglePublishMenu() {
  const trigger = document.querySelector('.vditor-toolbar [data-type="publish"]');
  if (!trigger) return;
  if (document.querySelector('#publish-menu')) { closePublishMenu(); return; }
  const rect = trigger.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'publish-menu';
  menu.className = 'vditor-preview__publish-menu';
  menu.setAttribute('role', 'menu');
  menu.style.left = `${Math.max(8, Math.min(rect.right - 56, innerWidth - 124))}px`;
  menu.style.top = `${rect.bottom + 4}px`;
  menu.innerHTML = '<button type="button" role="menuitem" data-publish-target="mp-wechat" title="公众号" aria-label="公众号"><svg viewBox="0 0 24 24"><use href="#i-mp-wechat"/></svg></button><button type="button" role="menuitem" data-publish-target="zhihu" title="知乎" aria-label="知乎"><svg viewBox="0 0 24 24"><use href="#i-zhihu"/></svg></button><button type="button" role="menuitem" data-publish-target="toutiao" title="今日头条" aria-label="今日头条"><svg viewBox="0 0 24 24"><use href="#i-toutiao"/></svg></button>';
  menu.addEventListener('click', (e) => {
    e.stopPropagation();
    const button = e.target.closest('[data-publish-target]');
    if (!button) return;
    const target = button.dataset.publishTarget;
    copyForPublish(target);
    closePublishMenu();
  });
  document.body.appendChild(menu);
  trigger?.setAttribute('aria-expanded', 'true');
  publishMenuDismiss = (e) => {
    if (e.type === 'keydown' && e.key !== 'Escape') return;
    if (e.type === 'mousedown' && (menu.contains(e.target) || trigger?.contains(e.target))) return;
    closePublishMenu();
  };
  document.addEventListener('mousedown', publishMenuDismiss, true);
  document.addEventListener('keydown', publishMenuDismiss, true);
}

function toggleSplitPreview() {
  if (!vditor) return;
  const targetMode = vditor.getCurrentMode() === 'sv' ? 'ir' : 'sv';
  const modeButton = document.querySelector('.vditor-toolbar [data-type="edit-mode"]')?.parentElement.querySelector(`.vditor-hint button[data-mode="${targetMode}"]`);
  modeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}
/* ------------------------------------------------------------------ 编辑器 */
function initEditor() {
  vditor = new Vditor('editor', {
    mode: 'ir',
    cdn: './vendor/vditor',
    lang: 'zh_CN',
    height: '100%',
    icon: 'material',
    cache: { enable: false },
    counter: { enable: false },
    outline: { enable: false },
    toolbarConfig: { pin: true },
    theme: { current: 'light', path: './vendor/vditor/dist/css/content-theme' },
    preview: {
      actions: ['desktop', 'tablet', 'mobile'],
      markdown: { toc: false, mark: true, footnotes: true, autoSpace: true, mathBlockPreview: true },
      math: { engine: 'KaTeX', inlineDigit: true, macros: {} },
      hljs: { style: 'github', lineNumber: true },
      theme: { current: 'light', path: './vendor/vditor/dist/css/content-theme' },
      maxWidth: 1080,
    },
    // 链接点击交给我们处理，避免将本地链接交给系统默认打开器。
    link: {
      isOpen: false,
      click: (el) => {
        const href = linkTarget(el);
        if (href) openHref(href);
      },
    },
    toolbar: [
      { name: 'toggle-sidebar', tip: '隐藏侧栏（Ctrl+Shift+1）', tipPosition: 's', icon: tbIcon('i-panel-hide'), click: () => cmds['toggle-sidebar']() },
      '|',
      'headings', 'bold', 'italic', 'strike',
      { name: 'mark', tip: '高亮（Ctrl+Shift+H）', tipPosition: 's', icon: tbIcon('i-highlight'), click: () => cmds.mark() },
      '|',
      'list', 'ordered-list', 'check', '|',
      'quote', 'line', 'code', 'inline-code', '|',
      'link', 'table', '|',
      'undo', 'redo', '|',
{ name: 'edit-mode', tip: '渲染模式', tipPosition: 's', icon: tbIcon('i-render'), hotkey: '⌘P' },
{ name: 'split-view', tip: '分屏预览', tipPosition: 's', icon: tbIcon('i-split'), click: (event) => { event.stopPropagation(); toggleSplitPreview(); } },
      'preview', '|',
       {
         name: 'publish',
         tip: '第三方发布',
         tipPosition: 's',
         icon: `<svg viewBox="0 0 24 24"><use href="#i-publish"/></svg>`,
         click: () => togglePublishMenu(),
       },
    ],
    input: () => { setDirty(true); updateOutline(); updateCount(); absolutizeDoc(); },
    after: () => {
      appReady = true;
      updateCount();
      updateOutline();
      absolutizeDoc();
      updateSidebarToggle();
      pendingCmds.splice(0).forEach(dispatch);
    },
  });
}

/* --------------------------------------------------------------- 视图切换 */
function showEditorView() {
  $('#viewer').classList.add('is-hidden');
  $('#editor').classList.remove('is-hidden');
  $('#st-mode').textContent = state.sourceMode ? '源码' : '实时渲染';
}
function hideEditorView() {
  $('#editor').classList.add('is-hidden');
  $('#viewer').classList.remove('is-hidden');
  $('#st-mode').textContent = '媒体预览';
}

/* -------------------------------------------------------------- 媒体查看器 */
const mediaEl = { image: () => $('#viewer-img'), audio: () => $('#viewer-audio'), video: () => $('#viewer-video') };

function stopMedia() {
  for (const el of [$('#viewer-img'), $('#viewer-audio'), $('#viewer-video')]) {
    try { el.pause(); } catch {}
  }
  try { $('#viewer-video').removeAttribute('src'); $('#viewer-video').load(); } catch {}
  try { $('#viewer-audio').removeAttribute('src'); $('#viewer-audio').load(); } catch {}
  $('#viewer-img').removeAttribute('src');
  for (const el of [$('#viewer-img'), $('#viewer-audio'), $('#viewer-video')]) el.classList.add('is-hidden');
}

async function showViewer(p, kind) {
  state.path = p;
  state.kind = kind;
  setDirty(false);
  stopMedia();
  hideEditorView();

  if (!await window.omp.stat(p)) { toast('无法读取媒体文件'); return; }
  const url = window.omp.toAssetUrl(p);
  $('#viewer-kind').textContent = { image: '图片', audio: '音频', video: '视频' }[kind];
  $('#viewer-name').textContent = baseName(p);
  $('#viewer-name').title = p;
  $('#viewer-stage').dataset.kind = kind;

  if (kind === 'image') {
    const img = $('#viewer-img');
    img.src = url;
    img.classList.remove('is-hidden');
    img.classList.add('fit');
    state.viewerZoom = 1;
    applyViewerZoom();
    img.onload = () => {
      img.dataset.nw = img.naturalWidth;
      img.dataset.nh = img.naturalHeight;
      refreshViewerMeta(`${img.naturalWidth} × ${img.naturalHeight} 像素`);
    };
    img.onerror = () => toast('无法显示该图片');
  } else if (kind === 'audio') {
    const au = $('#viewer-audio');
    au.src = url;
    au.classList.remove('is-hidden');
    au.onloadedmetadata = () => refreshViewerMeta(isFinite(au.duration) ? `时长 ${fmtTime(au.duration)}` : '');
  } else {
    const vd = $('#viewer-video');
    vd.src = url;
    vd.classList.remove('is-hidden');
    const meta = () => {
      const parts = [];
      if (vd.videoWidth) parts.push(`${vd.videoWidth} × ${vd.videoHeight}`);
      if (isFinite(vd.duration) && vd.duration > 0) parts.push(`时长 ${fmtTime(vd.duration)}`);
      refreshViewerMeta(parts.join(' · '));
    };
    vd.onloadedmetadata = meta;
    vd.onloadeddata = meta;
    vd.onresize = meta;
  }
  refreshViewerMeta();
  updateTitle();
  updateCount();
  markActiveInTree(p);
  $('#st-zoom').textContent = '100%';
  window.omp.configSet({ lastFolder: p.replace(/[\\/][^\\/]*$/, '') });
}

let viewerMetaExtra = '';
async function refreshViewerMeta(extra) {
  if (extra !== undefined) viewerMetaExtra = extra || '';
  const st = await window.omp.stat(state.path).catch(() => null);
  const parts = [];
  if (st) parts.push(fmtSize(st.size));
  if (viewerMetaExtra) parts.push(viewerMetaExtra);
  $('#viewer-meta').textContent = parts.join('  ·  ');
}

function applyViewerZoom() {
  const img = $('#viewer-img');
  const z = state.viewerZoom;
  if (z === 1) {
    img.classList.add('fit');
    img.style.width = '';
    img.style.height = '';
  } else {
    img.classList.remove('fit');
    const nw = Number(img.dataset.nw || img.naturalWidth || 0);
    img.style.width = nw ? Math.round(nw * z) + 'px' : Math.round(80 * z) + 'vw';
    img.style.height = 'auto';
  }
  $('#viewer-zoom-label').textContent = Math.round(z * 100) + '%';
}
const viewerZoomBy = (f) => { state.viewerZoom = Math.min(8, Math.max(0.1, Math.round(state.viewerZoom * f * 100) / 100)); applyViewerZoom(); };
const viewerFit = () => { state.viewerZoom = 1; applyViewerZoom(); };

/* -------------------------------------------------------------- 标题/状态 */
function setDirty(v) {
  const sync = state.dirty !== v ? window.omp.setDirty(v) : Promise.resolve();
  sync.catch((error) => toast('未保存状态同步失败：' + error));
  state.dirty = v;
  const el = $('#st-saved');
  el.textContent = v ? '未保存' : '已保存';
  el.classList.toggle('dirty', !!v);
  updateTitle();
  return sync;
}

function updateTitle() {
  const name = state.path ? baseName(state.path) : '未命名';
  document.title = (state.dirty ? '● ' : '') + name + ' — MuseMark';
  window.__TAURI__.window.getCurrentWindow().setTitle(document.title).catch((error) => console.error(error));
  $('#st-path').textContent = state.path || '未命名';
  $('#st-path').title = state.path || '';
}

function updateCount() {
  if (state.kind !== 'md') { $('#st-words').textContent = ''; return; }
  const md = vditor ? vditor.getValue() : '';
  const cjk = (md.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const words = (md.replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ').match(/[A-Za-z0-9_'\u00c0-\u024f-]+/g) || []).length;
  $('#st-words').textContent = `${cjk + words} 字 · ${md.length} 字符`;
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ------------------------------------------------------------------ 文件流 */
async function openPath(p) {
  if (!p) return;
  const kind = kindOfPath(p);
  if (kind === 'image' || kind === 'audio' || kind === 'video') return showViewer(p, kind);
  try {
    const { content } = await window.omp.read(p);
    state.path = p;
    state.kind = 'md';
    setDirty(false);
    showEditorView();
    vditor.setValue(content, true);
    absolutizeDoc();
    markActiveInTree(p);
    updateTitle();
    updateOutline();
    updateCount();
    window.omp.configSet({ lastFolder: p.replace(/[\\/][^\\/]*$/, '') });
  } catch (err) {
    toast('打开失败：' + err.message);
  }
}

async function save() {
  if (state.kind !== 'md') return;
  if (!state.path) return saveAs();
  if (await writeCurrent(state.path)) toast('已保存');
}

async function saveAs() {
  if (state.kind !== 'md') return;
  const p = await window.omp.saveDialog(state.path ? baseName(state.path) : 'untitled.md');
  if (!p) return;
  state.path = p;
  if (await writeCurrent(p)) toast('已保存到 ' + baseName(p));
  updateTitle();
}

async function writeCurrent(p) {
  if (!vditor) return false;
  try {
    await window.omp.write(p, vditor.getValue());
    await setDirty(false);
    updateTitle();
    return true;
  } catch (err) {
    toast('保存失败：' + err.message);
    return false;
  }
}

function newDoc() {
  state.path = null;
  state.kind = 'md';
  showEditorView();
  if (vditor) vditor.setValue('', true);
  setDirty(false);
  updateTitle();
  updateOutline();
  updateCount();
  markActiveInTree(null);
}

/* ------------------------------------------------------------------ 文件树 */
async function openFolder(root) {
  if (!root) {
    root = await window.omp.openFolderDialog();
    if (!root) return;
  }
  $('#folder-label').textContent = root;
  $('#folder-label').title = root;
  window.omp.configSet({ lastFolder: root });
  const tree = await window.omp.readTree(root);
  renderTree(tree.children, $('#filetree'), 0);
  showPane('files');
}

function renderTree(nodes, container, depth) {
  container.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const node of nodes) {
    const row = document.createElement('div');
    row.className = 'tree-row' + (node.dir ? '' : ' k-' + (node.kind || 'md'));
    row.style.paddingLeft = 4 + depth * 12 + 'px';
    row.dataset.path = node.path;
    row.title = node.path;
    if (node.dir) {
      const head = document.createElement('span');
      head.className = 'tw';
      head.innerHTML = `<svg class="ic" viewBox="0 0 24 24">${ICON.closed}</svg>`;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = node.name;
      row.append(head, name);
      const kids = document.createElement('div');
      kids.className = 'tree-children collapsed';
      row.addEventListener('click', () => {
        const collapsed = kids.classList.toggle('collapsed');
        head.innerHTML = `<svg class="ic" viewBox="0 0 24 24">${collapsed ? ICON.closed : ICON.open}</svg>`;
      });
      renderTree(node.children || [], kids, depth + 1);
      frag.append(row, kids);
    } else {
      const head = document.createElement('span');
      head.className = 'tw';
      head.innerHTML = `<svg class="ic" viewBox="0 0 24 24">${ICON[node.kind] || ICON.md}</svg>`;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = node.name;
      row.append(head, name);
      row.addEventListener('click', () => openPath(node.path));
      frag.append(row);
    }
  }
  container.appendChild(frag);
}

function markActiveInTree(p) {
  $$('#filetree .tree-row.active').forEach((el) => el.classList.remove('active'));
  if (!p) return;
  const el = document.querySelector(`#filetree .tree-row[data-path="${cssEscape(p)}"]`);
  if (el) el.classList.add('active');
}

/* -------------------------------------------------------------------- 大纲 */
function updateOutline() {
  const box = $('#outline');
  if (state.kind !== 'md' || !vditor) { box.innerHTML = '<div class="empty">媒体文件无大纲</div>'; return; }
  const lines = vditor.getValue().split('\n');
  const items = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (m) items.push({ level: m[1].length, text: m[2].trim() });
  }
  box.innerHTML = '';
  if (!items.length) { box.innerHTML = '<div class="empty">（无标题）</div>'; return; }
  items.forEach((it, i) => {
    const a = document.createElement('a');
    a.className = 'lv' + it.level;
    a.textContent = it.text || '(空标题)';
    a.addEventListener('click', () => scrollToHeading(i));
    box.appendChild(a);
  });
}

function scrollToHeading(idx) {
  const heads = $$('.vditor-ir .vditor-reset h1, .vditor-ir .vditor-reset h2, .vditor-ir .vditor-reset h3, .vditor-ir .vditor-reset h4, .vditor-ir .vditor-reset h5, .vditor-ir .vditor-reset h6');
  heads[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ 超链接 */
function linkTarget(el) {
  if (!el) return null;
  if (typeof el === 'string') return el;
  const href = el.getAttribute && (el.getAttribute('href') || el.getAttribute('data-href'));
  if (href) return href;
  // IR 模式：Vditor 传的是 .vditor-ir__marker--link，URL 存在文本里
  const t = (el.textContent || '').trim();
  return t || null;
}

/* 文档内相对资源（图片/音视频/链接）按文档所在目录解析 */
let absolutizeTimer = null;
function absolutizeDoc() {
  clearTimeout(absolutizeTimer);
  absolutizeTimer = setTimeout(() => {
    if (!state.path || state.kind !== 'md') return;
    const root = document.querySelector('.vditor-ir .vditor-reset') || document.querySelector('.vditor-reset');
    if (!root) return;
    root.querySelectorAll('img[src], video[src], audio[src], source[src]').forEach((el) => {
      const raw = el.getAttribute('src') || '';
      if (!raw || /^(https?:|data:|blob:|asset:|tauri:)/i.test(raw)) return;
      try {
        const resolved = new URL(raw, toFileUrl(state.path));
        if (resolved.protocol === 'file:') el.setAttribute('src', window.omp.toAssetUrl(fileUrlToPath(resolved)));
      } catch {}
    });
  }, 120);
}

function fileUrlToPath(url) {
  let path = decodeURIComponent(url.pathname);
  if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1);
  return /^\/?[A-Za-z]:/.test(path) ? path.replace(/\//g, '\\') : path;
}

function resolveHref(href) {
  const h = String(href || '').trim();
  if (!h) return { type: 'none' };
  if (/^(https?:\/\/|mailto:)/i.test(h)) return { type: 'external', url: h };
  if (h.startsWith('#')) return { type: 'anchor', id: decodeURIComponent(h.slice(1)) };
  let path = null;
  try {
    const base = state.path ? toFileUrl(state.path) : 'file:///';
    const u = new URL(h, base);
    if (u.protocol === 'file:') path = fileUrlToPath(u);
  } catch {}
  if (!path) return { type: 'unknown', url: h };
  return { type: 'file', path };
}

async function openHref(href) {
  const r = resolveHref(href);
  if (r.type === 'external') {
    const ok = await window.omp.openExternal(r.url);
    toast(ok ? '已在系统浏览器打开链接' : '不支持的链接协议');
    return;
  }
  if (r.type === 'file') {
    const k = kindOfPath(r.path);
    if (k === 'md' || k === 'image' || k === 'audio' || k === 'video') { openPath(r.path); return; }
    await window.omp.reveal(r.path);
    toast('已在资源管理器中定位：' + baseName(r.path));
    return;
  }
  if (r.type === 'anchor') {
    const want = r.id.replace(/^user-content-/, '').toLowerCase();
    const heads = $$('#editor h1, #editor h2, #editor h3, #editor h4, #editor h5, #editor h6');
    const hit = heads.find((el) => {
      const t = (el.textContent || '').trim().toLowerCase();
      return t === want || t.replace(/\s+/g, '-') === want || (el.id || '').toLowerCase() === want;
    });
    if (hit) { hit.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    toast('未找到锚点：' + r.id);
    return;
  }
  toast('无法解析链接');
}

function linkElFromNode(node) {
  let el = node;
  while (el && el !== document.body) {
    if (el.tagName === 'A' && el.getAttribute('href')) return el;
    el = el.parentElement;
  }
  return null;
}

/* ------------------------------------------------------------------ 侧栏 */
function showPane(name) {
  $$('.seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.pane === name));
  $('#pane-files').classList.toggle('is-hidden', name !== 'files');
  $('#pane-outline').classList.toggle('is-hidden', name !== 'outline');
  $('#sidebar').classList.remove('collapsed');
  updateSidebarToggle();
}

/* 工具栏最左端的侧栏开关：图标表示“收起 / 展开” */
function updateSidebarToggle() {
  const btn = document.querySelector('.vditor-toolbar [data-type="toggle-sidebar"]');
  if (!btn) return;
  const hidden = $('#sidebar').classList.contains('collapsed');
  btn.innerHTML = tbIcon(hidden ? 'i-panel-show' : 'i-panel-hide');
  btn.setAttribute('aria-label', hidden ? '展开侧栏（Ctrl+Shift+1）' : '隐藏侧栏（Ctrl+Shift+1）');
}
function toggleSidebar() {
  $('#sidebar').classList.toggle('collapsed');
  updateSidebarToggle();
}

/* -------------------------------------------------------------- 编辑命令 */
function clickToolbar(type) {
  const el = (vditor.toolbar && vditor.toolbar.elements && vditor.toolbar.elements[type]) ||
    document.querySelector(`.vditor-toolbar [data-type="${type}"]`);
  if (el) { el.click(); return true; }
  return false;
}

const wrapInline = (before, after = before) => {
  const sel = (vditor.getSelection && vditor.getSelection()) || state.tbSel || '';
  state.tbSel = '';
  if (sel) {
    // 内核 insertValue 会把选区折叠到起点但不删除其内容，先清空选区再插入包裹文本，避免重复
    const s = getSelection();
    if (s && s.rangeCount) { try { s.getRangeAt(0).deleteContents(); } catch {} }
  }
  vditor.insertValue(before + sel + after);
};

/* 工具栏按钮的 mousedown 早于编辑器失焦：先缓存选中文本，供自定义项使用 */
document.addEventListener('mousedown', (e) => {
  const hit = e.target && e.target.closest && e.target.closest('.vditor-toolbar [data-type]');
  if (hit && vditor && vditor.getSelection) state.tbSel = vditor.getSelection() || '';
}, true);

function replaceBlock(fn) {
  const sel = window.getSelection();
  const root = document.querySelector('.vditor-ir .vditor-reset') || document.querySelector('.vditor-ir');
  if (!sel || !sel.rangeCount || !root) { vditor.insertValue(fn('')); return; }
  let el = sel.anchorNode;
  if (!el) { vditor.insertValue(fn('')); return; }
  el = el.nodeType === 3 ? el.parentElement : el;
  while (el && el.parentElement && el.parentElement !== root) el = el.parentElement;
  if (!el || !root.contains(el)) { vditor.insertValue(fn('')); return; }
  const text = (el.textContent || '').replace(/\u200b/g, '');
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
  vditor.insertValue(fn(text));
}

const cmds = {
  new: newDoc,
  save,
  'save-as': saveAs,
  'open-dialog': async () => openPath(await window.omp.openDialog()),
  'open-folder': () => openFolder(),
  'open-folder-path': (arg) => openFolder(arg),
  'open-path': (arg) => openPath(arg),
  reveal: () => window.omp.reveal(state.path),
  undo: () => clickToolbar('undo'),
  redo: () => clickToolbar('redo'),
  find: () => openFind(),

  h1: () => replaceBlock((t) => '# ' + t.replace(/^#{1,6}\s+/, '')),
  h2: () => replaceBlock((t) => '## ' + t.replace(/^#{1,6}\s+/, '')),
  h3: () => replaceBlock((t) => '### ' + t.replace(/^#{1,6}\s+/, '')),
  h4: () => replaceBlock((t) => '#### ' + t.replace(/^#{1,6}\s+/, '')),
  h5: () => replaceBlock((t) => '##### ' + t.replace(/^#{1,6}\s+/, '')),
  h6: () => replaceBlock((t) => '###### ' + t.replace(/^#{1,6}\s+/, '')),
  paragraph: () => replaceBlock((t) => t.replace(/^#{1,6}\s+/, '')),
  quote: () => replaceBlock((t) => '> ' + t.replace(/^>\s*/, '')),
  ulist: () => replaceBlock((t) => '- ' + t.replace(/^([-*+]|\d+\.)\s+/, '').replace(/^- \[[ x]\]\s*/, '')),
  olist: () => replaceBlock((t) => '1. ' + t.replace(/^([-*+]|\d+\.)\s+/, '').replace(/^- \[[ x]\]\s*/, '')),
  task: () => replaceBlock((t) => '- [ ] ' + t.replace(/^([-*+]|\d+\.)\s+/, '').replace(/^- \[[ x]\]\s*/, '')),
  code: () => vditor.insertValue('\n```\n' + ((vditor.getSelection && vditor.getSelection()) || '') + '\n```\n'),
  table: () => vditor.insertValue('\n| 列 1 | 列 2 |\n| --- | --- |\n|  |  |\n'),
  math: () => vditor.insertValue('\n$$\n' + ((vditor.getSelection && vditor.getSelection()) || 'E = mc^2') + '\n$$\n'),
  mermaid: () => vditor.insertValue('\n```mermaid\ngraph TD\n  A[开始] --> B[结束]\n```\n'),
  hr: () => vditor.insertValue('\n---\n'),

  bold: () => wrapInline('**'),
  italic: () => wrapInline('*'),
  underline: () => wrapInline('<u>', '</u>'),
  strike: () => wrapInline('~~'),
  'inline-code': () => wrapInline('`'),
  mark: () => wrapInline('=='),
  link: () => {
    const sel = (vditor.getSelection && vditor.getSelection()) || '';
    vditor.insertValue(sel ? `[${sel}](https://)` : '[](https://)');
  },
  image: () => vditor.insertValue('![描述](图片路径)'),
  'open-link': () => {
    const sel = window.getSelection();
    const a = sel && sel.anchorNode ? linkElFromNode(sel.anchorNode) : null;
    if (a) openHref(a.getAttribute('href'));
    else toast('光标不在链接上');
  },
  'clear-format': () => replaceBlock((t) => t.replace(/[*_`~=<>#>-]/g, '').trim()),

  'toggle-source': () => {
    if (state.kind !== 'md') return;
    // edit-mode 是下拉项，clickToolbar 只会展开菜单；直接点选目标模式按钮完成切换
    const targetMode = vditor.getCurrentMode() === 'sv' ? 'ir' : 'sv';
    const modeButton = document.querySelector('.vditor-toolbar [data-type="edit-mode"]')?.parentElement.querySelector(`.vditor-hint button[data-mode="${targetMode}"]`);
    if (modeButton) {
      modeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } else {
      clickToolbar('edit-mode');
    }
    setTimeout(() => {
      let mode = null;
      try { mode = vditor.getCurrentMode && vditor.getCurrentMode(); } catch {}
      if (mode) state.sourceMode = mode === 'sv';
      $('#st-mode').textContent = state.sourceMode ? '源码' : '实时渲染';
    }, 120);
  },
  'toggle-sidebar': () => toggleSidebar(),
  'toggle-outline': () => showPane($('#pane-outline').classList.contains('is-hidden') ? 'outline' : 'files'),
  'focus-mode': () => {
    state.focusMode = !state.focusMode;
    document.body.classList.toggle('focus-mode', state.focusMode);
    toast(state.focusMode ? '专注模式：开' : '专注模式：关');
  },
  'typewriter-mode': () => {
    state.typewriter = !state.typewriter;
    document.body.classList.toggle('typewriter-mode', state.typewriter);
    toast(state.typewriter ? '打字机模式：开' : '打字机模式：关');
  },
  'zoom-in': () => (state.kind === 'md' ? setZoom(state.zoom + 0.1) : viewerZoomBy(1.25)),
  'zoom-out': () => (state.kind === 'md' ? setZoom(state.zoom - 0.1) : viewerZoomBy(0.8)),
  'zoom-reset': () => (state.kind === 'md' ? setZoom(1) : viewerFit()),
  reload: () => location.reload(),
  theme: (arg) => applyTheme(arg),
  'export-html': exportHtml,
  'export-pdf': exportPdf,
  shortcuts: showShortcuts,
  about: showAbout,
};

function setZoom(z) {
  state.zoom = Math.min(2.4, Math.max(0.6, Math.round(z * 10) / 10));
  $$('.vditor-reset').forEach((el) => { el.style.fontSize = (16 * state.zoom).toFixed(1) + 'px'; });
  $('#st-zoom').textContent = Math.round(state.zoom * 100) + '%';
  window.omp.configSet({ zoom: state.zoom });
}

/* -------------------------------------------------------------------- 查找 */
function openFind() {
  $('#findbar').classList.remove('is-hidden');
  const input = $('#find-input');
  input.focus();
  input.select();
}
function closeFind() {
  $('#findbar').classList.add('is-hidden');
  window.omp.findStop();
  $('#find-count').textContent = '';
}
function doFind(forward = true) {
  const q = $('#find-input').value;
  if (!q) { window.omp.findStop(); $('#find-count').textContent = ''; return; }
  window.omp.findStart(q, forward).then((r) => {
    if (r) $('#find-count').textContent = `${r.activeMatchOrdinal}/${r.matches}`;
  });
}

/* -------------------------------------------------------------------- 主题 */
function applyTheme(name) {
  if (name === 'system') name = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  state.theme = name;
  document.body.className = 'theme-' + name;
  document.body.classList.toggle('focus-mode', state.focusMode);
  document.body.classList.toggle('typewriter-mode', state.typewriter);
  const dark = name === 'dark';
  if (vditor && vditor.setTheme) vditor.setTheme(dark ? 'dark' : 'classic', dark ? 'dark' : 'light', dark ? 'monokai' : 'github');
  window.omp.configSet({ theme: name });
  toast('主题：' + ({ light: '浅色', dark: '深色', warm: '暖色' }[name] || name));
  const themeLabels = { light: '浅色', dark: '深色', warm: '暖色' };
  const themeButton = $('#theme-toggle');
  if (themeButton) themeButton.textContent = '主题：' + (themeLabels[name] || name);
}

/* -------------------------------------------------------------------- 导出 */
function exportCss() {
  const light = state.theme !== 'dark';
  const bg = light ? (state.theme === 'warm' ? '#fdfaf4' : '#ffffff') : '#22272e';
  const fg = light ? (state.theme === 'warm' ? '#3a332b' : '#24292f') : '#d7dde5';
  const dim = light ? '#6a737d' : '#8b949e';
  const line = light ? '#e5e2d9' : '#2f353c';
  const accent = light ? (state.theme === 'warm' ? '#a35a20' : '#0969da') : '#6ea8fe';
  return `
  body{font-family:"Segoe UI","Microsoft YaHei",system-ui,sans-serif;font-size:16px;line-height:1.72;color:${fg};background:${bg};margin:0;}
  .markdown-body{max-width:920px;margin:0 auto;padding:44px 36px 80px;}
  h1,h2,h3,h4,h5,h6{margin:1.5em 0 .6em;line-height:1.3;font-weight:650;letter-spacing:-.01em;}
  h1{font-size:1.9em;border-bottom:1px solid ${line};padding-bottom:.3em;}
  h2{font-size:1.45em;border-bottom:1px solid ${line};padding-bottom:.3em;}
  p,li{overflow-wrap:anywhere;}
  code{font-family:Consolas,"Courier New",monospace;background:${light ? '#f2f3f5' : '#2d333b'};padding:.15em .35em;border-radius:4px;font-size:.92em;}
  pre{background:${light ? '#f7f8fa' : '#1b1f24'};border:1px solid ${line};padding:14px 16px;border-radius:8px;overflow:auto;}
  pre code{background:none;padding:0;}
  blockquote{margin:1em 0;padding:0 1em;color:${dim};border-left:3px solid ${line};}
  table{border-collapse:collapse;margin:1em 0;}
  th,td{border:1px solid ${line};padding:6px 13px;}
  img{max-width:100%;}
  hr{height:1px;background:${line};border:0;margin:26px 0;}
  a{color:${accent};}
  `;
}

async function standaloneHtml() {
  const title = (state.path ? baseName(state.path) : '未命名').replace(/\.(md|markdown|txt)$/i, '');
  return renderStandaloneHtml(vditor.getValue(), title, state.theme, state.path, exportCss());
}

async function exportHtml() {
  if (state.kind !== 'md') return toast('仅文档可导出');
  const p = await window.omp.exportHtml(await standaloneHtml(), baseName(state.path).replace(/\.(md|markdown|txt)$/i, '') || 'untitled');
  if (p) toast('已导出 HTML：' + baseName(p));
}
async function exportPdf() {
  if (state.kind !== 'md') return toast('仅文档可导出');
  const p = await window.omp.exportPdf(await standaloneHtml(), baseName(state.path).replace(/\.(md|markdown|txt)$/i, '') || 'untitled');
  if (p) toast('已导出 PDF：' + baseName(p));
}

/* -------------------------------------------------------------------- 帮助 */
function showShortcuts() {
  alert([
    'MuseMark 快捷键',
    '',
    '文件：Ctrl+N 新建 · Ctrl+O 打开 · Ctrl+S 保存 · Ctrl+Shift+S 另存为',
    '      Ctrl+Shift+O 打开文件夹 · Ctrl+Shift+N 新窗口 · Ctrl+Shift+E 导出 HTML · Ctrl+Shift+P 导出 PDF',
    '      Ctrl+W 关闭窗口 · Ctrl+Q 退出',
    '编辑：Ctrl+Z 撤销 · Ctrl+Shift+Z 重做 · Ctrl+F 查找',
    '段落：Ctrl+1~6 标题 · Ctrl+0 正文 · Ctrl+Shift+Q 引用 · Ctrl+Shift+X 任务 · Ctrl+Shift+[ ] 列表',
    '      Ctrl+Shift+K 代码块 · Ctrl+T 表格 · Ctrl+Shift+M 公式',
    '格式：Ctrl+B 加粗 · Ctrl+I 斜体 · Ctrl+U 下划线 · Ctrl+Shift+H 高亮 · Ctrl+K 链接 · Ctrl+Shift+I 图片',
    '      Ctrl+Shift+` 行内代码 · Ctrl+\\ 清除格式 · Ctrl+Enter 打开链接',
    '视图：Ctrl+/ 源码 · Ctrl+Shift+1 侧栏 · Ctrl+Shift+2 大纲 · F8 专注 · F9 打字机',
    '      Ctrl+=/- 缩放 · Ctrl+Alt+0 实际大小 · Ctrl+R 刷新 · Ctrl+Alt+1/2/3 切换主题',
    '媒体：空格 播放/暂停 · ← → 快退/快进 5 秒 · Ctrl+=/- 缩放图片',
  ].join('\n'));
}
async function aboutText() {
  const i = await window.omp.info();
  let lute = '';
  try { lute = (window.Lute && (Lute.Version || Lute.version)) ? ' / Lute ' + (Lute.Version || Lute.version) : ''; } catch {}
  return [
    `MuseMark ${i.version}`,
    '',
    '本地 Markdown 编辑器 · 图片 / 音频 / 视频预览',
    '无许可证校验、无账号登录、无遥测、无网络请求。',
    '',
    `作者：${i.author || 'Brian98Z'}  ${i.authorUrl || 'https://github.com/Brian98Z'}`,
    `渲染内核：Vditor ${i.vditor || '?'}${lute}（MIT 许可，© Vanessa219 及贡献者）`,
    `运行时：Tauri ${i.tauri} · ${i.webview.name} (${i.os} ${i.arch})`,
  ].join('\n');
}
async function showAbout() {
  // 主进程原生对话框：按钮可直接打开作者主页
  await window.omp.about();
}

/* -------------------------------------------------------------------- 启动 */
function dispatch(msg) {
  const fn = cmds[msg.cmd];
  if (fn) fn(msg.arg);
}

/* Windows 上 WebView2 会吞掉发给原生菜单加速器的按键（wry#451，上游未修），
   菜单点击不受影响。这里在网页侧补一份同键位的兜底分发；
   原生菜单事件正常到达时两条路径都会触发 dispatch，动作幂等故无副作用。 */
const accelMap = (e) => {
  const mod = e.ctrlKey || e.metaKey;
  // SendInput 等注入的按键可能没有 e.code，统一用 e.key 匹配
  const key = (e.key || '').toLowerCase();
  if (mod && !e.altKey && !e.shiftKey) {
    switch (key) {
      case 'n': return 'new';
      case 'o': return 'open-dialog';
      case 's': return 'save';
      case 'f': return 'find';
      case 'r': return 'reload';
      case '/': return 'toggle-source';
      case 't': return 'table';
      case '\\': return 'clear-format';
      case '=': case '+': return 'zoom-in';
      case '-': return 'zoom-out';
    }
    if (/^[1-6]$/.test(key)) return 'h' + key;
    if (key === '0') return 'paragraph';
    if (e.key === 'Enter') return 'open-link';
  }
  if (mod && e.shiftKey && !e.altKey) {
    // Shift+数字在 Windows 产生 !/@ 等符号键，优先用 e.code 归位到数字
    const digit = /^Digit([0-9])$/.test(e.code || '') ? e.code.slice(5) : null;
    switch (key) {
      case 'n': return 'new-window';
      case 'o': return 'open-folder';
      case 's': return 'save-as';
      case 'e': return 'export-html';
      case 'p': return 'export-pdf';
      case 'q': return 'quote';
      case 'x': return 'task';
      case 'k': return 'code';
      case 'm': return 'math';
      case 'h': return 'mark';
      case '`': case '~': return 'inline-code';
      case '[': case '{': return 'olist';
      case ']': case '}': return 'ulist';
      case '0': case ')': return 'zoom-reset';
      case '1': case '!': return 'toggle-sidebar';
      case '2': case '@': return 'toggle-outline';
    }
    if (digit === '1') return 'toggle-sidebar';
    if (digit === '2') return 'toggle-outline';
    if (digit === '0') return 'zoom-reset';
  }
  if (mod && e.altKey && !e.shiftKey) {
    if (key === '1') return { cmd: 'theme', arg: 'light' };
    if (key === '2') return { cmd: 'theme', arg: 'dark' };
    if (key === '3') return { cmd: 'theme', arg: 'warm' };
    if (key === '0') return 'zoom-reset';
  }
  if (key === 'f8') return 'focus-mode';
  if (key === 'f9') return 'typewriter-mode';
  if (key === 'f1') return 'shortcuts';
  return null;
};

let lastAccel = { cmd: null, at: 0 };
function handleAccelerator(e) {
  const hit = accelMap(e);
  const cmd = typeof hit === 'string' ? hit : hit && hit.cmd;
  if (!cmd || !cmds[cmd]) return false;
  e.preventDefault();
  // 原生菜单与网页兜底可能同时送达；切换类命令连发两次等于回到原状，这里去重
  const now = Date.now();
  if (lastAccel.cmd === cmd && now - lastAccel.at < 350) return true;
  lastAccel = { cmd, at: now };
  const msg = typeof hit === 'string' ? { cmd } : hit;
  if (!appReady) pendingCmds.push(msg);
  else dispatch(msg);
  return true;
}

/* 复制为纯文本：人工复制文案时去掉 Markdown 标记符号。
   Vditor 默认把选区复制成 Markdown 源文本；这里在捕获阶段改写剪贴板，
   将选区对应的 Markdown 渲染为 HTML 后提取纯文本。代码块内部复制不受影响。 */
function selectionPlainText(md) {
  const lute = vditor && vditor.vditor && vditor.vditor.lute;
  const holder = document.createElement('div');
  holder.innerHTML = lute ? lute.Md2HTML(md) : '';
  return (holder.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

document.addEventListener('copy', (e) => {
  if (state.kind !== 'md' || !vditor) return;
  let mode = 'ir';
  try { mode = vditor.getCurrentMode ? vditor.getCurrentMode() : 'ir'; } catch {}
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.toString().trim()) return;
  const editorEl = document.querySelector(`.vditor-${mode} .vditor-reset`) || document.querySelector('.vditor-reset');
  if (!editorEl || !editorEl.contains(sel.anchorNode)) return;
  const range = sel.getRangeAt(0);
  // 源码模式下选中文本就是 Markdown 本身，直接送清洗
  let md = sel.toString();
  if (mode !== 'sv') {
    // 仅当选区整体位于同一个代码块内时保持原样（保留缩进与代码语义）；
    // ir 模式下编辑器根不是 <pre>，代码块才有独立 pre/code 祖先
    const anc = range.commonAncestorContainer;
    const ancEl = anc.nodeType === 1 ? anc : anc.parentElement;
    const codeBlock = ancEl && ancEl.closest && ancEl.closest('pre, code');
    if (codeBlock && !codeBlock.contains(editorEl) && codeBlock.textContent === range.toString()) return;
    // 与 Vditor 自身复制逻辑一致：选区 DOM -> Markdown，保证标题/链接等标记完整
    const temp = document.createElement('div');
    temp.appendChild(range.cloneContents());
    const lute = vditor.vditor.lute;
    md = (lute && lute.VditorIRDOM2Md ? lute.VditorIRDOM2Md(temp.innerHTML) : md).trim();
  }
  md = md.trim();
  if (!md.trim()) return;
  const plain = selectionPlainText(md);
  if (!plain) return;
  e.stopPropagation();
  e.preventDefault();
  e.clipboardData.setData('text/plain', plain);
  e.clipboardData.setData('text/html', '');
}, true);

window.addEventListener('DOMContentLoaded', async () => {
  let cfg = {};
  try { cfg = await window.omp.configGet(); } catch {}
  if (cfg.theme) applyTheme(cfg.theme);
  if (cfg.zoom) setZoom(cfg.zoom);

  initEditor();

  window.omp.onMenu((msg) => { if (!appReady) pendingCmds.push(msg); else dispatch(msg); });
  window.omp.onDragDrop((paths) => { if (paths[0]) openPath(paths[0]); });
  const startup = await window.omp.frontendReady();
  (Array.isArray(startup) ? startup : []).forEach((msg) => { if (!appReady) pendingCmds.push(msg); else dispatch(msg); });

  $$('.seg-btn').forEach((b) => b.addEventListener('click', () => showPane(b.dataset.pane)));
  $('#btn-open-folder').addEventListener('click', () => openFolder());

  $('#theme-toggle').addEventListener('click', () => {
    const next = ({ light: 'dark', dark: 'warm', warm: 'light' })[state.theme] || 'light';
    applyTheme(next);
  });
  // 查看器控件
  $('#viewer-zoom-in').addEventListener('click', () => viewerZoomBy(1.25));
  $('#viewer-zoom-out').addEventListener('click', () => viewerZoomBy(0.8));
  $('#viewer-fit').addEventListener('click', viewerFit);
  $('#viewer-stage').addEventListener('dblclick', () => (state.viewerZoom === 1 ? viewerZoomBy(2) : viewerFit()));

  // 查找
  $('#find-input').addEventListener('input', () => doFind(true));
  $('#find-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doFind(!e.shiftKey);
    if (e.key === 'Escape') closeFind();
  });
  $('#find-next').addEventListener('click', () => doFind(true));
  $('#find-prev').addEventListener('click', () => doFind(false));
  $('#find-close').addEventListener('click', closeFind);

  // 全局快捷键兜底（见 handleAccelerator 注释）+ 媒体快捷键：空格播放/暂停，左右方向键进退 5 秒
  document.addEventListener('keydown', (e) => {
    if (handleAccelerator(e)) return;
    if (state.kind === 'md') return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const el = mediaEl[state.kind] ? mediaEl[state.kind]() : null;
    if (!el || state.kind === 'image') return;
    if (e.code === 'Space') { e.preventDefault(); el.paused ? el.play() : el.pause(); }
    if (e.code === 'ArrowLeft') { e.preventDefault(); el.currentTime = Math.max(0, el.currentTime - 5); }
    if (e.code === 'ArrowRight') { e.preventDefault(); el.currentTime = Math.min(el.duration || 0, el.currentTime + 5); }
  });

  // 超链接：Ctrl/⌘+点击 打开；纯点击锚点直接跳转；悬停显示目标地址
  document.addEventListener('click', (e) => {
    const a = linkElFromNode(e.target);
    if (!a || !$('#editor').contains(a)) return;
    const href = a.getAttribute('href') || '';
    const withMod = e.ctrlKey || e.metaKey;
    const isAnchor = href.startsWith('#');
    if (withMod || isAnchor) {
      e.preventDefault();
      e.stopPropagation();
      openHref(href);
    }
  }, true);
  document.addEventListener('mouseover', (e) => {
    const a = linkElFromNode(e.target);
    if (a && $('#editor').contains(a) && !a.title) a.title = a.getAttribute('href') + '\n（Ctrl+点击打开）';
  });


  // 启动时的文件夹由主进程统一下发（默认目录：上次使用，其次桌面）
});
