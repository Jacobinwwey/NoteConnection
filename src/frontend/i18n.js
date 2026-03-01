/**
 * i18n.js - Internationalization Manager
 * Handles language detection, loading, and translation for NoteConnection
 */

class I18nManager {
    constructor() {
        this.tauriSyncStorageKey = 'nc_tauri_lang_synced';
        this.currentLanguage = 'en';
        this.translations = {};
        this.fallbackLanguage = 'en';
        this.supportedLanguages = ['en', 'zh'];
        this.listeners = [];
        this.isInitialized = false;
        this.lastSyncedLanguage = null;

        try {
            this.lastSyncedLanguage = sessionStorage.getItem(this.tauriSyncStorageKey);
        } catch (_e) {
            this.lastSyncedLanguage = null;
        }
    }

    /**
     * Initialize i18n system
     * @returns {Promise<void>}
     */
    async init() {
        // Load saved language preference
        const savedLang = localStorage.getItem('user_language');
        
        // Detect language priority: 1) Saved, 2) Browser, 3) Default
        let detectedLang = savedLang || this.detectBrowserLanguage() || 'en';
        
        // Validate against supported languages
        if (!this.supportedLanguages.includes(detectedLang)) {
            detectedLang = this.fallbackLanguage;
        }
        
        await this.setLanguage(detectedLang);
        console.log(`[i18n] Initialized with language: ${this.currentLanguage}`);
    }

    /**
     * Detect browser/system language
     * @returns {string|null}
     */
    detectBrowserLanguage() {
        const browserLang = navigator.language || navigator.userLanguage;
        if (!browserLang) return null;
        
        // Extract language code (e.g., 'zh-CN' -> 'zh')
        const langCode = browserLang.split('-')[0].toLowerCase();
        
        return this.supportedLanguages.includes(langCode) ? langCode : null;
    }

    /**
     * Set active language and load translations
     * @param {string} lang - Language code (e.g., 'en', 'zh')
     * @returns {Promise<void>}
     */
    async setLanguage(lang) {
        if (!this.supportedLanguages.includes(lang)) {
            console.warn(`[i18n] Unsupported language: ${lang}, falling back to ${this.fallbackLanguage}`);
            lang = this.fallbackLanguage;
        }

        if (this.isInitialized && this.currentLanguage === lang) {
            // Idempotent guard to avoid duplicate side effects (e.g. Tauri menu sync).
            return;
        }

        try {
            // Load translation file
            const response = await fetch(`locales/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load locale file: ${lang}.json`);
            }
            
            this.translations = await response.json();
            this.currentLanguage = lang;
            
            // Save preference
            localStorage.setItem('user_language', lang);
            
            this.isInitialized = true;

            // Notify listeners
            this.notifyListeners(lang);
            
            // Sync with Backend (Tauri) to update Menu
            if (window.__TAURI__) {
                let syncedInSession = null;
                try {
                    syncedInSession = sessionStorage.getItem(this.tauriSyncStorageKey);
                } catch (_e) {
                    syncedInSession = null;
                }

                if (this.lastSyncedLanguage !== lang && syncedInSession !== lang) {
                    await window.__TAURI__.core.invoke('set_user_language', { lang: lang });
                    this.lastSyncedLanguage = lang;
                    try {
                        sessionStorage.setItem(this.tauriSyncStorageKey, lang);
                    } catch (_e) {
                        // Ignore storage write failures; sync already applied.
                    }
                } else {
                    this.lastSyncedLanguage = lang;
                }
            }
            
            console.log(`[i18n] Language set to: ${lang}`);
        } catch (error) {
            console.error(`[i18n] Error loading language ${lang}:`, error);
            
            // If not already fallback, try fallback language
            if (lang !== this.fallbackLanguage) {
                console.log(`[i18n] Attempting fallback to ${this.fallbackLanguage}`);
                await this.setLanguage(this.fallbackLanguage);
            }
        }
    }

    /**
     * Translate a key with optional parameter substitution
     * @param {string} key - Translation key (e.g., 'menu.file.open')
     * @param {Object} params - Optional parameters for substitution
     * @returns {string} - Translated text
     */
    t(key, params = {}) {
        // Navigate nested keys (e.g., 'menu.file.open')
        const keys = key.split('.');
        let value = this.translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                console.warn(`[i18n] Translation key not found: ${key}`);
                return key; // Return key as fallback
            }
        }
        
        // Handle parameter substitution (e.g., "Hello {name}" with {name: "World"})
        if (typeof value === 'string' && Object.keys(params).length > 0) {
            return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
                return params[paramKey] !== undefined ? params[paramKey] : match;
            });
        }
        
        return value;
    }

    /**
     * Get current language code
     * @returns {string}
     */
    getLanguage() {
        return this.currentLanguage;
    }

    /**
     * Get all supported languages
     * @returns {Array<{code: string, name: string, nativeName: string}>}
     */
    getSupportedLanguages() {
        return [
            { code: 'en', name: 'English', nativeName: 'English' },
            { code: 'zh', name: 'Chinese', nativeName: '中文' }
        ];
    }

    /**
     * Register listener for language change events
     * @param {Function} callback - Callback function(lang)
     */
    onLanguageChange(callback) {
        this.listeners.push(callback);
    }

    /**
     * Notify all listeners of language change
     * @param {string} lang - New language code
     */
    notifyListeners(lang) {
        this.listeners.forEach(callback => {
            try {
                callback(lang);
            } catch (error) {
                console.error('[i18n] Error in language change listener:', error);
            }
        });
    }

    /**
     * Update all elements with data-i18n attribute
     * Supports: data-i18n="key" for textContent
     *           data-i18n-placeholder="key" for placeholder
     *           data-i18n-title="key" for title
     */
    updateDOM() {
        // Update text content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                const translation = this.t(key);
                // Ensure translation is a string before checking for HTML
                if (typeof translation === 'string' && translation.includes('<')) {
                    el.innerHTML = translation;
                } else if (typeof translation === 'string') {
                    el.textContent = translation;
                } else {
                    // Fallback for non-string translations (shouldn't happen but safety check)
                    el.textContent = String(translation);
                }
            }
        });

        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                el.placeholder = this.t(key);
            }
        });

        // Update titles (tooltips)
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                el.title = this.t(key);
            }
        });

        console.log('[i18n] DOM updated with translations');
    }
}

// Create global instance
window.i18n = new I18nManager();
window.t = window.i18n.t.bind(window.i18n);

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await window.i18n.init();
        window.i18n.updateDOM();
    });
} else {
    // DOM already ready
    window.i18n.init().then(() => {
        window.i18n.updateDOM();
    });
}

// Listen for language changes and update DOM
window.i18n.onLanguageChange(() => {
    window.i18n.updateDOM();
});
