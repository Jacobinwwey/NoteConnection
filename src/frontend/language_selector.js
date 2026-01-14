/**
 * language_selector.js - Language Selection Dialog
 * Displays language picker on first run and in settings
 */

class LanguageSelector {
    constructor() {
        this.modal = null;
        this.isFirstRun = !localStorage.getItem('user_language');
    }

    /**
     * Show language selection modal
     * @param {boolean} isFirstRun - Whether this is first-run dialog
     * @returns {Promise<string>} - Selected language code
     */
    show(isFirstRun = false) {
        return new Promise((resolve) => {
            this.createModal(isFirstRun, resolve);
        });
    }

    /**
     * Create and display modal
     * @param {boolean} isFirstRun - Whether this is first-run dialog
     * @param {Function} resolve - Promise resolve callback
     */
    createModal(isFirstRun, resolve) {
        // Remove existing modal if any
        this.destroy();

        // Create overlay
        this.modal = document.createElement('div');
        this.modal.id = 'language-selector-modal';
        this.modal.className = 'modal-overlay language-selector';
        this.modal.style.cssText = `
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            z-index: 9999;
            align-items: center;
            justify-content: center;
        `;

        const languages = window.i18n.getSupportedLanguages();
        const currentLang = window.i18n.getLanguage();

        this.modal.innerHTML = `
            <div class="modal-content language-selector-content" style="
                background: #2a2a2a;
                border-radius: 12px;
                padding: 40px;
                max-width: 500px;
                width: 90%;
                text-align: center;
                box-shadow: 0 10px 50px rgba(0,0,0,0.5);
            ">
                <h2 style="
                    margin: 0 0 10px 0;
                    color: #61dafb;
                    font-size: 1.8rem;
                " data-i18n="language.selector.title">Select Your Language</h2>
                
                <p style="
                    color: #aaa;
                    margin-bottom: 30px;
                    font-size: 0.95rem;
                " data-i18n="language.selector.description">Choose your preferred language for NoteConnection</p>

                <div class="language-options" style="
                    display: flex;
                    gap: 20px;
                    justify-content: center;
                    margin-bottom: 30px;
                ">
                    ${languages.map(lang => `
                        <div class="language-option ${lang.code === currentLang ? 'selected' : ''}" 
                             data-lang="${lang.code}"
                             style="
                                 flex: 1;
                                 padding: 20px;
                                 background: ${lang.code === currentLang ? '#2c5282' : '#333'};
                                 border: 2px solid ${lang.code === currentLang ? '#61dafb' : '#444'};
                                 border-radius: 8px;
                                 cursor: pointer;
                                 transition: all 0.3s;
                             "
                             onmouseover="this.style.background='${lang.code === currentLang ? '#3182ce' : '#3a3a3a'}'"
                             onmouseout="this.style.background='${lang.code === currentLang ? '#2c5282' : '#333'}'">
                            
                            <div style="font-size: 2.5rem; margin-bottom: 10px;">
                                ${lang.code === 'en' ? '🇬🇧' : '🇨🇳'}
                            </div>
                            <div style="font-size: 1.1rem; font-weight: bold; color: white; margin-bottom: 5px;">
                                ${lang.nativeName}
                            </div>
                            <div style="font-size: 0.85rem; color: #aaa;">
                                ${lang.name}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <button id="confirm-language-btn" style="
                    background: #2c5282;
                    color: white;
                    border: none;
                    padding: 12px 30px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 1rem;
                    font-weight: bold;
                    transition: background 0.3s;
                " 
                onmouseover="this.style.background='#3182ce'"
                onmouseout="this.style.background='#2c5282'"
                data-i18n="language.selector.confirm">Confirm</button>
            </div>
        `;

        document.body.appendChild(this.modal);

        // Update translations
        if (window.i18n) {
            window.i18n.updateDOM();
        }

        // Handle language option clicks
        let selectedLang = currentLang;
        this.modal.querySelectorAll('.language-option').forEach(option => {
            option.addEventListener('click', () => {
                // Remove previous selection
                this.modal.querySelectorAll('.language-option').forEach(opt => {
                    opt.classList.remove('selected');
                    opt.style.background = '#333';
                    opt.style.borderColor = '#444';
                });

                // Mark as selected
                option.classList.add('selected');
                option.style.background = '#2c5282';
                option.style.borderColor = '#61dafb';

                selectedLang = option.getAttribute('data-lang');
            });
        });

        // Handle confirm button
        this.modal.querySelector('#confirm-language-btn').addEventListener('click', async () => {
            if (selectedLang !== window.i18n.getLanguage()) {
                await window.i18n.setLanguage(selectedLang);
            }
            
            this.destroy();
            resolve(selectedLang);
        });

        // Prevent closing on first run (unless clicking confirm)
        if (!isFirstRun) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.destroy();
                    resolve(window.i18n.getLanguage());
                }
            });
        }
    }

    /**
     * Destroy the modal
     */
    destroy() {
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
            this.modal = null;
        }
    }

    /**
     * Check if this is first run and show selector if needed
     * @returns {Promise<boolean>} - True if first run and selector was shown
     */
    async checkFirstRun() {
        if (this.isFirstRun) {
            await this.show(true);
            return true;
        }
        return false;
    }
}

// Create global instance
window.languageSelector = new LanguageSelector();

// Auto-show on first run (after i18n initializes)
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for i18n to initialize
    if (window.i18n) {
        await new Promise(resolve => {
            const checkInit = setInterval(() => {
                if (window.i18n.currentLanguage) {
                    clearInterval(checkInit);
                    resolve();
                }
            }, 50);
        });

        // Show language selector if first run
        const wasFirstRun = await window.languageSelector.checkFirstRun();
        
        if (wasFirstRun) {
            console.log('[LanguageSelector] First run complete, language set to:', window.i18n.getLanguage());
        }
    }
});
