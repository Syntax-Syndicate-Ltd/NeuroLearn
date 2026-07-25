/**
 * NeuroLearn AI — Simple Mode Renderer
 * Renders simplified, card-based content for bored/distracted learners
 * Large fonts, calming colors, one concept per card, step-by-step navigation
 */

class SimpleModeRenderer {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector);
        this.cards = [];
        this.currentCardIndex = 0;
        this.title = '';
        this.encouragement = '';
        this.isActive = false;
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="simple-loading">
                <div class="simple-loading-icon">
                    <div class="simple-loading-pulse"><i class="fas fa-wand-magic-sparkles"></i></div>
                </div>
                <h3 class="simple-loading-title">Simplifying for you...</h3>
                <p class="simple-loading-sub">Making things easier and calmer</p>
            </div>
        `;
        this.container.classList.remove('hidden');
    }

    /**
     * Render the simplified content cards
     */
    render(simpleData) {
        if (!this.container || !simpleData) return;
        
        this.title = simpleData.simplified_title || 'Let\'s Learn Together';
        this.cards = simpleData.cards || [];
        this.encouragement = simpleData.encouragement || 'You\'re doing great! 🌟';
        this.currentCardIndex = 0;
        this.isActive = true;

        // Build dots
        const dotsHTML = this.cards.map((_, i) => 
            `<button class="simple-dot ${i === 0 ? 'active' : ''}" data-idx="${i}" onclick="simpleMode.goToCard(${i})"></button>`
        ).join('');

        this.container.innerHTML = `
            <div class="simple-mode-wrapper">
                <div class="simple-mode-header">
                    <div class="simple-mode-title-row">
                        <h2 class="simple-mode-title">
                            <span class="simple-mode-badge"><i class="fas fa-lightbulb" style="margin-right:4px"></i> SIMPLE MODE</span>
                            ${this.title}
                        </h2>
                        <button class="simple-control-close" onclick="simpleMode.close()" title="Return to normal mode">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <p class="simple-mode-subtitle">One step at a time — you've got this!</p>
                </div>
                
                <div class="simple-cards-viewport">
                    <div class="simple-cards-track" id="simple-cards-track">
                        ${this.cards.map((card, i) => this._renderCard(card, i)).join('')}
                    </div>
                </div>
                
                <div class="simple-navigation">
                    <button class="simple-nav-btn" id="simple-prev-btn" onclick="simpleMode.prevCard()" disabled>
                        <i class="fas fa-chevron-left"></i> Back
                    </button>
                    
                    <div class="simple-dots">
                        ${dotsHTML}
                    </div>
                    
                    <button class="simple-nav-btn simple-nav-next" id="simple-next-btn" onclick="simpleMode.nextCard()">
                        Next <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                
                <div class="simple-encouragement" id="simple-encouragement" style="display:none">
                    <div class="simple-encouragement-icon"><i class="fas fa-trophy" style="color:var(--amber);font-size:2rem;"></i></div>
                    <p class="simple-encouragement-text">${this.encouragement}</p>
                    <button class="btn-primary simple-continue-btn" onclick="simpleMode.complete()">
                        Continue Learning <i class="fas fa-arrow-right ml-2"></i>
                    </button>
                </div>
            </div>
        `;

        this.container.classList.remove('hidden');
        this._updateNavigation();
    }

    /**
     * Render a single card
     */
    _renderCard(card, index) {
        const colorMap = {
            violet: { bg: 'rgba(124, 58, 237, 0.08)', border: 'rgba(124, 58, 237, 0.3)', accent: '#7c3aed' },
            cyan: { bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.3)', accent: '#06b6d4' },
            amber: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.3)', accent: '#f59e0b' },
            emerald: { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)', accent: '#10b981' },
            rose: { bg: 'rgba(244, 63, 94, 0.08)', border: 'rgba(244, 63, 94, 0.3)', accent: '#f43f5e' }
        };
        
        const colors = colorMap[card.color_hint] || colorMap.violet;
        
        // Build image block if available
        let imageHTML = '';
        if (card.image && card.image.url) {
            imageHTML = `
                <div class="simple-card-image-wrap">
                    <img
                        class="simple-card-image"
                        src="${card.image.url}"
                        alt="${card.heading || 'concept image'}"
                        loading="lazy"
                        onerror="this.parentElement.style.display='none'"
                    />
                    ${card.image.attribution ? `<span class="simple-card-img-attr">📷 ${card.image.attribution}</span>` : ''}
                </div>`;
        }
        
        return `
            <div class="simple-card ${index === 0 ? 'active' : ''}" 
                 data-card-idx="${index}"
                 style="--card-bg: ${colors.bg}; --card-border: ${colors.border}; --card-accent: ${colors.accent}">
                <div class="simple-card-inner">
                    <div class="simple-card-emoji"><i class="fas fa-bookmark" style="font-size:2rem;color:var(--card-accent)"></i></div>
                    <h3 class="simple-card-heading">${card.heading || 'Key Concept'}</h3>
                    ${imageHTML}
                    <p class="simple-card-content">${card.content || ''}</p>
                    <div class="simple-card-analogy">
                        <i class="fas fa-lightbulb" style="color: var(--card-accent)"></i>
                        <span>${card.analogy || ''}</span>
                    </div>
                    <div class="simple-card-counter">
                        ${index + 1} / ${this.cards.length}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Navigate to a specific card
     */
    goToCard(index) {
        if (index < 0 || index >= this.cards.length) return;
        
        this.currentCardIndex = index;
        
        // Update card visibility
        const allCards = document.querySelectorAll('.simple-card');
        allCards.forEach((card, i) => {
            card.classList.toggle('active', i === index);
        });
        
        // Slide the track
        const track = document.getElementById('simple-cards-track');
        if (track) {
            track.style.transform = `translateX(-${index * 100}%)`;
        }
        
        this._updateNavigation();
    }

    /**
     * Go to next card
     */
    nextCard() {
        if (this.currentCardIndex < this.cards.length - 1) {
            this.goToCard(this.currentCardIndex + 1);
        } else {
            // Show encouragement at end
            const enc = document.getElementById('simple-encouragement');
            if (enc) enc.style.display = 'flex';
        }
    }

    /**
     * Go to previous card
     */
    prevCard() {
        if (this.currentCardIndex > 0) {
            this.goToCard(this.currentCardIndex - 1);
        }
    }

    /**
     * Update navigation buttons and dots
     */
    _updateNavigation() {
        const prevBtn = document.getElementById('simple-prev-btn');
        const nextBtn = document.getElementById('simple-next-btn');
        
        if (prevBtn) prevBtn.disabled = this.currentCardIndex === 0;
        if (nextBtn) {
            if (this.currentCardIndex >= this.cards.length - 1) {
                nextBtn.innerHTML = 'Finish <i class="fas fa-check"></i>';
            } else {
                nextBtn.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
            }
        }
        
        // Update dots
        document.querySelectorAll('.simple-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentCardIndex);
        });
    }

    /**
     * Close simple mode
     */
    close() {
        this.isActive = false;
        this.container.classList.add('hidden');
        document.dispatchEvent(new CustomEvent('simple-mode-close'));
    }

    /**
     * Complete simple mode
     */
    complete() {
        this.isActive = false;
        this.close();
        document.dispatchEvent(new CustomEvent('simple-mode-complete'));
    }

    /**
     * Hide
     */
    hide() {
        if (this.container) this.container.classList.add('hidden');
    }

    /**
     * Show
     */
    show() {
        if (this.container) this.container.classList.remove('hidden');
    }
}

// Global instance
window.simpleMode = null;
