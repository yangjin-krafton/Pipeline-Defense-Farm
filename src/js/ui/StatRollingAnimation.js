/**
 * StatRollingAnimation.js
 * 스탯 롤링 애니메이션 (슬롯머신 스타일)
 */
export class StatRollingAnimation {
  constructor() {
    this.isRolling = false;
  }

  /**
   * 스탯 롤링 시작
   * @param {Object[]} stats - 스탯 정보 배열 [{element, value, grade, min, max}, ...]
   * @param {Function} onComplete - 완료 콜백
   */
  async startRolling(stats, onComplete) {
    if (this.isRolling) return;

    this.isRolling = true;

    // 모든 스탯을 순차적으로 롤링 (150ms 간격)
    const rollingPromises = stats.map((stat, index) => {
      return this._rollSingleStat(stat, index * 150);
    });

    // 모든 롤링 완료 대기
    await Promise.all(rollingPromises);

    this.isRolling = false;
    if (onComplete) onComplete();
  }

  /**
   * 단일 스탯 롤링
   * @param {Object} stat - {element: HTMLElement, value: number, grade: Object, min: number, max: number}
   * @param {number} delay - 시작 지연 (ms)
   */
  async _rollSingleStat(stat, delay) {
    // 초기 지연
    await this._delay(delay);

    const { element, value, min, max } = stat;
    const duration = 800; // 0.8초
    const frameRate = 60;
    const totalFrames = Math.floor(duration / (1000 / frameRate));

    // 롤링 클래스 추가 (CSS 애니메이션)
    element.classList.add('rolling');

    for (let frame = 0; frame < totalFrames; frame++) {
      const progress = frame / totalFrames;
      const easedProgress = this._easeOutCubic(progress);

      if (progress < 0.7) {
        // 랜덤 롤링 (70%까지)
        const randomValue = min + Math.random() * (max - min);
        const displayPercent = (randomValue * 100).toFixed(1);
        element.textContent = `+${displayPercent}%`;
      } else {
        // 최종값으로 수렴 (70% ~ 100%)
        const convergenceProgress = (progress - 0.7) / 0.3;
        const interpolated = min + (value - min) * this._easeOutCubic(convergenceProgress);
        const displayPercent = (interpolated * 100).toFixed(1);
        element.textContent = `+${displayPercent}%`;
      }

      await this._delay(1000 / frameRate);
    }

    // 최종값 설정
    const displayPercent = (value * 100).toFixed(1);
    element.textContent = `+${displayPercent}%`;

    // 롤링 클래스 제거
    element.classList.remove('rolling');

    // 완료 플래시 효과
    const row = element.closest('.stat-comparison-row');
    if (row) {
      row.classList.add('stat-rolled');
      setTimeout(() => row.classList.remove('stat-rolled'), 500);
    }
  }

  /**
   * Ease Out Cubic 이징 함수
   * @param {number} t - 0~1 사이 값
   * @returns {number}
   */
  _easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
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
