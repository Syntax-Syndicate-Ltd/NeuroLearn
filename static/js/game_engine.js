// =============================================================
// NEUROLEARN AI — POLISHED HTML5 CANVAS ARCADE GAME ENGINE
// No answer hints — player must READ and THINK to win!
// =============================================================

class ArcadeEngine {
    constructor() {
        this.canvas = document.getElementById('arcade-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // Hi-DPI support
        const wrap = this.canvas.parentElement;
        const w = wrap.clientWidth;
        const h = Math.max(500, Math.min(w * 0.78, 580));
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.height = h + 'px';
        this.ctx.scale(dpr, dpr);
        this.W = w;
        this.H = h;

        this.type = window.gameType || 'true_false_blitz';
        this.items = Array.isArray(window.gameData) ? window.gameData : [];
        this.xpReward = window.xpReward || 250;

        // State
        this.score = 0;
        this.streak = 0;
        this.hearts = 5;
        this.particles = [];
        this.floatTexts = [];
        this.shakeTime = 0;
        this.gameOver = false;
        this.stageCleared = false;
        this.time = 0;
        this.stars = [];
        this.countdown = 3;
        this.countdownStart = Date.now();

        // Generate starfield once
        for (let i = 0; i < 80; i++) {
            this.stars.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: 0.5 + Math.random() * 1.5,
                speed: 0.02 + Math.random() * 0.04,
                phase: Math.random() * Math.PI * 2
            });
        }

        // Input
        this.canvas.addEventListener('click', e => this.onClick(e));
        this.canvas.addEventListener('touchstart', e => { e.preventDefault(); this.onClick(e.touches[0]); }, { passive: false });
        // Track mouse for hover effects
        this.mouseX = -1;
        this.mouseY = -1;
        this.canvas.addEventListener('mousemove', e => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });
        this.canvas.addEventListener('mouseleave', () => { this.mouseX = -1; this.mouseY = -1; });

        this.initGame();
        this.updateHUD();
        this.renderHearts();
        this.loop();

        const instrEl = document.getElementById('game-instruction-text');
        if (instrEl) instrEl.textContent = this.getInstruction();
    }

    getInstruction() {
        switch (this.type) {
            case 'true_false_blitz': return '🌟 Read each orb carefully — tap ONLY the TRUE statements!';
            case 'concept_connect': return '🍬 Flip cards to find matching concept-definition pairs!';
            case 'label_match': return '⚡ Sort falling items — tap the LEFT or RIGHT zone!';
            case 'sequence_sort': return '🔗 Read the steps and tap them in the CORRECT order!';
            case 'code_drop': return '💻 Catch the correct code block before it falls!';
            default: return 'Tap to play!';
        }
    }

    // ──── SHARED RENDERING ────
    drawBackground(baseColor = '#0F172A', accentHue = 220) {
        // Gradient bg
        const grad = this.ctx.createLinearGradient(0, 0, 0, this.H);
        grad.addColorStop(0, baseColor);
        grad.addColorStop(1, `hsl(${accentHue}, 40%, 8%)`);
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.W, this.H);

        // Animated stars
        for (const s of this.stars) {
            const twinkle = 0.3 + Math.sin(this.time * s.speed + s.phase) * 0.3;
            this.ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Subtle nebula glow
        const nx = this.W / 2 + Math.sin(this.time * 0.008) * 100;
        const ny = this.H / 2 + Math.cos(this.time * 0.006) * 60;
        const nebula = this.ctx.createRadialGradient(nx, ny, 0, nx, ny, 250);
        nebula.addColorStop(0, `hsla(${accentHue}, 60%, 40%, 0.06)`);
        nebula.addColorStop(1, 'transparent');
        this.ctx.fillStyle = nebula;
        this.ctx.fillRect(0, 0, this.W, this.H);
    }

    drawTitle(text, y = this.H - 18) {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
        this.ctx.fillRect(0, y - 14, this.W, 28);
        this.ctx.fillStyle = '#FFC800';
        this.ctx.font = 'bold 13px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, this.W / 2, y);
        this.ctx.restore();
    }

    drawProgressBar(current, total, y = 44) {
        const barW = Math.min(260, this.W * 0.45);
        const barH = 8;
        const x = (this.W - barW) / 2;
        // Track
        this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
        this.roundRect(x, y, barW, barH, 4);
        this.ctx.fill();
        // Fill
        const pct = Math.min(current / Math.max(total, 1), 1);
        if (pct > 0) {
            const fillGrad = this.ctx.createLinearGradient(x, 0, x + barW * pct, 0);
            fillGrad.addColorStop(0, '#10B981');
            fillGrad.addColorStop(1, '#34D399');
            this.ctx.fillStyle = fillGrad;
            this.roundRect(x, y, barW * pct, barH, 4);
            this.ctx.fill();
        }
        // Label
        this.ctx.fillStyle = '#94A3B8';
        this.ctx.font = 'bold 11px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${current} / ${total}`, this.W / 2, y + 22);
    }

    isHovering(ox, oy, r) {
        if (this.mouseX < 0) return false;
        const dx = this.mouseX - ox, dy = this.mouseY - oy;
        return dx * dx + dy * dy < r * r;
    }

    isHoveringRect(rx, ry, rw, rh) {
        if (this.mouseX < 0) return false;
        return this.mouseX > rx && this.mouseX < rx + rw && this.mouseY > ry && this.mouseY < ry + rh;
    }

    wrapText(text, maxWidth) {
        const words = text.split(' ');
        const lines = [''];
        for (const w of words) {
            const test = lines[lines.length - 1] + (lines[lines.length - 1] ? ' ' : '') + w;
            if (this.ctx.measureText(test).width > maxWidth && lines[lines.length - 1]) lines.push(w);
            else lines[lines.length - 1] = test;
        }
        return lines;
    }

    // ──── METEOR BLAST (true_false_blitz) ────
    // ALL orbs look IDENTICAL — player must READ to decide
    initMeteorBlitz() {
        this.orbs = this.items.map((item, i) => {
            const angle = (i / this.items.length) * Math.PI * 2;
            const cx = this.W / 2, cy = this.H / 2 - 20;
            const spread = Math.min(this.W, this.H) * 0.3;
            return {
                x: cx + Math.cos(angle) * spread * (0.5 + Math.random() * 0.5),
                y: cy + Math.sin(angle) * spread * (0.5 + Math.random() * 0.5),
                vx: (Math.random() - 0.5) * 2.5,
                vy: (Math.random() - 0.5) * 2.5,
                r: 46,
                text: item.text || item.statement || 'Fact',
                isTarget: item.is_target !== undefined ? item.is_target : (item.answer !== false),
                alive: true,
                pulse: Math.random() * Math.PI * 2,
                trail: [],
                hitAnim: 0,   // animation on click
                hitColor: null
            };
        });
        this.orbsToBlast = this.orbs.filter(o => o.isTarget).length;
        this.blasted = 0;
    }

    updateMeteorBlitz() {
        for (const o of this.orbs) {
            if (!o.alive) { if (o.hitAnim > 0) o.hitAnim -= 0.03; continue; }
            o.x += o.vx;
            o.y += o.vy;
            o.pulse += 0.04;
            // Store trail positions
            o.trail.push({ x: o.x, y: o.y });
            if (o.trail.length > 8) o.trail.shift();
            // Bounce off walls with padding
            const pad = 60;
            if (o.x < pad) { o.x = pad; o.vx = Math.abs(o.vx); }
            if (o.x > this.W - pad) { o.x = this.W - pad; o.vx = -Math.abs(o.vx); }
            if (o.y < pad) { o.y = pad; o.vy = Math.abs(o.vy); }
            if (o.y > this.H - pad - 30) { o.y = this.H - pad - 30; o.vy = -Math.abs(o.vy); }
        }
    }

    renderMeteorBlitz() {
        this.drawBackground('#0B0F1E', 260);

        // Draw progress
        this.drawProgressBar(this.blasted, this.orbsToBlast, 18);

        // Draw dead orb "ghosts" (hit feedback)
        for (const o of this.orbs) {
            if (!o.alive && o.hitAnim > 0) {
                this.ctx.globalAlpha = o.hitAnim * 0.5;
                this.ctx.save();
                this.ctx.shadowColor = o.hitColor || '#FFF';
                this.ctx.shadowBlur = 40;
                this.ctx.beginPath();
                this.ctx.arc(o.x, o.y, o.r * (2 - o.hitAnim), 0, Math.PI * 2);
                this.ctx.fillStyle = o.hitColor || '#FFF';
                this.ctx.fill();
                this.ctx.restore();
                this.ctx.globalAlpha = 1;
            }
        }

        // Draw living orbs — ALL SAME COLOR (no answer hints!)
        for (const o of this.orbs) {
            if (!o.alive) continue;
            const hovered = this.isHovering(o.x, o.y, o.r);
            const glow = 0.6 + Math.sin(o.pulse) * 0.2;
            const r = o.r + Math.sin(o.pulse) * 3 + (hovered ? 4 : 0);

            // Trail
            for (let t = 0; t < o.trail.length; t++) {
                const alpha = (t / o.trail.length) * 0.15;
                this.ctx.fillStyle = `rgba(139, 92, 246, ${alpha})`;
                this.ctx.beginPath();
                this.ctx.arc(o.trail[t].x, o.trail[t].y, r * 0.4 * (t / o.trail.length), 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Outer glow ring
            this.ctx.save();
            this.ctx.shadowColor = `rgba(139, 92, 246, ${glow * 0.5})`;
            this.ctx.shadowBlur = hovered ? 40 : 25;

            // Orb body — ALL USE SAME PURPLE/BLUE gradient
            const grad = this.ctx.createRadialGradient(o.x - r * 0.2, o.y - r * 0.2, 0, o.x, o.y, r);
            grad.addColorStop(0, `rgba(196, 181, 253, ${0.95})`);    // light lavender center
            grad.addColorStop(0.4, `rgba(139, 92, 246, ${0.85})`);   // purple mid
            grad.addColorStop(0.8, `rgba(99, 102, 241, ${0.7})`);    // indigo outer
            grad.addColorStop(1, `rgba(67, 56, 202, ${0.2})`);       // dark edge
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
            this.ctx.fill();

            // Inner highlight
            const hl = this.ctx.createRadialGradient(o.x - r * 0.3, o.y - r * 0.35, 0, o.x, o.y, r * 0.6);
            hl.addColorStop(0, 'rgba(255,255,255,0.3)');
            hl.addColorStop(1, 'rgba(255,255,255,0)');
            this.ctx.fillStyle = hl;
            this.ctx.beginPath();
            this.ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
            this.ctx.fill();

            // Hover ring
            if (hovered) {
                this.ctx.strokeStyle = 'rgba(255, 200, 0, 0.6)';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(o.x, o.y, r + 4, 0, Math.PI * 2);
                this.ctx.stroke();
                this.canvas.style.cursor = 'pointer';
            }
            this.ctx.restore();

            // Text on orb — white with shadow for readability
            this.ctx.save();
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowColor = 'rgba(0,0,0,0.6)';
            this.ctx.shadowBlur = 4;
            const lines = this.wrapText(o.text, r * 1.5);
            const lineH = 13;
            const startY = o.y - (lines.length - 1) * lineH / 2;
            lines.forEach((ln, i) => this.ctx.fillText(ln, o.x, startY + i * lineH));
            this.ctx.restore();
        }

        // Reset cursor if no hover
        if (!this.orbs.some(o => o.alive && this.isHovering(o.x, o.y, o.r))) {
            this.canvas.style.cursor = 'default';
        }

        this.drawTitle('METEOR BLAST — Tap the TRUE statements!');
    }

    clickMeteorBlitz(mx, my) {
        for (const o of this.orbs) {
            if (!o.alive) continue;
            const dx = mx - o.x, dy = my - o.y;
            if (dx * dx + dy * dy < (o.r + 5) * (o.r + 5)) {
                o.alive = false;
                if (o.isTarget) {
                    o.hitAnim = 1; o.hitColor = '#10B981';
                    this.blasted++;
                    this.streak++;
                    const pts = 50 * Math.min(this.streak, 5);
                    this.score += pts;
                    this.spawnBurst(o.x, o.y, '#10B981', 24);
                    this.spawnRing(o.x, o.y, '#10B981');
                    this.addFloatText(o.x, o.y - 40, '+' + pts, '#10B981');
                    if (window.playSound) window.playSound('correct');
                    if (this.blasted >= this.orbsToBlast) setTimeout(() => this.winStage(), 400);
                } else {
                    o.hitAnim = 1; o.hitColor = '#EF4444';
                    this.streak = 0;
                    this.hearts--;
                    this.shakeTime = 14;
                    this.spawnBurst(o.x, o.y, '#EF4444', 20);
                    this.addFloatText(o.x, o.y - 40, '✗ FALSE', '#EF4444');
                    if (window.playSound) window.playSound('wrong');
                    this.renderHearts();
                    if (this.hearts <= 0) this.loseStage();
                }
                this.updateHUD();
                return;
            }
        }
    }

    // ──── CANDY MATCH (concept_connect) ────
    // ALL face-down cards look IDENTICAL — no color hints!
    initCandyMatch() {
        const pairs = this.items.map((it, i) => ({
            id: i,
            left: it.left || it.term || 'Concept ' + (i + 1),
            right: it.right || it.definition || 'Match ' + (i + 1)
        }));
        const revealColors = ['#EC4899', '#8B5CF6', '#06B6D4', '#F59E0B', '#10B981', '#F43F5E', '#6366F1', '#14B8A6'];
        this.cards = [];
        pairs.forEach((p, i) => {
            const col = revealColors[i % revealColors.length];
            this.cards.push({ text: p.left, pairId: i, color: col, flipped: false, matched: false, flipT: 0, matchT: 0 });
            this.cards.push({ text: p.right, pairId: i, color: col, flipped: false, matched: false, flipT: 0, matchT: 0 });
        });
        // Shuffle
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
        // Layout grid
        const cols = Math.min(4, this.cards.length);
        const rows = Math.ceil(this.cards.length / cols);
        const cardPadX = 14, cardPadY = 12;
        const totalW = this.W - 50;
        const totalH = this.H - 110;
        const cw = Math.min(160, totalW / cols);
        const ch = Math.min(90, totalH / rows);
        const startX = (this.W - cols * cw) / 2;
        const startY = (this.H - rows * ch) / 2 + 10;
        this.cards.forEach((c, idx) => {
            c.col = idx % cols;
            c.row = Math.floor(idx / cols);
            c.x = startX + c.col * cw + cw / 2;
            c.y = startY + c.row * ch + ch / 2;
            c.w = cw - cardPadX;
            c.h = ch - cardPadY;
        });
        this.firstFlipped = null;
        this.lockInput = false;
        this.matchedCount = 0;
        this.totalPairs = pairs.length;
    }

    renderCandyMatch() {
        this.drawBackground('#12082B', 280);

        // Title + progress
        this.ctx.fillStyle = '#E0E7FF';
        this.ctx.font = 'bold 15px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('MEMORY MATCH', this.W / 2, 22);
        this.drawProgressBar(this.matchedCount, this.totalPairs, 34);

        for (const c of this.cards) {
            // Animate flip
            if (c.flipped && c.flipT < 1) c.flipT = Math.min(c.flipT + 0.12, 1);
            if (!c.flipped && !c.matched && c.flipT > 0) c.flipT = Math.max(c.flipT - 0.12, 0);
            if (c.matched && c.matchT < 1) c.matchT = Math.min(c.matchT + 0.04, 1);

            const hovered = !c.matched && !c.flipped && this.isHoveringRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
            const scaleX = Math.abs(Math.cos(c.flipT * Math.PI));  // flip animation
            const scaleY = c.matched ? (0.95 + Math.sin(this.time * 0.05 + c.pairId) * 0.02) : (hovered ? 1.05 : 1);

            this.ctx.save();
            this.ctx.translate(c.x, c.y);
            this.ctx.scale(Math.max(scaleX, 0.02), scaleY);

            if (c.matched) {
                // Matched — faded with checkmark
                this.ctx.globalAlpha = 0.3 + Math.sin(this.time * 0.03 + c.pairId) * 0.05;
                this.ctx.fillStyle = c.color;
                this.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 12);
                this.ctx.fill();
                this.ctx.fillStyle = '#FFF';
                this.ctx.font = 'bold 20px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('✓', 0, 0);
            } else if (c.flipT > 0.5) {
                // Face UP — show content with color
                this.ctx.shadowColor = c.color;
                this.ctx.shadowBlur = 18;
                this.ctx.fillStyle = c.color;
                this.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 12);
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
                // Border
                this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                this.ctx.lineWidth = 1.5;
                this.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 12);
                this.ctx.stroke();
                // Text
                this.ctx.fillStyle = '#FFF';
                this.ctx.font = 'bold 11px Inter, system-ui, sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                const lines = this.wrapText(c.text, c.w - 16);
                lines.forEach((ln, i) => this.ctx.fillText(ln, 0, (i - (lines.length - 1) / 2) * 14));
            } else {
                // Face DOWN — ALL cards look the SAME (no color hints!)
                const faceGrad = this.ctx.createLinearGradient(-c.w / 2, -c.h / 2, c.w / 2, c.h / 2);
                faceGrad.addColorStop(0, '#312E81');
                faceGrad.addColorStop(1, '#4338CA');
                this.ctx.fillStyle = faceGrad;
                this.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 12);
                this.ctx.fill();
                // Border
                this.ctx.strokeStyle = hovered ? 'rgba(255,200,0,0.5)' : 'rgba(255,255,255,0.1)';
                this.ctx.lineWidth = hovered ? 2.5 : 1;
                this.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 12);
                this.ctx.stroke();
                // Question mark pattern
                this.ctx.fillStyle = 'rgba(255,255,255,0.12)';
                this.ctx.font = 'bold 24px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('?', 0, 0);
                // Diamond pattern for texture
                this.ctx.strokeStyle = 'rgba(255,255,255,0.04)';
                this.ctx.lineWidth = 1;
                for (let d = -20; d < 25; d += 12) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(d, -c.h / 2);
                    this.ctx.lineTo(d + c.h, c.h / 2);
                    this.ctx.stroke();
                }
            }
            this.ctx.restore();
        }

        // Cursor
        const anyHover = this.cards.some(c => !c.matched && !c.flipped &&
            this.isHoveringRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h));
        this.canvas.style.cursor = anyHover ? 'pointer' : 'default';

        this.drawTitle('Find all matching pairs!');
    }

    clickCandyMatch(mx, my) {
        if (this.lockInput) return;
        for (const c of this.cards) {
            if (c.matched || c.flipped) continue;
            if (mx > c.x - c.w / 2 && mx < c.x + c.w / 2 && my > c.y - c.h / 2 && my < c.y + c.h / 2) {
                c.flipped = true;
                if (window.playSound) window.playSound('click');
                if (!this.firstFlipped) {
                    this.firstFlipped = c;
                } else {
                    this.lockInput = true;
                    const first = this.firstFlipped;
                    if (first.pairId === c.pairId && first !== c) {
                        // Match!
                        setTimeout(() => {
                            first.matched = true;
                            c.matched = true;
                            this.matchedCount++;
                            this.streak++;
                            const pts = 80 * Math.min(this.streak, 4);
                            this.score += pts;
                            this.spawnBurst(c.x, c.y, c.color, 16);
                            this.spawnBurst(first.x, first.y, c.color, 16);
                            this.addFloatText((c.x + first.x) / 2, Math.min(c.y, first.y) - 30, '+' + pts, '#10B981');
                            if (window.playSound) window.playSound('correct');
                            this.firstFlipped = null;
                            this.lockInput = false;
                            this.updateHUD();
                            if (this.matchedCount >= this.totalPairs) setTimeout(() => this.winStage(), 500);
                        }, 400);
                    } else {
                        // No match — lose a heart
                        this.streak = 0;
                        setTimeout(() => {
                            first.flipped = false;
                            c.flipped = false;
                            this.firstFlipped = null;
                            this.lockInput = false;
                            this.addFloatText((c.x + first.x) / 2, Math.min(c.y, first.y) - 20, 'No match', '#F59E0B');
                            if (window.playSound) window.playSound('wrong');
                        }, 800);
                    }
                }
                return;
            }
        }
    }

    // ──── GRAVITY SORT (label_match) ────
    initGravitySort() {
        this.sortItems = this.items.map((it, i) => ({
            text: it.text || it.label || 'Item ' + (i + 1),
            category: it.category || 'left',
            y: -80,
            baseSpeed: 0.8 + Math.random() * 0.4,
            speed: 0,
            x: this.W / 2,
            alive: true,
            rotation: 0,
            entered: false
        }));
        this.catLeft = window.categoryLeft || 'Category A';
        this.catRight = window.categoryRight || 'Category B';
        this.currentSortIdx = 0;
        this.sortedCount = 0;
        this.sortAnim = { active: false, dir: 0, t: 0 };
    }

    updateGravitySort() {
        const cur = this.sortItems[this.currentSortIdx];
        if (!cur || !cur.alive) return;

        if (!cur.entered) {
            cur.entered = true;
            cur.y = -60;
            cur.speed = cur.baseSpeed;
        }

        cur.y += cur.speed;
        // Gentle acceleration
        cur.speed += 0.005;
        cur.x = this.W / 2 + Math.sin(this.time * 0.025) * 50;
        cur.rotation = Math.sin(this.time * 0.02) * 0.06;

        if (cur.y > this.H + 50) {
            cur.alive = false;
            this.hearts--;
            this.streak = 0;
            this.shakeTime = 12;
            this.renderHearts();
            this.addFloatText(this.W / 2, this.H / 2, 'MISSED!', '#EF4444');
            if (window.playSound) window.playSound('wrong');
            this.currentSortIdx++;
            if (this.hearts <= 0) this.loseStage();
            else if (this.currentSortIdx >= this.sortItems.length) this.winStage();
        }

        // Sort animation
        if (this.sortAnim.active) {
            this.sortAnim.t += 0.08;
            if (this.sortAnim.t >= 1) this.sortAnim.active = false;
        }
    }

    renderGravitySort() {
        this.drawBackground('#0C1222', 200);

        // Divider line
        this.ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([6, 6]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.W / 2, 60);
        this.ctx.lineTo(this.W / 2, this.H - 110);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Left zone
        const zoneH = 90;
        const zoneY = this.H - zoneH;
        const hoverLeft = this.isHoveringRect(0, zoneY, this.W / 2 - 8, zoneH);
        const hoverRight = this.isHoveringRect(this.W / 2 + 8, zoneY, this.W / 2 - 8, zoneH);

        // Left bucket
        this.ctx.save();
        const lgGrad = this.ctx.createLinearGradient(0, zoneY, 0, this.H);
        lgGrad.addColorStop(0, `rgba(16,185,129,${hoverLeft ? 0.35 : 0.12})`);
        lgGrad.addColorStop(1, `rgba(16,185,129,${hoverLeft ? 0.15 : 0.04})`);
        this.ctx.fillStyle = lgGrad;
        this.roundRect(6, zoneY, this.W / 2 - 16, zoneH - 6, 16);
        this.ctx.fill();
        this.ctx.strokeStyle = hoverLeft ? '#34D399' : '#10B981';
        this.ctx.lineWidth = hoverLeft ? 3 : 2;
        this.roundRect(6, zoneY, this.W / 2 - 16, zoneH - 6, 16);
        this.ctx.stroke();
        // Label
        this.ctx.fillStyle = '#10B981';
        this.ctx.font = `bold ${hoverLeft ? 17 : 15}px Inter, system-ui, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.catLeft, this.W / 4, zoneY + zoneH / 2 - 3);
        this.ctx.fillStyle = 'rgba(16,185,129,0.5)';
        this.ctx.font = 'bold 10px Inter, system-ui, sans-serif';
        this.ctx.fillText('← TAP HERE', this.W / 4, zoneY + zoneH / 2 + 16);
        this.ctx.restore();

        // Right bucket
        this.ctx.save();
        const rgGrad = this.ctx.createLinearGradient(0, zoneY, 0, this.H);
        rgGrad.addColorStop(0, `rgba(99,102,241,${hoverRight ? 0.35 : 0.12})`);
        rgGrad.addColorStop(1, `rgba(99,102,241,${hoverRight ? 0.15 : 0.04})`);
        this.ctx.fillStyle = rgGrad;
        this.roundRect(this.W / 2 + 10, zoneY, this.W / 2 - 16, zoneH - 6, 16);
        this.ctx.fill();
        this.ctx.strokeStyle = hoverRight ? '#818CF8' : '#6366F1';
        this.ctx.lineWidth = hoverRight ? 3 : 2;
        this.roundRect(this.W / 2 + 10, zoneY, this.W / 2 - 16, zoneH - 6, 16);
        this.ctx.stroke();
        this.ctx.fillStyle = '#6366F1';
        this.ctx.font = `bold ${hoverRight ? 17 : 15}px Inter, system-ui, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.catRight, this.W * 3 / 4, zoneY + zoneH / 2 - 3);
        this.ctx.fillStyle = 'rgba(99,102,241,0.5)';
        this.ctx.font = 'bold 10px Inter, system-ui, sans-serif';
        this.ctx.fillText('TAP HERE →', this.W * 3 / 4, zoneY + zoneH / 2 + 16);
        this.ctx.restore();

        // Cursor
        this.canvas.style.cursor = (hoverLeft || hoverRight) ? 'pointer' : 'default';

        // Falling item
        const cur = this.sortItems[this.currentSortIdx];
        if (cur && cur.alive) {
            const bw = Math.min(240, this.W * 0.45), bh = 56;
            this.ctx.save();
            this.ctx.translate(cur.x, cur.y);
            this.ctx.rotate(cur.rotation);
            // Shadow
            this.ctx.shadowColor = '#FFC800';
            this.ctx.shadowBlur = 25;
            // Card
            const cardGrad = this.ctx.createLinearGradient(-bw / 2, -bh / 2, bw / 2, bh / 2);
            cardGrad.addColorStop(0, '#F59E0B');
            cardGrad.addColorStop(0.5, '#FBBF24');
            cardGrad.addColorStop(1, '#FCD34D');
            this.ctx.fillStyle = cardGrad;
            this.roundRect(-bw / 2, -bh / 2, bw, bh, 16);
            this.ctx.fill();
            // Border
            this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            this.ctx.lineWidth = 1.5;
            this.roundRect(-bw / 2, -bh / 2, bw, bh, 16);
            this.ctx.stroke();
            this.ctx.restore();
            // Text (outside transform for crisp rendering)
            this.ctx.save();
            this.ctx.fillStyle = '#78350F';
            this.ctx.font = 'bold 14px Inter, system-ui, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowColor = 'rgba(255,255,255,0.5)';
            this.ctx.shadowBlur = 2;
            const txtLines = this.wrapText(cur.text, bw - 24);
            txtLines.forEach((ln, i) => this.ctx.fillText(ln, cur.x, cur.y + (i - (txtLines.length - 1) / 2) * 16));
            this.ctx.restore();
        }

        // Progress
        this.drawProgressBar(this.sortedCount, this.sortItems.length, 14);
        this.drawTitle('GRAVITY SORT — Which category?');
    }

    clickGravitySort(mx, my) {
        const cur = this.sortItems[this.currentSortIdx];
        if (!cur || !cur.alive) return;
        const clickedLeft = mx < this.W / 2;
        const correct = (clickedLeft && cur.category === 'left') || (!clickedLeft && cur.category === 'right');
        cur.alive = false;
        const targetX = clickedLeft ? this.W / 4 : this.W * 3 / 4;
        if (correct) {
            this.streak++;
            const pts = 60 * Math.min(this.streak, 4);
            this.score += pts;
            this.spawnBurst(targetX, this.H - 50, correct ? '#10B981' : '#6366F1', 16);
            this.addFloatText(targetX, this.H - 80, '+' + pts, '#10B981');
            if (window.playSound) window.playSound('correct');
        } else {
            this.streak = 0;
            this.hearts--;
            this.shakeTime = 12;
            this.spawnBurst(targetX, this.H - 50, '#EF4444', 14);
            this.addFloatText(targetX, this.H - 80, '✗ Wrong', '#EF4444');
            if (window.playSound) window.playSound('wrong');
            this.renderHearts();
            if (this.hearts <= 0) { this.loseStage(); return; }
        }
        this.sortedCount++;
        this.currentSortIdx++;
        this.updateHUD();
        if (this.currentSortIdx >= this.sortItems.length) setTimeout(() => this.winStage(), 400);
    }

    // ──── CHAIN REACTOR (sequence_sort) ────
    // NO step numbers shown! Player must READ the text and figure out the order
    initChainReactor() {
        const steps = this.items.map((it, i) => ({
            step: it.step || (i + 1),
            text: it.text || 'Step ' + (i + 1),
        }));
        // Position nodes with better spacing — use force layout
        const margin = 70;
        const usableW = this.W - margin * 2;
        const usableH = this.H - margin * 2 - 40;
        this.nodes = steps.map((s, i) => ({
            step: s.step,
            text: s.text,
            x: margin + Math.random() * usableW,
            y: margin + 20 + Math.random() * usableH,
            r: 42,
            activated: false,
            pulse: Math.random() * 6,
            wrongFlash: 0,
            hintFlash: 0
        }));
        // Force-separate overlapping nodes (multiple passes)
        for (let pass = 0; pass < 30; pass++) {
            for (let i = 0; i < this.nodes.length; i++) {
                for (let j = i + 1; j < this.nodes.length; j++) {
                    const dx = this.nodes[j].x - this.nodes[i].x;
                    const dy = this.nodes[j].y - this.nodes[i].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const minDist = 110;
                    if (dist < minDist && dist > 0) {
                        const push = (minDist - dist) / 2;
                        const nx = (dx / dist) * push;
                        const ny = (dy / dist) * push;
                        this.nodes[i].x -= nx;
                        this.nodes[i].y -= ny;
                        this.nodes[j].x += nx;
                        this.nodes[j].y += ny;
                    }
                }
                // Keep in bounds
                this.nodes[i].x = Math.max(margin, Math.min(this.W - margin, this.nodes[i].x));
                this.nodes[i].y = Math.max(margin + 20, Math.min(this.H - margin - 20, this.nodes[i].y));
            }
        }
        this.chainOrder = [];
        this.beams = [];
        this.beamAnim = [];
    }

    renderChainReactor() {
        this.drawBackground('#080818', 240);

        // Animated grid
        this.ctx.strokeStyle = 'rgba(99,102,241,0.05)';
        this.ctx.lineWidth = 1;
        const gridOff = (this.time * 0.3) % 40;
        for (let x = -40 + gridOff; x < this.W + 40; x += 40) {
            this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.H); this.ctx.stroke();
        }
        for (let y = -40 + gridOff; y < this.H + 40; y += 40) {
            this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.W, y); this.ctx.stroke();
        }

        // Beams with animated glow
        for (let bi = 0; bi < this.beams.length; bi++) {
            const b = this.beams[bi];
            const anim = this.beamAnim[bi] || 1;
            // Outer glow
            this.ctx.save();
            this.ctx.strokeStyle = `rgba(6,182,212,${0.3 * anim})`;
            this.ctx.lineWidth = 10;
            this.ctx.shadowColor = '#06B6D4';
            this.ctx.shadowBlur = 30;
            this.ctx.beginPath();
            this.ctx.moveTo(b.x1, b.y1);
            this.ctx.lineTo(b.x2, b.y2);
            this.ctx.stroke();
            // Inner beam
            this.ctx.strokeStyle = `rgba(6,182,212,${0.9})`;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(b.x1, b.y1);
            this.ctx.lineTo(b.x2, b.y2);
            this.ctx.stroke();
            this.ctx.restore();
        }

        // Progress
        this.drawProgressBar(this.chainOrder.length, this.nodes.length, 14);

        // Nodes — NO step numbers! Only text content
        for (const n of this.nodes) {
            n.pulse += 0.035;
            if (n.wrongFlash > 0) n.wrongFlash -= 0.025;
            const hovered = !n.activated && this.isHovering(n.x, n.y, n.r);
            const glow = n.activated ? 1 : (0.5 + Math.sin(n.pulse) * 0.15);
            const r = n.r + (n.activated ? 0 : Math.sin(n.pulse) * 2) + (hovered ? 4 : 0);

            this.ctx.save();
            // Glow
            if (n.wrongFlash > 0) {
                this.ctx.shadowColor = '#EF4444';
                this.ctx.shadowBlur = 30;
            } else if (n.activated) {
                this.ctx.shadowColor = '#10B981';
                this.ctx.shadowBlur = 25;
            } else {
                this.ctx.shadowColor = hovered ? '#FFC800' : `rgba(99,102,241,${glow})`;
                this.ctx.shadowBlur = hovered ? 30 : 18;
            }

            // Node body
            const grad = this.ctx.createRadialGradient(n.x - r * 0.15, n.y - r * 0.15, 0, n.x, n.y, r);
            if (n.activated) {
                grad.addColorStop(0, '#34D399');
                grad.addColorStop(0.6, '#10B981');
                grad.addColorStop(1, 'rgba(16,185,129,0.15)');
            } else if (n.wrongFlash > 0) {
                grad.addColorStop(0, '#FCA5A5');
                grad.addColorStop(0.6, '#EF4444');
                grad.addColorStop(1, 'rgba(239,68,68,0.15)');
            } else {
                grad.addColorStop(0, `rgba(165,148,249,${glow})`);
                grad.addColorStop(0.5, `rgba(99,102,241,${glow * 0.8})`);
                grad.addColorStop(1, 'rgba(67,56,202,0.1)');
            }
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            this.ctx.fill();

            // Inner highlight
            const hl = this.ctx.createRadialGradient(n.x - r * 0.25, n.y - r * 0.3, 0, n.x, n.y, r * 0.5);
            hl.addColorStop(0, 'rgba(255,255,255,0.25)');
            hl.addColorStop(1, 'rgba(255,255,255,0)');
            this.ctx.fillStyle = hl;
            this.ctx.beginPath();
            this.ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            this.ctx.fill();

            // Hover ring
            if (hovered) {
                this.ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)';
                this.ctx.lineWidth = 2.5;
                this.ctx.beginPath();
                this.ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            this.ctx.restore();

            // Text label — NO STEP NUMBER, only content text
            this.ctx.save();
            this.ctx.fillStyle = '#FFF';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
            this.ctx.shadowBlur = 3;

            if (n.activated) {
                // Show checkmark + step number AFTER activation
                this.ctx.font = 'bold 18px Inter, system-ui, sans-serif';
                this.ctx.fillText('✓', n.x, n.y - 6);
                this.ctx.font = 'bold 9px Inter, system-ui, sans-serif';
                this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
                this.ctx.fillText('Step ' + n.step, n.x, n.y + 12);
            } else {
                // Show ONLY text — player must figure out the order
                this.ctx.font = 'bold 10px Inter, system-ui, sans-serif';
                const maxW = r * 1.6;
                const lines = this.wrapText(n.text, maxW);
                const lh = 12;
                const sy = n.y - (lines.length - 1) * lh / 2;
                lines.forEach((ln, i) => this.ctx.fillText(ln, n.x, sy + i * lh));
            }
            this.ctx.restore();
        }

        // Cursor
        this.canvas.style.cursor = this.nodes.some(n => !n.activated && this.isHovering(n.x, n.y, n.r)) ? 'pointer' : 'default';

        this.drawTitle(`CHAIN REACTOR — Tap steps in order! (${this.chainOrder.length}/${this.nodes.length})`);
    }

    clickChainReactor(mx, my) {
        for (const n of this.nodes) {
            if (n.activated) continue;
            const dx = mx - n.x, dy = my - n.y;
            if (dx * dx + dy * dy < (n.r + 5) * (n.r + 5)) {
                const expected = this.chainOrder.length + 1;
                if (n.step === expected) {
                    n.activated = true;
                    this.chainOrder.push(n);
                    this.streak++;
                    const pts = 70 * Math.min(this.streak, 4);
                    this.score += pts;
                    this.spawnBurst(n.x, n.y, '#10B981', 20);
                    this.spawnRing(n.x, n.y, '#06B6D4');
                    this.addFloatText(n.x, n.y - 50, '+' + pts, '#10B981');
                    if (window.playSound) window.playSound('correct');
                    // Beam to previous
                    if (this.chainOrder.length > 1) {
                        const prev = this.chainOrder[this.chainOrder.length - 2];
                        this.beams.push({ x1: prev.x, y1: prev.y, x2: n.x, y2: n.y });
                        this.beamAnim.push(1);
                    }
                    this.updateHUD();
                    if (this.chainOrder.length >= this.nodes.length) setTimeout(() => this.winStage(), 500);
                } else {
                    n.wrongFlash = 1;
                    this.streak = 0;
                    this.hearts--;
                    this.shakeTime = 10;
                    this.addFloatText(n.x, n.y - 50, '✗ Wrong order!', '#EF4444');
                    if (window.playSound) window.playSound('wrong');
                    this.renderHearts();
                    if (this.hearts <= 0) this.loseStage();
                }
                return;
            }
        }
    }

    // ──── CODE DROP (code_drop) ────
    initCodeDrop() {
        const item = this.items[0] || { prompt: 'Fill the gap:', target: 'correct()', options: ['correct()', 'wrong()'] };
        this.codePrompt = item.prompt || 'Select the correct code:';
        this.codeTarget = item.target || item.expected_code || 'correct';
        const opts = item.options || item.choices || [this.codeTarget, 'wrong1', 'wrong2'];
        // Spread blocks horizontally with random speeds
        const spacing = this.W / (opts.length + 1);
        this.codeBlocks = opts.map((o, i) => ({
            text: o,
            isCorrect: o === this.codeTarget,
            x: spacing * (i + 1),
            y: -60 - i * 100 - Math.random() * 60,
            speed: 0.8 + Math.random() * 0.6,
            alive: true,
            w: Math.min(200, this.W * 0.35),
            h: 48,
            wobble: Math.random() * Math.PI * 2
        }));
        this.codeDropDone = false;
        this.slotGlow = 0;
    }

    updateCodeDrop() {
        for (const b of this.codeBlocks) {
            if (!b.alive) continue;
            b.y += b.speed;
            b.speed += 0.003; // gentle acceleration
            b.wobble += 0.03;
            b.x += Math.sin(b.wobble) * 0.5;
            if (b.y > this.H + 60) {
                b.alive = false;
                if (b.isCorrect && !this.codeDropDone) {
                    this.hearts--;
                    this.shakeTime = 12;
                    this.addFloatText(this.W / 2, this.H / 2, 'Missed the answer!', '#EF4444');
                    this.renderHearts();
                    if (window.playSound) window.playSound('wrong');
                    if (this.hearts <= 0) this.loseStage();
                }
            }
        }
        if (this.codeDropDone) this.slotGlow = Math.min(this.slotGlow + 0.05, 1);
    }

    renderCodeDrop() {
        this.drawBackground('#0A0F1F', 200);

        // Prompt at top
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.roundRect(20, 12, this.W - 40, 36, 10);
        this.ctx.fill();
        this.ctx.fillStyle = '#10B981';
        this.ctx.font = 'bold 13px "Fira Code", monospace, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const promptLines = this.wrapText(this.codePrompt, this.W - 60);
        promptLines.forEach((ln, i) => this.ctx.fillText(ln, this.W / 2, 30 + i * 16));
        this.ctx.restore();

        // Target slot at bottom
        const slotW = Math.min(260, this.W * 0.5), slotH = 52;
        const slotX = this.W / 2 - slotW / 2, slotY = this.H - 100;
        this.ctx.save();
        if (this.codeDropDone) {
            this.ctx.shadowColor = '#10B981';
            this.ctx.shadowBlur = 30 * this.slotGlow;
            this.ctx.fillStyle = `rgba(16,185,129,${0.2 * this.slotGlow})`;
            this.roundRect(slotX, slotY, slotW, slotH, 14);
            this.ctx.fill();
            this.ctx.strokeStyle = '#10B981';
            this.ctx.lineWidth = 3;
        } else {
            this.ctx.strokeStyle = '#FFC800';
            this.ctx.lineWidth = 2.5;
            this.ctx.setLineDash([10, 8]);
        }
        this.roundRect(slotX, slotY, slotW, slotH, 14);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();
        // Slot label
        if (this.codeDropDone) {
            this.ctx.fillStyle = '#10B981';
            this.ctx.font = 'bold 14px "Fira Code", monospace, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('✓ ' + this.codeTarget, this.W / 2, slotY + slotH / 2);
        } else {
            this.ctx.fillStyle = '#475569';
            this.ctx.font = 'bold 13px "Fira Code", monospace, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('{ DROP HERE }', this.W / 2, slotY + slotH / 2);
            // Arrow
            const arrY = slotY - 10 + Math.sin(this.time * 0.06) * 5;
            this.ctx.fillStyle = '#FFC800';
            this.ctx.font = 'bold 18px sans-serif';
            this.ctx.fillText('↓', this.W / 2, arrY);
        }

        // Falling blocks — all identical appearance
        for (const b of this.codeBlocks) {
            if (!b.alive) continue;
            const hovered = this.isHoveringRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
            this.ctx.save();
            this.ctx.shadowColor = hovered ? '#FFC800' : '#6366F1';
            this.ctx.shadowBlur = hovered ? 20 : 12;
            const grad = this.ctx.createLinearGradient(b.x - b.w / 2, b.y - b.h / 2, b.x + b.w / 2, b.y + b.h / 2);
            grad.addColorStop(0, hovered ? '#4F46E5' : '#3730A3');
            grad.addColorStop(1, hovered ? '#6366F1' : '#4338CA');
            this.ctx.fillStyle = grad;
            this.roundRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 12);
            this.ctx.fill();
            // Border
            this.ctx.strokeStyle = hovered ? 'rgba(255,200,0,0.5)' : 'rgba(255,255,255,0.1)';
            this.ctx.lineWidth = hovered ? 2 : 1;
            this.roundRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 12);
            this.ctx.stroke();
            this.ctx.restore();
            // Code text
            this.ctx.fillStyle = '#E0E7FF';
            this.ctx.font = 'bold 12px "Fira Code", monospace, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('> ' + b.text, b.x, b.y);
        }

        this.canvas.style.cursor = this.codeBlocks.some(b => b.alive &&
            this.isHoveringRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h)) ? 'pointer' : 'default';

        this.drawTitle('CODE DROP — Tap the correct code block!');
    }

    clickCodeDrop(mx, my) {
        if (this.codeDropDone) return;
        for (const b of this.codeBlocks) {
            if (!b.alive) continue;
            if (mx > b.x - b.w / 2 && mx < b.x + b.w / 2 && my > b.y - b.h / 2 && my < b.y + b.h / 2) {
                b.alive = false;
                if (b.isCorrect) {
                    this.codeDropDone = true;
                    this.streak++;
                    this.score += 100;
                    this.spawnBurst(this.W / 2, this.H - 100, '#10B981', 24);
                    this.spawnRing(this.W / 2, this.H - 100, '#10B981');
                    this.addFloatText(this.W / 2, this.H - 150, '+100 XP', '#10B981');
                    if (window.playSound) window.playSound('correct');
                    this.updateHUD();
                    setTimeout(() => this.winStage(), 1200);
                } else {
                    this.streak = 0;
                    this.hearts--;
                    this.shakeTime = 12;
                    this.spawnBurst(b.x, b.y, '#EF4444', 14);
                    this.addFloatText(b.x, b.y - 30, '✗ Wrong', '#EF4444');
                    if (window.playSound) window.playSound('wrong');
                    this.renderHearts();
                    if (this.hearts <= 0) this.loseStage();
                }
                return;
            }
        }
    }

    // ──── ENGINE CORE ────
    initGame() {
        if (this.type === 'concept_connect') this.initCandyMatch();
        else if (this.type === 'label_match') this.initGravitySort();
        else if (this.type === 'sequence_sort') this.initChainReactor();
        else if (this.type === 'code_drop') this.initCodeDrop();
        else this.initMeteorBlitz();
    }

    onClick(e) {
        if (this.gameOver || this.stageCleared) return;
        // Block clicks during countdown
        if (this.countdown > 0) return;
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (this.type === 'concept_connect') this.clickCandyMatch(mx, my);
        else if (this.type === 'label_match') this.clickGravitySort(mx, my);
        else if (this.type === 'sequence_sort') this.clickChainReactor(mx, my);
        else if (this.type === 'code_drop') this.clickCodeDrop(mx, my);
        else this.clickMeteorBlitz(mx, my);
    }

    loop() {
        if (this.gameOver) return;

        // Countdown phase
        const elapsed = (Date.now() - this.countdownStart) / 1000;
        if (elapsed < 3) {
            this.countdown = 3 - Math.floor(elapsed);
            this.renderCountdown();
            requestAnimationFrame(() => this.loop());
            return;
        }
        this.countdown = 0;
        this.time++;

        // Update game
        if (this.type === 'true_false_blitz') this.updateMeteorBlitz();
        else if (this.type === 'label_match') this.updateGravitySort();
        else if (this.type === 'code_drop') this.updateCodeDrop();

        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.12;
            p.life -= 0.025;
            if (p.type === 'ring') {
                p.r += 3;
                p.life -= 0.01;
            }
            return p.life > 0;
        });
        // Update float texts
        this.floatTexts = this.floatTexts.filter(f => {
            f.y -= 1.0;
            f.life -= 0.018;
            f.scale = Math.min(f.scale + 0.05, 1);
            return f.life > 0;
        });
        if (this.shakeTime > 0) this.shakeTime--;

        // Render
        this.ctx.save();
        if (this.shakeTime > 0) {
            const s = this.shakeTime * 0.7;
            this.ctx.translate(Math.random() * s - s / 2, Math.random() * s - s / 2);
        }

        if (this.type === 'concept_connect') this.renderCandyMatch();
        else if (this.type === 'label_match') this.renderGravitySort();
        else if (this.type === 'sequence_sort') this.renderChainReactor();
        else if (this.type === 'code_drop') this.renderCodeDrop();
        else this.renderMeteorBlitz();

        // Render particles
        for (const p of this.particles) {
            this.ctx.globalAlpha = p.life;
            if (p.type === 'ring') {
                this.ctx.strokeStyle = p.color;
                this.ctx.lineWidth = 2 * p.life;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                this.ctx.stroke();
            } else {
                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        this.ctx.globalAlpha = 1;

        // Render float texts
        for (const f of this.floatTexts) {
            this.ctx.save();
            this.ctx.globalAlpha = Math.min(f.life * 2, 1);
            this.ctx.translate(f.x, f.y);
            this.ctx.scale(f.scale, f.scale);
            // Shadow
            this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
            this.ctx.font = 'bold 18px Inter, system-ui, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(f.text, 1, 1);
            // Text
            this.ctx.fillStyle = f.color;
            this.ctx.fillText(f.text, 0, 0);
            this.ctx.restore();
        }
        this.ctx.restore();

        requestAnimationFrame(() => this.loop());
    }

    renderCountdown() {
        this.drawBackground('#0B0F1E', 260);
        const elapsed = (Date.now() - this.countdownStart) / 1000;
        const num = 3 - Math.floor(elapsed);
        const frac = elapsed % 1;
        const scale = 1 + (1 - frac) * 0.5;
        const alpha = frac < 0.8 ? 1 : (1 - frac) * 5;

        this.ctx.save();
        this.ctx.translate(this.W / 2, this.H / 2);
        this.ctx.scale(scale, scale);
        this.ctx.globalAlpha = alpha;

        // Ring
        this.ctx.strokeStyle = '#6366F1';
        this.ctx.lineWidth = 6;
        this.ctx.shadowColor = '#6366F1';
        this.ctx.shadowBlur = 30;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 60, 0, Math.PI * 2);
        this.ctx.stroke();

        // Number
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 64px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(num > 0 ? num : 'GO!', 0, 0);
        this.ctx.restore();

        // Game name
        this.ctx.fillStyle = '#94A3B8';
        this.ctx.font = 'bold 14px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(window.gameTitle || 'Get Ready!', this.W / 2, this.H / 2 + 100);
    }

    // ──── HELPERS ────
    spawnBurst(x, y, color, count = 18) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: 3 + Math.random() * 5,
                life: 1,
                color,
                type: 'dot'
            });
        }
    }

    spawnRing(x, y, color) {
        this.particles.push({
            x, y, vx: 0, vy: 0, r: 5,
            size: 0, life: 1, color, type: 'ring'
        });
    }

    addFloatText(x, y, text, color) {
        this.floatTexts.push({ x, y, text, color, life: 1, scale: 0.3 });
    }

    roundRect(x, y, w, h, r) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + w - r, y);
        this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        this.ctx.lineTo(x + w, y + h - r);
        this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.ctx.lineTo(x + r, y + h);
        this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        this.ctx.lineTo(x, y + r);
        this.ctx.quadraticCurveTo(x, y, x + r, y);
        this.ctx.closePath();
    }

    updateHUD() {
        const scoreEl = document.getElementById('hud-score');
        if (scoreEl) scoreEl.textContent = this.score;
        const streakEl = document.getElementById('streak-val');
        if (streakEl) streakEl.textContent = this.streak;
        const comboEl = document.getElementById('hud-combo');
        const comboVal = document.getElementById('hud-combo-val');
        if (comboEl && comboVal) {
            if (this.streak >= 2) {
                comboEl.style.opacity = '1';
                comboVal.textContent = this.streak;
            } else {
                comboEl.style.opacity = '0';
            }
        }
    }

    renderHearts() {
        const el = document.getElementById('duo-hearts-bar');
        if (!el) return;
        let html = '';
        for (let i = 0; i < 5; i++) {
            html += `<span class="heart ${i >= this.hearts ? 'lost' : ''}">${i < this.hearts ? '❤️' : '🖤'}</span>`;
        }
        el.innerHTML = html;
    }

    winStage() {
        if (this.stageCleared) return;
        this.stageCleared = true;
        if (window.playSound) window.playSound('complete');
        // Canvas fireworks
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const fx = this.W * 0.2 + Math.random() * this.W * 0.6;
                const fy = this.H * 0.2 + Math.random() * this.H * 0.4;
                this.spawnBurst(fx, fy, ['#FFC800', '#10B981', '#EC4899', '#06B6D4', '#8B5CF6'][i], 20);
                this.spawnRing(fx, fy, '#FFC800');
            }, i * 200);
        }
        const overlay = document.getElementById('game-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.style.opacity = '1', 600);
        }
    }

    loseStage() {
        this.gameOver = true;
        // Draw game over on canvas
        setTimeout(() => {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0, 0, this.W, this.H);
            this.ctx.fillStyle = '#EF4444';
            this.ctx.font = 'bold 36px Inter, system-ui, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('GAME OVER', this.W / 2, this.H / 2 - 30);
            this.ctx.fillStyle = '#94A3B8';
            this.ctx.font = 'bold 16px Inter, system-ui, sans-serif';
            this.ctx.fillText('Score: ' + this.score, this.W / 2, this.H / 2 + 10);
            this.ctx.fillStyle = '#FFC800';
            this.ctx.font = 'bold 14px Inter, system-ui, sans-serif';
            this.ctx.fillText('Tap to retry', this.W / 2, this.H / 2 + 45);
            this.ctx.restore();
            // Allow retry on click
            this.canvas.addEventListener('click', () => location.reload(), { once: true });
        }, 300);
    }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
    window.arcadeGame = new ArcadeEngine();
});
