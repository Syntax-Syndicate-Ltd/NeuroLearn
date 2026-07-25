/**
 * NeuroLearn AI — Emotion Detector Module
 * Real-time webcam face expression detection using face-api.js
 * Maps expressions to learning states: focused, bored, distracted, stressed, anxious
 */

class EmotionDetector {
    constructor(options = {}) {
        this.videoElement = null;
        this.canvasOverlay = null;
        this.containerElement = null;
        this.flagElement = null;

        // Detection state
        this.isRunning = false;
        this.isModelLoaded = false;
        this.stream = null;
        this.detectionInterval = null;

        // Emotion tracking
        this.currentState = 'initializing';
        this.emotionHistory = [];         // Rolling window
        this.historySize = 4;             // Smooth over 4 readings
        this.noFaceCount = 0;             // Consecutive no-face frames
        this.noFaceThreshold = 2;         // Quicker trigger for complete absence

        // Sustained state tracking
        this.sustainedState = null;
        this.sustainedStartTime = null;
        this.sustainedThresholdMs = 30000;
        this.hasFiredSustained = false;

        // Logging
        this.logInterval = null;
        this.logFrequencyMs = 10000;
        this.chapterId = options.chapterId || null;
        this.topicId = options.topicId || null;

        // Callbacks
        this.onStateChange = options.onStateChange || null;
        this.onReady = options.onReady || null;

        // UI refs
        this.statusBadge = null;
    }

    async init(containerSelector = '#emotion-detector-container') {
        try {
            console.log('🎥 [EMOTION] Initializing emotion detector...');

            this.containerElement = document.querySelector(containerSelector);
            if (!this.containerElement) {
                console.error('✗ [EMOTION] Container not found:', containerSelector);
                return false;
            }

            this._buildUI();
            this._showStatus('Loading AI models...', 'loading');

            await this._loadModels();

            this.isModelLoaded = true;
            this._showStatus('Camera starting...', 'loading');

            await this._startCamera();
            this._startDetection();
            this._startLogging();

            this.isRunning = true;
            this._showStatus('Monitoring...', 'active');
            this._updateFlag('focused', 0.5);

            if (this.onReady) this.onReady();

            console.log('✓ [EMOTION] Emotion detector initialized successfully');
            return true;

        } catch (error) {
            console.error('✗ [EMOTION] Initialization failed:', error);
            this._showStatus('Camera unavailable', 'error');
            this._updateFlag('unknown', 0);
            return false;
        }
    }

    _buildUI() {
        this.containerElement.innerHTML = `
            <div class="emotion-detector-wrapper">
                <div class="emotion-camera-container">
                    <video id="emotion-video" autoplay muted playsinline></video>
                    <canvas id="emotion-overlay"></canvas>
                    <div id="emotion-camera-status" class="emotion-camera-status">
                        <i class="fas fa-spinner fa-spin"></i> Initializing...
                    </div>
                    <button id="emotion-camera-toggle" class="emotion-camera-toggle" title="Toggle Camera">
                        <i class="fas fa-video"></i>
                    </button>
                </div>
                <div class="emotion-flag-container" id="emotion-flag">
                    <div class="emotion-flag-icon" id="emotion-flag-icon">🧠</div>
                    <div class="emotion-flag-info">
                        <span class="emotion-flag-label" id="emotion-flag-label">INITIALIZING</span>
                        <div class="emotion-flag-bar">
                            <div class="emotion-flag-bar-fill" id="emotion-flag-bar-fill" style="width:0%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.videoElement = document.getElementById('emotion-video');
        this.canvasOverlay = document.getElementById('emotion-overlay');
        this.flagElement = document.getElementById('emotion-flag');
        this.statusBadge = document.getElementById('emotion-camera-status');

        const toggleBtn = document.getElementById('emotion-camera-toggle');
        toggleBtn.addEventListener('click', () => this.toggleCamera());
    }

    async _loadModels() {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';
        console.log('📦 [EMOTION] Loading face detection models...');

        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
            // NEW: Added landmark net to track head movements (looking away)
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL)
        ]);

        console.log('✓ [EMOTION] Models loaded successfully');
    }

    async _startCamera() {
        console.log('📷 [EMOTION] Requesting camera access...');
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user', frameRate: { ideal: 15 } },
                audio: false
            });
            this.videoElement.srcObject = this.stream;

            return new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.canvasOverlay.width = this.videoElement.videoWidth;
                    this.canvasOverlay.height = this.videoElement.videoHeight;
                    resolve();
                };
            });
        } catch (error) {
            console.warn('⚠️ [EMOTION] Camera access denied or unavailable:', error.message);
            throw new Error(`Camera unavailable: ${error.message}`);
        }
    }

    _startDetection() {
        // Reduced interval from 2000ms to 1000ms to catch quick glances away
        this.detectionInterval = setInterval(async () => {
            if (!this.isRunning || !this.videoElement || this.videoElement.paused) return;

            try {
                const detections = await faceapi
                    .detectSingleFace(this.videoElement, new faceapi.TinyFaceDetectorOptions({
                        inputSize: 224,
                        scoreThreshold: 0.3 // Lowered slightly so it can track you even if you turn sideways
                    }))
                    .withFaceLandmarks(true) // true = use tiny landmarks
                    .withFaceExpressions();

                if (detections) {
                    this.noFaceCount = 0;
                    const distractionScore = this._calculateHeadPoseDistraction(detections.landmarks);
                    this._processExpressions(detections.expressions, distractionScore);
                    this._drawOverlay(detections);
                } else {
                    this.noFaceCount++;
                    if (this.noFaceCount >= this.noFaceThreshold) {
                        this._updateState('distracted', 0.8);
                    }
                    const ctx = this.canvasOverlay.getContext('2d');
                    ctx.clearRect(0, 0, this.canvasOverlay.width, this.canvasOverlay.height);
                }
            } catch (error) {
                console.warn('⚠️ [EMOTION] Detection error:', error.message);
            }
        }, 1000);
    }

    /**
     * NEW: Calculates if you are looking away based on facial geometry
     */
    _calculateHeadPoseDistraction(landmarks) {
        const jaw = landmarks.getJawOutline();
        const nose = landmarks.getNose();

        const leftEdge = jaw[0];
        const rightEdge = jaw[16];
        const chin = jaw[8];
        const noseBridge = nose[0];
        const noseTip = nose[3];

        // 1. Yaw (Looking Left/Right)
        const noseToLeft = noseTip.x - leftEdge.x;
        const noseToRight = rightEdge.x - noseTip.x;
        // If the nose is super close to one edge, you're turned sideways
        const yawRatio = Math.max(noseToLeft, noseToRight) / Math.max(0.1, Math.min(noseToLeft, noseToRight));

        // 2. Pitch (Looking Up/Down)
        const upperFace = noseTip.y - noseBridge.y;
        const lowerFace = chin.y - noseTip.y;
        const pitchRatio = Math.max(upperFace, lowerFace) / Math.max(0.1, Math.min(upperFace, lowerFace));

        let distractionScore = 0;

        // Normal straight-on ratio is ~1.0 to 1.3. 
        if (yawRatio > 1.8) distractionScore += (yawRatio - 1.8) * 0.4; // Sideways
        if (pitchRatio > 2.2) distractionScore += (pitchRatio - 2.2) * 0.3; // Up/Down

        return Math.min(1, distractionScore); // Clamp at 100%
    }

    _processExpressions(expressions, physicalDistractionScore) {
        const { angry, disgusted, fearful, happy, neutral, sad, surprised } = expressions;

        // Rebalanced Weights: Neutral no longer completely dominates
        // Physical distraction actively subtracts from focus
        const states = {
            focused: Math.max(0, (neutral * 0.75 + happy * 0.2) * (1 - physicalDistractionScore)),

            bored: Math.max(0, (sad * 0.5 + neutral * 0.25 + disgusted * 0.1) * (1 - physicalDistractionScore)),

            stressed: Math.max(0, (angry * 0.6 + disgusted * 0.3) * (1 - physicalDistractionScore)),

            anxious: Math.max(0, (fearful * 0.6 + surprised * 0.4 + sad * 0.2) * (1 - physicalDistractionScore)),

            // Distracted is driven by the physical head pose score + extreme surprise
            distracted: Math.min(1, physicalDistractionScore + (surprised * 0.3))
        };

        // Push to history
        this.emotionHistory.push(states);
        if (this.emotionHistory.length > this.historySize) {
            this.emotionHistory.shift();
        }

        // Average over history
        const avgStates = { focused: 0, bored: 0, stressed: 0, anxious: 0, distracted: 0 };
        for (const reading of this.emotionHistory) {
            for (const key in avgStates) {
                avgStates[key] += reading[key] / this.emotionHistory.length;
            }
        }

        // Determine dominant state
        let dominantState = 'focused';
        let maxScore = 0;
        for (const [state, score] of Object.entries(avgStates)) {
            if (score > maxScore) {
                maxScore = score;
                dominantState = state;
            }
        }

        // Lowered threshold to allow secondary states to trigger more naturally
        if (dominantState !== 'focused' && maxScore < 0.20) {
            dominantState = 'focused';
            maxScore = avgStates.focused;
        }

        this._updateState(dominantState, maxScore);
    }

    _updateState(newState, confidence) {
        const previousState = this.currentState;
        this.currentState = newState;

        this._updateFlag(newState, confidence);

        const isActionableState = ['bored', 'distracted', 'stressed', 'anxious'].includes(newState);

        if (isActionableState) {
            if (this.sustainedState === newState) {
                const elapsed = Date.now() - this.sustainedStartTime;
                this._updateSustainedTimer(elapsed);

                if (elapsed >= this.sustainedThresholdMs && !this.hasFiredSustained) {
                    this.hasFiredSustained = true;
                    console.log(`🧠 [EMOTION] SUSTAINED ${newState} for ${(elapsed / 1000).toFixed(0)}s → TRIGGERING mode switch!`);

                    const event = new CustomEvent('emotion-change', {
                        detail: { state: newState, previousState: previousState, confidence: confidence, sustained: true, duration: elapsed }
                    });
                    document.dispatchEvent(event);

                    if (this.onStateChange) this.onStateChange(newState, previousState, confidence);

                    // === FEATURE 3: COGNITIVE LOAD INTERVENTION ===
                    if (['distressed', 'anxious', 'tired', 'stressed'].includes(newState)) {
                        const learnPage = document.querySelector('.learn-page');
                        const chId = learnPage?.dataset?.chapterId || this.chapterId;
                        const tpId = learnPage?.dataset?.topicId || this.topicId;
                        
                        fetch('/api/emotion-intervention', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                state: newState,
                                chapter_id: chId,
                                topic_id: tpId
                            })
                        }).then(r => {
                            if (!r.ok) {
                                console.warn(`⚠️ [EMOTION] Intervention API returned ${r.status}`);
                                return null;
                            }
                            return r.json();
                        }).then(data => {
                            if (data && data.intervention === true) {
                                console.log('🌿 [EMOTION] Intervention response received, dispatching neurosupport event');
                                const neuroEvent = new CustomEvent('neurosupport', {
                                    detail: {
                                        simplified_narration: data.simplified_narration,
                                        message: data.message
                                    }
                                });
                                document.dispatchEvent(neuroEvent);
                            }
                        }).catch(err => {
                            console.warn('⚠️ [EMOTION] Intervention request failed:', err.message);
                        });
                    }
                }
            } else {
                console.log(`🧠 [EMOTION] Tracking sustained: ${newState} (need ${this.sustainedThresholdMs / 1000}s to trigger)`);
                this.sustainedState = newState;
                this.sustainedStartTime = Date.now();
                this.hasFiredSustained = false;
            }
        } else {
            if (this.sustainedState !== null) {
                console.log(`🧠 [EMOTION] User returned to ${newState}, resetting sustained tracker`);
                if (this.hasFiredSustained) {
                    const event = new CustomEvent('emotion-change', {
                        detail: { state: 'focused', previousState: this.sustainedState, confidence: confidence, sustained: true }
                    });
                    document.dispatchEvent(event);

                    if (this.onStateChange) this.onStateChange('focused', this.sustainedState, confidence);
                }
            }
            this.sustainedState = null;
            this.sustainedStartTime = null;
            this.hasFiredSustained = false;
            this._hideSustainedTimer();
        }
    }

    _updateSustainedTimer(elapsed) {
        let timerEl = document.getElementById('emotion-sustained-timer');
        if (!timerEl) {
            const flagContainer = document.getElementById('emotion-flag');
            if (!flagContainer) return;
            timerEl = document.createElement('div');
            timerEl.id = 'emotion-sustained-timer';
            timerEl.className = 'emotion-sustained-timer';
            flagContainer.appendChild(timerEl);
        }

        const remaining = Math.max(0, this.sustainedThresholdMs - elapsed);
        const seconds = Math.ceil(remaining / 1000);

        if (this.hasFiredSustained) {
            timerEl.innerHTML = `<i class="fas fa-check-circle"></i> Mode switched`;
            timerEl.className = 'emotion-sustained-timer timer-fired';
        } else {
            const pct = Math.min(100, (elapsed / this.sustainedThresholdMs) * 100);
            timerEl.innerHTML = `<div class="timer-bar"><div class="timer-bar-fill" style="width:${pct}%"></div></div><span>${seconds}s to switch</span>`;
            timerEl.className = 'emotion-sustained-timer timer-counting';
        }
    }

    _hideSustainedTimer() {
        const timerEl = document.getElementById('emotion-sustained-timer');
        if (timerEl) timerEl.remove();
    }

    _updateFlag(state, confidence) {
        const config = {
            focused: { icon: '🧠', label: 'FOCUSED', color: '#10b981', barColor: '#10b981' },
            bored: { icon: '😴', label: 'BORED', color: '#f59e0b', barColor: '#f59e0b' },
            distracted: { icon: '👀', label: 'DISTRACTED', color: '#f59e0b', barColor: '#f59e0b' },
            stressed: { icon: '😰', label: 'STRESSED', color: '#f43f5e', barColor: '#f43f5e' },
            anxious: { icon: '😟', label: 'ANXIOUS', color: '#f43f5e', barColor: '#f43f5e' },
            unknown: { icon: '❓', label: 'UNKNOWN', color: '#475569', barColor: '#475569' },
            initializing: { icon: '⏳', label: 'STARTING', color: '#7c3aed', barColor: '#7c3aed' }
        };

        const c = config[state] || config.unknown;

        const iconEl = document.getElementById('emotion-flag-icon');
        const labelEl = document.getElementById('emotion-flag-label');
        const barEl = document.getElementById('emotion-flag-bar-fill');
        const flagEl = document.getElementById('emotion-flag');

        if (iconEl) iconEl.textContent = c.icon;
        if (labelEl) {
            labelEl.textContent = c.label;
            labelEl.style.color = c.color;
        }
        if (barEl) {
            barEl.style.width = `${Math.round(confidence * 100)}%`;
            barEl.style.background = c.barColor;
        }
        if (flagEl) {
            flagEl.style.borderColor = c.color + '40';
            flagEl.className = 'emotion-flag-container emotion-flag-' + state;
        }
    }

    _drawOverlay(detection) {
        const ctx = this.canvasOverlay.getContext('2d');
        ctx.clearRect(0, 0, this.canvasOverlay.width, this.canvasOverlay.height);

        if (detection && detection.detection) {
            const box = detection.detection.box;

            ctx.strokeStyle = this.currentState === 'focused' ? '#10b981' :
                (this.currentState === 'stressed' || this.currentState === 'anxious') ? '#f43f5e' : '#f59e0b';
            ctx.lineWidth = 2;
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = 8;

            const r = 8;
            ctx.beginPath();
            ctx.moveTo(box.x + r, box.y);
            ctx.lineTo(box.x + box.width - r, box.y);
            ctx.quadraticCurveTo(box.x + box.width, box.y, box.x + box.width, box.y + r);
            ctx.lineTo(box.x + box.width, box.y + box.height - r);
            ctx.quadraticCurveTo(box.x + box.width, box.y + box.height, box.x + box.width - r, box.y + box.height);
            ctx.lineTo(box.x + r, box.y + box.height);
            ctx.quadraticCurveTo(box.x, box.y + box.height, box.x, box.y + box.height - r);
            ctx.lineTo(box.x, box.y + r);
            ctx.quadraticCurveTo(box.x, box.y, box.x + r, box.y);
            ctx.stroke();

            ctx.shadowBlur = 0;
        }
    }

    _showStatus(message, type) {
        if (!this.statusBadge) return;

        const icons = {
            loading: '<i class="fas fa-spinner fa-spin"></i>',
            active: '<i class="fas fa-eye"></i>',
            error: '<i class="fas fa-exclamation-triangle"></i>',
            off: '<i class="fas fa-video-slash"></i>'
        };

        this.statusBadge.innerHTML = `${icons[type] || ''} ${message}`;
        this.statusBadge.className = `emotion-camera-status emotion-status-${type}`;

        if (type === 'active') {
            setTimeout(() => {
                if (this.statusBadge) this.statusBadge.style.opacity = '0';
            }, 3000);
        } else {
            this.statusBadge.style.opacity = '1';
        }
    }

    toggleCamera() {
        if (this.isRunning) {
            this.stop();
            const btn = document.getElementById('emotion-camera-toggle');
            if (btn) btn.innerHTML = '<i class="fas fa-video-slash"></i>';
            this._showStatus('Camera off', 'off');
        } else {
            this.restart();
            const btn = document.getElementById('emotion-camera-toggle');
            if (btn) btn.innerHTML = '<i class="fas fa-video"></i>';
        }
    }

    _startLogging() {
        this.logInterval = setInterval(() => {
            if (this.currentState && this.currentState !== 'initializing') {
                this._logToServer();
            }
        }, this.logFrequencyMs);
    }

    async _logToServer() {
        try {
            const payload = {
                emotion_state: this.currentState,
                confidence: this.emotionHistory.length > 0
                    ? Math.max(...Object.values(this.emotionHistory[this.emotionHistory.length - 1]))
                    : 0,
                chapter_id: this.chapterId,
                topic_id: this.topicId
            };

            await fetch('/api/emotion-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.warn('⚠️ [EMOTION] Log failed:', error.message);
        }
    }

    stop() {
        this.isRunning = false;

        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }

        if (this.logInterval) {
            clearInterval(this.logInterval);
            this.logInterval = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }

        console.log('⏹️ [EMOTION] Detector stopped');
    }

    async restart() {
        try {
            this._showStatus('Restarting camera...', 'loading');
            await this._startCamera();
            this._startDetection();
            this._startLogging();
            this.isRunning = true;
            this._showStatus('Monitoring...', 'active');
            console.log('▶️ [EMOTION] Detector restarted');
        } catch (error) {
            console.error('✗ [EMOTION] Restart failed:', error);
            this._showStatus('Camera unavailable', 'error');
        }
    }

    getState() {
        return {
            state: this.currentState,
            history: [...this.emotionHistory],
            isRunning: this.isRunning
        };
    }

    destroy() {
        this.stop();
        if (this.containerElement) {
            this.containerElement.innerHTML = '';
        }
    }
}

window.EmotionDetector = EmotionDetector;