import { COST_RATIOS } from '../data/economyDefinitions.js';

/**
 * SpeedBoostSystem - 전투 배속 부스터 관리 시스템
 *
 * 2x/3x 배속을 SC 소비형 시간제 부스터로 관리합니다.
 * - 2x: 6 SC, 10분 지속
 * - 3x: 12 SC, 10분 지속
 * - 실시간 타이머 (게임 속도와 무관)
 */
export class SpeedBoostSystem {
  constructor() {
    /**
     * 활성 부스터 상태
     * @type {null | {speed: number, startTime: number, duration: number, remainingTime: number}}
     */
    this.activeBoost = null;

    /**
     * 부스터 만료 시 호출될 콜백
     * @type {Function|null}
     */
    this.onBoostExpired = null;

    /**
     * 부스터 활성화 시 호출될 콜백
     * @type {Function|null}
     */
    this.onBoostActivated = null;
  }

  /**
   * 부스터 구매 및 활성화
   * @param {number} speed - 배속 (2 or 3)
   * @param {Object} economySystem - EconomySystem 인스턴스
   * @returns {{success: boolean, reason?: string}}
   */
  activateBoost(speed, economySystem) {
    // 유효성 검사: 속도는 2 또는 3만 가능
    if (speed !== 2 && speed !== 3) {
      console.warn(`[SpeedBoostSystem] Invalid speed: ${speed}. Must be 2 or 3.`);
      return { success: false, reason: 'invalid_speed' };
    }

    // 이미 활성 부스터가 있는지 확인
    if (this.activeBoost !== null) {
      console.log('[SpeedBoostSystem] Cannot activate boost: another boost is already active');
      return { success: false, reason: 'active_boost_exists' };
    }

    // 비용 계산
    const costKey = speed === 2 ? 'speed2x10m' : 'speed3x10m';
    const cost = COST_RATIOS[costKey];

    if (!cost) {
      console.error(`[SpeedBoostSystem] Cost not defined for ${costKey}`);
      return { success: false, reason: 'cost_not_defined' };
    }

    // SC 잔액 확인
    if (!economySystem.canAffordSC(cost)) {
      console.log(`[SpeedBoostSystem] Insufficient SC: need ${cost}, have ${economySystem.sc}`);
      return { success: false, reason: 'insufficient_sc' };
    }

    // SC 차감
    if (!economySystem.spendSC(cost)) {
      console.error('[SpeedBoostSystem] Failed to spend SC');
      return { success: false, reason: 'payment_failed' };
    }

    // 부스터 활성화
    const duration = 600; // 10분 = 600초
    this.activeBoost = {
      speed: speed,
      startTime: Date.now(),
      duration: duration,
      remainingTime: duration
    };

    console.log(`[SpeedBoostSystem] Boost activated: ${speed}x for ${duration}s (cost: ${cost} SC)`);

    // 콜백 호출
    if (this.onBoostActivated) {
      this.onBoostActivated(speed);
    }

    return { success: true };
  }

  /**
   * 매 프레임 업데이트 (실시간 타이머)
   * @param {number} dt - Delta time (초 단위, 실시간)
   * @param {Object} gameLoop - GameLoop 인스턴스
   */
  update(dt, gameLoop) {
    // 활성 부스터가 없으면 리턴
    if (this.activeBoost === null) {
      return;
    }

    // 게임이 일시정지 상태면 타이머 정지
    if (!gameLoop.isRunning) {
      return;
    }

    // 남은 시간 감소 (실시간)
    this.activeBoost.remainingTime -= dt;

    // 만료 확인
    if (this.activeBoost.remainingTime <= 0) {
      console.log(`[SpeedBoostSystem] Boost expired, reverting to 1x`);

      const expiredSpeed = this.activeBoost.speed;
      this.activeBoost = null;

      // 1x로 복귀 (부드러운 전환)
      gameLoop.setTimeScale(1.0, false);

      // 콜백 호출
      if (this.onBoostExpired) {
        this.onBoostExpired(expiredSpeed);
      }
    }
  }

  /**
   * 현재 활성 부스터 정보 반환
   * @returns {Object|null}
   */
  getActiveBoost() {
    return this.activeBoost;
  }

  /**
   * 활성 부스터 존재 여부
   * @returns {boolean}
   */
  hasActiveBoost() {
    return this.activeBoost !== null;
  }

  /**
   * 부스터 강제 종료 (테스트용)
   */
  cancelBoost() {
    if (this.activeBoost) {
      console.log('[SpeedBoostSystem] Boost cancelled manually');
      this.activeBoost = null;
    }
  }

  /**
   * 남은 시간을 포맷팅된 문자열로 반환 (MM:SS)
   * @returns {string}
   */
  getFormattedRemainingTime() {
    if (!this.activeBoost) {
      return '0:00';
    }

    const remaining = Math.max(0, Math.ceil(this.activeBoost.remainingTime));
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * 남은 시간 백분율 (0-100)
   * @returns {number}
   */
  getRemainingTimePercent() {
    if (!this.activeBoost) {
      return 0;
    }

    return Math.max(0, Math.min(100,
      (this.activeBoost.remainingTime / this.activeBoost.duration) * 100
    ));
  }
}
