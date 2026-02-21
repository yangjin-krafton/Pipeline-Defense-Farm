import { NC_CONFIG, SC_CONFIG, ZONE_REWARD_MULTIPLIERS } from '../data/economyDefinitions.js';

/**
 * 2종 재화 시스템 (NC/SC)
 * - NC (Nutrition Credit): 누적형 재화, 상한 없음
 * - SC (Supply Charge): 회복형 재화, 상한 80
 */
export class EconomySystem {
  constructor() {
    // NC (영양 크레딧) - 누적형
    this.nc = NC_CONFIG.initialBalance;

    // SC (보급 차지) - 회복형
    this.sc = SC_CONFIG.initialBalance;
    this.scMax = SC_CONFIG.maxCap;

    // 시간 기반 수급 누적기
    this.scAccumulator = 0;  // SC 수급 시간 누적 (초)
    this.scFractional = 0;   // SC 소수점 누적 (정수 1이 되면 실제 SC 증가)

    // 레거시 호환성
    this.nutrition = this.nc;
  }

  // ===== NC (영양 크레딧) 관리 =====

  canAffordNC(cost) {
    return this.nc >= cost;
  }

  spendNC(cost) {
    if (!this.canAffordNC(cost)) {
      return false;
    }
    this.nc -= cost;
    this.nutrition = this.nc;  // 레거시 동기화
    return true;
  }

  earnNC(amount) {
    this.nc += amount;
    this.nutrition = this.nc;  // 레거시 동기화
    return this.nc;
  }

  getNCBalance() {
    return this.nc;
  }

  // ===== SC (보급 차지) 관리 =====

  canAffordSC(cost) {
    return this.sc >= cost;
  }

  spendSC(cost) {
    if (!this.canAffordSC(cost)) {
      return false;
    }
    this.sc -= cost;
    return true;
  }

  earnSC(amount) {
    this.sc = Math.min(this.scMax, this.sc + amount);
    return this.sc;
  }

  /**
   * SC 획득 + 오버플로 NC 변환
   * 상한 초과분의 50%를 NC로 변환
   */
  earnSCWithOverflow(amount) {
    const before = this.sc;
    const after = this.sc + amount;

    if (after > this.scMax) {
      // 오버플로 발생
      const overflow = after - this.scMax;
      const ncConversion = Math.floor(overflow * SC_CONFIG.overflowToNCRatio);

      this.sc = this.scMax;
      this.earnNC(ncConversion);

      return {
        sc: this.scMax - before,
        ncFromOverflow: ncConversion,
        overflow: overflow
      };
    } else {
      this.sc = after;
      return {
        sc: amount,
        ncFromOverflow: 0,
        overflow: 0
      };
    }
  }

  getSCBalance() {
    return this.sc;
  }

  getSCMax() {
    return this.scMax;
  }

  // ===== 복합 비용 관리 =====

  canAffordBoth(ncCost, scCost) {
    return this.canAffordNC(ncCost) && this.canAffordSC(scCost);
  }

  spendBoth(ncCost, scCost) {
    if (!this.canAffordBoth(ncCost, scCost)) {
      return false;
    }
    this.spendNC(ncCost);
    this.spendSC(scCost);
    return true;
  }

  // ===== 시간 기반 수급 =====

  /**
   * 매 프레임 호출되어 시간 기반 수급 처리
   * @param {number} dt - delta time (초)
   */
  update(dt) {
    // SC 수급 (정수 단위로 1씩 증가)
    const scPerSecond = SC_CONFIG.passiveRegenPerHour / 3600;
    this.scFractional += scPerSecond * dt;

    // 1씩 증가할 때마다 실제 SC 증가
    while (this.scFractional >= 1.0) {
      this.earnSCWithOverflow(1);  // 1씩 증가
      this.scFractional -= 1.0;
    }
  }

  // ===== 음식 처치 보상 (레거시) =====

  earnFromFood(food, pathKey) {
    const baseReward = food.reward || 10;
    const zoneMultiplier = ZONE_REWARD_MULTIPLIERS[pathKey] || 1.0;
    const finalReward = Math.round(baseReward * zoneMultiplier);

    this.earnNC(finalReward);
    return finalReward;
  }

  // ===== 환불 =====

  refund(amount) {
    this.earnNC(amount);
  }

  refundSC(amount) {
    this.earnSC(amount);
  }

  // ===== 레거시 호환 메서드 (기존 코드 호환성 유지) =====

  canAfford(cost) {
    return this.canAffordNC(cost);
  }

  spend(cost) {
    return this.spendNC(cost);
  }

  getBalance() {
    return this.getNCBalance();
  }

  // ===== 상태 조회 =====

  getState() {
    return {
      nc: this.nc,
      sc: this.sc,
      scMax: this.scMax,
      scPercent: (this.sc / this.scMax) * 100,
      scFractional: this.scFractional  // 0-1 범위, 다음 1 SC까지의 진행도
    };
  }

  /**
   * 상태 설정 (저장 데이터 로드용)
   * @param {Object} state - 복원할 경제 상태
   */
  setState(state) {
    if (state.nc !== undefined) this.nc = state.nc;
    if (state.sc !== undefined) this.sc = state.sc;
    if (state.maxSC !== undefined) this.scMax = state.maxSC;
    if (state.scFractional !== undefined) this.scFractional = state.scFractional || 0;

    console.log('[EconomySystem] State restored:', this.getState());
  }
}
