/**
 * NeuroLearn AI — Story Mode Renderer
 * Renders manga-style asymmetric bento-grid comic panels
 * Each panel has AI-generated images, speech bubbles, and read-aloud
 */

class StoryModeRenderer {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector);
        this.panels = [];
        this.storyTitle = '';
        this.readAloudScript = '';
        this.currentPanel = 0;
        this.isLoading = false;
        this.isReading = false;
        this.audioEl = null;  // HTML5 Audio element for backend TTS
    }

    /**
     * Show loading state while story generates
     */
    showLoading() {
        if (!this.container) return;
        this.isLoading = true;
        
        this.container.innerHTML = `
            <div class="story-loading">
                <div class="story-loading-spinner">
                    <div class="story-loading-ring"></div>
                    <div class="story-loading-icon">📖</div>
                </div>
                <h3 class="story-loading-title">Crafting Your Story...</h3>
                <p class="story-loading-sub">Our AI sensei is drawing a manga adventure just for you!</p>
                <div class="story-loading-steps">
                    <div class="story-loading-step active" id="story-step-1">
                        <i class="fas fa-pen-fancy"></i> Writing story panels...
                    </div>
                    <div class="story-loading-step" id="story-step-2">
                        <i class="fas fa-paint-brush"></i> Generating manga art...
                    </div>
                    <div class="story-loading-step" id="story-step-3">
                        <i class="fas fa-magic"></i> Assembling comic...
                    </div>
                </div>
            </div>
        `;
        this.container.classList.remove('hidden');
    }

    /**
     * Update loading step progress
     */
    updateLoadingStep(step) {
        for (let i = 1; i <= 3; i++) {
            const el = document.getElementById(`story-step-${i}`);
            if (el) {
                el.classList.toggle('active', i === step);
                el.classList.toggle('done', i < step);
            }
        }
    }

    /**
     * Render the manga story with panels
     */
    render(storyData) {
        if (!this.container || !storyData) return;
        
        this.storyTitle = storyData.story_title || 'Learning Adventure';
        this.panels = storyData.panels || [];
        this.readAloudScript = storyData.read_aloud_script || '';
        this.isLoading = false;
        
        const panelsHTML = this.panels.map((panel, idx) => {
            const sizeClass = `manga-panel-${panel.panel_size || 'medium'}`;
            const imageContent = panel.image_data 
                ? `<img src="data:image/png;base64,${panel.image_data}" alt="Panel ${panel.panel_number}" class="manga-panel-image" />`
                : `<div class="manga-panel-placeholder">
                        <div class="manga-placeholder-icon">🎨</div>
                        <span>Panel ${panel.panel_number}</span>
                   </div>`;
            
            return `
                <div class="manga-panel ${sizeClass}" data-panel="${idx}" style="animation-delay: ${idx * 0.15}s">
                    <div class="manga-panel-inner">
                        ${imageContent}
                        
                        <div class="manga-panel-overlay">
                            <div class="manga-panel-number">${panel.panel_number}</div>
                            
                            ${panel.sfx ? `<div class="manga-sfx">${panel.sfx}</div>` : ''}
                            
                            <div class="manga-speech-bubble">
                                <p class="manga-dialogue">${panel.dialogue || ''}</p>
                            </div>
                            
                            <div class="manga-concept-tag">
                                <i class="fas fa-lightbulb"></i> ${panel.concept_taught || ''}
                            </div>
                        </div>
                        
                        <button class="manga-panel-read-btn" onclick="storyMode.readPanel(${idx})" title="Read aloud">
                            <i class="fas fa-volume-up"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        this.container.innerHTML = `
            <div class="story-mode-wrapper">
                <div class="story-mode-header">
                    <div class="story-mode-title-row">
                        <h2 class="story-mode-title">
                            <span class="story-mode-badge">📖 STORY MODE</span>
                            ${this.storyTitle}
                        </h2>
                        <div class="story-mode-controls">
                            <button class="story-control-btn" onclick="storyMode.readAll()" id="story-read-all-btn" title="Read entire story aloud">
                                <i class="fas fa-play"></i> Read Aloud
                            </button>
                            <button class="story-control-btn story-control-close" onclick="storyMode.close()" title="Return to normal mode">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <p class="story-mode-subtitle">This chapter's content told through an exciting manga story! 🎌</p>
                </div>
                
                <div class="manga-grid">
                    ${panelsHTML}
                </div>
                
                <div class="story-mode-footer">
                    <button class="btn-primary story-continue-btn" onclick="storyMode.complete()">
                        I've Read the Story! Continue <i class="fas fa-arrow-right ml-2"></i>
                    </button>
                </div>
            </div>
        `;

        this.container.classList.remove('hidden');
        
        // Animate panels in
        setTimeout(() => {
            document.querySelectorAll('.manga-panel').forEach(p => {
                p.classList.add('manga-panel-visible');
            });
        }, 100);
    }

    /**
     * Clean dialogue text for TTS — strips character name prefixes like "Name: "
     * and removes stray panel-number lines so TTS doesn't read "colon" or numbers.
     */
    cleanForTTS(text) {
        if (!text) return '';
        // Remove lines that are ONLY a number (panel number artifacts)
        let cleaned = text.split('\n')
            .map(line => line.trim())
            .filter(line => !/^\d+$/.test(line))
            .join(' ');
        // Strip "Character Name: " prefixes (works for any language including Marathi/Hindi)
        // Pattern: one or more non-colon words, then a colon+space at start of a sentence
        cleaned = cleaned.replace(/[^.!?]*?:\s+/g, ' ');
        // Collapse multiple spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned;
    }

    /**
     * Stop any currently playing audio
     */
    stopAudio() {
        if (this.audioEl) {
            this.audioEl.pause();
            this.audioEl.src = '';
            this.audioEl = null;
        }
        this.isReading = false;
    }

    /**
     * Send text to backend edge-tts and play the returned audio stream.
     * Uses Microsoft Neural voices (mr-IN-AarohiNeural, hi-IN-SwaraNeural, etc.)
     * which work for ALL languages regardless of what's installed on the OS.
     * @param {string} text - cleaned text to speak
     * @param {Function} onEnd - callback when audio finishes
     */
    async speakViaBackend(text, onEnd) {
        const lang = window.preferredLanguage || 'en';
        const voice = window.userVoice || 'standard_female';

        try {
            const response = await fetch('/api/tts/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, lang, voice })
            });

            if (!response.ok) throw new Error(`TTS server error: ${response.status}`);

            // Convert streamed response to a blob URL for the Audio element
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            this.audioEl = new Audio(url);
            this.audioEl.onended = () => {
                URL.revokeObjectURL(url);
                this.isReading = false;
                if (onEnd) onEnd();
            };
            this.audioEl.onerror = () => {
                URL.revokeObjectURL(url);
                this.isReading = false;
                if (onEnd) onEnd();
            };
            this.audioEl.play();

        } catch (err) {
            console.error('[TTS] Backend TTS failed:', err);
            this.isReading = false;
            if (onEnd) onEnd();
        }
    }

    /**
     * Read a single panel aloud via backend edge-tts
     */
    readPanel(panelIndex) {
        if (this.isReading) {
            this.stopAudio();
            document.querySelectorAll('.manga-panel').forEach(p => p.classList.remove('manga-panel-reading'));
            return;
        }

        const panel = this.panels[panelIndex];
        if (!panel || !panel.dialogue) return;

        // Highlight current panel
        document.querySelectorAll('.manga-panel').forEach(p => p.classList.remove('manga-panel-reading'));
        const panelEl = document.querySelector(`[data-panel="${panelIndex}"]`);
        if (panelEl) panelEl.classList.add('manga-panel-reading');

        this.isReading = true;
        this.speakViaBackend(this.cleanForTTS(panel.dialogue), () => {
            if (panelEl) panelEl.classList.remove('manga-panel-reading');
        });
    }

    /**
     * Read the entire story aloud via backend edge-tts
     */
    readAll() {
        const btn = document.getElementById('story-read-all-btn');

        if (this.isReading) {
            this.stopAudio();
            document.querySelectorAll('.manga-panel').forEach(p => p.classList.remove('manga-panel-reading'));
            if (btn) btn.innerHTML = '<i class="fas fa-play"></i> Read Aloud';
            return;
        }

        const rawText = this.readAloudScript || this.panels.map(p => p.dialogue).join('. ');
        const text = this.cleanForTTS(rawText);
        if (!text) return;

        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading Audio...';

        // Animate through panels while audio plays
        let panelIdx = 0;
        let panelHighlighter = null;

        this.isReading = true;
        this.speakViaBackend(text, () => {
            // On end — clean up
            if (panelHighlighter) clearInterval(panelHighlighter);
            document.querySelectorAll('.manga-panel').forEach(p => p.classList.remove('manga-panel-reading'));
            if (btn) btn.innerHTML = '<i class="fas fa-play"></i> Read Aloud';
        });

        // Start panel highlighter after a short delay (audio starts playing)
        setTimeout(() => {
            if (!this.isReading) return;
            if (btn) btn.innerHTML = '<i class="fas fa-stop"></i> Stop Reading';
            const timePerPanel = (text.split(' ').length / 2.5) / this.panels.length * 1000;
            panelHighlighter = setInterval(() => {
                if (!this.isReading || panelIdx >= this.panels.length) {
                    clearInterval(panelHighlighter);
                    return;
                }
                document.querySelectorAll('.manga-panel').forEach(p => p.classList.remove('manga-panel-reading'));
                const el = document.querySelector(`[data-panel="${panelIdx}"]`);
                if (el) {
                    el.classList.add('manga-panel-reading');
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                panelIdx++;
            }, timePerPanel);
        }, 800);
    }

    /**
     * Close story mode, return to normal
     */
    close() {
        if (this.isReading) {
            this.stopAudio();
        }
        
        this.container.classList.add('hidden');
        
        // Dispatch event for learn.js to handle
        document.dispatchEvent(new CustomEvent('story-mode-close'));
    }

    /**
     * Mark story as complete
     */
    complete() {
        this.close();
        document.dispatchEvent(new CustomEvent('story-mode-complete'));
    }

    /**
     * Hide the container
     */
    hide() {
        if (this.container) this.container.classList.add('hidden');
    }

    /**
     * Show the container
     */
    show() {
        if (this.container) this.container.classList.remove('hidden');
    }
}

// Global instance
window.storyMode = null;
