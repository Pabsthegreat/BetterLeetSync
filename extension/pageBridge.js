// BetterLeetSync - Page Bridge (runs in page/main world)
// Purpose: Access page globals like window.monaco and return editor code via postMessage.

(function () {
  'use strict';

  const REQ_TYPE = 'BLS_EXTRACT';
  const RES_TYPE = 'BLS_EXTRACT_RESULT';

  function isProbablyNonCode({ lang, uri, code }) {
    const l = (lang || '').toLowerCase();
    const u = (uri || '').toLowerCase();
    const c = code || '';

    if (u.includes('codicon') || c.includes('.codicon-')) return true;
    if (l === 'css' || l === 'html' || l === 'json') return true;
    return false;
  }

  function chooseBestModel(models) {
    let best = null;
    let bestLen = 0;

    for (const model of models) {
      try {
        const lang = typeof model.getLanguageId === 'function' ? model.getLanguageId() : 'unknown';
        const uri = model.uri?.path || model.uri?.toString?.() || '';
        const code = typeof model.getValue === 'function' ? model.getValue() : '';

        if (!code || code.trim().length === 0) continue;
        if (isProbablyNonCode({ lang, uri, code })) continue;

        const len = code.length;
        if (len > bestLen && len < 200000) {
          best = { code, language: lang };
          bestLen = len;
        }
      } catch {
        // ignore
      }
    }

    return best;
  }

  function extractFromMonaco() {
    const monaco = window.monaco;
    const editor = monaco?.editor;
    if (!editor || typeof editor.getModels !== 'function') return null;

    const models = editor.getModels() || [];
    if (!models.length) return null;

    return chooseBestModel(models);
  }

  async function handleRequest(requestId) {
    try {
      const result = extractFromMonaco();
      if (!result) {
        return { ok: false, error: 'Monaco not found or no suitable code model' };
      }
      return { ok: true, ...result };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.type !== REQ_TYPE) return;

    const requestId = data.requestId;
    if (!requestId) return;

    const response = await handleRequest(requestId);
    window.postMessage({ type: RES_TYPE, requestId, ...response }, '*');
  });
})();
