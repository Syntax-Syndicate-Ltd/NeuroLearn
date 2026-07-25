// Generate quiz.js from the NeuroLearn AI spec. 
// Write complete, production-ready code. 
// Every function fully implemented. 

class NeuroLearnQuizManager {
    constructor() {
        this.chapterId = window.chapterId;
        this.currIdx = 0;
        this.score = 0;
        this.xp = 0;
        this.questions = [];
        this.timer = 15;
        this.timerRemaining = 15;
        this.timerInterval = null;
        this.hintUsed = false;
        
        this.cards = document.getElementById('quiz-card');
        this.optionsContainer = document.getElementById('options-container');
        this.btnNext = document.getElementById('btn-next');
        
        this.init();
    }

    async init() {
        try {
            console.log("📝 [QUIZ-INIT] Initializing quiz for chapter:", this.chapterId);
            const resp = await fetch(`/api/quiz-data/${this.chapterId}`);
            const data = await resp.json();
            
            if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
                console.error("✗ [QUIZ-INIT] No questions in response:", data);
                this.showError("Quiz questions not found for this level.");
                return;
            }
            
            console.log(`📝 [QUIZ-INIT] Loaded ${data.questions.length} questions`);
            
            this.questions = data.questions.map((q, idx) => {
                let correctIndex = q.correct;
                if (typeof correctIndex !== 'number' || correctIndex < 0 || correctIndex >= (q.options ? q.options.length : 4)) {
                    correctIndex = 0;
                }
                
                return {
                    question: q.question || `Question ${idx + 1}`,
                    options: q.options || ["Option A", "Option B", "Option C", "Option D"],
                    correct: correctIndex,
                    explanation: q.explanation || "Great effort!",
                    difficulty: (q.difficulty || "medium").toLowerCase(),
                    concept_tag: q.concept_tag || "Concept"
                };
            });
            
            this.setupEvents();
            this.renderQuestion();
        } catch (e) {
            console.error("✗ [QUIZ-INIT] Data Load Error:", e);
            this.showError(`Failed to load quiz: ${e.message}`);
        }
    }

    showError(message) {
        console.error("❌ [QUIZ] Error:", message);
        const card = document.getElementById('quiz-card');
        if (card) {
            card.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-rose-600 text-lg font-black mb-4">❌ Quiz Error</p>
                    <p class="text-slate-600 font-bold mb-6">${message}</p>
                    <a href="/chapters" class="btn-primary">Return to Level Map</a>
                </div>
            `;
        }
    }

    setupEvents() {
        if (this.btnNext) {
            this.btnNext.onclick = () => this.nextQuestion();
        }
        
        const toggleRef = document.getElementById('toggle-ref');
        if (toggleRef) {
            toggleRef.onclick = () => {
                const panel = document.getElementById('ref-panel');
                if (panel) panel.classList.toggle('hidden');
                if (!this.hintUsed) {
                    this.hintUsed = true;
                    this.xp -= 20;
                    this.updateXP();
                }
            };
        }

        const btnVoice = document.getElementById('btn-voice');
        if (btnVoice) {
            if ('webkitSpeechRecognition' in window) {
                const recognition = new webkitSpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = false;
                recognition.lang = 'en-US';

                btnVoice.onclick = () => {
                    recognition.start();
                    btnVoice.classList.add('bg-sky-100', 'animate-pulse');
                };

                recognition.onresult = (e) => {
                    const text = e.results[0][0].transcript.toLowerCase();
                    btnVoice.classList.remove('bg-sky-100', 'animate-pulse');
                    this.handleVoiceCommand(text);
                };
            } else {
                btnVoice.style.display = 'none';
            }
        }
    }

    handleVoiceCommand(text) {
        if (!this.optionsContainer) return;
        const cards = this.optionsContainer.querySelectorAll('.answer-card');
        cards.forEach((card, i) => {
            const optLetter = String.fromCharCode(65 + i).toLowerCase();
            if (text.includes(`option ${optLetter}`) || text.includes(`choice ${optLetter}`) || text.includes(optLetter)) {
                card.click();
            }
        });
    }

    renderQuestion() {
        if (this.currIdx >= this.questions.length) {
            this.finishQuiz();
            return;
        }

        const q = this.questions[this.currIdx];
        
        const currElem = document.getElementById('current-q');
        if (currElem) currElem.innerText = this.currIdx + 1;
        
        const totalElem = document.getElementById('total-q');
        if (totalElem) totalElem.innerText = this.questions.length;
        
        const segmentedBar = document.getElementById('quiz-progress-segmented');
        if (segmentedBar) {
            const count = this.questions.length;
            let html = '';
            for (let i = 0; i < count; i++) {
                const state = i < this.currIdx ? 'completed' : (i === this.currIdx ? 'current' : '');
                html += `<div class="progress-segment ${state}"></div>`;
            }
            segmentedBar.innerHTML = html;
        }
        
        const questionElem = document.getElementById('question-text');
        if (questionElem) questionElem.innerText = q.question;
        
        const badge = document.getElementById('difficulty-badge');
        if (badge) {
            const difficulty = (q.difficulty || "medium").toLowerCase();
            badge.innerText = difficulty.toUpperCase();
        }

        if (this.optionsContainer) {
            this.optionsContainer.innerHTML = '';
            q.options.forEach((opt, i) => {
                const card = document.createElement('div');
                card.className = 'answer-card font-extrabold text-base flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-200 cursor-pointer hover:border-emerald-500 transition-all';
                card.id = `opt-card-${i}`;
                card.innerHTML = `<div class="answer-letter flex-shrink-0 w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-700">${String.fromCharCode(65 + i)}</div><span class="flex-1 text-slate-800">${opt}</span>`;
                card.onclick = () => {
                    if (window.playSound) window.playSound('click');
                    this.selectOption(i);
                };
                this.optionsContainer.appendChild(card);
            });
        }

        const expPanel = document.getElementById('explanation-panel');
        if (expPanel) expPanel.classList.add('hidden');
        
        if (this.btnNext) {
            this.btnNext.disabled = true;
            if (this.currIdx === this.questions.length - 1) {
                this.btnNext.innerHTML = 'PLAY CHALLENGE GAME 🎮 →';
            } else {
                this.btnNext.innerHTML = 'NEXT QUESTION →';
            }
        }
    }

    selectOption(idx) {
        if (this.timerInterval) clearInterval(this.timerInterval);
        const q = this.questions[this.currIdx];
        if (!this.optionsContainer) return;
        
        const cards = this.optionsContainer.querySelectorAll('.answer-card');
        const correctIndex = q.correct;
        
        cards.forEach((card, i) => {
            card.style.pointerEvents = 'none';
            if (i === correctIndex) {
                card.style.background = '#ECFDF5';
                card.style.borderColor = '#10B981';
                card.innerHTML += `<i class="fas fa-check-circle text-emerald-600 text-lg ml-auto"></i>`;
            } else if (i === idx && idx !== correctIndex) {
                card.style.background = '#FEF2F2';
                card.style.borderColor = '#EF4444';
                card.innerHTML += `<i class="fas fa-times-circle text-rose-600 text-lg ml-auto"></i>`;
            }
        });

        if (idx === correctIndex) {
            const points = q.difficulty === 'easy' ? 100 : (q.difficulty === 'medium' ? 150 : 250);
            this.xp += points;
            this.score++;
            if (window.playSound) window.playSound('correct');
        } else if (idx !== -1) {
            if (window.playSound) window.playSound('wrong');
        }

        const expText = document.getElementById('explanation-text');
        if (expText) expText.innerText = `💡 ${q.explanation}`;
        
        const expPanel = document.getElementById('explanation-panel');
        if (expPanel) expPanel.classList.remove('hidden');
        
        if (this.btnNext) this.btnNext.disabled = false;
        this.updateXP();
    }

    updateXP() {
        const xpElem = document.getElementById('running-xp');
        if (xpElem) xpElem.innerText = Math.max(0, this.xp);
    }

    nextQuestion() {
        this.currIdx++;
        this.renderQuestion();
    }

    async finishQuiz() {
        const points = Math.max(0, this.xp);
        const ratio = this.questions.length > 0 ? Math.round((this.score / this.questions.length) * 100) : 0;
        
        try {
            const resp = await fetch('/api/submit-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chapter_id: this.chapterId,
                    score: ratio,
                    xp_earned: points
                })
            });
            
            if (!resp.ok) {
                window.location.href = `/game/${this.chapterId}`;
                return;
            }
            
            const result = await resp.json();
            if (result.redirect) {
                window.location.href = result.redirect;
            } else {
                window.location.href = `/game/${this.chapterId}`;
            }
        } catch(e) {
            window.location.href = `/game/${this.chapterId}`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.quizManager = new NeuroLearnQuizManager();
});
