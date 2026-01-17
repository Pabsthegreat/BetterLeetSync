// BetterLeetSync - Popup Script

const DEFAULT_BACKEND_URL = 'http://localhost:3456';

async function generateSignature(secret, timestamp, body) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(`${timestamp}.${body}`);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function checkStatus() {
  const statusEl = document.getElementById('status');
  
  try {
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get({
        backendUrl: DEFAULT_BACKEND_URL,
        hmacSecret: ''
      }, resolve);
    });
    
    if (!settings.hmacSecret) {
      statusEl.textContent = '⚠️ Not configured - open Settings';
      statusEl.className = 'status disconnected';
      return;
    }
    
    const response = await fetch(`${settings.backendUrl}/health`);
    const data = await response.json();
    
    if (data.status === 'ok' && data.configured) {
      statusEl.textContent = '✓ Connected to backend';
      statusEl.className = 'status connected';
    } else if (data.status === 'ok') {
      statusEl.textContent = '⚠️ Backend running but not configured';
      statusEl.className = 'status disconnected';
    }
  } catch (error) {
    statusEl.textContent = '✗ Cannot connect to backend';
    statusEl.className = 'status disconnected';
  }
}

async function syncCurrentProblem() {
  const syncBtn = document.getElementById('sync-btn');
  const syncStatusEl = document.getElementById('sync-status');
  
  syncBtn.disabled = true;
  syncStatusEl.textContent = '⏳ Syncing...';
  syncStatusEl.className = 'status';
  
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if it's a LeetCode problem page
    if (!tab.url || !tab.url.includes('leetcode.com/problems/')) {
      throw new Error('Please navigate to a LeetCode problem page first');
    }

    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get({
        backendUrl: DEFAULT_BACKEND_URL,
        hmacSecret: ''
      }, resolve);
    });

    if (!settings.hmacSecret) {
      throw new Error('HMAC secret not configured. Open Settings and set it.');
    }

    // Extract payload in the page MAIN world so we can access window.monaco.
    const [{ result: extracted }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: () => {
        try {
          const nextDataScript = document.getElementById('__NEXT_DATA__');
          if (!nextDataScript) {
            return { ok: false, error: '__NEXT_DATA__ not found' };
          }

          const nextData = JSON.parse(nextDataScript.textContent);
          const queries = nextData?.props?.pageProps?.dehydratedState?.queries || [];

          let questionData = null;
          for (const query of queries) {
            const data = query.state?.data;
            if (data?.question) {
              questionData = data.question;
              break;
            }
          }
          if (!questionData) {
            for (const query of queries) {
              const data = query.state?.data;
              if (data?.titleSlug || data?.title) {
                questionData = data;
                break;
              }
            }
          }
          if (!questionData?.titleSlug) {
            return { ok: false, error: 'Question data not found in __NEXT_DATA__' };
          }

          const problem = {
            slug: questionData.titleSlug,
            title: questionData.title,
            difficulty: questionData.difficulty,
            topics: (questionData.topicTags || []).map((t) => t.name),
            description_html: questionData.content || ''
          };

          // Extract code from Monaco
          const monaco = window.monaco;
          const editor = monaco?.editor;
          if (!editor || typeof editor.getModels !== 'function') {
            return { ok: false, error: 'Monaco editor not found on page' };
          }

          const models = editor.getModels() || [];
          if (!models.length) {
            return { ok: false, error: 'No Monaco models found' };
          }

          const isProbablyNonCode = ({ lang, uri, code }) => {
            const l = (lang || '').toLowerCase();
            const u = (uri || '').toLowerCase();
            const c = code || '';
            if (u.includes('codicon') || c.includes('.codicon-')) return true;
            if (l === 'css' || l === 'html' || l === 'json') return true;
            return false;
          };

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

          if (!best?.code) {
            return { ok: false, error: 'Could not find a suitable code model (non-empty, non-CSS)' };
          }

          return {
            ok: true,
            payload: {
              slug: problem.slug,
              title: problem.title,
              difficulty: problem.difficulty,
              topics: problem.topics,
              description_html: problem.description_html,
              code: best.code,
              language: best.language,
              source_url: window.location.href.split('?')[0]
            }
          };
        } catch (e) {
          return { ok: false, error: e?.message || String(e) };
        }
      }
    });

    if (!extracted?.ok) {
      throw new Error(extracted?.error || 'Failed to extract problem/code from page');
    }

    const payload = extracted.payload;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = JSON.stringify(payload);
    const signature = await generateSignature(settings.hmacSecret, timestamp, bodyStr);

    const resp = await fetch(`${settings.backendUrl}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Signature': signature
      },
      body: bodyStr
    });

    const data = await resp.json().catch(async () => {
      const text = await resp.text();
      throw new Error(`Backend returned invalid JSON (${resp.status}): ${text}`);
    });

    if (!resp.ok) {
      throw new Error(data?.error || `Sync failed (${resp.status})`);
    }

    syncStatusEl.textContent = data.no_change ? '✅ No changes to sync' : '✅ Synced to GitHub';
    syncStatusEl.className = 'status connected';
  } catch (error) {
    console.error('Sync error:', error);
    
    // Provide helpful error message
    if (error.message.includes('Receiving end does not exist') || 
        error.message.includes('Could not establish connection')) {
      syncStatusEl.textContent = '❌ Content script not loaded. Refresh the LeetCode tab and try again.';
    } else {
      syncStatusEl.textContent = `❌ ${error.message}`;
    }
    syncStatusEl.className = 'status disconnected';
  } finally {
    syncBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkStatus();
  
  const syncBtn = document.getElementById('sync-btn');
  if (syncBtn) {
    syncBtn.addEventListener('click', syncCurrentProblem);
  }
});
