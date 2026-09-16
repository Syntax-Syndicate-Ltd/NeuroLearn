class OrbitLauncherGame {
    constructor(canvasId, gameData, onComplete) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // Setup dimensions
        const wrap = this.canvas.parentElement;
        const w = wrap.clientWidth || 800;
        const h = Math.max(500, Math.min(w * 0.78, 600));
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.scale(dpr, dpr);
        this.W = w;
        this.H = h;

        this.gameData = gameData;
        this.rounds = gameData.rounds || [];
        this.currentRoundIdx = 0;
        this.onComplete = onComplete;
        this.score = 0;
        this.shakeTime = 0;

        // Constants
        this.G = 2.0; // Gravitational constant
        this.EPSILON = 5.0; // Softening factor

        // Event listeners
        this.canvas.addEventListener('mousedown', this.onPointerDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onPointerMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onPointerUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.onPointerUp.bind(this));
        this.canvas.addEventListener('touchstart', e => { e.preventDefault(); this.onPointerDown(e.touches[0]); }, { passive: false });
        this.canvas.addEventListener('touchmove', e => { e.preventDefault(); this.onPointerMove(e.touches[0]); }, { passive: false });
        this.canvas.addEventListener('touchend', e => { e.preventDefault(); this.onPointerUp(e); }, { passive: false });

        this.particles = [];
        this.stars = [];
        for (let i = 0; i < 100; i++) {
            this.stars.push({
                x: Math.random() * this.W,
                y: Math.random() * this.H,
                size: Math.random() * 2,
                speed: 0.1 + Math.random() * 0.3
            });
        }

        this.initRound();
        
        // Loop
        this.lastTime = performance.now();
        this.animationFrame = requestAnimationFrame(this.loop.bind(this));
    }

    initRound() {
        if (this.currentRoundIdx >= this.rounds.length) {
            this.endGame();
            return;
        }
        
        this.round = this.rounds[this.currentRoundIdx];
        this.shotsLeft = this.round.max_shots || 3;
        this.anchor = { x: this.round.slingshot.x, y: this.round.slingshot.y };
        this.probe = null;
        
        this.isDragging = false;
        this.dragPos = { x: this.anchor.x, y: this.anchor.y };
        
        // Setup planets
        this.planets = JSON.parse(JSON.stringify(this.round.planets));
        this.planets.forEach(p => {
            p.angle = Math.random() * Math.PI * 2;
            p.baseX = p.x;
            p.baseY = p.y;
        });
    }

    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    onPointerDown(e) {
        if (this.probe || this.shotsLeft <= 0) return;
        const pos = this.getPointerPos(e);
        const dx = pos.x - this.anchor.x;
        const dy = pos.y - this.anchor.y;
        if (Math.sqrt(dx * dx + dy * dy) < 50) {
            this.isDragging = true;
            this.dragPos = pos;
        }
    }

    onPointerMove(e) {
        if (!this.isDragging) return;
        const pos = this.getPointerPos(e);
        const dx = pos.x - this.anchor.x;
        const dy = pos.y - this.anchor.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxPull = 100;
        
        if (dist > maxPull) {
            this.dragPos.x = this.anchor.x + (dx / dist) * maxPull;
            this.dragPos.y = this.anchor.y + (dy / dist) * maxPull;
        } else {
            this.dragPos = pos;
        }
    }

    onPointerUp(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        const dx = this.anchor.x - this.dragPos.x;
        const dy = this.anchor.y - this.dragPos.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > 10) {
            this.shotsLeft--;
            const k = 0.08;
            this.probe = {
                x: this.dragPos.x,
                y: this.dragPos.y,
                vx: dx * k,
                vy: dy * k,
                radius: 8,
                trail: []
            };
        } else {
            this.dragPos = { x: this.anchor.x, y: this.anchor.y };
        }
    }

    update(dt) {
        // Orbit logic
        this.planets.forEach(p => {
            p.angle += p.orbit_speed * dt;
            p.x = p.baseX + Math.cos(p.angle) * p.orbit_radius;
            p.y = p.baseY + Math.sin(p.angle) * p.orbit_radius;
        });

        // Particles
        this.particles.forEach(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= 0.05 * dt;
        });
        this.particles = this.particles.filter(p => p.life > 0);

        if (this.shakeTime > 0) this.shakeTime -= dt;

        // Physics integration
        if (this.probe) {
            // N-Body Gravity
            let ax = 0;
            let ay = 0;
            
            for (const p of this.planets) {
                const dx = p.x - this.probe.x;
                const dy = p.y - this.probe.y;
                const distSq = dx*dx + dy*dy;
                const dist = Math.sqrt(distSq);
                
                const force = (this.G * p.mass) / (distSq + this.EPSILON);
                ax += force * (dx / dist);
                ay += force * (dy / dist);
            }

            this.probe.vx += ax * dt;
            this.probe.vy += ay * dt;
            this.probe.x += this.probe.vx * dt;
            this.probe.y += this.probe.vy * dt;

            this.probe.trail.push({x: this.probe.x, y: this.probe.y});
            if (this.probe.trail.length > 30) this.probe.trail.shift();

            // Collision check
            let hit = false;
            for (const p of this.planets) {
                const dx = p.x - this.probe.x;
                const dy = p.y - this.probe.y;
                if (dx*dx + dy*dy < (p.radius + this.probe.radius) * (p.radius + this.probe.radius)) {
                    this.handleHit(p);
                    hit = true;
                    break;
                }
            }

            // Out of bounds check
            if (!hit && (this.probe.x < -100 || this.probe.x > this.W + 100 || this.probe.y < -100 || this.probe.y > this.H + 100)) {
                this.probe = null;
                if (this.shotsLeft <= 0) {
                    this.nextRound(); // Failed round, move on
                }
            }
        }
    }

    handleHit(planet) {
        this.shakeTime = 10;
        this.spawnExplosion(this.probe.x, this.probe.y, planet.color);
        this.probe = null;

        if (planet.is_correct) {
            this.score += (this.shotsLeft + 1) * 100;
            setTimeout(() => this.nextRound(), 1000);
        } else {
            if (this.shotsLeft <= 0) {
                setTimeout(() => this.nextRound(), 1000);
            }
        }
    }

    spawnExplosion(x, y, color) {
        for(let i=0; i<30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                life: 1.0,
                size: 2 + Math.random() * 4
            });
        }
    }

    predictTrajectory() {
        const dx = this.anchor.x - this.dragPos.x;
        const dy = this.anchor.y - this.dragPos.y;
        let px = this.dragPos.x;
        let py = this.dragPos.y;
        const k = 0.08;
        let pvx = dx * k;
        let pvy = dy * k;
        
        const points = [];
        const simDt = 1.0;
        
        // Use current planet positions for prediction, ignoring their orbit speed for simplicity
        for(let i=0; i<60; i++) {
            let ax = 0;
            let ay = 0;
            for (const p of this.planets) {
                const dpx = p.x - px;
                const dpy = p.y - py;
                const distSq = dpx*dpx + dpy*dpy;
                const dist = Math.sqrt(distSq);
                const force = (this.G * p.mass) / (distSq + this.EPSILON);
                ax += force * (dpx / dist);
                ay += force * (dpy / dist);
            }
            pvx += ax * simDt;
            pvy += ay * simDt;
            px += pvx * simDt;
            py += pvy * simDt;
            
            if (i % 3 === 0) points.push({x: px, y: py});
        }
        return points;
    }

    render() {
        this.ctx.save();
        
        if (this.shakeTime > 0) {
            this.ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
        }

        // Background
        const grad = this.ctx.createLinearGradient(0, 0, 0, this.H);
        grad.addColorStop(0, '#050B14');
        grad.addColorStop(1, '#0B1B3D');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.W, this.H);

        // Stars
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.stars.forEach(s => {
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, s.size, 0, Math.PI*2);
            this.ctx.fill();
            s.x -= s.speed;
            if (s.x < 0) s.x = this.W;
        });

        // Slingshot anchor
        this.ctx.strokeStyle = '#475569';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(this.anchor.x, this.anchor.y + 40);
        this.ctx.lineTo(this.anchor.x, this.anchor.y);
        this.ctx.stroke();

        // Drag band and prediction
        if (this.isDragging) {
            this.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            const traj = this.predictTrajectory();
            if (traj.length > 0) {
                this.ctx.moveTo(traj[0].x, traj[0].y);
                for(let i=1; i<traj.length; i++) {
                    this.ctx.lineTo(traj[i].x, traj[i].y);
                }
            }
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            this.ctx.strokeStyle = '#F59E0B';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(this.anchor.x, this.anchor.y);
            this.ctx.lineTo(this.dragPos.x, this.dragPos.y);
            this.ctx.stroke();
            
            // Draw dragged probe
            this.ctx.fillStyle = '#60A5FA';
            this.ctx.beginPath();
            this.ctx.arc(this.dragPos.x, this.dragPos.y, 8, 0, Math.PI*2);
            this.ctx.fill();
        } else if (!this.probe && this.shotsLeft > 0) {
            // Draw idle probe
            this.ctx.fillStyle = '#60A5FA';
            this.ctx.beginPath();
            this.ctx.arc(this.anchor.x, this.anchor.y, 8, 0, Math.PI*2);
            this.ctx.fill();
        }

        // Planets
        if (this.planets) {
            this.planets.forEach(p => {
                // Atmosphere glow
                const radGrad = this.ctx.createRadialGradient(p.x, p.y, p.radius * 0.8, p.x, p.y, p.radius * 1.5);
                radGrad.addColorStop(0, p.color);
                radGrad.addColorStop(1, 'transparent');
                this.ctx.fillStyle = radGrad;
                this.ctx.globalAlpha = 0.3;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius * 1.5, 0, Math.PI*2);
                this.ctx.fill();
                this.ctx.globalAlpha = 1.0;

                // Planet body
                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
                this.ctx.fill();
                
                // Shadow
                this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, Math.PI * 0.25, Math.PI * 1.25);
                this.ctx.fill();

                // Label
                this.ctx.fillStyle = '#FFF';
                this.ctx.font = 'bold 12px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(p.label, p.x, p.y + p.radius + 15);
            });
        }

        // Active Probe
        if (this.probe) {
            // Trail
            this.ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            if (this.probe.trail.length > 0) {
                this.ctx.moveTo(this.probe.trail[0].x, this.probe.trail[0].y);
                for(let i=1; i<this.probe.trail.length; i++) {
                    this.ctx.lineTo(this.probe.trail[i].x, this.probe.trail[i].y);
                }
            }
            this.ctx.stroke();

            // Probe body
            this.ctx.fillStyle = '#93C5FD';
            this.ctx.beginPath();
            this.ctx.arc(this.probe.x, this.probe.y, this.probe.radius, 0, Math.PI*2);
            this.ctx.fill();
        }

        // Particles
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1.0;

        // UI Layer
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 18px sans-serif';
        this.ctx.textAlign = 'center';
        if (this.round) {
            this.ctx.fillText(this.round.prompt, this.W / 2, 40);
        }
        
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 20, 30);
        this.ctx.fillText(`Shots: ${this.shotsLeft}`, 20, 60);
        this.ctx.fillText(`Round: ${this.currentRoundIdx + 1} / ${this.rounds.length}`, 20, 90);

        this.ctx.restore();
    }

    nextRound() {
        this.currentRoundIdx++;
        this.initRound();
    }

    endGame() {
        cancelAnimationFrame(this.animationFrame);
        if (this.onComplete) {
            this.onComplete({ score: this.score });
        }
    }

    loop(timestamp) {
        // dt based physics update
        const dt = Math.min((timestamp - this.lastTime) / 16.666, 2.0); // max step
        this.lastTime = timestamp;
        
        this.update(dt);
        this.render();
        
        this.animationFrame = requestAnimationFrame(this.loop.bind(this));
    }
}
