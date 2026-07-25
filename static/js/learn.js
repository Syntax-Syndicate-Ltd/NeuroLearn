// NeuroLearn AI — Learn Page Controller
// Handles audio playback, text sync, ambient audio, visualizations,
// AND emotion detection + adaptive mode switching (Normal/Simple/Story)

class NeuroLearnLearnManager {
    constructor() {
        this.audio = document.getElementById('audio-element');
        this.btnPlay = document.getElementById('btn-play');
        this.canvas = document.getElementById('viz-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.textContainer = document.getElementById('text-container');
        this.continuePanel = document.getElementById('continue-panel');
        
        this.sentences = [];
        this.sentenceTimes = [];
        this.activeIdx = -1;
        this.mermaidReady = false;
        this.listenedPercentage = 0;
        
        // Tone.js
        this.ambientSynth = null;
        this.isAmbienceStarted = false;
        
        // Audio stream state
        this.audioReady = false;
        this.audioLoading = false;
        
        // Audio context for visualizer
        this.audioContext = null;
        this.analyser = null;
        
        // === ADAPTIVE MODE STATE ===
        this.currentMode = 'normal'; // 'normal', 'simple', 'story'
        this.emotionDetector = null;
        this.storyRenderer = null;
        this.simpleRenderer = null;
        this.modeSwitchCooldown = false; // Prevent rapid switching
        this.storyDataCache = null;     // Cache story data after first generation
        this.simpleDataCache = null;    // Cache simple data after first generation
        
        this.init();
    }

    async init() {
        try {
            console.log("🚀 [LEARN-INIT] Initializing Learn Manager...");
            
            if (!window.chapterData || !window.chapterData.narration_script) {
                throw new Error("Chapter data not loaded properly.");
            }
            
            this.parseScript();
            this.setupMermaid();
            this.setupEvents();
            this.setupAmbientAudio();
            this.initVisualizer();
            
            // Load audio asynchronously
            this.loadAudio();
            
            // === INITIALIZE ADAPTIVE MODULES ===
            this.initEmotionDetector();
            this.initModeRenderers();
            this.setupModeEvents();
            
            console.log("✓ [LEARN-INIT] Learn Manager Initialized Successfully");
        } catch (error) {
            console.error("✗ [LEARN-INIT] Critical Error:", error);
            const glassContainer = document.querySelector('.glass');
            if (glassContainer) {
                glassContainer.innerHTML = `
                    <div class="text-center py-12">
                        <p class="text-rose text-lg mb-4">❌ Error Loading Chapter</p>
                        <p class="text-secondary mb-6">${error.message}</p>
                        <a href="/chapters" class="btn-primary">Return to Chapters</a>
                    </div>
                `;
            }
        }
    }

    // ============================
    // EMOTION DETECTION INTEGRATION
    // ============================

    initEmotionDetector() {
        console.log("🎥 [MODE] Initializing Emotion Detector...");
        
        this.emotionDetector = new EmotionDetector({
            chapterId: window.chapterData?.chapter_id,
            onStateChange: (newState, prevState, confidence) => {
                this.handleEmotionChange(newState, prevState, confidence);
            },
            onReady: () => {
                console.log("✓ [MODE] Emotion detector ready");
            }
        });
        
        // Initialize with startup notification
        this.emotionDetector.init('#emotion-detector-container');
    }

    initModeRenderers() {
        // Story Mode
        this.storyRenderer = new StoryModeRenderer('#story-mode-container');
        window.storyMode = this.storyRenderer;
        
        // Simple Mode
        this.simpleRenderer = new SimpleModeRenderer('#simple-mode-container');
        window.simpleMode = this.simpleRenderer;
    }

    setupModeEvents() {
        // Listen for mode close events
        document.addEventListener('story-mode-close', () => {
            this.switchToNormal();
        });
        
        document.addEventListener('simple-mode-close', () => {
            this.switchToNormal();
        });
        
        document.addEventListener('story-mode-complete', () => {
            this.switchToNormal();
            this.revealContinue();
        });
        
        document.addEventListener('simple-mode-complete', () => {
            this.switchToNormal();
            this.revealContinue();
        });

        // === FEATURE 3: NEUROSUPPORT INTERVENTION LISTENER ===
        document.addEventListener('neurosupport', (e) => {
            const { simplified_narration, message } = e.detail;
            console.log('🌿 [LEARN] Neurosupport event received');

            // Pause audio
            if (this.audio && !this.audio.paused) {
                this.audio.pause();
                this.btnPlay.innerHTML = '<i class="fas fa-play ml-1"></i>';
            }

            // Show calming overlay
            this._showNeuroSupportOverlay(simplified_narration, message);
        });
    }

    _showNeuroSupportOverlay(simplifiedNarration, message) {
        // Remove existing overlay if any
        const existingOverlay = document.getElementById('neurosupport-overlay');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'neurosupport-overlay';
        overlay.className = 'neurosupport-overlay';
        overlay.innerHTML = `
            <div class="neurosupport-card">
                <div class="neurosupport-emoji">🌿</div>
                <h3 class="neurosupport-title">Taking a moment for you</h3>
                <p class="neurosupport-message">${message || 'Let me simplify this content to make it more comfortable for you.'}</p>
                <div class="neurosupport-actions">
                    <button id="neurosupport-simplify" class="neurosupport-btn neurosupport-btn-simplify">
                        <i class="fas fa-feather-alt" style="margin-right:6px"></i> Simplify this section
                    </button>
                    <button id="neurosupport-continue" class="neurosupport-btn neurosupport-btn-continue">
                        I'm okay, continue
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Simplify button
        document.getElementById('neurosupport-simplify').addEventListener('click', () => {
            overlay.remove();
            this._applySimplifiedContent(simplifiedNarration);
        });

        // Continue button
        document.getElementById('neurosupport-continue').addEventListener('click', () => {
            overlay.remove();
            // Resume audio
            if (this.audio && this.audio.paused && this.audioReady) {
                this.audio.play().catch(() => {});
                this.btnPlay.innerHTML = '<i class="fas fa-pause"></i>';
            }
        });
    }

    _applySimplifiedContent(simplifiedNarration) {
        if (!simplifiedNarration) return;

        console.log('🌿 [LEARN] Applying simplified narration');

        // Update the narration script in window data
        window.chapterData.narration_script = simplifiedNarration;

        // Re-parse the text display
        this.parseScript();

        // Reload audio with simplified text
        const chapterId = window.chapterData?.chapter_id;
        if (chapterId) {
            // Re-stream with original voice settings
            this.loadAudio();
        }

        // Show a brief notification
        this.showAudioStatus('✨ Content simplified for you', 'loading');
    }

    handleEmotionChange(newState, prevState, confidence) {
        console.log(`🧠 [MODE-SWITCH] Emotion: ${prevState} → ${newState} (${(confidence * 100).toFixed(0)}%)`);
        
        // Don't switch during cooldown
        if (this.modeSwitchCooldown) {
            console.log("⏳ [MODE-SWITCH] Cooldown active, skipping");
            return;
        }
        
        // Determine target mode
        let targetMode = 'normal';
        
        if (newState === 'bored' || newState === 'distracted') {
            targetMode = 'simple';
        } else if (newState === 'stressed' || newState === 'anxious') {
            targetMode = 'story';
        } else {
            targetMode = 'normal';
        }
        
        // Only switch if mode actually changed
        if (targetMode !== this.currentMode) {
            this.switchMode(targetMode, newState);
        }
    }

    async switchMode(targetMode, emotion) {
        console.log(`🔄 [MODE-SWITCH] Switching: ${this.currentMode} → ${targetMode} (triggered by: ${emotion})`);
        
        // Set cooldown (30 seconds) to prevent rapid flipping
        this.modeSwitchCooldown = true;
        setTimeout(() => { this.modeSwitchCooldown = false; }, 30000);
        
        // Show notification banner
        this.showModeBanner(targetMode, emotion);
        
        // Update mode indicator
        this.updateModeIndicator(targetMode);
        
        switch (targetMode) {
            case 'simple':
                await this.switchToSimple();
                break;
            case 'story':
                await this.switchToStory();
                break;
            default:
                this.switchToNormal();
                break;
        }
        
        this.currentMode = targetMode;
    }

    showModeBanner(mode, emotion) {
        const banner = document.getElementById('mode-switch-banner');
        const icon = document.getElementById('mode-switch-icon');
        const title = document.getElementById('mode-switch-title');
        const desc = document.getElementById('mode-switch-desc');
        
        const configs = {
            simple: {
                icon: '<i class="fas fa-lightbulb"></i>',
                title: 'Switching to Simple Mode',
                desc: 'Making things easier and calmer for you...'
            },
            story: {
                icon: '<i class="fas fa-book-open"></i>',
                title: 'Switching to Story Mode',
                desc: 'Let\'s learn through an exciting manga adventure!'
            },
            normal: {
                icon: '<i class="fas fa-brain"></i>',
                title: 'Back to Normal Mode',
                desc: 'Great focus! Continuing standard learning...'
            }
        };
        
        const cfg = configs[mode] || configs.normal;
        
        if (icon) icon.innerHTML = cfg.icon;
        if (title) title.textContent = cfg.title;
        if (desc) desc.textContent = cfg.desc;
        
        banner.classList.remove('hidden');
        
        // Auto-dismiss after 5s
        setTimeout(() => {
            banner.classList.add('hidden');
        }, 5000);
    }

    updateModeIndicator(mode) {
        const indicator = document.getElementById('mode-indicator');
        const label = document.getElementById('mode-label');
        
        indicator.className = 'mode-indicator';
        
        switch (mode) {
            case 'story':
                indicator.classList.add('story-active');
                label.textContent = 'STORY';
                break;
            case 'simple':
                indicator.classList.add('simple-active');
                label.textContent = 'SIMPLE';
                break;
            default:
                label.textContent = 'NORMAL';
                break;
        }
    }

    async switchToSimple() {
        console.log("💡 [MODE] Activating Simple Mode...");
        
        // Hide normal content
        const normalContent = document.getElementById('normal-mode-content');
        if (normalContent) normalContent.classList.add('hidden');
        
        // Hide story if visible
        this.storyRenderer.hide();
        
        // Pause audio
        if (this.audio && !this.audio.paused) {
            this.audio.pause();
            this.btnPlay.innerHTML = '<i class="fas fa-play ml-1"></i>';
        }
        
        // Check cache
        if (this.simpleDataCache) {
            this.simpleRenderer.render(this.simpleDataCache);
            return;
        }
        
        // Show loading
        this.simpleRenderer.showLoading();
        
        // Fetch simplified content
        try {
            const response = await fetch('/api/generate-simple', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chapter_id: window.chapterData?.chapter_id })
            });
            
            if (!response.ok) {
                console.warn(`✗ [MODE] Simple API returned ${response.status}`);
                this.switchToNormal();
                return;
            }
            
            const data = await response.json();
            
            if (data.error) {
                console.error("✗ [MODE] Simple generation failed:", data.error);
                this.switchToNormal();
                return;
            }
            
            this.simpleDataCache = data;
            this.simpleRenderer.render(data);
            console.log("✓ [MODE] Simple Mode active");
            
        } catch (error) {
            console.error("✗ [MODE] Simple fetch error:", error);
            this.switchToNormal();
        }
    }

    async switchToStory() {
        console.log("📖 [MODE] Activating Story Mode...");
        
        // Hide normal content
        const normalContent = document.getElementById('normal-mode-content');
        if (normalContent) normalContent.classList.add('hidden');
        
        // Hide simple if visible
        this.simpleRenderer.hide();
        
        // Pause audio
        if (this.audio && !this.audio.paused) {
            this.audio.pause();
            this.btnPlay.innerHTML = '<i class="fas fa-play ml-1"></i>';
        }
        
        // Check cache
        if (this.storyDataCache) {
            this.storyRenderer.render(this.storyDataCache);
            return;
        }
        
        // Show loading
        this.storyRenderer.showLoading();
        
        // Fetch story content
        try {
            // Step 1: Writing story
            this.storyRenderer.updateLoadingStep(1);
            
            const response = await fetch('/api/generate-story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chapter_id: window.chapterData?.chapter_id })
            });
            
            if (!response.ok) {
                console.warn(`✗ [MODE] Story API returned ${response.status}`);
                this.switchToNormal();
                return;
            }
            
            // Step 2: Images generating
            this.storyRenderer.updateLoadingStep(2);
            
            const data = await response.json();
            
            if (data.error) {
                console.error("✗ [MODE] Story generation failed:", data.error);
                this.switchToNormal();
                return;
            }
            
            // Step 3: Assembling
            this.storyRenderer.updateLoadingStep(3);
            
            // Short delay for visual feedback
            await new Promise(r => setTimeout(r, 500));
            
            this.storyDataCache = data;
            this.storyRenderer.render(data);
            console.log("✓ [MODE] Story Mode active");
            
        } catch (error) {
            console.error("✗ [MODE] Story fetch error:", error);
            this.switchToNormal();
        }
    }

    switchToNormal() {
        console.log("🧠 [MODE] Returning to Normal Mode...");
        
        // Show normal content
        const normalContent = document.getElementById('normal-mode-content');
        if (normalContent) normalContent.classList.remove('hidden');
        
        // Hide other modes
        this.storyRenderer.hide();
        this.simpleRenderer.hide();
        
        this.currentMode = 'normal';
        this.updateModeIndicator('normal');
    }

    // =====================
    // AUDIO & PLAYBACK
    // =====================

    setupAudioEvents() {
        this.audio.onloadedmetadata = () => {
            const hasValidDuration = this.audio.duration && !isNaN(this.audio.duration) && this.audio.duration !== Infinity;
            console.log(`✓ [AUDIO] Audio loaded: ${hasValidDuration ? this.formatTime(this.audio.duration) : 'Stream'} duration`);
            this.audioReady = true;
            this.audioLoading = false;
            
            if (hasValidDuration && this.sentences.length > 0) {
                const perSent = this.audio.duration / this.sentences.length;
                this.sentenceTimes = this.sentences.map((_, i) => i * perSent);
                document.getElementById('time-display').innerText = `0:00 / ${this.formatTime(this.audio.duration)}`;
            }
            
            this.btnPlay.disabled = false;
            this.btnPlay.innerHTML = '<i class="fas fa-play ml-1"></i>';
            this.hideAudioStatus();
            this.connectVisualizerSource();
        };

        this.audio.oncanplaythrough = () => {
            if (!this.audioReady) {
                this.audioReady = true;
                this.audioLoading = false;
                this.btnPlay.disabled = false;
                this.btnPlay.innerHTML = '<i class="fas fa-play ml-1"></i>';
                this.hideAudioStatus();
            }
        };

        this.audio.onerror = (error) => {
            console.error("❌ [AUDIO-ERROR] Failed to stream audio");
            this.showAudioStatus("Playback failed. Click READ INSTEAD.", "warning");
            this.btnPlay.disabled = false;
            this.audioLoading = false;
        };
    }

    loadAudio(forceVoice = null) {
        const chapterId = window.chapterData?.chapter_id;
        if (!chapterId) {
            this.showAudioStatus("No audio available", "warning");
            return;
        }

        const voice = forceVoice || window.userVoice || 'standard_female';
        
        this.audioLoading = true;
        this.audioReady = false;
        this.showAudioStatus("Tuning neural stream...", "loading");
        this.btnPlay.disabled = true;
        this.btnPlay.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const audioUrl = `/api/audio/stream/${chapterId}?voice=${voice}&_t=${Date.now()}`;
        console.log(`🔊 [AUDIO-LOAD] Streaming neural voice: ${voice}`);
        
        this.audio.src = audioUrl;
        this.audio.load();
        this.setupAudioEvents();
    }

    showAudioStatus(message, type) {
        let statusEl = document.getElementById('audio-status-banner');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'audio-status-banner';
            statusEl.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:1000;padding:8px 20px;border-radius:99px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;transition:all 0.3s ease;';
            document.body.appendChild(statusEl);
        }
        statusEl.style.background = type === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(124, 58, 237, 0.2)';
        statusEl.style.border = type === 'warning' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(124, 58, 237, 0.4)';
        statusEl.style.color = type === 'warning' ? '#fbbf24' : '#a78bfa';
        statusEl.innerHTML = message;
        statusEl.style.opacity = '1';
        setTimeout(() => statusEl.remove(), 3000);
    }

    hideAudioStatus() {
        const el = document.getElementById('audio-status-banner');
        if (el) el.remove();
    }

    parseScript() {
        console.log("📝 [PARSE-SCRIPT] Starting text parsing...");
        const fullScript = window.chapterData?.narration_script || "No narration provided.";
        
        const sentenceArr = fullScript.match(/[^.!?]+[.!?]+/g) || [fullScript];
        console.log(`📝 [PARSE-SCRIPT] Split into ${sentenceArr.length} sentences`);
        
        this.textContainer.innerHTML = '';
        this.sentences = [];
        
        sentenceArr.forEach((s, i) => {
            const div = document.createElement('div');
            div.className = 'sentence upcoming text-lg leading-relaxed';
            div.id = `sent-${i}`;
            div.innerText = s.trim();
            div.onclick = () => this.jumpTo(i);
            this.textContainer.appendChild(div);
            this.sentences.push(div);
        });
            
        const estimatedDuration = this.sentences.length * 5;
        const perSent = estimatedDuration / (this.sentences.length || 1);
        this.sentenceTimes = this.sentences.map((_, i) => i * perSent);
        document.getElementById('time-display').innerText = `0:00 / ~${this.formatTime(estimatedDuration)}`;
    }

    jumpTo(idx) {
        if (!this.audioReady) return;
        this.audio.currentTime = this.sentenceTimes[idx];
        if (this.audio.paused) this.togglePlay();
    }

    setupEvents() {
        this.btnPlay.onclick = () => this.togglePlay();
        
        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            this.updateTextSync(cur);
            this.updateProgressBar(cur);
            
            const hasValidDuration = this.audio.duration && !isNaN(this.audio.duration) && this.audio.duration !== Infinity;
            
            if (hasValidDuration) {
                this.listenedPercentage = Math.round((cur / this.audio.duration) * 100);
            } else {
                const estDur = this.sentences.length * 5;
                this.listenedPercentage = Math.round((cur / estDur) * 100);
            }
            
            if (this.listenedPercentage >= 80) {
                this.revealContinue();
            }
        };

        this.audio.onplay = () => this.startAmbience();
        this.audio.onpause = () => this.stopAmbience();
        
        this.audio.onended = () => {
            console.log("✓ [AUDIO] Playback ended");
            this.btnPlay.innerHTML = '<i class="fas fa-redo ml-1"></i>';
            this.listenedPercentage = 100;
            this.revealContinue();
        };

        document.getElementById('toggle-read').onclick = () => {
            this.audio.pause();
            this.stopAmbience();
            this.listenedPercentage = 100;
            this.revealContinue();
            
            this.sentences.forEach(s => {
                s.classList.remove('active', 'upcoming');
                s.classList.add('past');
            });
            this.textContainer.scrollTop = this.textContainer.scrollHeight;
        };

        const volSlider = document.getElementById('ambience-vol');
        if (volSlider) {
            volSlider.oninput = (e) => {
                if (this.ambientSynth) {
                    try { Tone.getDestination().volume.value = e.target.value; } catch (err) {}
                }
            };
        }
    }

    togglePlay() {
        if (!this.audioReady) return;
        
        if (this.audio.paused) {
            console.log("▶️ [PLAY] Starting playback");
            this.audio.play().catch(err => {
                 this.showAudioStatus("Playback blocked by browser.", "warning");
            });
            this.btnPlay.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            console.log("⏸️ [PLAY] Pausing playback");
            this.audio.pause();
            this.btnPlay.innerHTML = '<i class="fas fa-play ml-1"></i>';
        }
    }

    updateTextSync(time) {
        if (!this.sentences || this.sentences.length === 0) return;
        
        let newIdx = 0;
        for (let i = 0; i < this.sentenceTimes.length; i++) {
            if (time >= this.sentenceTimes[i]) newIdx = i;
            else break;
        }

        if (newIdx !== this.activeIdx) {
            this.activeIdx = newIdx;
            this.sentences.forEach((s, i) => {
                s.classList.remove('active', 'past', 'upcoming');
                if (i < newIdx) s.classList.add('past');
                else if (i === newIdx) {
                    s.classList.add('active');
                    s.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                else s.classList.add('upcoming');
            });
        }
    }

    updateProgressBar(time) {
        const hasValidDuration = this.audio.duration && !isNaN(this.audio.duration) && this.audio.duration !== Infinity;
        
        if (!hasValidDuration) {
            const estDur = this.sentences.length * 5;
            document.getElementById('time-display').innerText = `${this.formatTime(Math.max(0, time))} / ~${this.formatTime(estDur)}`;
            
            const percent = Math.min((time / estDur) * 100, 100);
            document.getElementById('playback-progress').style.width = `${percent}%`;
        } else {
            const percent = Math.min((time / this.audio.duration) * 100, 100);
            document.getElementById('playback-progress').style.width = `${percent}%`;
            document.getElementById('time-display').innerText = `${this.formatTime(time)} / ${this.formatTime(this.audio.duration)}`;
        }
    }

    revealContinue() {
        const panel = this.continuePanel;
        panel.classList.remove('hidden');
        setTimeout(() => {
            panel.classList.remove('opacity-0', 'translate-y-4');
        }, 50);
    }

    setupMermaid() {
        try {
            console.log("📊 [SETUP-MERMAID] Initializing mermaid...");
            mermaid.initialize({ 
                startOnLoad: false,
                theme: 'dark',
                logLevel: 'error',
                securityLevel: 'loose',
                themeVariables: { 
                    primaryColor: '#7c3aed',
                    primaryTextColor: '#f1f5f9',
                    primaryBorderColor: '#06b6d4',
                    lineColor: '#94a3b8',
                    background: '#0d0d1a'
                }
            });
            
            const vizData = window.chapterData?.visualization;
            const code = vizData?.mermaid_code;
            const container = document.getElementById('mermaid-container');
            
            if (!code || !container) {
                console.warn("⚠️ [SETUP-MERMAID] No visualization code available");
                if (container) container.innerHTML = '<div class="text-center py-8"><p class="text-xs text-muted">📊 Interactive diagram not available</p></div>';
                return;
            }
            
            console.log("📊 [SETUP-MERMAID] Rendering code:", code.substring(0, 50) + "...");
            
            mermaid.render('diagram-svg', code).then(({svg}) => {
                console.log("✓ [SETUP-MERMAID] Diagram rendered successfully");
                container.innerHTML = svg;
                this.mermaidReady = true;
            }).catch(e => {
                console.error("❌ [SETUP-MERMAID] Rendering failed:", e.message);
                container.innerHTML = `
                    <div class="text-center py-8">
                        <p class="text-amber text-xs font-bold mb-2">📊 Diagram Unavailable</p>
                        <p class="text-muted text-[10px]">Interactive diagram has a syntax issue</p>
                    </div>
                `;
                this.mermaidReady = false;
            });
        } catch (e) {
            console.error("❌ [SETUP-MERMAID] Critical error:", e);
        }
    }

    setupAmbientAudio() {
        try {
            const style = window.cognitiveStyle;
            
            if (style === 'focus') {
                this.ambientSynth = new Tone.PolySynth(Tone.Synth).toDestination();
                this.ambientSynth.set({ 
                    oscillator: { type: 'sine' },
                    envelope: { attack: 2, release: 2 } 
                });
            } else {
                this.ambientSynth = new Tone.MembraneSynth().toDestination();
            }
            
            Tone.getDestination().volume.value = -22;
        } catch (e) {
            console.warn("Tone.js setup failed:", e);
        }
    }

    async startAmbience() {
        try {
            if (!this.isAmbienceStarted) {
                await Tone.start();
                this.isAmbienceStarted = true;
            }
            
            const style = window.cognitiveStyle;
            if (style === 'focus') {
                this.ambientLoop = new Tone.Loop(time => {
                    this.ambientSynth.triggerAttackRelease(["C3", "E3", "G3", "B3"], "4n", time);
                }, "2n").start(0);
            } else {
                this.ambientLoop = new Tone.Loop(time => {
                    this.ambientSynth.triggerAttackRelease("C1", "8n", time);
                }, "4n").start(0);
            }
            Tone.Transport.start();
        } catch (e) {
            console.warn("Ambient audio error:", e);
        }
    }

    stopAmbience() {
        try {
            Tone.Transport.pause();
        } catch (e) {}
    }

    initVisualizer() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        
        let phase = 0;
        const drawIdle = () => {
            if (this.analyser) return;
            requestAnimationFrame(drawIdle);
            
            const w = this.canvas.width;
            const h = this.canvas.height;
            this.ctx.clearRect(0, 0, w, h);
            
            const waves = [
                { amp: h * 0.15, freq: 0.015, speed: 0.02, color: 'rgba(124, 58, 237, 0.3)' },
                { amp: h * 0.10, freq: 0.025, speed: 0.015, color: 'rgba(6, 182, 212, 0.2)' },
                { amp: h * 0.08, freq: 0.035, speed: 0.025, color: 'rgba(124, 58, 237, 0.15)' }
            ];
            
            waves.forEach(wave => {
                this.ctx.beginPath();
                this.ctx.moveTo(0, h / 2);
                for (let x = 0; x <= w; x += 2) {
                    const y = h / 2 + Math.sin(x * wave.freq + phase * (wave.speed * 50)) * wave.amp;
                    this.ctx.lineTo(x, y);
                }
                this.ctx.lineTo(w, h);
                this.ctx.lineTo(0, h);
                this.ctx.closePath();
                
                const grad = this.ctx.createLinearGradient(0, 0, w, 0);
                grad.addColorStop(0, wave.color);
                grad.addColorStop(0.5, wave.color.replace(/[\d.]+\)$/, (parseFloat(wave.color.match(/[\d.]+\)$/)[0]) * 1.5).toFixed(2) + ')'));
                grad.addColorStop(1, wave.color);
                this.ctx.fillStyle = grad;
                this.ctx.fill();
            });
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, h / 2);
            for (let x = 0; x <= w; x += 2) {
                const y = h / 2 + Math.sin(x * 0.02 + phase * 1.0) * (h * 0.12);
                this.ctx.lineTo(x, y);
            }
            this.ctx.strokeStyle = 'rgba(124, 58, 237, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            phase += 0.02;
        };
        drawIdle();
        
        const resize = () => {
            this.canvas.width = this.canvas.clientWidth;
            this.canvas.height = this.canvas.clientHeight;
        };
        window.addEventListener('resize', resize);
    }

    connectVisualizerSource() {
        try {
            if (this.analyser) return;
            
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioCtx.createMediaElementSource(this.audio);
            this.analyser = audioCtx.createAnalyser();
            
            source.connect(this.analyser);
            this.analyser.connect(audioCtx.destination);
            this.analyser.fftSize = 256;
            
            this.audioContext = audioCtx;
            
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const draw = () => {
                requestAnimationFrame(draw);
                this.analyser.getByteFrequencyData(dataArray);
                
                const w = this.canvas.width;
                const h = this.canvas.height;
                this.ctx.clearRect(0, 0, w, h);

                const centerY = h / 2;
                const barWidth = Math.max(2, (w / bufferLength) * 2);
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const value = dataArray[i] / 255;
                    const barHeight = value * centerY * 0.85;
                    
                    const r = 124 - (i / bufferLength) * 60;
                    const g = 58 + (i / bufferLength) * 120;
                    const b = 237 - (i / bufferLength) * 25;
                    const alpha = 0.3 + value * 0.7;
                    
                    this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                    
                    this.ctx.fillRect(x, centerY - barHeight, barWidth - 1, barHeight);
                    this.ctx.fillRect(x, centerY, barWidth - 1, barHeight * 0.6);
                    
                    x += barWidth + 1;
                    if (x > w) break;
                }
                
                this.ctx.beginPath();
                this.ctx.moveTo(0, centerY);
                this.ctx.lineTo(w, centerY);
                this.ctx.strokeStyle = 'rgba(124, 58, 237, 0.2)';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            };
            draw();
        } catch (e) {
            console.warn("Visualizer connection error:", e);
        }
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
}

function expandViz() {
    const modal = document.getElementById('viz-modal');
    const container = document.getElementById('modal-container');
    const source = document.getElementById('mermaid-container');
    
    if (modal.classList.contains('hidden')) {
        container.innerHTML = source.innerHTML;
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('opacity-100'), 10);
    } else {
        modal.classList.remove('opacity-100');
        setTimeout(() => {
            modal.classList.add('hidden');
            container.innerHTML = '';
        }, 300);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.manager = new NeuroLearnLearnManager();
});
