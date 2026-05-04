/**
 * i18n.mjs - ES Module version of Internationalization Manager
 * Replaces window.i18n global with proper module exports.
 * A thin backward-compat shim in i18n.js re-exports through window for legacy code.
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

    async init() {
        const savedLang = localStorage.getItem('user_language');
        let tauriLang = null;

        if (window.__TAURI__) {
            try {
                tauriLang = await window.__TAURI__.core.invoke('get_user_language');
            } catch (error) {
                console.warn('[i18n] Failed to read language from Tauri backend:', error);
            }
        }

        let detectedLang = savedLang || tauriLang || this.detectBrowserLanguage() || 'en';

        if (!this.supportedLanguages.includes(detectedLang)) {
            detectedLang = this.fallbackLanguage;
        }

        await this.setLanguage(detectedLang);
        console.log(`[i18n] Initialized with language: ${this.currentLanguage}`);
    }

    detectBrowserLanguage() {
        const browserLang = navigator.language || navigator.userLanguage;
        if (!browserLang) return null;
        const langCode = browserLang.split('-')[0].toLowerCase();
        return this.supportedLanguages.includes(langCode) ? langCode : null;
    }

    async setLanguage(lang) {
        if (!this.supportedLanguages.includes(lang)) {
            console.warn(`[i18n] Unsupported language: ${lang}, falling back to ${this.fallbackLanguage}`);
            lang = this.fallbackLanguage;
        }

        if (this.isInitialized && this.currentLanguage === lang) {
            return;
        }

        try {
            const response = await fetch(`locales/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load locale file: ${lang}.json`);
            }

            this.translations = await response.json();
            this.currentLanguage = lang;
            localStorage.setItem('user_language', lang);
            this.isInitialized = true;
            this.notifyListeners(lang);

            if (window.__TAURI__) {
                let syncedInSession = null;
                try { syncedInSession = sessionStorage.getItem(this.tauriSyncStorageKey); } catch (_e) {}

                if (this.lastSyncedLanguage !== lang && syncedInSession !== lang) {
                    await window.__TAURI__.core.invoke('set_user_language', { lang });
                    this.lastSyncedLanguage = lang;
                    try { sessionStorage.setItem(this.tauriSyncStorageKey, lang); } catch (_e) {}
                } else {
                    this.lastSyncedLanguage = lang;
                }
            }
        } catch (error) {
            console.error(`[i18n] Error loading language ${lang}:`, error);
            if (lang !== this.fallbackLanguage) {
                await this.setLanguage(this.fallbackLanguage);
            }
        }
    }

    t(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                console.warn(`[i18n] Translation key not found: ${key}`);
                return key;
            }
        }

        if (typeof value === 'string' && Object.keys(params).length > 0) {
            return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
                return params[paramKey] !== undefined ? params[paramKey] : match;
            });
        }

        return value;
    }

    getLanguage() {
        return this.currentLanguage;
    }

    getSupportedLanguages() {
        return [
            { code: 'en', name: 'English', nativeName: 'English' },
            { code: 'zh', name: 'Chinese', nativeName: '中文' }
        ];
    }

    onLanguageChange(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(lang) {
        this.listeners.forEach(callback => {
            try { callback(lang); } catch (error) {
                console.error('[i18n] Error in language change listener:', error);
            }
        });
    }

    updateDOM() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                const translation = this.t(key);
                if (typeof translation === 'string' && translation.includes('<')) {
                    el.innerHTML = translation;
                } else {
                    el.textContent = typeof translation === 'string' ? translation : String(translation);
                }
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) el.placeholder = this.t(key);
        });

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) el.title = this.t(key);
        });
    }
}

const instance = new I18nManager();

// Backward compatibility: expose on window for legacy scripts
window.i18n = instance;
window.t = instance.t.bind(instance);

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await instance.init();
        instance.updateDOM();
    });
} else {
    instance.init().then(() => instance.updateDOM());
}

instance.onLanguageChange(() => instance.updateDOM());

export { instance as i18n, I18nManager };
export const t = instance.t.bind(instance);
export default instance;
