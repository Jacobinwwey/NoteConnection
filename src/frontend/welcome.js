// welcome.js - Handles the "Empty State" or "Welcome" experience for new users.
// Now with i18n support and expandable help section

// Exposed entry point for SourceManager to call after data load
window.showWelcomeModal = showWelcomeModal;

const consumePendingWelcomeState = () => {
    if (!Object.prototype.hasOwnProperty.call(window, '__NC_PENDING_WELCOME_STATE')) {
        return null;
    }

    const pending = Boolean(window.__NC_PENDING_WELCOME_STATE);
    delete window.__NC_PENDING_WELCOME_STATE;
    return pending;
};

/* 
 * Main function to trigger welcome modal
 * @param {boolean} hasNodes - Whether the graph has data (true) or is empty (false)
 */
function showWelcomeModal(hasNodes = false) {
    console.log('[Welcome] Initializing with hasNodes:', hasNodes);
    // Check if modal already exists
    if (document.getElementById('welcome-modal')) return;
    window.__welcomeModalVisible = true;

    // Check if user has explicitly disabled welcome screen (if we implemented that feature)
    // For now, we follow the requirement to always ask.

    const showModal = () => {
        const t = (window.i18n && typeof window.i18n.t === 'function')
            ? window.i18n.t.bind(window.i18n)
            : ((key) => key);

        // Create Modal HTML
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'welcome-modal';
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.display = 'flex';
        modalOverlay.style.zIndex = '2000';

        // Content logic based on State
        let title = t('welcome.title');
        let subtitle = t('welcome.subtitle');
        let exploreBtnFn = '';

        if (hasNodes) {
            title = t('welcome.graphLoaded.title');
            subtitle = t('welcome.graphLoaded.subtitle');
            
            exploreBtnFn = `
                <button id="btn-explore" style="
                    width: 100%;
                    padding: 15px 25px;
                    margin-bottom: 20px;
                    background: transparent;
                    border: 2px solid #555;
                    border-radius: 10px;
                    color: #ccc;
                    font-size: 1.1rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                " data-i18n="welcome.graphLoaded.explore">
                    ${t('welcome.graphLoaded.explore')}
                </button>
            `;
        }

        modalOverlay.innerHTML = `
            <div class="modal-content" style="max-width: 600px; text-align: center;">
                <div class="modal-header" style="justify-content: center;">
                    <h2 data-i18n="welcome.title">${title}</h2>
                </div>
                <div class="modal-body">
                    <p style="font-size: 1.1rem; color: #ccc; margin-bottom: 25px;">
                        ${subtitle}
                    </p>
                    
                    ${!hasNodes ? `
                    <div style="background: #333; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="margin-top: 0; color: #61dafb;" data-i18n="welcome.step1.title">${t('welcome.step1.title')}</h3>
                        <p style="font-size: 0.9rem; color: #aaa;" data-i18n="welcome.step1.description">
                            ${t('welcome.step1.description')}
                        </p>
                    </div>
                    ` : ''}

                    <!-- Prominent Tutorial Button -->
                    <button id="btn-start-tutorial" style="
                        width: 100%;
                        padding: 15px 25px;
                        margin-bottom: 10px;
                        background: linear-gradient(135deg, #2c5282 0%, #1a365d 100%);
                        border: 2px solid #61dafb;
                        border-radius: 10px;
                        color: #61dafb;
                        font-size: 1.1rem;
                        font-weight: bold;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 15px rgba(97, 218, 251, 0.3);
                    " data-i18n="welcome.startTutorial">
                        ${t('welcome.startTutorial')}
                    </button>
                    
                    ${exploreBtnFn}

                    <!-- Expandable Help Section -->
                    <div id="welcome-help-section" style="
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 8px;
                        margin-top: 20px;
                        overflow: hidden;
                    ">
                        <div id="welcome-help-header" style="
                            padding: 15px;
                            cursor: pointer;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            background: #333;
                            transition: background 0.3s;
                        ">
                            <span style="color: #61dafb; font-weight: bold; font-size: 1rem;" data-i18n="welcome.needHelp">
                                ${t('welcome.needHelp')}
                            </span>
                            <span id="help-toggle-icon" style="color: #61dafb; font-size: 1.2rem; transition: transform 0.3s;">
                                ▼
                            </span>
                        </div>

                        <div id="welcome-help-content" style="
                            max-height: 0;
                            overflow: hidden;
                            transition: max-height 0.4s ease, padding 0.4s ease;
                            padding: 0 15px;
                            background: #2a2a2a;
                        ">
                            <div style="padding: 15px 0; text-align: left; color: #ccc; font-size: 0.9rem; line-height: 1.8;">
                                <p style="margin-bottom: 15px;" data-i18n="welcome.helpContent.intro">
                                    ${t('welcome.helpContent.intro')}
                                </p>
                                <p style="
                                    padding: 12px;
                                    background: #333;
                                    border-left: 3px solid #61dafb;
                                    border-radius: 4px;
                                    margin-top: 15px;
                                " data-i18n="welcome.helpContent.tutorialLink">
                                    ${t('welcome.helpContent.tutorialLink')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        const closeWelcomeModal = () => {
            const modal = document.getElementById('welcome-modal');
            if (modal) modal.remove();
            window.__welcomeModalVisible = false;

            if (sourceControl) {
                sourceControl.style.boxShadow = '';
                sourceControl.style.zIndex = '1000';
            }
        };
        
        // Highlight the Source Control area
        const sourceControl = document.getElementById('source-control');
        if (sourceControl) {
            sourceControl.style.boxShadow = '0 0 15px 5px rgba(97, 218, 251, 0.5)';
            sourceControl.style.zIndex = '2001'; // Above modal if needed, or just highlight
            sourceControl.style.position = 'relative'; // Ensure z-index works
        }

        // Setup expandable help section
        const helpHeader = document.getElementById('welcome-help-header');
        const helpContent = document.getElementById('welcome-help-content');
        const toggleIcon = document.getElementById('help-toggle-icon');
        let isExpanded = false;

        // Add hover effects interactively to avoid CSP violations
        helpHeader.addEventListener('mouseenter', () => {
             helpHeader.style.background = '#3a3a3a';
        });
        helpHeader.addEventListener('mouseleave', () => {
             helpHeader.style.background = '#333';
        });

        helpHeader.addEventListener('click', () => {
            isExpanded = !isExpanded;
            if (isExpanded) {
                helpContent.style.maxHeight = helpContent.scrollHeight + 'px';
                helpContent.style.padding = '0 15px';
                toggleIcon.style.transform = 'rotate(180deg)';
            } else {
                helpContent.style.maxHeight = '0';
                helpContent.style.padding = '0 15px';
                toggleIcon.style.transform = 'rotate(0deg)';
            }
        });

        // Setup prominent tutorial button
        const tutorialBtn = document.getElementById('btn-start-tutorial');
        if (tutorialBtn) {
            // Hover effects
            tutorialBtn.addEventListener('mouseenter', () => {
                tutorialBtn.style.transform = 'translateY(-2px)';
                tutorialBtn.style.boxShadow = '0 6px 20px rgba(97, 218, 251, 0.5)';
                tutorialBtn.style.background = 'linear-gradient(135deg, #3d6ca8 0%, #2c5282 100%)';
            });
            tutorialBtn.addEventListener('mouseleave', () => {
                tutorialBtn.style.transform = 'translateY(0)';
                tutorialBtn.style.boxShadow = '0 4px 15px rgba(97, 218, 251, 0.3)';
                tutorialBtn.style.background = 'linear-gradient(135deg, #2c5282 0%, #1a365d 100%)';
            });
            
            // Click handler
            tutorialBtn.addEventListener('click', () => {
                sessionStorage.removeItem('tutorial_skip_once');
                sessionStorage.setItem('tutorial_last_choice', 'tutorial');
                closeWelcomeModal();

                // Launch tutorial
                if (window.tutorialManager) {
                    setTimeout(() => {
                        window.tutorialManager.start();
                    }, 300);
                }
            });
        }

        // Setup tutorial launch link (inside help section - keep for backwards compat)
        const tutorialLink = document.getElementById('launch-tutorial-link');
        if (tutorialLink) {
            tutorialLink.addEventListener('click', (e) => {
                e.preventDefault();
                sessionStorage.removeItem('tutorial_skip_once');
                sessionStorage.setItem('tutorial_last_choice', 'tutorial');
                closeWelcomeModal();

                // Launch tutorial
                if (window.tutorialManager) {
                    setTimeout(() => {
                        window.tutorialManager.start();
                    }, 300);
                }
            });
        }
        
        // Setup direct explore button
        const exploreBtn = document.getElementById('btn-explore');
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                 // Explicit user choice: explore directly, do not auto-start tutorial this session.
                 sessionStorage.setItem('tutorial_skip_once', 'true');
                 sessionStorage.setItem('tutorial_last_choice', 'explore');
                 closeWelcomeModal();
            });
            
            // Hover
            exploreBtn.addEventListener('mouseenter', () => {
                exploreBtn.style.color = '#fff';
                exploreBtn.style.borderColor = '#ccc';
            });
            exploreBtn.addEventListener('mouseleave', () => {
                exploreBtn.style.color = '#ccc';
                exploreBtn.style.borderColor = '#555';
            });
        }
    };

    // Wait for i18n to be completely ready
    const checkAndShow = (attempt = 0) => {
         const i18nReady =
             window.i18n &&
             window.i18n.isInitialized &&
             window.i18n.translations &&
             Object.keys(window.i18n.translations).length > 0;

         if (i18nReady) {
              showModal();
              return;
         }

         // Fallback path: do not block modal forever if language init is delayed or unavailable.
         if (attempt >= 50) {
             console.warn('[Welcome] i18n readiness timeout, rendering with fallback strings.');
             showModal();
             return;
         }

         setTimeout(() => checkAndShow(attempt + 1), 80);
    };

    // Initial Check
    if (window.i18n && window.i18n.isInitialized) {
         checkAndShow();
    } else {
         // Poll briefly if initialization is in progress but not exposed yet
         // or wait for DOMContentLoaded which initialized i18n
         // Actually i18n.js runs before us usually, but init is async.
         setTimeout(checkAndShow, 100);
    }
}

const pendingWelcomeState = consumePendingWelcomeState();
if (pendingWelcomeState !== null) {
    setTimeout(() => {
        showWelcomeModal(pendingWelcomeState);
    }, 0);
}
