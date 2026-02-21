/**
 * UpgradeCelebration.js
 * 승급 완료 축하 연출
 */
export class UpgradeCelebration {
  constructor(uiParticleSystem, playSfx = null) {
    this.particleSystem = uiParticleSystem;
    this.overlay = null;
    this.playSfx = typeof playSfx === 'function' ? playSfx : null;
  }

  /**
   * 승급 축하 연출 시작
   * @param {number} fromStar - 이전 성급
   * @param {number} toStar - 새 성급
   * @param {string} imprintName - 선택한 각인 이름
   * @param {Function} onComplete - 완료 콜백
   */
  async celebrate(fromStar, toStar, imprintName, onComplete) {
    // 1. 오버레이 생성
    this._createOverlay(fromStar, toStar, imprintName);
    this._playSfx('tower_upgrade', 0.72);

    // 2. 파티클 폭발
    this._emitCelebrationParticles();

    // 3. 성급 애니메이션 (0.8초)
    await this._animateStarUpgrade();

    // 4. 각인 정보 표시 (1.2초)
    await this._showImprintInfo();

    // 5. 페이드아웃 (0.5초)
    await this._fadeOut();

    // 6. 정리
    this._cleanup();

    if (onComplete) onComplete();
  }

  /**
   * 오버레이 생성
   */
  _createOverlay(fromStar, toStar, imprintName) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'upgrade-celebration-overlay';
    this.overlay.innerHTML = `
      <div class="celebration-content">
        <div class="star-animation-container">
          <div class="star-from">${'⭐'.repeat(fromStar)}</div>
          <div class="star-arrow">→</div>
          <div class="star-to">${'⭐'.repeat(toStar)}</div>
        </div>
        <div class="celebration-text">승급 완료!</div>
        <div class="imprint-info">✨ ${imprintName} 각인 획득</div>
      </div>
    `;

    document.getElementById('tower-star-upgrade').appendChild(this.overlay);

    // 페이드인 애니메이션
    setTimeout(() => this.overlay.classList.add('visible'), 10);
  }

  /**
   * 축하 파티클 발생
   */
  _emitCelebrationParticles() {
    const container = document.getElementById('tower-star-upgrade');
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // 컨페티 폭발
    this.particleSystem.emitConfetti(centerX, centerY, 100);
    this._playSfx('explosion_small', 0.58);

    // 빛나는 효과
    this.particleSystem.emitGlow(centerX, centerY, 150, '#ffd700');
    this._playSfx('wave_start', 0.64);

    // 추가 반짝임
    setTimeout(() => {
      this.particleSystem.emitSparkles(centerX, centerY, '#00d9ff', 50);
      this._playSfx('crit', 0.62);
    }, 300);
  }

  /**
   * 성급 애니메이션
   */
  async _animateStarUpgrade() {
    const starFrom = this.overlay.querySelector('.star-from');
    const starTo = this.overlay.querySelector('.star-to');
    const celebrationText = this.overlay.querySelector('.celebration-text');

    // From star 애니메이션
    starFrom.classList.add('animate');
    this._playSfx('shot', 0.5);
    await this._delay(300);

    // To star 애니메이션
    starTo.classList.add('animate');
    this._playSfx('tower_upgrade', 0.76);
    await this._delay(300);

    // 축하 텍스트 애니메이션
    celebrationText.classList.add('animate');
    this._playSfx('wave_clear', 0.68);
    await this._delay(200);
  }

  /**
   * 각인 정보 표시
   */
  async _showImprintInfo() {
    const imprintInfo = this.overlay.querySelector('.imprint-info');
    imprintInfo.classList.add('visible');
    this._playSfx('ui_click', 0.56);
    await this._delay(1200);
  }

  /**
   * 페이드아웃
   */
  async _fadeOut() {
    this.overlay.classList.add('fade-out');
    this._playSfx('ui_click', 0.46);
    await this._delay(500);
  }

  _playSfx(eventName, volume = 0.7) {
    if (!this.playSfx) return;
    this.playSfx(eventName, volume);
  }

  /**
   * 정리
   */
  _cleanup() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }

  /**
   * 지연 유틸리티
   * @param {number} ms - 밀리초
   * @returns {Promise}
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
