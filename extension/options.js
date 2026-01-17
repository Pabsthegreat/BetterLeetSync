// BetterLeetSync - Options Page Script

const DEFAULT_BACKEND_URL = 'http://localhost:3456';

// Load saved settings
function loadSettings() {
  chrome.storage.sync.get({
    backendUrl: DEFAULT_BACKEND_URL,
    hmacSecret: ''
  }, (items) => {
    document.getElementById('backendUrl').value = items.backendUrl;
    document.getElementById('hmacSecret').value = items.hmacSecret;
  });
}

// Save settings
function saveSettings(e) {
  e.preventDefault();
  
  const backendUrl = document.getElementById('backendUrl').value.trim() || DEFAULT_BACKEND_URL;
  const hmacSecret = document.getElementById('hmacSecret').value.trim();
  
  const statusEl = document.getElementById('status');
  const saveBtn = document.getElementById('save-btn');
  
  if (!hmacSecret) {
    statusEl.textContent = 'HMAC Secret is required!';
    statusEl.className = 'status error';
    return;
  }
  
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  
  chrome.storage.sync.set({
    backendUrl,
    hmacSecret
  }, () => {
    // Test connection to backend
    testConnection(backendUrl).then((result) => {
      if (result.success) {
        statusEl.textContent = `Settings saved! Backend status: ${result.configured ? 'Configured ✓' : 'Not configured (check server .env)'}`;
        statusEl.className = 'status success';
      } else {
        statusEl.textContent = `Settings saved, but could not connect to backend: ${result.error}`;
        statusEl.className = 'status error';
      }
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Settings';
    });
  });
}

// Test backend connection
async function testConnection(backendUrl) {
  try {
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    return { success: true, configured: data.configured };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', loadSettings);
document.getElementById('options-form').addEventListener('submit', saveSettings);
