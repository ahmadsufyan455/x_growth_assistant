'use strict';

const GeminiAPI = {
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/models',
  model: 'gemini-2.5-flash-lite',
  maxOutputTokens: 4096,
  timeout: 8000,
  systemPrompt: `You are a personal branding expert for software engineers building in public on X.
The user is a software engineer transitioning to solopreneur, focused on AI and indie hacking.
Write content that feels authentic, smart, and human.
No hashtags. Minimal emojis. Engineer voice. Return only raw JSON.`
};

const StorageKeys = {
  API_KEY: 'xgrowth_api_key',
  NICHE_PROFILE: 'xgrowth_niche',
  HISTORY: 'xgrowth_history',
  SETTINGS: 'xgrowth_settings'
};

/**
 * Centralized error message mapping.
 * Keys are HTTP status codes (number) or named error types (string).
 * Values are user-friendly messages displayed in error cards.
 */
const ERROR_MESSAGES = {
  400: 'Bad request. Check your input and try again.',
  401: 'Invalid API key. Please check your key in Settings.',
  403: 'API quota exceeded. Check your Google AI Studio usage.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Google API server error. Please try again later.',
  502: 'Google API is temporarily unavailable. Please try again later.',
  503: 'Google API is temporarily unavailable. Please try again later.',
  timeout: 'Request timed out after 8 seconds. Please try again.',
  network: 'Network error. Check your internet connection.',
  parse: 'Failed to parse AI response. Raw output shown below.',
  empty: 'Empty response from API. Please try again.',
  cancelled: null  // No message shown for user-initiated cancel
};

/**
 * Centralized error handling utility.
 * All modules delegate error display to this object.
 * Methods are stateless — they operate on DOM elements by ID.
 */
const ErrorHandler = {

  // ─── Field Validation ──────────────────────────────────────

  /**
   * Validate that a field is not empty.
   * @param {string} fieldId - The DOM id of the input/textarea element
   * @param {string} fieldName - Human-readable field name for the error message
   * @returns {boolean} true if valid, false if empty
   */
  validateRequired(fieldId, fieldName) {
    const field = document.getElementById(fieldId);
    if (!field) return false;

    const value = field.value.trim();
    if (!value) {
      this.showFieldError(fieldId, `${fieldName} is required.`);
      return false;
    }

    this.clearFieldError(fieldId);
    return true;
  },

  /**
   * Show inline error on a specific field.
   * Adds .input-error class to the field and populates the .field-error span.
   * @param {string} fieldId - The DOM id of the input/textarea element
   * @param {string} message - Error message to display
   */
  showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    // Add red border
    field.classList.add('input-error');

    // Find or create the error message element
    let errorEl = document.getElementById(`${fieldId}-error`);
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.id = `${fieldId}-error`;
      errorEl.className = 'field-error';
      field.parentNode.appendChild(errorEl);
    }

    errorEl.textContent = message;
    errorEl.classList.remove('hidden');

    // Auto-clear on focus
    field.addEventListener('focus', () => {
      this.clearFieldError(fieldId);
    }, { once: true });
  },

  /**
   * Clear inline error from a specific field.
   * Removes .input-error class and hides the .field-error span.
   * @param {string} fieldId - The DOM id of the input/textarea element
   */
  clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.classList.remove('input-error');

    const errorEl = document.getElementById(`${fieldId}-error`);
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
  },

  // ─── API Key Check ─────────────────────────────────────────

  /**
   * Check if API key is set. If not, show a banner in the given container
   * and optionally navigate to Settings.
   * @param {string} [containerId] - Optional container to show the banner in
   * @returns {boolean} true if API key exists, false if missing
   */
  requireAPIKey(containerId) {
    if (AppState.apiKey) return true;

    if (containerId) {
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = `
          <div class="api-key-banner">
            <div class="api-key-banner-content">
              <span class="api-key-banner-icon">🔑</span>
              <div>
                <p class="api-key-banner-title">API Key Required</p>
                <p class="api-key-banner-message">
                  Please set your Gemini API key in Settings to use this feature.
                </p>
              </div>
            </div>
            <button class="btn btn-primary btn-sm api-key-banner-action"
                    onclick="NavigationManager.switchModule('settings')">
              Go to Settings
            </button>
          </div>
        `;
      }
    }

    return false;
  },

  // ─── API Error Display ─────────────────────────────────────

  /**
   * Display a styled API error card in the given container.
   * Parses the error to determine the appropriate user-friendly message.
   * @param {string} containerId - The DOM id of the output container
   * @param {Error|string} error - The error object or message string
   */
  showAPIError(containerId, error) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const message = typeof error === 'string' ? error : error.message || 'An unexpected error occurred.';

    // Try to extract HTTP status code from error message for icon selection
    const isAuthError = message.toLowerCase().includes('api key') ||
      message.toLowerCase().includes('unauthorized');

    container.innerHTML = `
      <div class="error-card">
        <div class="error-card-header">
          <span class="error-card-icon">${isAuthError ? '🔑' : '⚠️'}</span>
          <span class="error-card-title">API Error</span>
          <button class="btn btn-icon error-dismiss"
                  onclick="ErrorHandler.dismiss('${containerId}')"
                  aria-label="Dismiss error">✕</button>
        </div>
        <p class="error-card-message">${this._escapeHTML(message)}</p>
        ${isAuthError ? `
          <button class="btn btn-secondary btn-sm mt-3"
                  onclick="NavigationManager.switchModule('settings')">
            Go to Settings
          </button>
        ` : ''}
      </div>
    `;
  },

  /**
   * Display a JSON parse failure card with the raw response for debugging.
   * @param {string} containerId - The DOM id of the output container
   * @param {string} rawResponse - The raw API response text that failed to parse
   */
  showParseError(containerId, rawResponse) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const truncated = rawResponse.length > 2000
      ? rawResponse.substring(0, 2000) + '\n\n... [truncated]'
      : rawResponse;

    container.innerHTML = `
      <div class="error-card">
        <div class="error-card-header">
          <span class="error-card-icon">🔧</span>
          <span class="error-card-title">Parse Error</span>
          <button class="btn btn-icon error-dismiss"
                  onclick="ErrorHandler.dismiss('${containerId}')"
                  aria-label="Dismiss error">✕</button>
        </div>
        <p class="error-card-message">${ERROR_MESSAGES.parse}</p>
        <pre class="error-card-raw">${this._escapeHTML(truncated)}</pre>
      </div>
    `;
  },

  /**
   * Display a timeout error card.
   * @param {string} containerId - The DOM id of the output container
   */
  showTimeoutError(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="error-card">
        <div class="error-card-header">
          <span class="error-card-icon">⏱️</span>
          <span class="error-card-title">Request Timeout</span>
          <button class="btn btn-icon error-dismiss"
                  onclick="ErrorHandler.dismiss('${containerId}')"
                  aria-label="Dismiss error">✕</button>
        </div>
        <p class="error-card-message">${ERROR_MESSAGES.timeout}</p>
      </div>
    `;
  },

  /**
   * Display a network error card.
   * @param {string} containerId - The DOM id of the output container
   */
  showNetworkError(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="error-card">
        <div class="error-card-header">
          <span class="error-card-icon">📡</span>
          <span class="error-card-title">Connection Error</span>
          <button class="btn btn-icon error-dismiss"
                  onclick="ErrorHandler.dismiss('${containerId}')"
                  aria-label="Dismiss error">✕</button>
        </div>
        <p class="error-card-message">${ERROR_MESSAGES.network}</p>
      </div>
    `;
  },

  // ─── Loading State ─────────────────────────────────────────

  /**
   * Show a loading indicator with optional cancel button.
   * @param {string} containerId - The DOM id of the output container
   * @param {string} message - Loading message (e.g., "Generating tweets...")
   * @param {AbortController} [abortController] - Optional controller for cancel
   */
  showLoading(containerId, message, abortController) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const cancelBtnId = `${containerId}-cancel-btn`;

    container.innerHTML = `
      <div class="loading">
        <div class="loading-dots">
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
        </div>
        <span class="loading-message">${this._escapeHTML(message)}</span>
        ${abortController ? `
          <button id="${cancelBtnId}"
                  class="btn btn-ghost btn-sm loading-cancel">
            Cancel
          </button>
        ` : ''}
      </div>
    `;

    // Wire up cancel button
    if (abortController) {
      const cancelBtn = document.getElementById(cancelBtnId);
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          abortController.abort();
          this.dismiss(containerId);
        });
      }
    }
  },

  // ─── Utility Methods ───────────────────────────────────────

  /**
   * Map an HTTP status code to a user-friendly error message.
   * @param {number} statusCode - HTTP status code
   * @returns {string} User-friendly error message
   */
  getErrorMessage(statusCode) {
    return ERROR_MESSAGES[statusCode]
      || ERROR_MESSAGES[Math.floor(statusCode / 100) * 100]
      || `Unexpected error (code ${statusCode}). Please try again.`;
  },

  /**
   * Clear the contents of a container (dismiss an error or loading state).
   * @param {string} containerId - The DOM id of the container to clear
   */
  dismiss(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }
  },

  /**
   * Route an error to the appropriate display method.
   * Inspects the error message/type to determine which handler to call.
   * This is the primary entry point for catch blocks in modules.
   * @param {string} containerId - The DOM id of the output container
   * @param {Error} error - The caught error
   */
  handleError(containerId, error) {
    const msg = error.message || '';

    // User cancelled — do nothing
    if (error.name === 'AbortError' && msg !== 'Request timed out. Please try again.') {
      this.dismiss(containerId);
      return;
    }

    // Timeout
    if (msg.toLowerCase().includes('timed out') || msg.toLowerCase().includes('timeout')) {
      this.showTimeoutError(containerId);
      return;
    }

    // Network error
    if (msg.toLowerCase().includes('network') ||
      msg.toLowerCase().includes('failed to fetch') ||
      msg.toLowerCase().includes('connection')) {
      this.showNetworkError(containerId);
      return;
    }

    // Parse error with raw response
    if (msg.toLowerCase().includes('failed to parse json')) {
      // Extract raw output from the error message (format: "Failed to parse JSON response. Raw output:\n...")
      const rawStart = msg.indexOf('Raw output:\n');
      if (rawStart !== -1) {
        const rawResponse = msg.substring(rawStart + 'Raw output:\n'.length);
        this.showParseError(containerId, rawResponse);
        return;
      }
    }

    // Generic API error
    this.showAPIError(containerId, error);
  },

  /**
   * Escape HTML entities to prevent XSS in error messages.
   * @param {string} str - Raw string
   * @returns {string} HTML-safe string
   * @private
   */
  _escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

const StorageManager = {
  saveAPIKey(apiKey) {
    try {
      localStorage.setItem(StorageKeys.API_KEY, btoa(apiKey));
      return true;
    } catch (error) {
      console.error('Failed to save API key:', error.name);
      return false;
    }
  },

  loadAPIKey() {
    try {
      const encoded = localStorage.getItem(StorageKeys.API_KEY);
      return encoded ? atob(encoded) : null;
    } catch (error) {
      console.error('Failed to load API key:', error.name);
      return null;
    }
  },

  clearAPIKey() {
    localStorage.removeItem(StorageKeys.API_KEY);
  },

  saveNicheProfile(profile) {
    try {
      localStorage.setItem(StorageKeys.NICHE_PROFILE, JSON.stringify(this.validateNicheProfile(profile)));
      return true;
    } catch (error) {
      console.error('Failed to save niche profile:', error.name);
      return false;
    }
  },

  loadNicheProfile() {
    try {
      const raw = localStorage.getItem(StorageKeys.NICHE_PROFILE);
      if (!raw) return null;
      return this.validateNicheProfile(JSON.parse(raw));
    } catch (error) {
      console.error('Failed to load niche profile:', error.name);
      return null;
    }
  },

  validateNicheProfile(profile) {
    return {
      role: profile?.role || '',
      experience: profile?.experience || '',
      focusAreas: Array.isArray(profile?.focusAreas) ? profile.focusAreas : [],
      tone: profile?.tone || 'authentic',
      customContext: profile?.customContext || ''
    };
  },

  addToHistory(item) {
    try {
      const history = this.loadHistory();
      history.unshift({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        module: item.module,
        content: item.content,
        metadata: item.metadata || {}
      });
      localStorage.setItem(StorageKeys.HISTORY, JSON.stringify(history.slice(0, 20)));
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        this.clearHistory();
        return this.addToHistory(item);
      }
      console.error('Failed to add to history:', error.name);
      return false;
    }
  },

  loadHistory() {
    try {
      const raw = localStorage.getItem(StorageKeys.HISTORY);
      if (!raw) return [];
      const history = JSON.parse(raw);
      return Array.isArray(history) ? history : [];
    } catch (error) {
      console.error('Failed to load history:', error.name);
      return [];
    }
  },

  clearHistory() {
    localStorage.removeItem(StorageKeys.HISTORY);
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(StorageKeys.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error.name);
      return false;
    }
  },

  loadSettings() {
    try {
      const raw = localStorage.getItem(StorageKeys.SETTINGS);
      if (!raw) return this.getDefaultSettings();
      return { ...this.getDefaultSettings(), ...JSON.parse(raw) };
    } catch (error) {
      console.error('Failed to load settings:', error.name);
      return this.getDefaultSettings();
    }
  },

  getDefaultSettings() {
    return {
      theme: 'dark',
      autoSaveHistory: true,
      showCharCount: true,
      defaultTone: 'authentic'
    };
  },

  clearAll() {
    Object.values(StorageKeys).forEach((key) => localStorage.removeItem(key));
  },

  getStorageUsage() {
    let total = 0;
    Object.values(StorageKeys).forEach((key) => {
      const item = localStorage.getItem(key);
      if (item) total += item.length;
    });
    return {
      bytes: total,
      kb: (total / 1024).toFixed(2),
      percentage: ((total / (5 * 1024 * 1024)) * 100).toFixed(2)
    };
  }
};

const AppState = {
  apiKey: null,
  nicheProfile: null,
  currentModule: 'tweet-generator',
  history: [],
  settings: {},

  init() {
    this.loadFromStorage();
    this.render();
  },

  loadFromStorage() {
    this.apiKey = StorageManager.loadAPIKey();
    this.nicheProfile = StorageManager.loadNicheProfile();
    this.history = StorageManager.loadHistory();
    this.settings = StorageManager.loadSettings();
  },

  saveAPIKey(apiKey) {
    this.apiKey = apiKey;
    StorageManager.saveAPIKey(apiKey);
  },

  saveNicheProfile(profile) {
    this.nicheProfile = profile;
    StorageManager.saveNicheProfile(profile);
  },

  saveSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    StorageManager.saveSettings(this.settings);
  },

  addToHistory(item) {
    StorageManager.addToHistory(item);
    this.history = StorageManager.loadHistory();
  },

  clearAllData() {
    if (confirm('Clear all saved data? This cannot be undone.')) {
      StorageManager.clearAll();
      this.loadFromStorage();
      this.render();
    }
  },

  extractJSON(rawText) {
    try { return JSON.parse(rawText); } catch { }

    try {
      const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fenceMatch) return JSON.parse(fenceMatch[1]);
    } catch { }

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch { }

    throw new Error('Failed to parse JSON response. Raw output:\n' + rawText.substring(0, 500));
  },

  async callGeminiAPI(userMessage, apiKey, signal = null) {
    if (!apiKey) {
      throw new Error('API key is required. Please set it in Settings.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GeminiAPI.timeout);

    // If external signal provided, forward its abort to our controller
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const response = await fetch(
        `${GeminiAPI.baseURL}/${GeminiAPI.model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: GeminiAPI.systemPrompt }]
            },
            contents: [{ parts: [{ text: userMessage }] }],
            generationConfig: {
              maxOutputTokens: GeminiAPI.maxOutputTokens,
              temperature: 0.9,
              topP: 0.95,
              topK: 40
            }
          })
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(this.parseAPIError(response.status, errorData));
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) throw new Error('Empty response from API');

      return this.extractJSON(rawText);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        // User-initiated cancel (external signal) - return null silently
        if (signal?.aborted) {
          return null;
        }
        // Timeout - throw error
        throw new Error('Request timed out. Please try again.');
      }
      throw error;
    }
  },

  parseAPIError(statusCode, errorData) {
    const errorMessage = errorData?.error?.message || '';
    const errorMap = {
      400: errorMessage.includes('API_KEY_INVALID')
        ? 'Invalid API key. Please check your key in Settings.'
        : `Bad request: ${errorMessage}`,
      401: 'Unauthorized. Please check your API key.',
      403: 'Access forbidden. Your API key may not have access to this model.',
      429: 'Rate limit exceeded. Please wait a moment and try again.',
      500: 'Google API is temporarily unavailable. Please try again.',
      502: 'Google API is temporarily unavailable. Please try again.',
      503: 'Google API is temporarily unavailable. Please try again.'
    };
    return errorMap[statusCode] || `API error (${statusCode}): ${errorMessage || 'Unknown error'}`;
  },

  render() {
    NavigationManager.renderModule(this.currentModule);
  }
};

const escapeHTML = (str) => {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
};

const loadingHTML = (label) => `
  <div class="loading">
    <div class="loading-dots">
      <div class="loading-dot"></div>
      <div class="loading-dot"></div>
      <div class="loading-dot"></div>
    </div>
    <span>${label}</span>
  </div>`;

const callGeminiAPI = (prompt, apiKey) => AppState.callGeminiAPI(prompt, apiKey);

const copyToClipboard = async (text, btn) => {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = '\u2713 Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  } catch {
    alert('Failed to copy. Please copy manually.');
  }
};

const OutputCard = {
  render(containerId, items, options = {}) {
    const { charLimit, copyClass = 'copy-btn', onRegenerate } = options;
    const container = document.getElementById(containerId);
    if (!container) return;

    const cardsHTML = items.map((item) => {
      const text = item.text;
      const label = item.label;
      const length = text.length;
      const pct = charLimit ? (length / charLimit) * 100 : 0;

      let charCountClass = 'char-count-ok';
      if (pct > 100) {
        charCountClass = 'char-count-over';
      } else if (pct > 80) {
        charCountClass = 'char-count-warn';
      }

      return `
        <div class="output-card">
          <div class="output-card-header">
            <span class="output-card-label">${escapeHTML(label)}</span>
            <span class="output-card-meta ${charCountClass}">${length} / ${charLimit}</span>
          </div>
          <div class="output-card-content">${escapeHTML(text)}</div>
          <div class="output-card-footer">
            <button class="btn btn-secondary btn-sm ${copyClass}" data-text="${escapeHTML(text)}">📋 Copy</button>
          </div>
        </div>
      `;
    }).join('');

    const regenerateHTML = onRegenerate
      ? '<button class="btn btn-ghost w-full mt-3">🔄 Regenerate</button>'
      : '';

    container.innerHTML = cardsHTML + regenerateHTML;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest(`.${copyClass}`);
      if (btn) {
        const text = btn.getAttribute('data-text');
        navigator.clipboard.writeText(text)
          .then(() => Toast.show('Copied to clipboard!'))
          .catch(() => Toast.show('Failed to copy'));
      } else if (e.target.closest('.btn-ghost') && onRegenerate) {
        onRegenerate();
      }
    });
  },

  renderLoading(containerId, message = 'Generating...') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = loadingHTML(message);
  },

  renderError(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<div class="alert alert-error"><strong>Error:</strong> ${escapeHTML(message)}</div>`;
  }
};

const Toast = (() => {
  let container = null;
  let currentToast = null;
  let timeoutId = null;

  const getContainer = () => {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  };

  return {
    show(message) {
      // Clear existing toast and timeout
      if (currentToast) {
        currentToast.remove();
        clearTimeout(timeoutId);
      }

      const toastContainer = getContainer();
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = message;

      toastContainer.appendChild(toast);
      currentToast = toast;

      // Auto-dismiss after 2 seconds
      timeoutId = setTimeout(() => {
        toast.remove();
        currentToast = null;
      }, 2000);
    }
  };
})();

const SettingsModule = {
  render() {
    return `<div class="module-settings">
  <div class="module-header">
    <h2 class="module-title">Settings</h2>
    <p class="module-description">Configure your API key and niche profile</p>
  </div>

  <div class="card mb-4">
    <h3 class="text-lg font-semibold mb-3">Google Gemini API Key</h3>
    <p class="text-sm text-secondary mb-3">
      Get your free API key from
      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" class="text-accent">Google AI Studio</a>.
    </p>
    <div class="input-group">
      <label class="label" for="api-key-input">API Key</label>
      <input type="password" id="api-key-input" class="input" placeholder="AIza..." autocomplete="off">
    </div>
    <div class="flex gap-2">
      <button id="test-api-btn" class="btn btn-secondary">Test Connection</button>
      <button id="save-api-btn" class="btn btn-primary">Save API Key</button>
      <button id="clear-api-btn" class="btn btn-ghost">Clear</button>
    </div>
    <div id="api-status" class="mt-3"></div>
  </div>

  <div class="card mb-4">
    <h3 class="text-lg font-semibold mb-3">Niche Profile</h3>
    <p class="text-sm text-secondary mb-4">This context is injected into all AI prompts to personalize your content.</p>
    <div class="input-group">
      <label class="label" for="profile-role">Role &amp; Experience <span class="label-optional">(e.g., "Software Engineer, 3 years")</span></label>
      <input type="text" id="profile-role" class="input" placeholder="Software Engineer, 3 years at startups">
    </div>
    <div class="input-group">
      <label class="label" for="profile-focus">Focus Areas <span class="label-optional">(e.g., "AI, indie hacking, React")</span></label>
      <input type="text" id="profile-focus" class="input" placeholder="AI, indie hacking, React, TypeScript">
    </div>
    <div class="input-group">
      <label class="label" for="profile-context">Additional Context <span class="label-optional">(optional)</span></label>
      <textarea id="profile-context" class="input textarea" placeholder="What you're building, your goals, unique perspective..."></textarea>
    </div>
    <div class="flex gap-2">
      <button id="save-profile-btn" class="btn btn-primary">Save Profile</button>
      <button id="clear-profile-btn" class="btn btn-ghost">Clear</button>
    </div>
    <div id="profile-status" class="mt-3"></div>
  </div>

  <div class="card" style="border-color:var(--error-color)">
    <h3 class="text-lg font-semibold mb-2" style="color:var(--error-color)">Danger Zone</h3>
    <p class="text-sm text-secondary mb-3">Clear all saved data including API key, profile, and history.</p>
    <button id="clear-all-btn" class="btn btn-secondary">Clear All Data</button>
  </div>
</div>`;
  },

  init() {
    this.loadSavedSettings();
    this.setupEventListeners();
  },

  loadSavedSettings() {
    const apiKey = StorageManager.loadAPIKey();
    if (apiKey) {
      document.getElementById('api-key-input').value = apiKey;
      this.showStatus('api-status', 'API key loaded', 'success');
    }
    const profile = StorageManager.loadNicheProfile();
    if (profile) {
      document.getElementById('profile-role').value = profile.role || '';
      document.getElementById('profile-focus').value = profile.focusAreas?.join(', ') || '';
      document.getElementById('profile-context').value = profile.customContext || '';
    }
  },

  setupEventListeners() {
    document.getElementById('test-api-btn').addEventListener('click', () => this.testAPIConnection());
    document.getElementById('save-api-btn').addEventListener('click', () => this.saveAPIKey());
    document.getElementById('clear-api-btn').addEventListener('click', () => this.clearAPIKey());
    document.getElementById('save-profile-btn').addEventListener('click', () => this.saveProfile());
    document.getElementById('clear-profile-btn').addEventListener('click', () => this.clearProfile());
    document.getElementById('clear-all-btn').addEventListener('click', () => this.clearAllData());

    // Clear error on focus
    document.getElementById('api-key-input').addEventListener('focus', () => ErrorHandler.clearFieldError('api-key-input'));
  },

  async testAPIConnection() {
    const apiKey = document.getElementById('api-key-input').value.trim();
    if (!ErrorHandler.validateRequired('api-key-input', 'API Key')) return;

    const btn = document.getElementById('test-api-btn');
    btn.disabled = true;
    btn.textContent = 'Testing…';
    try {
      await callGeminiAPI('Return JSON: {"status":"ok"}', apiKey);
      this.showStatus('api-status', '✓ Connected successfully!', 'success');
    } catch (err) {
      this.showStatus('api-status', `✗ ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Test Connection';
    }
  },

  saveAPIKey() {
    const apiKey = document.getElementById('api-key-input').value.trim();
    if (!ErrorHandler.validateRequired('api-key-input', 'API Key')) return;

    if (!apiKey.startsWith('AIza')) {
      ErrorHandler.showFieldError('api-key-input', 'Invalid key format (should start with "AIza")');
      return;
    }
    if (StorageManager.saveAPIKey(apiKey)) {
      AppState.apiKey = apiKey;
      this.showStatus('api-status', '✓ API key saved', 'success');
    } else {
      this.showStatus('api-status', '✗ Failed to save', 'error');
    }
  },

  clearAPIKey() {
    if (!confirm('Clear saved API key?')) return;
    StorageManager.clearAPIKey();
    AppState.apiKey = null;
    document.getElementById('api-key-input').value = '';
    this.showStatus('api-status', 'API key cleared', 'info');
  },

  saveProfile() {
    const role = document.getElementById('profile-role').value.trim();
    const focuses = document.getElementById('profile-focus').value.trim();
    const ctx = document.getElementById('profile-context').value.trim();
    const profile = {
      role,
      focusAreas: focuses ? focuses.split(',').map((s) => s.trim()) : [],
      customContext: ctx
    };
    if (StorageManager.saveNicheProfile(profile)) {
      AppState.nicheProfile = profile;
      this.showStatus('profile-status', '\u2713 Profile saved', 'success');
    } else {
      this.showStatus('profile-status', '\u2717 Failed to save', 'error');
    }
  },

  clearProfile() {
    if (!confirm('Clear niche profile?')) return;
    ['profile-role', 'profile-focus', 'profile-context'].forEach((id) => {
      document.getElementById(id).value = '';
    });
    StorageManager.saveNicheProfile({ role: '', focusAreas: [], customContext: '' });
    AppState.nicheProfile = null;
    this.showStatus('profile-status', 'Profile cleared', 'info');
  },

  clearAllData() {
    if (!confirm('\u26a0\ufe0f Clear ALL data? This includes API key, profile, and history. Cannot be undone.')) return;
    StorageManager.clearAll();
    AppState.loadFromStorage();
    this.loadSavedSettings();
    this.showStatus('api-status', 'All data cleared', 'info');
  },

  showStatus(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;

    if (type === 'error') {
      const inputId = id === 'api-status' ? 'api-key-input' : null;
      if (inputId) {
        ErrorHandler.showFieldError(inputId, msg);
      } else {
        const cls = 'alert-error';
        el.innerHTML = `<div class="alert ${cls}">${msg}</div>`;
        setTimeout(() => { if (el) el.innerHTML = ''; }, 5000);
      }
    } else {
      const cls = type === 'success' ? 'alert-success' : 'alert-info';
      el.innerHTML = `<div class="alert ${cls}">${msg}</div>`;
      setTimeout(() => { if (el) el.innerHTML = ''; }, 5000);
    }
  }
};

const ExportManager = {
  exportContentPlan(ideas) {
    const markdown = this.generateMarkdown(ideas);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `x-content-${dateStr}.md`;
    this.downloadFile(markdown, filename);
  },

  generateMarkdown(ideas) {
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    let md = `# X Content Plan\n\n> Generated by X Growth Assistant on ${dateStr}\n`;

    if (AppState.nicheProfile && AppState.nicheProfile.role) {
      const role = AppState.nicheProfile.role;
      const focus = AppState.nicheProfile.focusAreas ? AppState.nicheProfile.focusAreas.join(', ') : 'Unspecified';
      md += `> Niche: ${role} | Focus: ${focus}\n`;
    }

    md += `\n---\n\n`;

    ideas.forEach(idea => {
      md += `${idea.day} — [${idea.type}]\n\n**Idea:** ${idea.idea}\n\n---\n\n`;
    });

    return md.trim() + '\n';
  },

  downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

const ThreadFormatter = {
  /**
   * Parse thread text into an array of tweet objects.
   * Splits on numbered patterns like "1/ ", "2/ ", etc.
   * @param {string} text - Raw thread text from API
   * @returns {Array<{number: number, text: string}>}
   */
  parseThread(text) {
    if (!text || typeof text !== 'string') return [];

    // Split on numbered tweet pattern: "1/ ", "2/ ", etc.
    // Handles optional newline before the number
    const parts = text.split(/\n?(\d+)\/\s*/);

    // parts array: ['', '1', 'tweet text...', '2', 'tweet text...', ...]
    // First element is empty or preamble text (discard if empty)
    const tweets = [];

    for (let i = 1; i < parts.length; i += 2) {
      const num = parseInt(parts[i], 10);
      const tweetText = (parts[i + 1] || '').trim();

      if (tweetText) {
        tweets.push({ number: num, text: tweetText });
      }
    }

    return tweets;
  },

  /**
   * Render a thread with visual connectors into a container element.
   * @param {string} containerId - DOM element ID to render into
   * @param {Array<{number: number, text: string}>} threadTweets - Parsed tweets
   * @param {Object} options - Callbacks and configuration
   */
  renderThread(containerId, threadTweets, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const tweetCount = threadTweets.length;

    const tweetsHTML = threadTweets.map((tweet, index) => {
      const isLast = index === tweetCount - 1;
      const charCount = tweet.text.length;
      const charClass = this.getCharClass(charCount);

      return `
        <div class="thread-tweet${isLast ? ' thread-tweet-last' : ''}">
          <div class="thread-connector">
            <span class="thread-number">${tweet.number}/</span>
            ${!isLast ? '<div class="thread-line"></div>' : ''}
          </div>
          <div class="thread-tweet-content">
            <div class="thread-tweet-text">${escapeHTML(tweet.text)}</div>
            <div class="thread-tweet-footer">
              <span class="thread-char-count ${charClass}">${charCount} chars</span>
              <button class="btn btn-ghost btn-sm copy-tweet-btn" data-index="${index}">Copy</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <div class="thread-container">
        <div class="thread-header">
          <span class="thread-label">Thread · ${tweetCount} tweet${tweetCount !== 1 ? 's' : ''}</span>
          <button class="btn btn-secondary btn-sm copy-thread-btn">📋 Copy Thread</button>
        </div>
        <div class="thread-tweets">
          ${tweetsHTML}
        </div>
        <button class="btn btn-ghost w-full mt-3" id="regenerate-tweet-btn">
          🔄 Regenerate
        </button>
      </div>
    `;

    container.innerHTML = html;

    // Bind event listeners
    this.bindEvents(container, threadTweets, options);
  },

  /**
   * Bind click events for copy and regenerate buttons.
   */
  bindEvents(container, threadTweets, options) {
    // Copy Thread button
    const copyThreadBtn = container.querySelector('.copy-thread-btn');
    if (copyThreadBtn) {
      copyThreadBtn.addEventListener('click', () => {
        const formatted = this.formatForCopy(threadTweets);
        if (options.onCopyThread) {
          options.onCopyThread(formatted);
        } else {
          this.copyToClipboard(formatted);
        }
      });
    }

    // Individual Copy buttons
    container.querySelectorAll('.copy-tweet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        const tweetText = threadTweets[index].text;
        if (options.onCopyTweet) {
          options.onCopyTweet(index, tweetText);
        } else {
          this.copyToClipboard(tweetText);
        }
      });
    });

    // Regenerate button
    const regenBtn = container.querySelector('#regenerate-tweet-btn');
    if (regenBtn && options.onRegenerate) {
      regenBtn.addEventListener('click', () => {
        options.onRegenerate();
      });
    }
  },

  /**
   * Format thread tweets for clipboard copy.
   * Each tweet is prefixed with its number and separated by double newlines.
   * @param {Array<{number: number, text: string}>} threadTweets
   * @returns {string}
   */
  formatForCopy(threadTweets) {
    return threadTweets
      .map(tweet => `${tweet.number}/ ${tweet.text}`)
      .join('\n\n');
  },

  /**
   * Check if a text string looks like a thread (has numbered tweet pattern).
   * @param {string} text
   * @returns {boolean}
   */
  isThread(text) {
    if (!text || typeof text !== 'string') return false;
    // Must have at least "1/" and "2/" patterns to be considered a thread
    const matches = text.match(/\d+\/\s/g);
    return matches !== null && matches.length >= 2;
  },

  /**
   * Get CSS class for character count color coding.
   * @param {number} count - Character count
   * @returns {string} CSS class name
   */
  getCharClass(count) {
    if (count <= 240) return 'char-ok';
    if (count <= 280) return 'char-warn';
    return 'char-over';
  },

  /**
   * Copy text to clipboard with fallback.
   * @param {string} text
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      Toast.show('Copied to clipboard!');
    } catch (error) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      Toast.show('Copied to clipboard!');
    }
  }
};

const TweetGeneratorModule = {
  _pendingTopic: null,
  currentInputs: null,

  render() {
    return `<div class="module-tweet-generator">
  <div class="module-header">
    <h2 class="module-title">Tweet Generator</h2>
    <p class="module-description">Generate authentic, on-brand tweets in seconds</p>
  </div>
  <div class="card mb-4">
    <div class="input-group">
      <label class="label" for="tweet-topic">What do you want to tweet about?</label>
      <textarea id="tweet-topic" class="input textarea" rows="4"
        placeholder="E.g., 'I just learned about React Server Components and how they solve the data fetching problem...'"></textarea>
    </div>
    <div class="flex gap-3">
      <div class="input-group" style="flex:1">
        <label class="label" for="tweet-tone">Tone</label>
        <select id="tweet-tone" class="input select">
          <option value="authentic">Authentic &amp; direct</option>
          <option value="contrarian">Slightly contrarian</option>
          <option value="educational">Educational</option>
          <option value="storytelling">Storytelling</option>
          <option value="bold">Bold &amp; provocative</option>
        </select>
      </div>
      <div class="input-group" style="flex:1">
        <label class="label" for="tweet-format">Format</label>
        <select id="tweet-format" class="input select">
          <option value="single">Single tweet</option>
          <option value="thread">Short thread (3-5 tweets)</option>
          <option value="hook">Hook tweet only</option>
        </select>
      </div>
    </div>
    <button id="generate-tweet-btn" class="btn btn-primary w-full">Generate Tweets</button>
  </div>
  <div id="tweet-output"></div>
</div>`;
  },

  init() {
    document.getElementById('generate-tweet-btn').addEventListener('click', () => this.generate());
    document.getElementById('tweet-topic').addEventListener('focus', () => ErrorHandler.clearFieldError('tweet-topic'));

    // Legacy: _pendingTopic (kept for backward compat)
    if (this._pendingTopic) {
      document.getElementById('tweet-topic').value = this._pendingTopic;
      this._pendingTopic = null;
    }

    // NEW: Consume cross-module data payload from NavigationManager
    const pendingData = NavigationManager.consumePendingData();
    if (pendingData && pendingData.topic) {
      const topicField = document.getElementById('tweet-topic');
      topicField.value = pendingData.topic;
      topicField.focus();
      topicField.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  async generate() {
    const topic = document.getElementById('tweet-topic').value.trim();
    const tone = document.getElementById('tweet-tone').value;
    const format = document.getElementById('tweet-format').value;

    if (!ErrorHandler.validateRequired('tweet-topic', 'Topic')) return;
    if (!ErrorHandler.requireAPIKey('tweet-output')) return;

    this.currentInputs = { topic, tone, format };

    const controller = new AbortController();
    ErrorHandler.showLoading('tweet-output', 'Generating tweets…', controller);
    try {
      const result = await AppState.callGeminiAPI(this.buildPrompt(topic, tone, format), AppState.apiKey, controller.signal);
      if (!result) {
        ErrorHandler.dismiss('tweet-output');
        return;
      }
      this.renderOutput(result.variations);
      AppState.addToHistory({ module: 'tweet-generator', content: result.variations[0].text, metadata: { tone, format } });
    } catch (err) {
      ErrorHandler.handleError('tweet-output', err);
    }
  },

  buildPrompt(topic, tone, format) {
    const ctx = AppState.nicheProfile
      ? `User context: ${AppState.nicheProfile.role}. Focus: ${AppState.nicheProfile.focusAreas.join(', ')}.`
      : '';
    const tones = {
      authentic: 'Direct, honest voice. No fluff.',
      contrarian: 'Challenge common assumptions.',
      educational: 'Teach something specific. Be actionable.',
      storytelling: 'Use narrative structure. Make it personal.',
      bold: 'Be provocative. Take a strong stance.'
    };
    const formats = {
      single: 'Single tweet, max 280 characters.',
      thread: 'Thread of 3-5 tweets. Number them (1/, 2/, etc.). Each max 280 chars.',
      hook: 'Just the opening hook. Max 280 chars.'
    };
    return `${ctx}\n\nTopic: ${topic}\nTone: ${tones[tone]}\nFormat: ${formats[format]}\n\nGenerate 2 distinct variations. No hashtags. Minimal emojis. Engineer voice.\n\nReturn JSON:\n{\n  "variations": [\n    {"label":"Variation 1","text":"..."},\n    {"label":"Variation 2","text":"..."}\n  ]\n}`;
  },

  renderOutput(variations) {
    const format = this.currentInputs?.format;

    if (format === 'thread') {
      const outputContainer = document.getElementById('tweet-output');
      outputContainer.innerHTML = '';

      for (let i = 0; i < variations.length; i++) {
        const v = variations[i];
        const tweets = ThreadFormatter.parseThread(v.text);

        if (tweets.length > 1) {
          // Valid thread — render with ThreadFormatter
          ThreadFormatter.renderThread('tweet-output', tweets, {
            onCopyThread: (formatted) => {
              ThreadFormatter.copyToClipboard(formatted);
            },
            onCopyTweet: (index, text) => {
              ThreadFormatter.copyToClipboard(text);
            },
            onRegenerate: () => {
              this.generate();
            }
          });
          return; // Only render first valid thread variation
        }
      }

      // Fallback: if no valid thread was parsed, check if text looks like a thread
      if (document.getElementById('tweet-output').innerHTML === '') {
        const firstText = variations[0]?.text || '';
        if (ThreadFormatter.isThread(firstText)) {
          const tweets = ThreadFormatter.parseThread(firstText);
          ThreadFormatter.renderThread('tweet-output', tweets, {
            onRegenerate: () => this.generate()
          });
        } else {
          this.renderStandardOutput(variations);
        }
      }
      return;
    }

    this.renderStandardOutput(variations);
  },

  renderStandardOutput(variations) {
    OutputCard.render('tweet-output', variations, {
      charLimit: 280,
      copyClass: 'copy-tweet-btn',
      onRegenerate: () => this.generate()
    });
  }
};

const ReplyWriterModule = {
  render() {
    return `<div class="module-reply-writer">
  <div class="module-header">
    <h2 class="module-title">Reply Writer</h2>
    <p class="module-description">Generate thoughtful replies that add value and build visibility</p>
  </div>
  <div class="card mb-4">
    <div class="input-group">
      <label class="label" for="source-tweet">Paste the tweet you want to reply to</label>
      <textarea id="source-tweet" class="input textarea" rows="4" placeholder="Paste the full tweet text here..."></textarea>
    </div>
    <div class="input-group">
      <label class="label" for="reply-goal">Reply Goal</label>
      <select id="reply-goal" class="input select">
        <option value="add-value">Add value / insight</option>
        <option value="agree-expand">Agree + expand on their point</option>
        <option value="challenge">Challenge the take (respectfully)</option>
        <option value="ask-question">Ask a thoughtful question</option>
        <option value="introduce">Introduce myself / my work</option>
      </select>
    </div>
    <div class="input-group">
      <label class="label" for="reply-angle">Your angle <span class="label-optional">(optional — adds personal context)</span></label>
      <input type="text" id="reply-angle" class="input" placeholder="E.g., 'I faced this issue last month when building...'">
    </div>
    <button id="generate-reply-btn" class="btn btn-primary w-full">Generate Replies</button>
  </div>
  <div id="reply-output"></div>
</div>`;
  },

  init() {
    document.getElementById('generate-reply-btn').addEventListener('click', () => this.generate());
    document.getElementById('source-tweet').addEventListener('focus', () => ErrorHandler.clearFieldError('source-tweet'));
  },

  async generate() {
    const src = document.getElementById('source-tweet').value.trim();
    const goal = document.getElementById('reply-goal').value;
    const angle = document.getElementById('reply-angle').value.trim();

    if (!ErrorHandler.validateRequired('source-tweet', 'Source tweet')) return;
    if (!ErrorHandler.requireAPIKey('reply-output')) return;

    const controller = new AbortController();
    ErrorHandler.showLoading('reply-output', 'Generating replies…', controller);

    try {
      const result = await AppState.callGeminiAPI(this.buildPrompt(src, goal, angle), AppState.apiKey, controller.signal);
      if (!result) {
        ErrorHandler.dismiss('reply-output');
        return;
      }
      this.renderOutput(result.replies);
      AppState.addToHistory({ module: 'reply-writer', content: result.replies[0].text, metadata: { goal } });
    } catch (err) {
      ErrorHandler.handleError('reply-output', err);
    }
  },

  buildPrompt(src, goal, angle) {
    const ctx = AppState.nicheProfile
      ? `Your background: ${AppState.nicheProfile.role}. Focus: ${AppState.nicheProfile.focusAreas.join(', ')}.`
      : '';
    const goals = {
      'add-value': "Add a valuable insight they didn't mention.",
      'agree-expand': 'Agree and expand with your own experience.',
      'challenge': 'Respectfully challenge with a counterpoint.',
      'ask-question': 'Ask a thoughtful question that deepens the conversation.',
      'introduce': 'Introduce yourself and your relevant work naturally.'
    };
    const angleCtx = angle ? `\nYour angle: ${angle}` : '';
    return `${ctx}\n\nSource tweet:\n"${src}"\n\nGoal: ${goals[goal]}${angleCtx}\n\nGenerate 3 distinct reply options. Each:\n- Max 280 characters\n- No self-promotion in the text\n- Signal expertise through insight\n- Sound human\n- No hashtags\n\nReturn JSON:\n{\n  "replies": [\n    {"label":"Value add","text":"..."},\n    {"label":"Personal take","text":"..."},\n    {"label":"Question","text":"..."}\n  ]\n}`;
  },

  renderOutput(replies) {
    OutputCard.render('reply-output', replies, {
      charLimit: 280,
      copyClass: 'copy-reply-btn',
      onRegenerate: () => this.generate()
    });
  }
};

const ContentPlannerModule = {
  render() {
    return `<div class="module-content-planner">
  <div class="module-header">
    <h2 class="module-title">Content Ideas</h2>
    <p class="module-description">7-day content calendar — one specific idea per day</p>
  </div>
  <div class="card mb-4">
    <div class="input-group">
      <label class="label" for="planner-context">Context <span class="label-optional">(optional — recent work, wins, thoughts)</span></label>
      <textarea id="planner-context" class="input textarea" rows="3" placeholder="E.g., 'Just shipped v2 of my SaaS, learning about LLM fine-tuning, struggling with distribution...'"></textarea>
    </div>
    <div class="input-group mb-0">
      <label class="label" for="planner-focus">Content Focus</label>
      <select id="planner-focus" class="input select">
        <option value="mixed">Mixed (balanced variety)</option>
        <option value="technical">Technical insights</option>
        <option value="journey">Building in public / journey</option>
        <option value="lessons">Lessons learned</option>
        <option value="engagement">Engagement-first (questions + hot takes)</option>
      </select>
    </div>
  </div>
  <button id="generate-plan-btn" class="btn btn-primary w-full mb-4">Generate 7-Day Plan</button>
  <div id="planner-output"></div>
</div>`;
  },

  init() {
    document.getElementById('generate-plan-btn').addEventListener('click', () => this.generate());
  },

  async generate() {
    if (!ErrorHandler.requireAPIKey('planner-output')) return;
    const ctx = document.getElementById('planner-context').value.trim();
    const focus = document.getElementById('planner-focus').value;

    const controller = new AbortController();
    ErrorHandler.showLoading('planner-output', 'Building your content calendar…', controller);
    try {
      const result = await AppState.callGeminiAPI(this.buildPrompt(ctx, focus), AppState.apiKey, controller.signal);
      if (!result) {
        ErrorHandler.dismiss('planner-output');
        return;
      }
      this.renderOutput(result.ideas);
    } catch (err) {
      ErrorHandler.handleError('planner-output', err);
    }
  },

  buildPrompt(ctx, focus) {
    const profile = AppState.nicheProfile
      ? `Engineer background: ${AppState.nicheProfile.role}. Focus: ${AppState.nicheProfile.focusAreas.join(', ')}.`
      : '';
    const focusMap = {
      mixed: 'Balanced: mix of technical, personal, lessons, and engagement content.',
      technical: 'Lean toward technical insights, tutorials, and code discoveries.',
      journey: 'Focus on building-in-public: progress, setbacks, decisions.',
      lessons: 'Emphasize lessons learned and hard-won experience.',
      engagement: 'Prioritize questions, polls, hot takes to drive comments.'
    };
    const ctxNote = ctx ? `\nContext: ${ctx}` : '';
    return `${profile}${ctxNote}\n\nContent focus: ${focusMap[focus]}\n\nGenerate a 7-day X content calendar (Monday to Sunday).\nEach idea must be specific and actionable — NOT generic.\nContent types: Personal story, Hot take, Tutorial, Lesson learned, Behind the scenes, Question, Thread idea.\n\nReturn JSON:\n{\n  "ideas": [\n    {"day":"Monday","idea":"...","type":"..."},\n    {"day":"Tuesday","idea":"...","type":"..."},\n    {"day":"Wednesday","idea":"...","type":"..."},\n    {"day":"Thursday","idea":"...","type":"..."},\n    {"day":"Friday","idea":"...","type":"..."},\n    {"day":"Saturday","idea":"...","type":"..."},\n    {"day":"Sunday","idea":"...","type":"..."}\n  ]\n}`;
  },

  renderOutput(ideas) {
    this.currentIdeas = ideas;
    const cards = ideas.map((idea) => `
      <div class="idea-card" data-idea="${escapeHTML(idea.idea)}" role="button" tabindex="0"
           title="Click to open in Tweet Generator">
        <div class="idea-card-day">${escapeHTML(idea.day)}</div>
        <span class="idea-card-type">${escapeHTML(idea.type)}</span>
        <div class="idea-card-text">${escapeHTML(idea.idea)}</div>
        <button class="btn btn-ghost btn-sm idea-use-btn"
                data-idea="${escapeHTML(idea.idea)}"
                aria-label="Use this idea in Tweet Generator">
          Use this idea &rarr;
        </button>
      </div>`).join('');

    document.getElementById('planner-output').innerHTML =
      `<div class="week-grid">${cards}</div>
       <div class="export-actions flex gap-2 mt-4">
         <button id="regen-plan-btn" class="btn btn-ghost w-full">🔄 Regenerate</button>
         <button id="export-plan-btn" class="btn btn-secondary w-full">📥 Export as Markdown</button>
       </div>`;

    // Card-level click (whole card is still clickable)
    document.querySelectorAll('.idea-card').forEach((card) => {
      const open = () => this.useIdeaForTweet(card.dataset.idea);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });

    // Dedicated button listeners (stopPropagation prevents double-fire)
    this.setupIdeaButtons();

    document.getElementById('regen-plan-btn').addEventListener('click', () => this.generate());
    document.getElementById('export-plan-btn').addEventListener('click', () => {
      ExportManager.exportContentPlan(this.currentIdeas);
    });
  },

  /**
   * Attach click handlers to all "Use this idea" buttons.
   * Uses stopPropagation so the parent card click doesn't also fire.
   */
  setupIdeaButtons() {
    document.querySelectorAll('.idea-use-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.useIdeaForTweet(e.currentTarget.dataset.idea);
      });
    });
  },

  /**
   * Navigate to Tweet Generator with the selected idea pre-filled as the topic.
   * @param {string} ideaText
   */
  useIdeaForTweet(ideaText) {
    NavigationManager.switchModule('tweet-generator', { topic: ideaText });
  }
};

const BioBuilderModule = {
  currentInputs: null,

  render() {
    return `<div class="module-bio-builder">
  <div class="module-header">
    <h2 class="module-title">Bio Builder</h2>
    <p class="module-description">Generate a professional X bio that makes profile visitors hit Follow</p>
  </div>
  <div class="card mb-4">
    <div class="input-group">
      <label class="label" for="bio-role">Role &amp; experience <span style="color:var(--error-color)">*</span></label>
      <input type="text" id="bio-role" class="input" placeholder="Senior Frontend Engineer, 5 years">
    </div>
    <div class="input-group">
      <label class="label" for="bio-building">What you're building <span style="color:var(--error-color)">*</span></label>
      <input type="text" id="bio-building" class="input" placeholder="AI-powered productivity tools">
    </div>
    <div class="input-group">
      <label class="label" for="bio-known-for">Things to be known for <span class="label-optional">(optional)</span></label>
      <input type="text" id="bio-known-for" class="input" placeholder="React, TypeScript, open source">
    </div>
    <div class="input-group">
      <label class="label" for="bio-personal">Personal detail <span class="label-optional">(optional)</span></label>
      <input type="text" id="bio-personal" class="input" placeholder="Based in Jakarta, coffee addict">
    </div>
    <button id="generate-bio-btn" class="btn btn-primary w-full">Generate Bios</button>
  </div>
  <div id="bio-output"></div>
</div>`;
  },

  init() {
    document.getElementById('generate-bio-btn').addEventListener('click', () => this.generate());
    document.getElementById('bio-role').addEventListener('focus', () => ErrorHandler.clearFieldError('bio-role'));
    document.getElementById('bio-building').addEventListener('focus', () => ErrorHandler.clearFieldError('bio-building'));
  },

  async generate() {
    const role = document.getElementById('bio-role').value.trim();
    const building = document.getElementById('bio-building').value.trim();
    const knownFor = document.getElementById('bio-known-for').value.trim();
    const personal = document.getElementById('bio-personal').value.trim();

    if (!ErrorHandler.validateRequired('bio-role', 'Role & experience')) return;
    if (!ErrorHandler.validateRequired('bio-building', 'What you\'re building')) return;
    if (!ErrorHandler.requireAPIKey('bio-output')) return;

    this.currentInputs = { role, building, knownFor, personal };

    const controller = new AbortController();
    ErrorHandler.showLoading('bio-output', 'Generating bios…', controller);
    try {
      const result = await AppState.callGeminiAPI(this.buildPrompt(role, building, knownFor, personal), AppState.apiKey, controller.signal);
      if (!result) {
        ErrorHandler.dismiss('bio-output');
        return;
      }
      this.renderOutput(result.bios);
      AppState.addToHistory({ module: 'bio-builder', content: result.bios[0].text, metadata: {} });
    } catch (err) {
      ErrorHandler.handleError('bio-output', err);
    }
  },

  buildPrompt(role, building, knownFor, personal) {
    const ctx = AppState.nicheProfile
      ? `User niche context: ${AppState.nicheProfile.role}. Focus areas: ${AppState.nicheProfile.focusAreas.join(', ')}.`
      : '';
    const knownLine = knownFor ? `\nKnown for: ${knownFor}` : '';
    const personalLine = personal ? `\nPersonal detail: ${personal}` : '';
    return `${ctx}\n\nGenerate 3 distinct X bio options based on these inputs:\n\nRole & experience: ${role}\nWhat they're building: ${building}${knownLine}${personalLine}\n\nStyle requirements for each bio:\n1. "Minimal & punchy" — Short, impactful, uses line breaks or pipes to separate ideas. Feels clean and confident.\n2. "Story-driven" — Narrative arc, shows the journey or transition. Feels personal and authentic.\n3. "Bold & direct" — Strong stance, memorable claim. Feels authoritative and opinionated.\n\nRules:\n- Each bio MUST be 160 characters or fewer.\n- No hashtags.\n- No emojis.\n- Write in an engineer's voice — direct, specific, no fluff.\n- Reflect the specific role, goals, and personal details provided.\n- Each bio should feel genuinely different in structure and tone.\n\nReturn JSON only:\n{\n  "bios": [\n    {"label": "Minimal & punchy", "text": "..."},\n    {"label": "Story-driven", "text": "..."},\n    {"label": "Bold & direct", "text": "..."}\n  ]\n}`;
  },

  renderOutput(bios) {
    OutputCard.render('bio-output', bios, {
      charLimit: 160,
      copyClass: 'copy-bio-btn',
      onRegenerate: () => this.generate()
    });
  }
};

// ─── Module Badge Definitions ─────────────────────────────────────────────

const MODULE_BADGES = {
  'tweet-generator': { label: 'Tweet', color: '#1D9BF0' },
  'reply-writer': { label: 'Reply', color: '#4CAF50' },
  'content-planner': { label: 'Ideas', color: '#FF9800' },
  'bio-builder': { label: 'Bio', color: '#9C27B0' }
};

// ─── History Module ────────────────────────────────────────────────────────

const HistoryModule = {
  /** Cached items for the current view cycle */
  currentItems: [],

  render() {
    return `
      <div class="module-history">
        <div class="module-header">
          <h2 class="module-title">History</h2>
          <p class="module-description">Your last 20 generated outputs</p>
        </div>
        <div id="history-container"></div>
      </div>
    `;
  },

  init() {
    this.loadHistory();
  },

  loadHistory() {
    this.currentItems = StorageManager.loadHistory();
    const container = document.getElementById('history-container');
    if (!container) return;

    if (!this.currentItems || this.currentItems.length === 0) {
      container.innerHTML = this.renderEmptyState();
      return;
    }

    container.innerHTML = this.renderHistoryList(this.currentItems);
    this.bindListEvents();
  },

  renderEmptyState() {
    return `
      <div class="empty-state">
        <span class="empty-state-icon" aria-hidden="true">📭</span>
        <p class="empty-state-text">No history yet</p>
        <p class="empty-state-hint">Generated content will appear here</p>
      </div>
    `;
  },

  renderHistoryList(items) {
    const count = items.length;
    const itemsHTML = items.map((item, index) => this.renderHistoryItem(item, index)).join('');
    return `
      <div class="history-actions">
        <span class="history-count">${count} item${count !== 1 ? 's' : ''}</span>
        <button id="clear-history-btn" class="btn btn-ghost btn-sm">Clear All</button>
      </div>
      <div id="history-list">
        ${itemsHTML}
      </div>
    `;
  },

  renderHistoryItem(item, index) {
    const badge = this.getModuleBadge(item.module);
    const timeStr = this.formatTimestamp(item.timestamp);
    const preview = this.truncateText(item.content, 80);
    return `
      <div class="history-item" data-index="${index}" role="button" tabindex="0"
           aria-label="${badge.label} generated ${timeStr}">
        <div class="history-item-header">
          <span class="history-badge" style="background: ${badge.color}">${badge.label}</span>
          <span class="history-time">${timeStr}</span>
        </div>
        <p class="history-preview">${this.escapeHTML(preview)}</p>
      </div>
    `;
  },

  viewItem(index) {
    const item = this.currentItems[index];
    if (!item) return;

    const badge = this.getModuleBadge(item.module);
    const timeStr = this.formatTimestamp(item.timestamp);
    const charCount = item.content.length;
    const container = document.getElementById('history-container');

    container.innerHTML = `
      <div class="history-detail">
        <button class="btn btn-ghost btn-sm mb-3" id="history-back-btn">← Back to list</button>
        <div class="output-card">
          <div class="output-card-header">
            <span class="history-badge" style="background: ${badge.color}">${badge.label}</span>
            <span class="output-card-meta">${charCount} chars · ${timeStr}</span>
          </div>
          <div class="output-card-content">${this.escapeHTML(item.content)}</div>
          <div class="output-card-footer">
            <button class="btn btn-secondary btn-sm copy-btn" id="history-copy-btn">📋 Copy</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('history-back-btn').addEventListener('click', () => this.backToList());
    document.getElementById('history-copy-btn').addEventListener('click', () => this.copyToClipboard(item.content));
  },

  backToList() {
    this.loadHistory();
  },

  clearHistory() {
    const confirmed = confirm('Clear all history? This cannot be undone.');
    if (!confirmed) return;
    StorageManager.clearHistory();
    this.loadHistory();
  },

  bindListEvents() {
    // History item clicks (keyboard + pointer)
    document.querySelectorAll('.history-item').forEach((el) => {
      const open = () => {
        const index = parseInt(el.dataset.index, 10);
        this.viewItem(index);
      };
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });

    // Clear all button
    const clearBtn = document.getElementById('clear-history-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearHistory());
    }
  },

  // ─── Utility Methods ───────────────────────────────────────

  /**
   * Convert an ISO timestamp to a human-readable relative string.
   * @param {string} isoString
   * @returns {string}
   */
  formatTimestamp(isoString) {
    if (!isoString) return 'Unknown';
    const now = new Date();
    const then = new Date(isoString);
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    return then.toLocaleDateString();
  },

  /**
   * Truncate text to maxLength chars with ellipsis.
   * @param {string} text
   * @param {number} maxLength
   * @returns {string}
   */
  truncateText(text, maxLength = 80) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trimEnd() + '\u2026';
  },

  /**
   * Return the badge config for a module name.
   * @param {string} moduleName
   * @returns {{ label: string, color: string }}
   */
  getModuleBadge(moduleName) {
    return MODULE_BADGES[moduleName] ?? { label: 'Other', color: '#666666' };
  },

  /**
   * Escape HTML entities to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Copy text to clipboard and show a toast.
   * @param {string} text
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      Toast.show('Copied to clipboard!');
    } catch {
      alert('Failed to copy. Please copy manually.');
    }
  }
};

const NavigationManager = {
  currentModule: 'tweet-generator',
  /** Stores a one-time data payload for cross-module communication (e.g., idea → tweet topic). */
  pendingData: null,

  init() {
    this.setupMobileSettingsTab();
    this.setupTabListeners();
    this.renderModule(this.currentModule);
  },

  setupMobileSettingsTab() {
    const mobileBtn = document.getElementById('nav-settings-mobile');
    const applyVisibility = () => {
      const isMobile = window.innerWidth <= 768;
      mobileBtn.style.display = isMobile ? '' : 'none';
      mobileBtn.setAttribute('aria-hidden', isMobile ? 'false' : 'true');
    };
    applyVisibility();
    window.addEventListener('resize', applyVisibility);
  },

  setupTabListeners() {
    document.querySelectorAll('.nav-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        this.switchModule(e.currentTarget.dataset.module);
      });
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.switchModule(e.currentTarget.dataset.module);
        }
      });
    });
  },

  /**
   * Consume pending cross-module data (one-time read; clears after).
   * @returns {object|null}
   */
  consumePendingData() {
    const data = this.pendingData;
    this.pendingData = null;
    return data;
  },

  /**
   * Switch to a module, optionally passing a data payload to it.
   * @param {string} moduleName
   * @param {object|null} data - Optional payload (e.g., { topic: "..." })
   */
  switchModule(moduleName, data = null) {
    // Store pending data BEFORE same-module guard so re-renders with new data work
    if (data) this.pendingData = data;

    // If same module and no new data, no-op
    if (this.currentModule === moduleName && !data) return;

    document.querySelectorAll('.nav-tab').forEach((tab) => {
      tab.classList.remove('active');
      tab.removeAttribute('aria-current');
    });
    document.querySelectorAll(`[data-module="${moduleName}"]`).forEach((tab) => {
      tab.classList.add('active');
      tab.setAttribute('aria-current', 'page');
    });

    const container = document.getElementById('module-container');
    container.style.animation = 'none';
    void container.offsetHeight;
    container.style.animation = '';

    this.currentModule = moduleName;
    AppState.currentModule = moduleName;
    this.renderModule(moduleName);
  },

  renderModule(moduleName) {
    const container = document.getElementById('module-container');
    const modules = {
      'tweet-generator': TweetGeneratorModule,
      'reply-writer': ReplyWriterModule,
      'content-planner': ContentPlannerModule,
      'bio-builder': BioBuilderModule,
      'history': HistoryModule,
      'settings': SettingsModule
    };

    const mod = modules[moduleName];
    if (mod) {
      container.innerHTML = mod.render();
      mod.init();
    } else {
      container.innerHTML = '<p style="color:var(--text-tertiary)">Module not found.</p>';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AppState.init();
  NavigationManager.init();
});
