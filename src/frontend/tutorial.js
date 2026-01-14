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
                target: '#analysis-panel',
                position: 'left',
                beforeShow: () => {
                    // Ensure analysis panel is visible
                    const panel = document.getElementById('analysis-panel');
                    if (panel && panel.style.display === 'none') {
                        panel.style.display = 'block';
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
                target: '#settings-btn', // Settings button
                position: 'bottom',
                beforeShow: null
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
     */
    stop() {
        this.isActive = false;
        this.destroyOverlay();
        console.log('[Tutorial] Stopped');
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
        document.querySelectorAll('.tutorial-spotlight').forEach(el => el.classList.remove('tutorial-spotlight'));
    }

    /**
     * Show specific tutorial step
     * @param {number} stepIndex - Step index to show
     */
    showStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.steps.length) {
            this.stop();
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
        document.querySelectorAll('.tutorial-spotlight').forEach(el => {
            el.classList.remove('tutorial-spotlight');
            el.style.position = '';
            el.style.zIndex = '';
        });

        // Highlight target element
        const targetEl = step.target ? document.querySelector(step.target) : null;
        if (targetEl) {
            targetEl.classList.add('tutorial-spotlight');
            targetEl.style.position = 'relative';
            targetEl.style.zIndex = '9000';
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
            skipBtn.addEventListener('click', () => this.stop());
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.showStep(this.currentStep - 1));
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.currentStep === this.steps.length - 1) {
                    this.stop();
                    this.markCompleted();
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
