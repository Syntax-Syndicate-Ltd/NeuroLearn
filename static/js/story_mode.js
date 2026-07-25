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
        this.speechSynth = window.speechSynthesis;
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
     * Read a single panel aloud using browser TTS
     */
    readPanel(panelIndex) {
        if (this.isReading) {
            this.speechSynth.cancel();
            this.isReading = false;
            return;
        }
        
        const panel = this.panels[panelIndex];
        if (!panel || !panel.dialogue) return;
        
        const utterance = new SpeechSynthesisUtterance(panel.dialogue);
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        utterance.lang = 'en-US';
        
        // Highlight current panel
        document.querySelectorAll('.manga-panel').forEach(p => p.classList.remove('manga-panel-reading'));
        const panelEl = document.querySelector(`[data-panel="${panelIndex}"]`);
        if (panelEl) panelEl.classList.add('manga-panel-reading');
        
        utterance.onend = () => {
            this.isReading = false;
            if (panelEl) panelEl.classList.remove('manga-panel-reading');
        };
        
        this.isReading = true;
        this.speechSynth.speak(utterance);
    }

    /**
     * Read the entire story aloud
     */
    readAll() {
        if (this.isReading) {
            this.speechSynth.cancel();
            this.isReading = false;
            const btn = document.getElementById('story-read-all-btn');
            if (btn) btn.innerHTML = '<i class="fas fa-play"></i> Read Aloud';
            return;
        }
        
        const text = this.readAloudScript || this.panels.map(p => p.dialogue).join('. ');
        if (!text) return;
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        utterance.pitch = 1.05;
        utterance.lang = 'en-US';
        
        const btn = document.getElementById('story-read-all-btn');
        if (btn) btn.innerHTML = '<i class="fas fa-stop"></i> Stop Reading';
        
        // Animate through panels as reading progresses
        let panelIdx = 0;
        const wordsPerPanel = text.split(' ').length / this.panels.length;
        const timePerPanel = (text.split(' ').length / 2.5) / this.panels.length * 1000; // ~2.5 words/sec
        
        const panelHighlighter = setInterval(() => {
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
        
        utterance.onend = () => {
            this.isReading = false;
            clearInterval(panelHighlighter);
            document.querySelectorAll('.manga-panel').forEach(p => p.classList.remove('manga-panel-reading'));
            if (btn) btn.innerHTML = '<i class="fas fa-play"></i> Read Aloud';
        };
        
        this.isReading = true;
        this.speechSynth.speak(utterance);
    }

    /**
     * Close story mode, return to normal
     */
    close() {
        if (this.isReading) {
            this.speechSynth.cancel();
            this.isReading = false;
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
