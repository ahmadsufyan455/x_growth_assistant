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
    try { return JSON.parse(rawText); } catch {}

    try {
      const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fenceMatch) return JSON.parse(fenceMatch[1]);
    } catch {}

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {}

    throw new Error('Failed to parse JSON response. Raw output:\n' + rawText.substring(0, 500));
  },

  async callGeminiAPI(userMessage, apiKey, customSystemPrompt = null) {
    if (!apiKey) {
      throw new Error('API key is required. Please set it in Settings.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GeminiAPI.timeout);

    try {
      const response = await fetch(
        `${GeminiAPI.baseURL}/${GeminiAPI.model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: customSystemPrompt || GeminiAPI.systemPrompt }]
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
  },

  async testAPIConnection() {
    const apiKey = document.getElementById('api-key-input').value.trim();
    if (!apiKey) {
      this.showStatus('api-status', 'Please enter an API key', 'error');
      return;
    }
    const btn = document.getElementById('test-api-btn');
    btn.disabled = true;
    btn.textContent = 'Testing\u2026';
    try {
      await callGeminiAPI('Return JSON: {"status":"ok"}', apiKey);
      this.showStatus('api-status', '\u2713 Connected successfully!', 'success');
    } catch (err) {
      this.showStatus('api-status', `\u2717 ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Test Connection';
    }
  },

  saveAPIKey() {
    const apiKey = document.getElementById('api-key-input').value.trim();
    if (!apiKey) {
      this.showStatus('api-status', 'Please enter an API key', 'error');
      return;
    }
    if (!apiKey.startsWith('AIza')) {
      this.showStatus('api-status', 'Invalid key format (should start with "AIza")', 'error');
      return;
    }
    if (StorageManager.saveAPIKey(apiKey)) {
      AppState.apiKey = apiKey;
      this.showStatus('api-status', '\u2713 API key saved', 'success');
    } else {
      this.showStatus('api-status', '\u2717 Failed to save', 'error');
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
    const cls = type === 'success' ? 'alert-success' : type === 'error' ? 'alert-error' : 'alert-info';
    document.getElementById(id).innerHTML = `<div class="alert ${cls}">${msg}</div>`;
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    }, 5000);
  }
};

const TweetGeneratorModule = {
  _pendingTopic: null,

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
    if (this._pendingTopic) {
      document.getElementById('tweet-topic').value = this._pendingTopic;
      this._pendingTopic = null;
    }
  },

  async generate() {
    const topic = document.getElementById('tweet-topic').value.trim();
    const tone = document.getElementById('tweet-tone').value;
    const format = document.getElementById('tweet-format').value;

    if (!topic) { alert('Please enter a topic'); return; }
    if (!AppState.apiKey) { alert('Please set your API key in Settings'); return; }

    document.getElementById('tweet-output').innerHTML = loadingHTML('Generating tweets\u2026');
    try {
      const result = await callGeminiAPI(this.buildPrompt(topic, tone, format), AppState.apiKey);
      this.renderOutput(result.variations);
      AppState.addToHistory({ module: 'tweet-generator', content: result.variations[0].text, metadata: { tone, format } });
    } catch (err) {
      document.getElementById('tweet-output').innerHTML =
        `<div class="alert alert-error"><strong>Error:</strong> ${escapeHTML(err.message)}</div>`;
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
    const cards = variations.map((v) => `
      <div class="output-card">
        <div class="output-card-header">
          <span class="output-card-label">${escapeHTML(v.label)}</span>
          <span class="output-card-meta">${v.text.length} chars</span>
        </div>
        <div class="output-card-content">${escapeHTML(v.text)}</div>
        <div class="output-card-footer">
          <button class="btn btn-secondary btn-sm copy-tweet-btn" data-text="${escapeHTML(v.text)}">📋 Copy</button>
        </div>
      </div>`).join('');

    document.getElementById('tweet-output').innerHTML = cards +
      `<button id="regen-tweet-btn" class="btn btn-ghost w-full mt-3">🔄 Regenerate</button>`;

    document.querySelectorAll('.copy-tweet-btn').forEach((btn) =>
      btn.addEventListener('click', () => copyToClipboard(btn.dataset.text, btn)));
    document.getElementById('regen-tweet-btn').addEventListener('click', () => this.generate());
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
  },

  async generate() {
    const src = document.getElementById('source-tweet').value.trim();
    const goal = document.getElementById('reply-goal').value;
    const angle = document.getElementById('reply-angle').value.trim();

    if (!src) { alert('Please paste the tweet you want to reply to'); return; }
    if (!AppState.apiKey) { alert('Please set your API key in Settings'); return; }

    document.getElementById('reply-output').innerHTML = loadingHTML('Generating replies\u2026');
    try {
      const result = await callGeminiAPI(this.buildPrompt(src, goal, angle), AppState.apiKey);
      this.renderOutput(result.replies);
      AppState.addToHistory({ module: 'reply-writer', content: result.replies[0].text, metadata: { goal } });
    } catch (err) {
      document.getElementById('reply-output').innerHTML =
        `<div class="alert alert-error"><strong>Error:</strong> ${escapeHTML(err.message)}</div>`;
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
    const cards = replies.map((r) => `
      <div class="output-card">
        <div class="output-card-header">
          <span class="output-card-label">${escapeHTML(r.label)}</span>
          <span class="output-card-meta">${r.text.length} chars</span>
        </div>
        <div class="output-card-content">${escapeHTML(r.text)}</div>
        <div class="output-card-footer">
          <button class="btn btn-secondary btn-sm copy-reply-btn" data-text="${escapeHTML(r.text)}">📋 Copy</button>
        </div>
      </div>`).join('');

    document.getElementById('reply-output').innerHTML = cards +
      `<button id="regen-reply-btn" class="btn btn-ghost w-full mt-3">🔄 Regenerate</button>`;

    document.querySelectorAll('.copy-reply-btn').forEach((btn) =>
      btn.addEventListener('click', () => copyToClipboard(btn.dataset.text, btn)));
    document.getElementById('regen-reply-btn').addEventListener('click', () => this.generate());
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
    if (!AppState.apiKey) { alert('Please set your API key in Settings'); return; }
    const ctx = document.getElementById('planner-context').value.trim();
    const focus = document.getElementById('planner-focus').value;

    document.getElementById('planner-output').innerHTML = loadingHTML('Building your content calendar\u2026');
    try {
      const result = await callGeminiAPI(this.buildPrompt(ctx, focus), AppState.apiKey);
      this.renderOutput(result.ideas);
    } catch (err) {
      document.getElementById('planner-output').innerHTML =
        `<div class="alert alert-error"><strong>Error:</strong> ${escapeHTML(err.message)}</div>`;
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
    const cards = ideas.map((idea) => `
      <div class="idea-card" data-idea="${escapeHTML(idea.idea)}" role="button" tabindex="0"
           title="Click to open in Tweet Generator">
        <div class="idea-card-day">${escapeHTML(idea.day)}</div>
        <span class="idea-card-type">${escapeHTML(idea.type)}</span>
        <div class="idea-card-text">${escapeHTML(idea.idea)}</div>
        <div class="idea-card-hint">\u2197 Click to open in Tweet Generator</div>
      </div>`).join('');

    document.getElementById('planner-output').innerHTML =
      `<div class="week-grid">${cards}</div>
       <button id="regen-plan-btn" class="btn btn-ghost w-full mt-4">🔄 Regenerate</button>`;

    document.querySelectorAll('.idea-card').forEach((card) => {
      const open = () => {
        TweetGeneratorModule._pendingTopic = card.dataset.idea;
        NavigationManager.switchModule('tweet-generator');
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
    document.getElementById('regen-plan-btn').addEventListener('click', () => this.generate());
  }
};

const BioBuilderModule = {
  render() {
    return `<div class="module-placeholder">
      <span class="ph-icon">👤</span>
      <p class="ph-title">Bio Builder</p>
      <p class="ph-desc">Coming soon</p>
    </div>`;
  },
  init() {}
};

const NavigationManager = {
  currentModule: 'tweet-generator',

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

  switchModule(moduleName) {
    if (this.currentModule === moduleName) return;

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
