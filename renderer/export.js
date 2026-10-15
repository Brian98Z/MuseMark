'use strict';

async function exportDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`导出资源读取失败：${url} (${response.status})`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function exportStyle(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`导出样式读取失败：${url}`);
  let css = await response.text();
  const refs = [...css.matchAll(/url\((['"]?)([^)'"\s]+)\1\)/g)];
  for (const match of refs) {
    if (/^(data:|#)/.test(match[2])) continue;
    const data = await exportDataUrl(new URL(match[2], url).href);
    css = css.split(match[0]).join(`url("${data}")`);
  }
  return css;
}

async function renderStandaloneHtml(markdown, title, theme, documentPath, customCss) {
  const preview = document.createElement('div');
  preview.style.cssText = 'position:fixed;left:-10000px;top:0;width:920px;pointer-events:none';
  document.body.append(preview);
  try {
    await Vditor.preview(preview, markdown, {
      cdn: './vendor/vditor', lang: 'zh_CN',
      math: { engine: 'KaTeX' }, hljs: { style: 'github', lineNumber: true },
      theme: { current: theme === 'dark' ? 'dark' : 'light', path: './vendor/vditor/dist/css/content-theme' },
    });
    const pending = () => [...preview.querySelectorAll('[data-type="math-block"],.language-math')].some(e => !e.querySelector('.katex')) || [...preview.querySelectorAll('.language-mermaid')].some(e => !e.querySelector('svg'));
    const until = Date.now() + 15000;
    while (pending() && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 50));
    if (pending()) throw new Error('公式或图表尚未渲染完成');
    const styles = [
      './vendor/vditor/dist/index.css',
      `./vendor/vditor/dist/css/content-theme/${theme === 'dark' ? 'dark' : 'light'}.css`,
      './vendor/vditor/dist/js/katex/katex.min.css',
      './vendor/vditor/dist/js/highlight.js/styles/github.min.css',
    ];
    const css = await Promise.all(styles.map(s => exportStyle(new URL(s, location.href).href)));
    for (const image of preview.querySelectorAll('img')) {
      const raw = image.getAttribute('src');
      if (!raw || raw.startsWith('data:')) continue;
      if (/^https?:/i.test(raw) && !raw.startsWith(location.origin) && !raw.startsWith('http://asset.localhost/')) throw new Error('离线导出不支持远程图片：' + raw);
      let url;
      if (/^(asset:|http:\/\/asset.localhost\/)/.test(raw)) url = raw;
      else if (documentPath) url = window.omp.toAssetUrl(fileUrlToPath(new URL(raw, toFileUrl(documentPath))));
      else url = new URL(raw, location.href).href;
      image.src = await exportDataUrl(url);
    }
    for (const script of preview.querySelectorAll('script,iframe,object,embed')) script.remove();
    for (const el of preview.querySelectorAll('*')) for (const attr of [...el.attributes]) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${css.join('\n')}\n${customCss}</style></head><body><article class="markdown-body vditor-reset">${preview.innerHTML}</article></body></html>`;
  } finally { preview.remove(); }
}
