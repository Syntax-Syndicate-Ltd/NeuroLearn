// Generate results.js from the NeuroLearn AI spec. 
// Write complete, production-ready code. 
// Every function fully implemented. 

class NeuroLearnResultsManager {
    constructor() {
        this.results = window.resultData;
        this.init();
    }

    async init() {
        this.animateScore();
        this.fireConfetti();
        await this.postScore();
        await this.loadLeaderboard();
        this.setupShare();
    }

    animateScore() {
        const stroke = document.getElementById('score-stroke');
        const text = document.getElementById('score-text');
        const finalScore = this.results.score;
        
        // Stroke offset: 552.9 * (1 - score/100)
        const offset = 552.9 * (1 - (finalScore / 100));
        setTimeout(() => {
            stroke.style.strokeDashoffset = offset;
        }, 100);

        // Text count up
        let count = 0;
        const interval = setInterval(() => {
            if (count >= finalScore) {
                count = finalScore;
                clearInterval(interval);
            }
            text.innerText = count;
            count++;
        }, 15);
    }

    fireConfetti() {
        if (this.results.score >= 70) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981']
            });
        }
    }

    async postScore() {
        try {
            const response = await fetch('/api/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: this.results.name,
                    topic: this.results.topic,
                    score: this.results.score,
                    xp: this.results.xp,
                    badge: this.results.badge
                })
            });
            
            if (!response.ok) {
                console.warn(`Score save returned ${response.status} - data may not persist`);
            }
        } catch (e) {
            console.error("Score Save Error:", e);
        }
    }

    async loadLeaderboard() {
        const list = document.getElementById('leaderboard-list');
        try {
            const resp = await fetch('/api/leaderboard');
            
            if (!resp.ok) {
                console.warn(`Leaderboard API returned ${resp.status}`);
                list.innerHTML = '<p class="text-muted">Leaderboard unavailable</p>';
                return;
            }
            
            const data = await resp.json();
            
            if (!Array.isArray(data)) {
                console.error('Invalid leaderboard data format');
                list.innerHTML = '<p class="text-muted">Invalid data format</p>';
                return;
            }
            
            list.innerHTML = '';
            data.forEach((row, i) => {
                const entry = document.createElement('div');
                const isCurrent = row.name === this.results.name && row.xp === this.results.xp;
                entry.className = `flex items-center justify-between p-3 rounded-lg border border-white/5 ${isCurrent ? 'bg-violet/10 border-violet/30 outline outline-1 outline-violet' : 'bg-white/2'}`;
                
                entry.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="text-[10px] font-bold text-muted w-4">${i + 1}</span>
                        <div>
                            <p class="text-sm font-bold">${row.name} ${i === 0 ? '👑' : ''}</p>
                            <p class="text-[9px] text-muted uppercase">${row.topic}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-xs font-bold text-amber">⚡ ${row.xp}</p>
                        <p class="text-[9px] text-muted">${row.badge.split(' ')[0]}</p>
                    </div>
                `;
                list.appendChild(entry);
            });
        } catch (e) {
            list.innerHTML = '<p class="text-[10px] text-muted italic p-4 text-center">Offline. Start learning to record your rank.</p>';
        }
    }

    setupShare() {
        const btn = document.getElementById('btn-share');
        btn.onclick = async () => {
            const card = document.getElementById('share-card');
            card.style.display = 'flex'; // Temporarily show
            card.style.left = '0';
            
            try {
                const canvas = await html2canvas(card, {
                    backgroundColor: '#0d0d1a',
                    scale: 2,
                    logging: false
                });
                
                const link = document.createElement('a');
                link.download = `NeuroLearn_Achievement_${this.results.name}.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
            } catch (e) {
                console.error("Capture Error:", e);
            } finally {
                card.style.left = '-1000px';
                card.style.display = 'none';
            }
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new NeuroLearnResultsManager();
});
