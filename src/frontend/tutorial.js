/**
 * tutorial.js - Interactive Tutorial System
 * Provides step-by-step guided tour of NoteConnection features
 */

class TutorialManager {
    constructor() {
        this.currentStep = 0;
        this.isActive = false;
        this.overlay = null;
        this.dialog = null;
        
        // Tutorial completed flag
        this.completed = localStorage.getItem('tutorial_completed') === 'true';
        
        // Tutorial steps configuration
        this.steps = [
            {
                id: 'welcome',
                target: null, // No specific target, just show dialog
                position: 'center',
                beforeShow: null
            },
            {
                id: 'kbSelection',
                target: '#source-control', // or '#folder-select'
                position: 'bottom',
                beforeShow: null
            },
            {
                id: 'loadButton',
                target: '#btn-load-source',
                position: 'bottom',
                beforeShow: null
            },
            {
                id: 'analysis',
                target: '#analysis-btn',
                position: 'right', // Adjusted position for better visibility
                beforeShow: () => {
                    // Highlight the Analysis button, and open panel if NOT already open
                    const btn = document.getElementById('analysis-btn');
                    const panel = document.getElementById('analysis-panel');
                    if (btn && panel && !panel.classList.contains('open')) {
                         btn.click();
                    }
                }
            },
            {
                id: 'focusMode',
                target: '#graph-container', // Main graph area
                position: 'center',
                beforeShow: null
            },
            {
                id: 'controls',
                target: '#btn-open-settings', // Settings button (top right)
                position: 'left',
                beforeShow: () => {
                    // Ensure visibility of the settings button
                    const settingsBtn = document.getElementById('btn-open-settings');
                    if (settingsBtn) {
                        settingsBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            },
            {
                id: 'quickStart',
                target: null, // No specific target, centered dialog
                position: 'center',
                beforeShow: () => {
                    // This step triggers the Quick Start Guide display
                    // The guide will show after this step is acknowledged
                }
            }
        ];
    }

    /**
     * Start the tutorial from the beginning
     */
    start() {
        if (this.isActive) return;
        
        this.currentStep = 0;
        this.isActive = true;
        this.createOverlay();
        this.showStep(0);
        
        console.log('[Tutorial] Started');
    }

    /**
     * Stop and close the tutorial
     * @param {boolean} skipped - Whether user clicked Skip (true) or finished naturally (false)
     */
    stop(skipped = true) {
        this.isActive = false;
        this.destroyOverlay();
        
        // If user skipped before reaching quickStart step, show the Quick Start Guide
        const quickStartStepIndex = this.steps.findIndex(s => s.id === 'quickStart');
        if (skipped && this.currentStep < quickStartStepIndex) {
            console.log('[Tutorial] Skipped - showing Quick Start Guide');
            this.showQuickStartGuide();
        }
        
        console.log('[Tutorial] Stopped');
    }

    /**
     * Show the Quick Start Guide modal
     * Called when user skips tutorial or reaches quickStart step
     */
    showQuickStartGuide() {
        // Check if manual modal already exists
        if (document.getElementById('quick-start-modal')) return;
        
        const t = window.i18n ? window.i18n.t.bind(window.i18n) : (k) => k;
        
        const modal = document.createElement('div');
        modal.id = 'quick-start-modal';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display: flex; z-index: 3000;';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 550px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2 data-i18n="manual_title">${t('manual_title')}</h2>
                    <button class="modal-close" id="quick-start-close">&times;</button>
                </div>
                <div class="modal-body" style="text-align: left;">
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #61dafb; margin-bottom: 10px;" data-i18n="manual_step1_title">${t('manual_step1_title')}</h3>
                        <p style="color: #ccc; font-size: 0.9rem;" data-i18n="manual_step1_desc">${t('manual_step1_desc')}</p>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #61dafb; margin-bottom: 10px;" data-i18n="manual_step2_title">${t('manual_step2_title')}</h3>
                        <p style="color: #ccc; font-size: 0.9rem;" data-i18n="manual_step2_desc">${t('manual_step2_desc')}</p>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #61dafb; margin-bottom: 10px;" data-i18n="manual_step3_title">${t('manual_step3_title')}</h3>
                        <p style="color: #ccc; font-size: 0.9rem;" data-i18n="manual_step3_desc">${t('manual_step3_desc')}</p>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #61dafb; margin-bottom: 10px;" data-i18n="manual_step4_title">${t('manual_step4_title')}</h3>
                        <p style="color: #ccc; font-size: 0.9rem;" data-i18n="manual_step4_desc">${t('manual_step4_desc')}</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #444;">
                        <input type="checkbox" id="quick-start-dont-show" />
                        <label for="quick-start-dont-show" style="color: #888; font-size: 0.85rem;" data-i18n="dont_show_again">${t('dont_show_again')}</label>
                    </div>
                </div>
                <div class="modal-footer" style="text-align: right; padding: 15px 20px; border-top: 1px solid #444;">
                    <button id="quick-start-got-it" style="
                        background: #2c5282;
                        color: white;
                        border: none;
                        padding: 10px 25px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1rem;
                    " data-i18n="btn_got_it">${t('btn_got_it')}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Update i18n
        if (window.i18n) window.i18n.updateDOM();
        
        // Event listeners
        const closeModal = () => {
            const dontShow = document.getElementById('quick-start-dont-show');
            if (dontShow && dontShow.checked) {
                localStorage.setItem('quick_start_hidden', 'true');
            }
            modal.remove();
        };
        
        document.getElementById('quick-start-close').addEventListener('click', closeModal);
        document.getElementById('quick-start-got-it').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    /**
     * Mark tutorial as completed
     */
    markCompleted() {
        localStorage.setItem('tutorial_completed', 'true');
        this.completed = true;
        console.log('[Tutorial] Marked as completed');
    }

    /**
     * Reset tutorial (allow re-running)
     */
    reset() {
        localStorage.removeItem('tutorial_completed');
        this.completed = false;
        console.log('[Tutorial] Reset');
    }

    /**
     * Create overlay backdrop
     */
    createOverlay() {
        // Prevent duplicate overlays
        const existingOverlay = document.getElementById('tutorial-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        this.overlay = document.createElement('div');
        this.overlay.id = 'tutorial-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 8000;
            pointer-events: none;
        `;
        document.body.appendChild(this.overlay);
    }

    /**
     * Destroy overlay and dialog
     */
    destroyOverlay() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        if (this.dialog) {
            this.dialog.remove();
            this.dialog = null;
        }
        // Remove all spotlights
        this.clearSpotlights();
    }

    /**
     * Helper to remove spotlight classes and restore original styles
     */
    clearSpotlights() {
        // Restore parent elevation if any
        const controls = document.getElementById('controls');
        if (controls && controls.dataset.tutorialTempZ !== undefined) {
             controls.style.zIndex = controls.dataset.tutorialTempZ;
             delete controls.dataset.tutorialTempZ;
        }

        document.querySelectorAll('.tutorial-spotlight').forEach(el => {
            el.classList.remove('tutorial-spotlight');
            
            // Restore original styles
            if (el.dataset.originalPosition !== undefined) {
                el.style.position = el.dataset.originalPosition || '';
                delete el.dataset.originalPosition;
            } else {
                el.style.position = '';
            }

            if (el.dataset.originalZIndex !== undefined) {
                el.style.zIndex = el.dataset.originalZIndex || '';
                delete el.dataset.originalZIndex;
            } else {
                el.style.zIndex = '';
            }
            
            // Clear any pointer-events override (just in case)
            el.style.pointerEvents = '';
        });
        
        // Also ensure #source-control (dropdown area) is explicitly reset
        const sourceControl = document.getElementById('source-control');
        if (sourceControl) {
            sourceControl.style.position = '';
            sourceControl.style.zIndex = '';
            sourceControl.style.pointerEvents = 'auto'; // Force auto
        }
        
        // Ensure dropdown select is functional
        const folderSelect = document.getElementById('folder-select');
        if (folderSelect) {
            folderSelect.style.pointerEvents = 'auto'; // Force auto
            folderSelect.disabled = false;
        }
        
        const loadBtn = document.getElementById('btn-load-source');
        if (loadBtn) {
             loadBtn.style.pointerEvents = 'auto';
        }
    }

    /**
     * Show specific tutorial step
     * @param {number} stepIndex - Step index to show
     */
    showStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.steps.length) {
            this.stop(false); // Natural completion
            this.markCompleted();
            return;
        }

        this.currentStep = stepIndex;
        const step = this.steps[stepIndex];

        // Execute beforeShow callback
        if (step.beforeShow) {
            step.beforeShow();
        }

        // Remove previous spotlights
        this.clearSpotlights();

        // Highlight target element
        const targetEl = step.target ? document.querySelector(step.target) : null;
        if (targetEl) {
            // Save original styles
            targetEl.dataset.originalPosition = targetEl.style.position;
            targetEl.dataset.originalZIndex = targetEl.style.zIndex;
            
            targetEl.classList.add('tutorial-spotlight');
            targetEl.style.position = 'relative';
            // targetEl.style.zIndex = '9000'; // CSS handles this now via !important, but keeping for safety? 
            // Actually, CSS marks it !important, so inline style might be overridden or redundant. 
            // Let's set it anyway to be sure.
            targetEl.style.zIndex = '9000';

            // Check if target is inside #controls and elevate parent logic
            const controls = document.getElementById('controls');
            if (controls && (controls === targetEl || controls.contains(targetEl))) {
                // Save original
                if (controls.dataset.tutorialTempZ === undefined) {
                    controls.dataset.tutorialTempZ = controls.style.zIndex || getComputedStyle(controls).zIndex;
                }
                // Elevate parent above overlay (8000)
                controls.style.zIndex = '9001';
            }
        }

        // Create or update dialog
        this.createDialog(step, stepIndex, targetEl);
    }

    /**
     * Create tutorial dialog
     * @param {Object} step - Step configuration
     * @param {number} stepIndex - Current step index
     * @param {HTMLElement} targetEl - Target element being highlighted
     */
    createDialog(step, stepIndex, targetEl) {
        // Remove existing dialog
        if (this.dialog) {
            this.dialog.remove();
        }

        // Get translations
        const t = window.i18n.t.bind(window.i18n);
        const stepContent = t(`tutorial.steps.${step.id}`);

        // Create dialog
        this.dialog = document.createElement('div');
        this.dialog.id = 'tutorial-dialog';
        this.dialog.style.cssText = `
            position: fixed;
            background: #2a2a2a;
            border: 2px solid #61dafb;
            border-radius: 10px;
            padding: 25px;
            max-width: 400px;
            z-index: 9500;
            box-shadow: 0 10px 50px rgba(0,0,0,0.8);
            pointer-events: all;
        `;

        this.dialog.innerHTML = `
            <div class="tutorial-header" style="margin-bottom: 15px;">
                <h3 style="margin: 0 0 5px 0; color: #61dafb; font-size: 1.3rem;">
                    ${stepContent.title || t('tutorial.steps.' + step.id + '.title')}
                </h3>
                <div style="color: #888; font-size: 0.85rem;">
                    ${t('tutorial.progress', { current: stepIndex + 1, total: this.steps.length })}
                </div>
            </div>

            <div class="tutorial-body" style="margin-bottom: 20px; color: #ddd; font-size: 0.95rem; line-height: 1.6;">
                ${stepContent.content || t('tutorial.steps.' + step.id + '.content')}
            </div>

            <div class="tutorial-footer" style="display: flex; justify-content: space-between; align-items: center;">
                <button id="tutorial-skip" style="
                    background: transparent;
                    color: #888;
                    border: 1px solid #555;
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 0.9rem;
                " data-i18n="tutorial.skip">Skip Tutorial</button>

                <div style="display: flex; gap: 10px;">
                    ${stepIndex > 0 ? `
                        <button id="tutorial-prev" style="
                            background: #444;
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 0.9rem;
                        " data-i18n="tutorial.prev">Previous</button>
                    ` : ''}
                    
                    <button id="tutorial-next" style="
                        background: #2c5282;
                        color: white;
                        border: none;
                        padding: 8px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        font-weight: bold;
                    " data-i18n="tutorial.${stepIndex === this.steps.length - 1 ? 'finish' : 'next'}">
                        ${stepIndex === this.steps.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.dialog);

        // Update translations
        window.i18n.updateDOM();

        // Position dialog relative to target
        this.positionDialog(step.position, targetEl);

        // Attach event listeners
        this.attachDialogListeners();
    }

    /**
     * Position dialog relative to target element
     * @param {string} position - Position hint ('top', 'bottom', 'left', 'right', 'center')
     * @param {HTMLElement} targetEl - Target element
     */
    positionDialog(position, targetEl) {
        if (!targetEl || position === 'center') {
            // Center on screen
            this.dialog.style.top = '50%';
            this.dialog.style.left = '50%';
            this.dialog.style.transform = 'translate(-50%, -50%)';
            return;
        }

        const rect = targetEl.getBoundingClientRect();
        const dialogRect = this.dialog.getBoundingClientRect();

        let top, left;

        switch (position) {
            case 'bottom':
                top = rect.bottom + 20;
                left = rect.left + (rect.width / 2) - (dialogRect.width / 2);
                break;
            case 'top':
                top = rect.top - dialogRect.height - 20;
                left = rect.left + (rect.width / 2) - (dialogRect.width / 2);
                break;
            case 'left':
                top = rect.top + (rect.height / 2) - (dialogRect.height / 2);
                left = rect.left - dialogRect.width - 20;
                break;
            case 'right':
                top = rect.top + (rect.height / 2) - (dialogRect.height / 2);
                left = rect.right + 20;
                break;
            default:
                top = rect.bottom + 20;
                left = rect.left;
        }

        // Ensure dialog stays within viewport
        top = Math.max(10, Math.min(top, window.innerHeight - dialogRect.height - 10));
        left = Math.max(10, Math.min(left, window.innerWidth - dialogRect.width - 10));

        this.dialog.style.top = top + 'px';
        this.dialog.style.left = left + 'px';
        this.dialog.style.transform = 'none';
    }

    /**
     * Attach event listeners to dialog buttons
     */
    attachDialogListeners() {
        const skipBtn = this.dialog.querySelector('#tutorial-skip');
        const prevBtn = this.dialog.querySelector('#tutorial-prev');
        const nextBtn = this.dialog.querySelector('#tutorial-next');

        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.stop(true)); // true = skipped
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.showStep(this.currentStep - 1));
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.currentStep === this.steps.length - 1) {
                    // On final step (quickStart), stop and show the guide
                    this.stop(false); // false = not skipped, completed normally
                    this.markCompleted();
                    this.showQuickStartGuide(); // Show guide when completing tutorial
                } else {
                    this.showStep(this.currentStep + 1);
                }
            });
        }
    }

    /**
     * Check if tutorial should auto-start (first run after language selection)
     * @returns {boolean}
     */
    shouldAutoStart() {
        return !this.completed && localStorage.getItem('user_language');
    }
}

// Create global instance
window.tutorialManager = new TutorialManager();

// Auto-start tutorial if appropriate (after language selector)
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for the app to load
    setTimeout(() => {
        if (window.tutorialManager.shouldAutoStart()) {
            // Check if graph is empty (from welcome.js detection)
            const isEmpty = typeof graphData === 'undefined' || !graphData || !graphData.nodes || graphData.nodes.length === 0;
            
            if (!isEmpty) {
                // Only auto-start if there's data to show
                console.log('[Tutorial] Auto-starting tutorial');
                window.tutorialManager.start();
            }
        }
    }, 1500);
});
