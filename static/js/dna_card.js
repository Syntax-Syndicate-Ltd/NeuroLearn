/**
 * NeuroLearn AI — Progress DNA Card Generator
 * Renders a beautiful shareable learning fingerprint card using Canvas API.
 * Features a radar/spider chart of 5 learning metrics.
 */

class DNACard {
    constructor() {
        this.data = null;
        this.canvas = null;
        this.ctx = null;
    }

    async fetchData(topicId) {
        try {
            const response = await fetch(`/api/dna-card/${topicId}`);
            
            if (!response.ok) {
                console.error('❌ [DNA-CARD] API returned:', response.status);
                return null;
            }
            
            const data = await response.json();

            if (!data.success) {
                console.error('❌ [DNA-CARD] Error:', data.error);
                return null;
            }

            this.data = data;
            console.log('✓ [DNA-CARD] Data fetched:', data);
            return data;
        } catch (error) {
            console.error('❌ [DNA-CARD] Fetch error:', error);
            return null;
        }
    }

    renderCard(data, canvasElement) {
        this.data = data;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');

        const w = 480;
        const h = 280;
        canvasElement.width = w * 2; // Retina
        canvasElement.height = h * 2;
        canvasElement.style.width = w + 'px';
        canvasElement.style.height = h + 'px';
        this.ctx.scale(2, 2);

        // Background gradient
        const grad = this.ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#4c1d95');
        grad.addColorStop(1, '#0e7490');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);

        // Subtle pattern overlay
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        for (let i = 0; i < w; i += 20) {
            for (let j = 0; j < h; j += 20) {
                this.ctx.fillRect(i, j, 1, 1);
            }
        }

        // Top section: Name + Topic
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.font = '600 9px system-ui';
        this.ctx.letterSpacing = '2px';
        this.ctx.fillText('LEARNING DNA CARD', 24, 28);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '700 20px system-ui';
        this.ctx.fillText(data.student_name || 'Learner', 24, 52);

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.font = '500 11px system-ui';
        const topicText = (data.topic_title || 'Learning Module').substring(0, 40);
        this.ctx.fillText(topicText, 24, 70);

        // Stats row
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '600 9px system-ui';
        this.ctx.fillText('XP', 24, 95);
        this.ctx.fillText('CHAPTERS', 100, 95);
        this.ctx.fillText('QUIZ AVG', 190, 95);
        this.ctx.fillText('STYLE', 280, 95);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '700 16px system-ui';
        this.ctx.fillText(`⚡ ${data.total_xp || 0}`, 24, 113);
        this.ctx.fillText(`${data.chapters_completed || 0}`, 100, 113);
        this.ctx.fillText(`${Math.round(data.avg_quiz_score || 0)}%`, 190, 113);
        this.ctx.font = '600 12px system-ui';
        this.ctx.fillText(data.learning_style || 'Focus', 280, 113);

        // Radar chart
        const centerX = 380;
        const centerY = 160;
        const radius = 55;

        // Calculate metrics (0-1 scale)
        const emotionDist = data.emotion_distribution || {};
        const totalEmotions = Object.values(emotionDist).reduce((a, b) => a + b, 0) || 1;
        const focusedPct = (emotionDist.focused || 0) / totalEmotions;
        const stabilityPct = 1 - ((emotionDist.distressed || 0) + (emotionDist.anxious || 0) + (emotionDist.tired || 0)) / totalEmotions;

        const metrics = {
            'Focus': Math.min(1, focusedPct * 1.5 + 0.2),
            'Quiz': Math.min(1, (data.avg_quiz_score || 0) / 100),
            'XP': Math.min(1, (data.total_xp || 0) / 2000),
            'Chapters': Math.min(1, (data.chapters_completed || 0) / 10),
            'Stability': Math.max(0.1, stabilityPct)
        };

        this.drawRadarChart(this.ctx, metrics, centerX, centerY, radius);

        // Badge row
        const badges = data.badge_collection || [];
        if (badges.length > 0) {
            this.ctx.font = '16px system-ui';
            const badgeY = 245;
            const badgeStartX = 24;
            badges.slice(0, 8).forEach((badge, i) => {
                this.ctx.fillText(badge.badge_emoji || '🏆', badgeStartX + i * 26, badgeY);
            });
        }

        // Footer
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.font = '500 8px system-ui';
        this.ctx.fillText('Powered by NeuroLearn AI', 24, h - 10);

        // Decorative glow circle
        const glowGrad = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius + 20);
        glowGrad.addColorStop(0, 'rgba(139, 92, 246, 0.08)');
        glowGrad.addColorStop(1, 'rgba(139, 92, 246, 0)');
        this.ctx.fillStyle = glowGrad;
        this.ctx.fillRect(centerX - radius - 30, centerY - radius - 30, (radius + 30) * 2, (radius + 30) * 2);
    }

    drawRadarChart(ctx, metrics, cx, cy, radius) {
        const labels = Object.keys(metrics);
        const values = Object.values(metrics);
        const n = labels.length;
        const angleStep = (Math.PI * 2) / n;
        const startAngle = -Math.PI / 2; // Start from top

        // Draw guide lines and labels
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 0.5;

        // Concentric rings
        for (let ring = 1; ring <= 3; ring++) {
            const r = (radius / 3) * ring;
            ctx.beginPath();
            for (let i = 0; i <= n; i++) {
                const angle = startAngle + i * angleStep;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        // Axis lines
        for (let i = 0; i < n; i++) {
            const angle = startAngle + i * angleStep;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
            ctx.stroke();
        }

        // Data polygon
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const angle = startAngle + i * angleStep;
            const r = values[i] * radius;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(139, 92, 246, 0.4)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Data points
        for (let i = 0; i < n; i++) {
            const angle = startAngle + i * angleStep;
            const r = values[i] * radius;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }

        // Labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '600 8px system-ui';
        ctx.textAlign = 'center';
        for (let i = 0; i < n; i++) {
            const angle = startAngle + i * angleStep;
            const labelR = radius + 14;
            const x = cx + Math.cos(angle) * labelR;
            const y = cy + Math.sin(angle) * labelR + 3;
            ctx.fillText(labels[i], x, y);
        }
        ctx.textAlign = 'start'; // Reset
    }

    downloadCard() {
        if (!this.canvas) return;
        const link = document.createElement('a');
        link.download = `NeuroLearn_DNA_${(this.data?.student_name || 'Card').replace(/\s+/g, '_')}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
        console.log('✓ [DNA-CARD] Card downloaded');
    }
}

window.DNACard = DNACard;
