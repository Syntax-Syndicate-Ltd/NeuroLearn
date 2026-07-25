/**
 * AccessibilityEngine — NeuroLearn AI
 * Profile-driven WCAG 2.1 AA compliant UI adaptation system.
 * Reads from window.NEURO_PROFILE and applies DOM modifications on every page load.
 */
class AccessibilityEngine {
    constructor(profile) {
        this.profile = profile || {};
        this.root = document.documentElement;
        this.body = document.body;
    }

    init() {
        this.applyDyslexiaMode();
        this.applyReducedMotion();
        this.applyLowStimulationMode();
        this.applyFontScaling();
        this.applyColorOverlay();
        this.applyFocusStyles();
        this.applyAriaEnhancements();
        this.applyVoiceFirstMode();
        this.applyAnxietyMode();
        this.setupKeyboardShortcuts();
        console.log('[AccessibilityEngine] Initialised with profile:', Object.keys(this.profile).filter(k => this.profile[k] === true));
    }

    applyDyslexiaMode() {
        if (!this.profile.has_dyslexia) return;

        const style = document.createElement('style');
        style.id = 'dyslexia-styles';

        let css = `
            body, p, li, td, span, label, input, select, textarea, button {
                font-family: 'OpenDyslexic', 'Lexie Readable', 'Comic Sans MS', system-ui, sans-serif !important;
                letter-spacing: 0.12em !important;
                word-spacing: 0.16em !important;
            }
            p, li, .narration-text {
                line-height: 1.9 !important;
                text-align: left !important;
            }
            em, i { font-style: normal !important; font-weight: 500 !important; }
        `;

        if (this.profile.dyslexia_tracking) {
            css += `
                p { max-width: 65ch !important; }
                .narration-para {
                    padding: 12px 0 !important;
                    border-bottom: 1px dashed rgba(255,255,255,0.08) !important;
                }
            `;
        }

        style.textContent = css;
        document.head.appendChild(style);
        this.body.setAttribute('data-dyslexia', 'true');
        this.root.style.setProperty('--reading-line-height', '1.9');
    }

    applyReducedMotion() {
        const needsReduced = this.profile.sensory_visual || this.profile.sensory_sensitive || this.profile.autism_predictability;
        if (!needsReduced) return;

        const style = document.createElement('style');
        style.id = 'reduced-motion-styles';
        style.textContent = `
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
            .animate-pulse-glow, .animate-float, [class*="animate-"] {
                animation: none !important;
            }
        `;
        document.head.appendChild(style);
        this.body.setAttribute('data-reduced-motion', 'true');
    }

    applyLowStimulationMode() {
        const needsLow = this.profile.sensory_clutter || this.profile.sensory_visual || this.profile.autism_predictability;
        if (!needsLow) return;

        document.querySelectorAll('.decorative, .bg-gradient, [class*="particle"]').forEach(el => {
            el.style.display = 'none';
        });

        // Also hide the particle container
        const particleContainer = document.getElementById('particle-container');
        if (particleContainer) particleContainer.style.display = 'none';

        const style = document.createElement('style');
        style.id = 'low-stim-styles';
        style.textContent = `
            .glass {
                background: rgba(0,0,0,0.4) !important;
                backdrop-filter: none !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
            }
            [class*="shadow"] { box-shadow: none !important; }
            body { background: #0f0f13 !important; }
            .dot { display: none !important; }
        `;
        document.head.appendChild(style);
        this.body.setAttribute('data-low-stim', 'true');
    }

    applyFontScaling() {
        // Restore saved font size from localStorage
        const savedFont = localStorage.getItem('nl_font_size');
        if (savedFont) {
            this.body.style.fontSize = savedFont;
        }

        // If processing speed is slow, slightly increase base font
        if (this.profile.slow_processing && !savedFont) {
            this.body.style.fontSize = '18px';
        }
    }

    applyColorOverlay() {
        if (!this.profile.irlen_syndrome) return;

        const overlay = document.createElement('div');
        overlay.id = 'irlen-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(255, 220, 100, 0.08);
            pointer-events: none; z-index: 9998;
            mix-blend-mode: multiply;
        `;
        document.body.appendChild(overlay);

        const colorBtn = document.createElement('button');
        colorBtn.id = 'overlay-toggle';
        colorBtn.innerHTML = '<span aria-hidden="true">🔆</span> Overlay: ON';
        colorBtn.setAttribute('aria-label', 'Toggle colour overlay for reading comfort — currently on');
        colorBtn.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:9999;padding:8px 14px;font-size:12px;background:rgba(0,0,0,0.7);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:8px;cursor:pointer;min-width:44px;min-height:44px;';
        colorBtn.addEventListener('click', () => {
            const isOn = overlay.style.display !== 'none';
            overlay.style.display = isOn ? 'none' : 'block';
            colorBtn.innerHTML = isOn ? '<span aria-hidden="true">🔆</span> Overlay: OFF' : '<span aria-hidden="true">🔆</span> Overlay: ON';
            colorBtn.setAttribute('aria-label', `Toggle colour overlay for reading comfort — currently ${isOn ? 'off' : 'on'}`);
        });
        document.body.appendChild(colorBtn);
    }

    applyFocusStyles() {
        const style = document.createElement('style');
        style.id = 'focus-styles';
        style.textContent = `
            :focus-visible {
                outline: 3px solid #7c3aed !important;
                outline-offset: 3px !important;
                box-shadow: 0 0 0 5px rgba(124,58,237,0.25) !important;
            }
            a:focus-visible, button:focus-visible, input:focus-visible,
            select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
                outline: 3px solid #7c3aed !important;
                outline-offset: 3px !important;
            }
        `;
        document.head.appendChild(style);
    }

    applyAriaEnhancements() {
        // Ensure all images have alt text or role=presentation
        document.querySelectorAll('img:not([alt])').forEach(img => {
            img.setAttribute('alt', '');
            img.setAttribute('role', 'presentation');
        });

        // Ensure buttons without text have aria-label
        document.querySelectorAll('button').forEach(btn => {
            if (!btn.getAttribute('aria-label') && !btn.textContent.trim()) {
                btn.setAttribute('aria-label', 'Action button');
            }
        });

        // Set role=main on main content if missing
        if (!document.querySelector('[role="main"]')) {
            const mainContent = document.querySelector('main, .main-content, #content, .content');
            if (mainContent) mainContent.setAttribute('role', 'main');
        }

        // Add landmark roles
        const nav = document.querySelector('nav');
        if (nav && !nav.getAttribute('role')) {
            nav.setAttribute('role', 'navigation');
            nav.setAttribute('aria-label', 'Main navigation');
        }
    }

    applyVoiceFirstMode() {
        if (!this.profile.voice_first_input) return;

        document.querySelectorAll('textarea, input[type="text"]').forEach(input => {
            if (input.closest('.pf-wizard')) return; // Skip parent form inputs
            if (!input.nextElementSibling?.classList.contains('voice-btn')) {
                const btn = document.createElement('button');
                btn.className = 'voice-btn';
                btn.setAttribute('aria-label', 'Speak your answer');
                btn.setAttribute('type', 'button');
                btn.innerHTML = '<i class="fas fa-microphone" aria-hidden="true"></i>';
                btn.style.cssText = 'min-width:44px;min-height:44px;margin-left:8px;padding:8px;background:rgba(124,58,237,0.2);border:1px solid rgba(124,58,237,0.4);border-radius:8px;cursor:pointer;color:#7c3aed;display:inline-flex;align-items:center;justify-content:center;';
                input.parentNode.insertBefore(btn, input.nextSibling);
                btn.addEventListener('click', () => this._startSpeechRecognition(input));
            }
        });
    }

    applyAnxietyMode() {
        if (!this.profile.has_anxiety) return;

        // Hide leaderboard if configured
        if (this.profile.hide_leaderboard) {
            document.querySelectorAll('[id*="leaderboard"], [class*="leaderboard"], [class*="rank"]').forEach(el => {
                el.style.display = 'none';
            });
        }

        // Hide timers for anxious learners
        document.querySelectorAll('[id*="timer"], [class*="timer"], [class*="countdown"]').forEach(el => {
            el.style.display = 'none';
        });

        const style = document.createElement('style');
        style.id = 'anxiety-styles';
        style.textContent = `
            .wrong, .incorrect, [class*="error"]:not(input):not(.field-error) {
                background: rgba(6, 182, 212, 0.15) !important;
                border-color: rgba(6, 182, 212, 0.4) !important;
            }
        `;
        document.head.appendChild(style);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Alt+R: Toggle audio playback
            if (e.altKey && e.key === 'r') {
                e.preventDefault();
                const audioEl = document.querySelector('audio');
                if (audioEl) { audioEl.paused ? audioEl.play() : audioEl.pause(); }
            }
            // Alt+B: Take a break
            if (e.altKey && e.key === 'b') {
                e.preventDefault();
                const breakBtn = document.querySelector('#break-btn, [data-action="break"]');
                if (breakBtn) breakBtn.click();
            }
            // Escape: Close overlays/modals
            if (e.key === 'Escape') {
                document.querySelectorAll('.overlay, .modal, [class*="popup"]').forEach(el => {
                    el.style.display = 'none';
                });
            }
        });

        // Skip to main content link
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.textContent = 'Skip to main content';
        skipLink.className = 'skip-to-main';
        skipLink.style.cssText = 'position:absolute;top:-100px;left:0;z-index:10000;padding:12px 20px;background:#7c3aed;color:white;font-weight:bold;border-radius:0 0 8px 0;transition:top .15s;font-size:14px;text-decoration:none;';
        skipLink.addEventListener('focus', () => { skipLink.style.top = '0'; });
        skipLink.addEventListener('blur', () => { skipLink.style.top = '-100px'; });
        document.body.insertBefore(skipLink, document.body.firstChild);
    }

    _startSpeechRecognition(targetInput) {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
            return;
        }
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SR();
        recognition.lang = document.documentElement.lang || 'en-IN';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onresult = (event) => {
            targetInput.value = event.results[0][0].transcript;
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        };
        recognition.onerror = (event) => {
            console.warn('[AccessibilityEngine] Speech recognition error:', event.error);
        };
        recognition.start();
    }
}
