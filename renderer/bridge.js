'use strict';

(() => {
  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;
  const currentWindow = window.__TAURI__.window.getCurrentWindow();
  const invokeCommand = (command, args) => invoke(command, args);
  let menuListener;
  let dragDropListener;
  let activeFind = null;

  const api = {
    info: () => invokeCommand('info'),
    about: () => invokeCommand('about'),
    stat: (path) => invokeCommand('stat', { path }),
    openDialog: () => invokeCommand('open_dialog'),
    openFolderDialog: () => invokeCommand('open_folder_dialog'),
    saveDialog: (defaultName) => invokeCommand('save_dialog', { defaultName }),
    read: (path) => invokeCommand('read', { path }),
    write: (path, content) => invokeCommand('write', { path, content }),
    readTree: (root) => invokeCommand('read_tree', { root }),
    reveal: (path) => invokeCommand('reveal', { path }),
    openExternal: (url) => invokeCommand('open_external', { url }),
    recent: () => invokeCommand('recent'),
    exportHtml: (html, defaultName) => invokeCommand('export_html', { html, defaultName }),
    exportPdf: (html, name) => invokeCommand('export_pdf', { html, name }),
    configGet: () => invokeCommand('config_get'),
    configSet: (patch) => invokeCommand('config_set', { patch }),
    setDirty: (dirty) => invokeCommand('set_dirty', { dirty }),
    frontendReady: () => invokeCommand('frontend_ready'),
    toAssetUrl(path) {
      return window.__TAURI__.core.convertFileSrc(path);
    },
    onMenu(fn) {
      if (menuListener) menuListener();
      listen('menu', (event) => fn(event.payload)).then((unlisten) => { menuListener = unlisten; });
    },
    onDragDrop(fn) {
      if (dragDropListener) dragDropListener();
      currentWindow.onDragDropEvent((event) => {
        if (event.payload.type === 'drop') fn(event.payload.paths || []);
      }).then((unlisten) => { dragDropListener = unlisten; });
    },
    findStart(text, forward = true) {
      return findRenderedText(text, forward);
    },
    findStop() {
      activeFind = null;
    },
  };

  function findRenderedText(query, forward) {
    const root = document.querySelector('.vditor-ir .vditor-reset') || document.querySelector('.vditor-reset');
    if (!root || !query) return null;
    const normalized = query.toLocaleLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest('script,style,textarea,input,[contenteditable="false"]')
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    const matches = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.nodeValue.toLocaleLowerCase();
      let from = 0, at;
      while ((at = text.indexOf(normalized, from)) !== -1) {
        matches.push({ node, start: at, end: at + query.length });
        from = at + Math.max(1, query.length);
      }
    }
    if (!matches.length) { activeFind = { query, matches, index: -1 }; return null; }
    let index = activeFind?.query === query && activeFind.matches.length === matches.length
      ? activeFind.index : -1;
    index = (index + (forward ? 1 : -1) + matches.length) % matches.length;
    activeFind = { query, matches, index };
    const match = matches[index];
    const range = document.createRange();
    range.setStart(match.node, match.start);
    range.setEnd(match.node, match.end);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    match.node.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return { activeMatchOrdinal: index + 1, matches: matches.length };
  }

  window.omp = api;
})();
