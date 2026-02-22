/**
 * StatRollingAnimation.js
 * 스탯 카드 플립 연출 + 등급별 효과음
 *
 * 재생 전략:
 *  - 카드 5장이 120ms 간격으로 순차 플립
 *  - 각 카드가 뒤집히는 순간(flip-out 완료 시점)에 해당 등급 SFX를 100% 볼륨으로 재생
 *  - 총 5번 연달아 재생됨
 */

const GRADE_SFX = {
  'SSS': { event: 'upgrade_reveal_sss', volume: 1.0 },
  'SS':  { event: 'upgrade_reveal_ss',  volume: 1.0 },
  'S':   { event: 'upgrade_reveal_s',   volume: 1.0 },
  'A':   { event: 'upgrade_reveal_a',   volume: 1.0 },
  'B':   { event: 'upgrade_reveal_b',   volume: 1.0 },
  'C':   { event: 'upgrade_reveal_c',   volume: 1.0 },
};

export class StatRollingAnimation {
  constructor() {
    this.isRolling = false;
  }

  /**
   * 카드 플립 시작 (5장, 120ms 간격)
   * @param {Object[]} stats   - [{element, value, min, max, grade}, ...]
   * @param {Function} onComplete
   * @param {Function} [playSfx] - (eventName, volume) => void
   */
  async startRolling(stats, onComplete, playSfx = null) {
    if (this.isRolling) return;
    this.isRolling = true;

    const promises = stats.map((stat, index) =>
      this._flipCard(stat, index * 120, playSfx)
    );

    await Promise.all(promises);

    this.isRolling = false;
    if (onComplete) onComplete();
  }

  /**
   * 단일 카드 플립
   * 1) flip-out (0→90°, 180ms)
   * 2) 90° 지점 — 값 교체 + 등급 SFX 100% 볼륨 재생
   * 3) flip-in (-90°→0°, 280ms, 바운스)
   */
  async _flipCard(stat, delay, playSfx) {
    await this._delay(delay);

    const { element, value, grade } = stat;
    const card = element.closest('.stat-comp-card') ?? element.closest('.stat-comparison-row');

    if (!card) {
      element.textContent = `+${(value * 100).toFixed(1)}%`;
      this._playSfxForGrade(grade, playSfx);
      return;
    }

    // Phase 1 — flip out (180ms)
    card.classList.add('card-flip-out');
    await this._delay(180);

    // 카드가 보이지 않는 순간: 값 교체 + 효과음 100% 볼륨
    element.textContent = `+${(value * 100).toFixed(1)}%`;
    this._playSfxForGrade(grade, playSfx);

    card.classList.remove('card-flip-out');

    // Phase 2 — flip in (280ms, 바운스)
    card.classList.add('card-flip-in');
    await this._delay(280);
    card.classList.remove('card-flip-in');
  }

  _playSfxForGrade(grade, playSfx) {
    if (!playSfx) return;
    const key = grade?.grade;
    if (!key) return;
    const sfx = GRADE_SFX[key];
    if (!sfx) return;
    playSfx(sfx.event, sfx.volume);
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
