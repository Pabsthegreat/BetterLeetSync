// BetterLeetSync - Content Script
// Injects sync button on LeetCode problem pages

(function() {
  'use strict';

  const BUTTON_ID = 'betterleet-sync-btn';
  const DEFAULT_BACKEND_URL = 'http://localhost:3456';

  const BRIDGE_SCRIPT_ID = 'betterleetsync-page-bridge';
  const BRIDGE_REQ_TYPE = 'BLS_EXTRACT';
  const BRIDGE_RES_TYPE = 'BLS_EXTRACT_RESULT';

  function ensurePageBridgeInjected() {
    try {
      if (document.getElementById(BRIDGE_SCRIPT_ID)) return;
      const script = document.createElement('script');
      script.id = BRIDGE_SCRIPT_ID;
      script.src = chrome.runtime.getURL('pageBridge.js');
      script.async = true;
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.warn('BetterLeetSync: Failed to inject page bridge', e);
    }
  }

  function requestCodeFromPageBridge(timeoutMs = 2500) {
    return new Promise((resolve) => {
      const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const timer = setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(null);
      }, timeoutMs);

      function onMessage(event) {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.type !== BRIDGE_RES_TYPE || data.requestId !== requestId) return;

        clearTimeout(timer);
        window.removeEventListener('message', onMessage);

        if (data.ok && data.code) {
          resolve({ code: data.code, language: data.language || 'unknown' });
        } else {
          resolve(null);
        }
      }

      window.addEventListener('message', onMessage);
      window.postMessage({ type: BRIDGE_REQ_TYPE, requestId }, '*');
    });
  }

  // Check if we're on a problem page
  function isProblemPage() {
    return window.location.pathname.startsWith('/problems/') && 
           !window.location.pathname.includes('/submissions');
  }

  // Get settings from storage
  async function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        backendUrl: DEFAULT_BACKEND_URL,
        hmacSecret: ''
      }, resolve);
    });
  }

  // Generate HMAC signature
  async function generateSignature(secret, timestamp, body) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(timestamp + '.' + body);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Extract problem metadata from __NEXT_DATA__
  function extractProblemData() {
    try {
      const nextDataScript = document.getElementById('__NEXT_DATA__');
      if (!nextDataScript) {
        console.error('BetterLeetSync: __NEXT_DATA__ not found');
        return null;
      }

      const nextData = JSON.parse(nextDataScript.textContent);
      const queries = nextData?.props?.pageProps?.dehydratedState?.queries || [];
      
      let questionData = null;
      
      // Find the question data in queries
      for (const query of queries) {
        const data = query.state?.data;
        if (data?.question) {
          questionData = data.question;
          break;
        }
      }

      if (!questionData) {
        // Try alternative path
        for (const query of queries) {
          const data = query.state?.data;
          if (data?.titleSlug || data?.title) {
            questionData = data;
            break;
          }
        }
      }

      if (!questionData) {
        console.error('BetterLeetSync: Question data not found in __NEXT_DATA__');
        return null;
      }

      return {
        slug: questionData.titleSlug,
        title: questionData.title,
        difficulty: questionData.difficulty,
        topics: (questionData.topicTags || []).map(t => t.name),
        description_html: questionData.content || ''
      };
    } catch (e) {
      console.error('BetterLeetSync: Error extracting problem data', e);
      return null;
    }
  }

  // Extract code from Monaco editor
  async function extractCode() {
    try {
      console.log('BetterLeetSync: Starting code extraction...');
      console.log('BetterLeetSync: Monaco available?', !!window.monaco);
      console.log('BetterLeetSync: Monaco editor available?', !!window.monaco?.editor);
      
      // Try multiple methods to get the code
      
      // Method 1: Monaco editor API - get all models
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        console.log('BetterLeetSync: Found', models?.length, 'Monaco models');
        
        if (models && models.length > 0) {
          // Log all models for debugging
          let candidateModel = null;
          let maxCodeLength = 0;
          
          models.forEach((model, idx) => {
            const lang = model.getLanguageId();
            const uri = model.uri?.path || model.uri?.toString() || 'unknown';
            const code = model.getValue();
            const length = code.length;
            console.log(`  Model ${idx}: ${lang}, URI: ${uri}, Length: ${length}`);
            console.log(`  First 50 chars: ${code.substring(0, 50)}`);
            
            // Skip obvious non-code models
            if (uri.includes('codicon') || code.includes('.codicon-') || 
                lang === 'css' || lang === 'html' || lang === 'json') {
              console.log(`  -> Skipping (non-code)`);
              return;
            }
            
            // If it has reasonable length and language, consider it
            if (length > maxCodeLength && length < 100000) {
              candidateModel = { model, lang, code };
              maxCodeLength = length;
              console.log(`  -> New candidate (length: ${length})`);
            }
          });

          if (candidateModel) {
            const { code, lang } = candidateModel;
            console.log('BetterLeetSync: Selected model with language:', lang);
            console.log('BetterLeetSync: Code length:', code.length);
            return { code, language: lang };
          }
        }
      }

      // Method 1b: If Monaco isn't visible in the content-script world (common on LeetCode),
      // request code via page bridge running in the main world.
      ensurePageBridgeInjected();
      const bridged = await requestCodeFromPageBridge();
      if (bridged?.code) {
        console.log('BetterLeetSync: Code extracted via page bridge');
        return bridged;
      }

      // Method 2: Try to get active editor directly  
      if (window.monaco && window.monaco.editor) {
        const getEditors = window.monaco.editor.getEditors;
        if (getEditors && typeof getEditors === 'function') {
          const editors = getEditors() || [];
          console.log('BetterLeetSync: Found', editors.length, 'Monaco editors');
          
          for (const editor of editors) {
            try {
              if (!editor || typeof editor.getModel !== 'function') continue;
              
              const model = editor.getModel();
              if (model && typeof model.getValue === 'function') {
                const lang = model.getLanguageId?.() || 'unknown';
                const code = model.getValue();
                const uri = model.uri?.toString?.() || '';
                
                console.log('BetterLeetSync: Editor model:', lang, 'URI:', uri, 'Length:', code.length);
                
                // Skip CSS/icon files
                if (uri.includes('codicon') || code.includes('.codicon-')) {
                  continue;
                }
                
                // Return first reasonable editor content
                if (code && code.trim().length > 0) {
                  console.log('BetterLeetSync: Code extracted from active editor');
                  return { code, language: lang };
                }
              }
            } catch (e) {
              console.log('BetterLeetSync: Error checking editor:', e);
            }
          }
        }
      }

      console.error('BetterLeetSync: Could not extract code from editor');
      return null;
    } catch (e) {
      console.error('BetterLeetSync: Error extracting code', e);
      return null;
    }
  }

  // Sync solution to backend
  async function syncSolution() {
    console.log('BetterLeetSync: syncSolution() called');
    
    const btn = document.getElementById(BUTTON_ID);
    const originalText = btn?.textContent || 'Sync';
    if (btn) {
      btn.textContent = 'Syncing...';
      btn.disabled = true;
    }

    try {
      const settings = await getSettings();
      console.log('BetterLeetSync: Got settings, backend:', settings.backendUrl);
      
      if (!settings.hmacSecret) {
        throw new Error('HMAC secret not configured. Please set it in extension options.');
      }

      const problemData = extractProblemData();
      console.log('BetterLeetSync: Problem data:', problemData?.slug);
      if (!problemData) {
        throw new Error('Could not extract problem data. Try refreshing the page.');
      }

      const codeData = await extractCode();
      console.log('BetterLeetSync: Code data:', codeData?.language, 'length:', codeData?.code?.length);
      if (!codeData) {
        throw new Error('Could not extract code. Please wait for the editor to fully load, then try again.');
      }
      
      if (!codeData.code || codeData.code.trim().length === 0) {
        throw new Error('Code editor appears empty. Please write some code first.');
      }

      console.log('BetterLeetSync: Extracted code length:', codeData.code.length);
      console.log('BetterLeetSync: Detected language:', codeData.language);

      const payload = {
        slug: problemData.slug,
        title: problemData.title,
        difficulty: problemData.difficulty,
        topics: problemData.topics,
        description_html: problemData.description_html,
        code: codeData.code,
        language: codeData.language,
        source_url: window.location.href.split('?')[0]
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const bodyStr = JSON.stringify(payload);
      const signature = await generateSignature(settings.hmacSecret, timestamp, bodyStr);

      console.log('BetterLeetSync: Sending to backend:', settings.backendUrl);
      const response = await fetch(`${settings.backendUrl}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Timestamp': timestamp,
          'X-Signature': signature
        },
        body: bodyStr
      });

      console.log('BetterLeetSync: Backend response status:', response.status);
      let result;
      try {
        result = await response.json();
        console.log('BetterLeetSync: Backend result:', result);
      } catch (e) {
        throw new Error(`Backend returned invalid response (${response.status}): ${await response.text()}`);
      }

      if (!response.ok) {
        throw new Error(result?.error || `Sync failed with status ${response.status}`);
      }

      if (btn) {
        if (result.no_change) {
          btn.textContent = '✓ No Changes';
        } else {
          btn.textContent = '✓ Synced!';
        }
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 2000);
      }

      // Return success for message handler
      return { success: true, message: result.no_change ? 'No changes to sync' : 'Solution synced successfully!' };

    } catch (error) {
      console.error('BetterLeetSync: Sync failed', error);
      if (btn) {
        btn.textContent = '✗ Error';
        btn.title = error.message;
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
          btn.title = '';
        }, 3000);
      }

      // Return error for message handler
      throw error;
    }
  }

  // Create and inject sync button
  function injectSyncButton() {
    // Check if button already exists
    if (document.getElementById(BUTTON_ID)) {
      console.log('BetterLeetSync: Button already exists, skipping injection');
      return;
    }

    console.log('BetterLeetSync: Attempting to inject sync button...');

    // Try to find submit button area
    const submitBtn = document.querySelector('button[data-e2e-locator="console-submit-button"]');
    let targetContainer = submitBtn?.parentElement;

    // If not found, try other selectors
    if (!targetContainer) {
      targetContainer = document.querySelector('.flex.items-center.gap-4') ||
                        document.querySelector('[class*="submit"]')?.parentElement ||
                        document.querySelector('button[type="submit"]')?.parentElement;
    }

    // Last resort: add floating button to body
    if (!targetContainer) {
      console.log('BetterLeetSync: Using floating button (no container found)');
      targetContainer = document.body;
    }

    try {
      const btn = document.createElement('button');
      btn.id = BUTTON_ID;
      btn.textContent = '📤 Sync';
      btn.title = 'Sync solution to GitHub';
      
      // Style the button
      btn.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        margin-left: 8px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      `;

      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 4px 12px rgba(0, 184, 163, 0.5)';
        btn.style.background = '#00d4bd';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = '0 2px 8px rgba(0, 184, 163, 0.3)';
        btn.style.background = '#00b8a3';
      });

      btn.addEventListener('click', syncSolution);

      // If adding to body, make it floating
      if (targetContainer === document.body) {
        btn.style.position = 'fixed';
        btn.style.bottom = '20px';
        btn.style.right = '20px';
        btn.style.zIndex = '10000';
      }

      targetContainer.appendChild(btn);
      console.log('BetterLeetSync: Sync button injected successfully');
    } catch (error) {
      console.error('BetterLeetSync: Error injecting button:', error);
    }
  }

  // Wait for page to fully load and inject button
  function init() {
    if (!isProblemPage()) {
      console.log('BetterLeetSync: Not on a problem page, skipping');
      return;
    }

    // Remove existing button if any
    const existingBtn = document.getElementById(BUTTON_ID);
    if (existingBtn) {
      existingBtn.remove();
      console.log('BetterLeetSync: Removed existing button');
    }

    // Wait for Monaco to be available
    let attempts = 0;
    const maxAttempts = 50;
    
    const checkAndInject = () => {
      attempts++;
      
      if (window.monaco && window.monaco.editor) {
        injectSyncButton();
      } else if (attempts < maxAttempts) {
        setTimeout(checkAndInject, 500);
      } else {
        // Inject anyway after timeout
        injectSyncButton();
      }
    };

    // Start checking after a short delay
    setTimeout(checkAndInject, 1000);
  }

  // Handle SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log('BetterLeetSync: URL changed, reinitializing...');
      // Give the page time to load new content
      setTimeout(init, 1500);
    }
  }).observe(document, { subtree: true, childList: true });

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'syncSolution') {
      syncSolution()
        .then(() => {
          sendResponse({ success: true, message: 'Solution synced successfully!' });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Will respond asynchronously
    }
  });

  // Initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
