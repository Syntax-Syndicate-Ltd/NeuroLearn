// Synesthesia Engine 3.0 - Frontend Logic

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const form = document.getElementById('ingest-form');
    const uploadView = document.getElementById('upload-view');
    const engineView = document.getElementById('engine-view');
    const globalLoader = document.getElementById('global-loader');
    const errorMsg = document.getElementById('error-message');
    const endSimBtn = document.getElementById('end-sim-btn');
    
    const fileInput = document.getElementById('file-upload');
    const textInput = document.getElementById('text-input');
    const dropZone = document.getElementById('drop-zone');
    
    // Modals
    const pModal = document.getElementById('personalization-modal');
    const qModal = document.getElementById('quiz-modal');
    const lModal = document.getElementById('leaderboard-modal');
    const pauseIndicator = document.getElementById('pause-indicator');
    
    // Global State
    let learningStyle = sessionStorage.getItem('learningStyle');
    let cachedSourceText = ""; 
    let currentScore = 0;

    // --- 1. Personalization Initialization ---
    if (!learningStyle) {
        document.querySelectorAll('.style-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                learningStyle = btn.getAttribute('data-style');
                sessionStorage.setItem('learningStyle', learningStyle);
                pModal.classList.add('hidden');
                pModal.classList.remove('flex');
            });
        });
    } else {
        pModal.classList.add('hidden');
        pModal.classList.remove('flex');
    }

    // --- 2. Pre-Load Demo ---
    document.getElementById('preload-btn').addEventListener('click', () => {
        textInput.value = "Biology: Cellular Mitosis Overview\nMitosis is the process of cell division where one parent cell divides to produce two identical daughter cells. The stages are Prophase (chromosomes condense), Metaphase (chromosomes align at the equator), Anaphase (chromatids are pulled apart), and Telophase (nuclear envelopes re-form). This is critical for growth and tissue repair.";
        errorMsg.classList.add('hidden');
    });

    // --- 3. Web Speech API (Voice Input) ---
    const micBtn = document.getElementById('mic-btn');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onstart = function() {
            micBtn.classList.add('bg-red-500', 'animate-pulse');
            micBtn.classList.remove('bg-white/5');
            textInput.placeholder = "Listening...";
        };
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            textInput.value += (textInput.value ? " " : "") + transcript;
        };
        
        recognition.onend = function() {
            micBtn.classList.remove('bg-red-500', 'animate-pulse');
            micBtn.classList.add('bg-white/5');
            textInput.placeholder = "Paste subject matter here...";
        };
        
        micBtn.addEventListener('click', () => {
            try { recognition.start(); } catch(e) {}
        });
    } else {
        micBtn.style.display = 'none'; // Not supported
    }

    // --- 4. Drag and Drop ---
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
        dropZone.addEventListener(ev, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(ev => {
        dropZone.addEventListener(ev, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(ev => {
        dropZone.addEventListener(ev, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            dropZone.querySelector('p').textContent = `Loaded: ${fileInput.files[0].name}`;
            errorMsg.classList.add('hidden');
        }
    });

    // Handle normal click upload
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            dropZone.querySelector('p').textContent = `Loaded: ${fileInput.files[0].name}`;
            errorMsg.classList.add('hidden');
        }
    });

    // --- 5. Submission & Engine Launch ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.classList.add('hidden');
        
        if (!fileInput.files.length && !textInput.value.trim()) {
            errorMsg.textContent = 'Provide a PDF, text, or use Voice input.';
            errorMsg.classList.remove('hidden');
            return;
        }

        // Cache text explicitly if typed (for post-quiz feature)
        cachedSourceText = textInput.value.trim();

        globalLoader.classList.remove('hidden');
        globalLoader.classList.add('flex');

        try {
            const formData = new FormData(form);
            // Append style to backend via formdata
            formData.append('learning_style', sessionStorage.getItem('learningStyle') || 'energy');

            const response = await fetch('/api/process', { method: 'POST', body: formData });
            
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || `Server error: ${response.status}`);
            }
            
            const data = await response.json();

            // Success. Transition to Game
            uploadView.style.opacity = '0';
            setTimeout(() => {
                uploadView.classList.remove('active');
                uploadView.classList.add('hidden');
                
                engineView.classList.remove('hidden');
                setTimeout(() => {
                    engineView.classList.add('active');
                    engineView.style.opacity = '1';
                    
                    document.getElementById('objective-display').textContent = data.objective || "Absorb Knowledge Nodes";
                    
                    if (window.engineApp) window.engineApp.startGame(data);
                }, 50);
            }, 500);

        } catch (err) {
            errorMsg.textContent = err.message;
            errorMsg.classList.remove('hidden');
        } finally {
            globalLoader.classList.add('hidden');
            globalLoader.classList.remove('flex');
        }
    });

    // --- 6. End Simulation & Trigger Post-Quiz ---
    document.addEventListener('keydown', (e) => {
        if(e.code === 'Space' && window.engineApp && window.engineApp.isPlaying) {
            e.preventDefault();
            const paused = window.engineApp.togglePause();
            if(paused) {
                pauseIndicator.classList.remove('hidden');
                pauseIndicator.classList.add('flex');
            } else {
                pauseIndicator.classList.add('hidden');
                pauseIndicator.classList.remove('flex');
            }
        }
    });

    window.triggerPostSessionQuiz = async () => {
        // Triggered by engine.js when song ends, or manual abort
        if(window.engineApp) window.engineApp.stopGame();
        
        qModal.classList.remove('hidden');
        qModal.classList.add('flex');
        
        // Fetch Quiz
        try {
            const resp = await fetch('/api/quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: cachedSourceText || "General Knowledge" }) // Use typed text. 
            });
            
            document.getElementById('quiz-loader').classList.add('hidden');
            const qc = document.getElementById('quiz-questions-container');
            qc.classList.remove('hidden');
            
            if(!resp.ok) {
                qc.innerHTML = `<h3 class="text-xl text-white mb-4">Quiz service unavailable (${resp.status}).</h3>
                                <button id="q-close-err" class="bg-accent_secondary text-black font-bold px-6 py-2 rounded-lg">Return to Base</button>`;
                document.getElementById('q-close-err').onclick = returnToMenuFromQuiz;
                return;
            }
            
            const data = await resp.json();
            
            if(!data.questions || data.questions.length === 0) {
                qc.innerHTML = `<h3 class="text-xl text-white mb-4">Quiz Generation Failed or No Context.</h3>
                                <button id="q-close-err" class="bg-accent_secondary text-black font-bold px-6 py-2 rounded-lg">Return to Base</button>`;
                document.getElementById('q-close-err').onclick = returnToMenuFromQuiz;
                return;
            }

            // Render Questions
            let currentQ = 0;
            let questions = data.questions;
            let score = 0;

            const renderQ = () => {
                if(currentQ >= questions.length) {
                    // Quiz End
                    const pass = score >= 2;
                    qc.innerHTML = `
                        <h2 class="font-heading text-4xl font-bold mb-4 ${pass?'text-green-400':'text-yellow-400'}">${pass?'Excellent Retention!':'Keep Practicing!'}</h2>
                        <p class="text-xl text-white mb-6">Score: ${score} / ${questions.length}</p>
                        <button id="q-done" class="bg-gradient-to-r from-accent_primary to-purple-600 text-white font-bold px-8 py-3 rounded-xl hover:scale-105 transition">Complete Session</button>
                    `;
                    document.getElementById('q-done').onclick = returnToMenuFromQuiz;
                    
                    // Leaderboard inject fake
                    saveLeaderboardScore(score);

                    if(pass) {
                        try {
                            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#8a2be2', '#00ffff', '#ffffff'] });
                        } catch(e){}
                    }
                    return;
                }

                const qData = questions[currentQ];
                let optsHTML = qData.options.map((opt, i) => `
                    <button class="quiz-opt-btn w-full text-left bg-white/5 hover:bg-white/15 border border-white/20 p-4 rounded-xl mb-3 transition text-white" data-idx="${i}">
                        ${['A','B','C','D'][i]}. ${opt}
                    </button>
                `).join('');

                qc.innerHTML = `
                    <span class="text-accent_secondary text-sm font-bold tracking-widest mb-2 block">QUESTION ${currentQ+1} OF 3</span>
                    <h3 class="font-heading text-2xl text-white mb-6 leading-tight">${qData.question}</h3>
                    <div class="space-y-2">${optsHTML}</div>
                `;

                document.querySelectorAll('.quiz-opt-btn').forEach(btn => {
                    btn.onclick = (e) => {
                        const idx = parseInt(e.target.closest('button').getAttribute('data-idx'));
                        if(idx === qData.correct_index) {
                            e.target.closest('button').classList.replace('bg-white/5', 'bg-green-500/50');
                            e.target.closest('button').classList.replace('border-white/20', 'border-green-400');
                            score++;
                        } else {
                            e.target.closest('button').classList.replace('bg-white/5', 'bg-red-500/50');
                            e.target.closest('button').classList.replace('border-white/20', 'border-red-400');
                        }
                        // Disable all
                        document.querySelectorAll('.quiz-opt-btn').forEach(b => b.disabled = true);
                        setTimeout(() => {
                            currentQ++;
                            renderQ();
                        }, 1000);
                    }
                });
            };

            renderQ();

        } catch(e) {
            console.error(e);
            returnToMenuFromQuiz();
        }
    };

    endSimBtn.addEventListener('click', () => {
        window.triggerPostSessionQuiz();
    });

    const returnToMenuFromQuiz = () => {
        qModal.classList.add('hidden');
        qModal.classList.remove('flex');
        
        engineView.style.opacity = '0';
        setTimeout(() => {
            engineView.classList.remove('active');
            engineView.classList.add('hidden');
            uploadView.classList.remove('hidden');
            setTimeout(() => {
                uploadView.classList.add('active');
                uploadView.style.opacity = '1';
                form.reset();
                dropZone.querySelector('p').textContent = 'Drag & Drop PDF Document';
                document.getElementById('quiz-questions-container').classList.add('hidden');
                document.getElementById('quiz-loader').classList.remove('hidden');
            }, 50);
        }, 500);
    };

    // --- 7. Sharing & Leaderboard ---
    document.getElementById('share-btn').addEventListener('click', () => {
        if(navigator.share) {
            navigator.share({ title: 'Synesthesia Engine', text: 'I just generated a gamified learning experience to accelerate my retention metrics!', url: window.location.href });
        } else {
            alert('Share API not supported on this browser.');
        }
    });

    const saveLeaderboardScore = (qScore) => {
        let scores = JSON.parse(localStorage.getItem('synScores') || '[]');
        scores.push({ name: 'You (Guest)', points: (window.engineApp.score * 10) + (qScore * 50) });
        scores.sort((a,b) => b.points - a.points);
        localStorage.setItem('synScores', JSON.stringify(scores.slice(0,5))); // Keep top 5
    };

    const loadLeaderboard = () => {
        const lbEl = document.getElementById('leaderboard-list');
        // Fake defaults
        let scores = JSON.parse(localStorage.getItem('synScores') || '[{"name": "Alice - Biology", "points": 850}, {"name": "Bob - Quantum", "points": 720}]');
        lbEl.innerHTML = scores.map((s, i) => `
            <div class="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 ${i===0?'border-yellow-400':''}">
                <span class="font-bold text-white"><span class="text-gray-500 mr-2">#${i+1}</span> ${s.name}</span>
                <span class="text-accent_secondary font-heading font-bold">${s.points} PTS</span>
            </div>
        `).join('');
    };

    document.getElementById('open-leaderboard-btn').addEventListener('click', () => {
        loadLeaderboard();
        lModal.classList.remove('hidden');
        lModal.classList.add('flex');
    });

    document.getElementById('close-leaderboard').addEventListener('click', () => {
        lModal.classList.add('hidden');
        lModal.classList.remove('flex');
    });
});
