'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('omp', {
  info: () => ipcRenderer.invoke('app:info'),
  about: () => ipcRenderer.invoke('app:about'),
  stat: (p) => ipcRenderer.invoke('file:stat', p),
  pathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch { return null; } },
  openDialog: () => ipcRenderer.invoke('file:open-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('file:open-folder-dialog'),
  saveDialog: (name) => ipcRenderer.invoke('file:save-dialog', name),
  read: (p) => ipcRenderer.invoke('file:read', p),
  write: (p, content) => ipcRenderer.invoke('file:write', p, content),
  readTree: (root) => ipcRenderer.invoke('tree:read', root),
  reveal: (p) => ipcRenderer.invoke('shell:reveal', p),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  recent: () => ipcRenderer.invoke('recent:list'),
  exportHtml: (html, name) => ipcRenderer.invoke('export:html', html, name),
  exportPdf: (html, name) => ipcRenderer.invoke('export:pdf', html, name),
  configGet: () => ipcRenderer.invoke('config:get'),
  configSet: (patch) => ipcRenderer.invoke('config:set', patch),
  findStart: (text, forward) => ipcRenderer.invoke('find:start', text, forward),
  findStop: () => ipcRenderer.invoke('find:stop'),
  confirmDiscard: () => ipcRenderer.sendSync('app:confirm-discard'),
  onMenu: (fn) => ipcRenderer.on('menu', (_e, msg) => fn(msg)),
});
