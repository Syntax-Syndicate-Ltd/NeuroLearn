(function() {
    class SynesthesiaGameEngine {
        constructor() {
            this.isPlaying = false;
            this.isPaused = false;
            this.engineMode = 'energy'; // Default 3D
            
            // Audio elements
            this.toneLoaded = false;
            this.vocalPlayer = null;
            this.bgmLoop = null;
            this.hitSynth = null;
            this.bassSynth = null;
            this.bgmSynth = null;
            
            // Game State
            this.score = 0;
            this.maxScore = 0;
            this.keywords = [];
            this.audioFinished = false;
            
            // Three.js Core
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.clock = new THREE.Clock();
            
            // Game Objects
            this.player = null;
            this.targets = [];
            
            // 3D Specific
            this.tunnelRings = [];
            this.particles = null;
            
            // Input
            this.mouse = new THREE.Vector2();
            this.targetMouse = new THREE.Vector2();
            
            // UI
            this.scoreDisplay = document.getElementById('score-display');
            this.lyricsContainer = document.getElementById('lyrics-display');
            this.uiLayer = document.getElementById('game-ui-layer');
            
            window.addEventListener('mousemove', (e) => {
                this.targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
                this.targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            });
        }

        initVisuals(mode) {
            this.engineMode = mode;
            const container = document.getElementById('canvas-container');
            if(!container) return;
            // Clear existing
            container.innerHTML = '';
            this.uiLayer.innerHTML = '';

            this.scene = new THREE.Scene();
            
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.domElement.style.position = 'absolute';
            container.appendChild(this.renderer.domElement);

            if (mode === 'focus') {
                // 2D AUTISM/ADHD Focus Mode (Low Cognitive Load)
                this.scene.background = new THREE.Color(0x050510);
                this.scene.fog = null;
                
                // Orthographic flat camera
                const aspect = window.innerWidth / window.innerHeight;
                const d = 10;
                this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 100);
                this.camera.position.set(0, 0, 10);
                this.camera.lookAt(0,0,0);

                const ambient = new THREE.AmbientLight(0xffffff, 0.8);
                this.scene.add(ambient);

                // Simple glowing 2D paddle
                const shipGeo = new THREE.PlaneGeometry(4, 0.5);
                const shipMat = new THREE.MeshBasicMaterial({ color: 0x8a2be2 });
                this.player = new THREE.Mesh(shipGeo, shipMat);
                this.player.position.set(0, -8, 0); // Bottom of screen
                this.scene.add(this.player);

            } else {
                // 3D HIGH ENERGY Mode
                this.scene.background = new THREE.Color(0x0a0a0f);
                this.scene.fog = new THREE.FogExp2(0x0a0a0f, 0.02);
                
                this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 100);
                this.camera.position.z = 5;
                this.camera.position.y = 1;

                const ambient = new THREE.AmbientLight(0xffffff, 0.4);
                this.scene.add(ambient);
                const dirLight = new THREE.DirectionalLight(0x00ffff, 1);
                dirLight.position.set(0, 10, 5);
                this.scene.add(dirLight);

                // Advanced Ship Model representation (Group)
                this.player = new THREE.Group();
                const coreGeo = new THREE.ConeGeometry(0.5, 2, 4);
                coreGeo.rotateX(Math.PI / 2);
                const coreMat = new THREE.MeshPhysicalMaterial({ color: 0x8a2be2, metalness: 0.9, roughness: 0.1 });
                const core = new THREE.Mesh(coreGeo, coreMat);
                
                const wingGeo = new THREE.BoxGeometry(2.5, 0.1, 1);
                const wingMat = new THREE.MeshPhysicalMaterial({ color: 0x00ffff, metalness: 0.5 });
                const wings = new THREE.Mesh(wingGeo, wingMat);
                wings.position.set(0, 0, 0.5);

                this.player.add(core);
                this.player.add(wings);
                this.player.position.set(0, 0, 3);
                this.scene.add(this.player);

                // Tunnel Rings
                this.tunnelRings = [];
                const ringGeo = new THREE.TorusGeometry(8, 0.1, 8, 50);
                const ringMat = new THREE.MeshBasicMaterial({ color: 0x330066, wireframe: true, transparent: true, opacity: 0.3 });
                for(let i=0; i<20; i++) {
                    const ring = new THREE.Mesh(ringGeo, ringMat);
                    ring.position.z = -i * 5;
                    this.scene.add(ring);
                    this.tunnelRings.push(ring);
                }

                // Starfield
                const pGeo = new THREE.BufferGeometry();
                const pCount = 2000;
                const pArr = new Float32Array(pCount * 3);
                for(let i=0; i<pCount*3; i+=3) {
                    pArr[i] = (Math.random()-0.5)*40;
                    pArr[i+1] = (Math.random()-0.5)*40;
                    pArr[i+2] = (Math.random()-0.5)*60 - 20;
                }
                pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
                const pMat = new THREE.PointsMaterial({ size: 0.1, color: 0x00ffff, transparent: true, opacity: 0.5 });
                this.particles = new THREE.Points(pGeo, pMat);
                this.scene.add(this.particles);
            }

            window.addEventListener('resize', this.onResize.bind(this));
            
            // Only start loop if not already running
            if (!this.loopRunning) {
                this.loopRunning = true;
                this.animate();
            }
        }

        onResize() {
            if(!this.camera) return;
            if(this.engineMode === 'focus') {
                const aspect = window.innerWidth / window.innerHeight;
                const d = 10;
                this.camera.left = -d * aspect;
                this.camera.right = d * aspect;
                this.camera.top = d;
                this.camera.bottom = -d;
                this.camera.updateProjectionMatrix();
            } else {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
            }
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }

        spawnTarget(keyword, delayIndex) {
            let target;
            if (this.engineMode === 'focus') {
                // 2D Setup: Falling glowing boxes
                const geo = new THREE.PlaneGeometry(3, 1.5);
                const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5, wireframe: true });
                target = new THREE.Mesh(geo, mat);
                
                const aspect = window.innerWidth / window.innerHeight;
                const startX = (Math.random() - 0.5) * (10 * aspect * 1.5);
                
                // Spawn way high up (y-axis)
                target.position.set(startX, 15 + (delayIndex * 8), 0);
            } else {
                // 3D Setup: Flying orbs from deep Z-axis
                const geo = new THREE.IcosahedronGeometry(1.2, 0);
                const mat = new THREE.MeshPhysicalMaterial({ color: 0x00ffff, wireframe: true, emissive: 0x002255 });
                target = new THREE.Mesh(geo, mat);
                
                const startX = (Math.random() - 0.5) * 10;
                const startY = (Math.random() - 0.5) * 8;
                
                target.position.set(startX, startY, -20 - (delayIndex * 15));
            }
            
            target.userData = { keyword: keyword, active: true, labelDiv: null };

            const label = document.createElement('div');
            label.className = 'floating-label';
            label.textContent = keyword;
            this.uiLayer.appendChild(label);
            target.userData.labelDiv = label;

            this.scene.add(target);
            this.targets.push(target);
        }

        async initAudio(audioUrl, styleFlag) {
            if(!this.toneLoaded) {
                await Tone.start();
                this.toneLoaded = true;
                
                this.hitSynth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: "square" },
                    envelope: { attack: 0.02, decay: 0.1, sustain: 0.1, release: 1 }
                }).toDestination();

                this.bassSynth = new Tone.MembraneSynth().toDestination();
                
                this.bgmSynth = new Tone.Synth({
                    oscillator: { type: "triangle" },
                    envelope: { attack: 0.05, decay: 0.2, sustain: 0.1, release: 0.5 }
                }).toDestination();
            }

            if(this.vocalPlayer) this.vocalPlayer.dispose();
            
            this.audioFinished = false;

            this.vocalPlayer = new Tone.Player({
                url: audioUrl,
                autostart: false,
                onstop: () => {
                    this.audioFinished = true;
                    this.checkEndCondition();
                }
            }).toDestination();

            await Tone.loaded();

            let beat = 0;
            if(styleFlag === 'focus') {
                Tone.Transport.bpm.value = 70; 
                const notes = ["C3", "G3", "C4", "G3"];
                this.bgmLoop = new Tone.Loop((time) => {
                    if(beat % 4 === 0) this.bassSynth.triggerAttackRelease("C1", "2n", time, 0.6);
                    this.bgmSynth.triggerAttackRelease(notes[beat % notes.length], "4n", time, 0.2);
                    beat++;
                }, "4n");
            } else {
                Tone.Transport.bpm.value = 110; 
                const notes = ["C4", "E4", "G4", "B4", "C5", "A4", "F4", "G4"];
                this.bgmLoop = new Tone.Loop((time) => {
                    if(beat % 4 === 0) this.bassSynth.triggerAttackRelease("C1", "8n", time);
                    this.bgmSynth.triggerAttackRelease(notes[beat % notes.length], "16n", time, 0.3);
                    beat++;
                }, "8n");
            }
        }

        async startGame(dataStr) {
            this.stopGame(); 
            this.isPaused = false;
            const pauseInd = document.getElementById('pause-indicator');
            if (pauseInd) pauseInd.classList.add('hidden');
            
            const {lyrics, keywords, audio_url, style} = dataStr;
            
            this.initVisuals(style);

            this.lyricsContainer.innerHTML = `<p>${lyrics}</p>`;
            this.keywords = keywords;
            this.maxScore = keywords.length;
            this.score = 0;
            this.updateScoreUI();
            
            this.targets = [];
            this.keywords.forEach((kw, i) => this.spawnTarget(kw, i));

            await this.initAudio(audio_url, style);
            
            Tone.Transport.start();
            this.bgmLoop.start(0);
            
            // Explicit pacing: Audio starts 1.5 seconds later so player can read objective
            this.vocalPlayer.start("+1.5");
            
            this.isPlaying = true;
        }

        togglePause() {
            this.isPaused = !this.isPaused;
            if (this.isPaused) {
                if (Tone.Transport.state === 'started') Tone.Transport.pause();
                this.vocalPlayer.mute = true; // Simulating pause since Tone.Player lacks standard pause without math
                // Actually, stopping Tone.Transport might not stop Player if it isn't synced. 
                // Let's rely on Context suspend for true global pause
                Tone.context.suspend();
                this.clock.stop();
            } else {
                Tone.context.resume();
                this.clock.start();
            }
            return this.isPaused;
        }

        checkEndCondition() {
            // End when audio finishes AND no active targets remain
            const activeTargets = this.targets.filter(t => t.userData.active);
            if (this.audioFinished && activeTargets.length === 0) {
                if(window.triggerPostSessionQuiz) window.triggerPostSessionQuiz();
            }
        }

        stopGame() {
            this.isPlaying = false;
            Tone.context.resume(); // Rescue context if paused
            if (this.vocalPlayer) this.vocalPlayer.stop();
            if (this.bgmLoop) this.bgmLoop.stop();
            Tone.Transport.stop();
            
            this.targetMouse.set(0,0);
        }

        updateScoreUI() {
            this.scoreDisplay.textContent = `${this.score} / ${this.maxScore}`;
        }

        playHitSound() {
            if(this.hitSynth) {
                this.hitSynth.triggerAttackRelease(["C5", "E5", "G5"], "4n");
            }
        }

        animate() {
            requestAnimationFrame(() => this.animate());
            if(!this.isPlaying || this.isPaused) return;

            const delta = this.clock.getDelta();

            this.mouse.lerp(this.targetMouse, 0.1);

            // Handle Ships
            if(this.player) {
                if (this.engineMode === 'focus') {
                    // 2D: Pure horizontal movement constrained to screen width
                    const aspect = window.innerWidth / window.innerHeight;
                    const maxDist = (10 * aspect) - 2;
                    let nx = this.mouse.x * (10 * aspect);
                    if(nx > maxDist) nx = maxDist;
                    if(nx < -maxDist) nx = -maxDist;
                    this.player.position.x = nx;
                } else {
                    // 3D: Flying controls
                    this.player.position.x = this.mouse.x * 6;
                    this.player.position.y = this.mouse.y * 4 + 1;
                    this.player.rotation.z = -this.mouse.x * Math.PI / 4;
                    this.player.rotation.x = this.mouse.y * Math.PI / 8;
                }
            }

            if (this.engineMode === 'energy') {
                this.tunnelRings.forEach(ring => {
                    ring.position.z += 10 * delta;
                    if(ring.position.z > 5) ring.position.z = -95;
                });
                
                this.particles.position.z += 15 * delta;
                if(this.particles.position.z > 20) this.particles.position.z = 0;
            }

            // Object Physics
            this.targets.forEach(t => {
                if(!t.userData.active) return;

                if (this.engineMode === 'focus') {
                    // 2D: Fall downwards
                    t.position.y -= 4 * delta;
                } else {
                    // 3D: Fly towards camera
                    t.position.z += 8 * delta;
                    t.rotation.x += 1 * delta;
                    t.rotation.y += 2 * delta;
                }

                // UI Label Projection
                if(t.userData.labelDiv) {
                    const vector = t.position.clone();
                    vector.project(this.camera);
                    const x = (vector.x * .5 + .5) * window.innerWidth;
                    const y = (vector.y * -.5 + .5) * window.innerHeight;
                    
                    if(vector.z > 1 && this.engineMode==='energy') {
                        t.userData.labelDiv.style.opacity = '0';
                    } else {
                        t.userData.labelDiv.style.opacity = '1';
                        t.userData.labelDiv.style.left = `${x}px`;
                        t.userData.labelDiv.style.top = `${y - 40}px`;
                    }
                }

                // Collision Detection
                const dist = this.player.position.distanceTo(t.position);
                const collisionThreshold = this.engineMode === 'focus' ? 3.0 : 2.5;

                if(dist < collisionThreshold) {
                    t.userData.active = false;
                    
                    this.score++;
                    this.updateScoreUI();
                    this.playHitSound();

                    if(this.engineMode === 'energy') {
                        // Visual explosion simulation
                        t.material.color.setHex(0xffffff);
                        t.material.emissive.setHex(0xffffff);
                        t.scale.set(2,2,2);
                    } else {
                        t.material.color.setHex(0x00ff00); // Turn green in 2D
                    }
                    
                    if(t.userData.labelDiv) t.userData.labelDiv.style.color = '#0f0';

                    setTimeout(() => {
                        this.scene.remove(t);
                        if(t.userData.labelDiv) t.userData.labelDiv.remove();
                        this.checkEndCondition(); // evaluate if done
                    }, 200);
                }

                // Missed Target Check
                if ((this.engineMode === 'focus' && t.position.y < -12) || 
                    (this.engineMode === 'energy' && t.position.z > 5)) {
                    if (t.userData.active) {
                        t.userData.active = false;
                        this.scene.remove(t);
                        if(t.userData.labelDiv) t.userData.labelDiv.remove();
                        this.checkEndCondition(); // evaluate if done
                    }
                }
            });

            this.renderer.render(this.scene, this.camera);
        }
    }

    window.engineApp = new SynesthesiaGameEngine();
})();
