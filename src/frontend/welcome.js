// welcome.js - Handles the "Empty State" or "Welcome" experience for new users.
// Now with i18n support and expandable help section

document.addEventListener('DOMContentLoaded', () => {
    // Check if graphData is empty or missing
    // graphData is defined in data.js which is loaded before this.
    // However, if data.js was generated with 0 nodes, we should show the welcome screen.
    
    // Safety check for graphData existence
    if (typeof graphData === 'undefined' || !graphData || !graphData.nodes || graphData.nodes.length === 0) {
        showWelcomeModal();
    }
});

function showWelcomeModal() {
    // Check if modal already exists (to prevent duplicates)
    if (document.getElementById('welcome-modal')) return;

    // Wait for i18n to initialize
    const showModal = () => {
        const t = window.i18n.t.bind(window.i18n);

        // Create Modal HTML
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'welcome-modal';
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.display = 'flex'; // Force show
        modalOverlay.style.zIndex = '2000'; // Top level

        modalOverlay.innerHTML = `
            <div class="modal-content" style="max-width: 600px; text-align: center;">
                <div class="modal-header" style="justify-content: center;">
                    <h2 data-i18n="welcome.title">${t('welcome.title')}</h2>
                </div>
                <div class="modal-body">
                    <p style="font-size: 1.1rem; color: #ccc; margin-bottom: 5px;" data-i18n="welcome.subtitle">
                        ${t('welcome.subtitle')}
                    </p>
                    <p style="font-size: 1.1rem; color: #ccc; margin-bottom: 25px;" data-i18n="welcome.subtitle2">
                        ${t('welcome.subtitle2')}
                    </p>
                    
                    <div style="background: #333; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="margin-top: 0; color: #61dafb;" data-i18n="welcome.step1.title">${t('welcome.step1.title')}</h3>
                        <p style="font-size: 0.9rem; color: #aaa;" data-i18n="welcome.step1.description">
                            ${t('welcome.step1.description')}
                        </p>
                    </div>

                    <div style="background: #333; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="margin-top: 0; color: #61dafb;" data-i18n="welcome.step2.title">${t('welcome.step2.title')}</h3>
                        <p style="font-size: 0.9rem; color: #aaa;" data-i18n="welcome.step2.description">
                            ${t('welcome.step2.description')}
                        </p>
                    </div>

                    <p style="font-size: 0.9rem; color: #888; margin-bottom: 20px;" data-i18n="welcome.tip">
                        ${t('welcome.tip')}
                    </p>

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
                                <p style="margin-bottom: 10px;" data-i18n="welcome.helpContent.step1">
                                    ${t('welcome.helpContent.step1')}
                                </p>
                                <p style="margin-bottom: 10px;" data-i18n="welcome.helpContent.step2">
                                    ${t('welcome.helpContent.step2')}
                                </p>
                                <p style="margin-bottom: 10px;" data-i18n="welcome.helpContent.step3">
                                    ${t('welcome.helpContent.step3')}
                                </p>
                                <p style="margin-bottom: 10px;" data-i18n="welcome.helpContent.step4">
                                    ${t('welcome.helpContent.step4')}
                                </p>
                                <p style="margin-bottom: 15px;" data-i18n="welcome.helpContent.step5">
                                    ${t('welcome.helpContent.step5')}
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

        // Setup tutorial launch link
        const tutorialLink = document.getElementById('launch-tutorial-link');
        if (tutorialLink) {
            tutorialLink.addEventListener('click', (e) => {
                e.preventDefault();
                // Close welcome modal
                const modal = document.getElementById('welcome-modal');
                if (modal) modal.remove();
                
                // Remove highlight
                if (sourceControl) {
                    sourceControl.style.boxShadow = '';
                    sourceControl.style.zIndex = '';
                }

                // Launch tutorial
                if (window.tutorialManager) {
                    setTimeout(() => {
                        window.tutorialManager.start();
                    }, 300);
                }
            });
        }
    };

    // Wait for i18n to be completely ready
    const checkAndShow = () => {
         if (window.i18n && window.i18n.isInitialized && Object.keys(window.i18n.translations).length > 0) {
              showModal();
         } else {
              // If not ready, listen for the next change
              window.i18n.onLanguageChange(() => {
                   // This ensures we have translations
                   showModal();
              });
         }
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
