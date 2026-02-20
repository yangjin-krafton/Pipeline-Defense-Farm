import { STAR_UPGRADE_COSTS } from '../data/economyDefinitions.js';

/**
 * 타워 성장 시스템
 * - XP 획득 및 레벨업
 * - 성급(Star) 승급
 * - 스탯 리롤
 */
export class TowerGrowthSystem {
  constructor(economySystem) {
    this.economySystem = economySystem;

    // XP 설정 (1성 기준)
    this.xpRequirements = {
      1: [0, 40, 90, 160, 260, 500],  // 1성: Lv1~5
      // 성급별로 동적 계산
    };

    // 온라인 XP 수급률
    this.xpPerHourPerTower = 100;  // 타워당 100 XP/h

    // 승급 히스토리 (구제 메커니즘용)
    this.upgradeHistory = [];

    console.log('[TowerGrowthSystem] Initialized');
  }

  /**
   * 매 프레임 호출 - 타워들의 XP 증가
   * @param {number} dt - delta time (초)
   * @param {BaseTower[]} towers - 타워 목록
   */
  update(dt, towers) {
    if (!towers || towers.length === 0) return;

    const xpPerSecond = this.xpPerHourPerTower / 3600;
    const xpGain = xpPerSecond * dt;

    for (const tower of towers) {
      this.addXP(tower, xpGain);
    }
  }

  /**
   * XP 추가
   * @param {BaseTower} tower
   * @param {number} amount
   */
  addXP(tower, amount) {
    tower.xp += amount;
    this.checkLevelUp(tower);
  }

  /**
   * 레벨업 체크 및 처리
   * @param {BaseTower} tower
   */
  checkLevelUp(tower) {
    const maxLevel = this.calculateMaxLevel(tower.star);
    const xpReqs = this._getXPRequirements(tower.star);

    while (tower.level < maxLevel && tower.xp >= xpReqs[tower.level]) {
      tower.level++;
      tower.upgradePoints++;  // 레벨업마다 +1 포인트

      console.log(`[TowerGrowthSystem] ${tower.definition.name} leveled up to Lv${tower.level}! (XP: ${Math.floor(tower.xp)}/${xpReqs[tower.level] || 'MAX'})`);

      // 만랩 도달 시
      if (tower.level >= maxLevel) {
        console.log(`[TowerGrowthSystem] ${tower.definition.name} reached max level (${tower.star}★ Lv${maxLevel})!`);
        break;
      }
    }
  }

  /**
   * 성급별 최대 레벨 계산
   * @param {number} star - 성급 (1~12)
   * @returns {number} 최대 레벨
   */
  calculateMaxLevel(star) {
    return 4 + star;  // 1성: Lv5, 12성: Lv16
  }

  /**
   * 성급별 XP 요구량 조회 (누적)
   */
  _getXPRequirements(star) {
    if (this.xpRequirements[star]) {
      return this.xpRequirements[star];
    }

    // 성급별 동적 계산 (1성 기준의 배율 적용)
    const baseLevelCounts = [0, 40, 90, 160, 260, 500];
    const maxLevel = this.calculateMaxLevel(star);
    const multiplier = 1 + (star - 1) * 0.5;  // 성급당 +50% XP 요구량

    const reqs = [];
    for (let i = 0; i <= maxLevel; i++) {
      const baseIndex = Math.min(i, baseLevelCounts.length - 1);
      reqs.push(Math.floor(baseLevelCounts[baseIndex] * multiplier));
    }

    this.xpRequirements[star] = reqs;
    return reqs;
  }

  /**
   * 승급 가능 여부
   * @param {BaseTower} tower
   * @returns {boolean}
   */
  canUpgradeStar(tower) {
    const maxLevel = this.calculateMaxLevel(tower.star);
    if (tower.level < maxLevel) {
      return false;  // 만랩 미달
    }

    if (tower.star >= 12) {
      return false;  // 최대 성급
    }

    const cost = STAR_UPGRADE_COSTS.find(c => c.from === tower.star);
    if (!cost) {
      return false;  // 비용 정의 없음
    }

    return this.economySystem.canAffordBoth(cost.nc, cost.sc);
  }

  /**
   * 승급 실행
   * @param {BaseTower} tower
   * @returns {boolean} 성공 여부
   */
  upgradeStar(tower) {
    if (!this.canUpgradeStar(tower)) {
      console.warn('[TowerGrowthSystem] Cannot upgrade star');
      return false;
    }

    const cost = STAR_UPGRADE_COSTS.find(c => c.from === tower.star);
    if (!this.economySystem.spendBoth(cost.nc, cost.sc)) {
      return false;
    }

    // 성급 상승
    tower.star++;

    // XP 리셋
    tower.xp = 0;
    tower.level = 1;

    // 랜덤 스탯 증가
    const statGains = this._rollStatGains();
    this._applyStatGains(tower, statGains);

    // 히스토리 기록
    this.upgradeHistory.push(statGains);
    if (this.upgradeHistory.length > 3) {
      this.upgradeHistory.shift();  // 최근 3회만 유지
    }

    console.log(`[TowerGrowthSystem] ${tower.definition.name} upgraded to ${tower.star}★!`, statGains);

    return true;
  }

  /**
   * 랜덤 스탯 증가 롤
   * @returns {{damageMultiplier, attackSpeedMultiplier, rangeMultiplier, statusSuccessRate}}
   */
  _rollStatGains() {
    // 공격력: +5% ~ +11% (하한 +7%)
    let damage = 0.05 + Math.random() * 0.06;
    if (damage < 0.07) damage = 0.07;

    // 공격속도: +1% ~ +4% (하한 +2%)
    let attackSpeed = 0.01 + Math.random() * 0.03;
    if (attackSpeed < 0.02) attackSpeed = 0.02;

    // 사거리: +0% ~ +3% (하한 +1%)
    let range = Math.random() * 0.03;
    if (range < 0.01) range = 0.01;

    // 상태이상 성공률: +1%p ~ +3%p (하한 +1.5%p)
    let statusRate = 0.01 + Math.random() * 0.02;
    if (statusRate < 0.015) statusRate = 0.015;

    return {
      damageMultiplier: damage,
      attackSpeedMultiplier: attackSpeed,
      rangeMultiplier: range,
      statusSuccessRate: statusRate
    };
  }

  /**
   * 스탯 증가 적용
   */
  _applyStatGains(tower, gains) {
    tower.starBonuses.damageMultiplier *= (1 + gains.damageMultiplier);
    tower.starBonuses.attackSpeedMultiplier *= (1 + gains.attackSpeedMultiplier);
    tower.starBonuses.rangeMultiplier *= (1 + gains.rangeMultiplier);
    tower.starBonuses.statusSuccessRate += gains.statusSuccessRate;
  }

  /**
   * 스탯 리롤
   * @param {BaseTower} tower
   * @returns {boolean} 성공 여부
   */
  rerollStats(tower) {
    const cost = 20;  // SC 20

    if (!this.economySystem.canAffordSC(cost)) {
      console.warn('[TowerGrowthSystem] Cannot afford stat reroll');
      return false;
    }

    if (tower.star <= 1) {
      console.warn('[TowerGrowthSystem] Cannot reroll stats at star 1');
      return false;
    }

    this.economySystem.spendSC(cost);

    // 이전 스탯 롤백 (마지막 승급의 스탯만 리롤)
    const lastGain = this.upgradeHistory[this.upgradeHistory.length - 1];
    if (lastGain) {
      // 이전 스탯 제거
      tower.starBonuses.damageMultiplier /= (1 + lastGain.damageMultiplier);
      tower.starBonuses.attackSpeedMultiplier /= (1 + lastGain.attackSpeedMultiplier);
      tower.starBonuses.rangeMultiplier /= (1 + lastGain.rangeMultiplier);
      tower.starBonuses.statusSuccessRate -= lastGain.statusSuccessRate;
    }

    // 새 스탯 롤
    const newGains = this._rollStatGains();
    this._applyStatGains(tower, newGains);

    // 히스토리 업데이트
    this.upgradeHistory[this.upgradeHistory.length - 1] = newGains;

    console.log('[TowerGrowthSystem] Stats rerolled', newGains);
    return true;
  }

  /**
   * 구제 메커니즘 체크
   * 최근 3회 승급 평균이 하위 20%면 무료 리롤 1회
   * @returns {boolean} 무료 리롤 가능 여부
   */
  checkBadLuckProtection() {
    if (this.upgradeHistory.length < 3) {
      return false;
    }

    // 최근 3회 평균 스탯 계산
    const avgDamage = this.upgradeHistory.reduce((sum, g) => sum + g.damageMultiplier, 0) / 3;

    // 하위 20% 기준: 평균 공격력 증가가 +7.2% 이하
    const threshold = 0.072;

    return avgDamage < threshold;
  }

  /**
   * 타워 성장 상태 조회
   * @param {BaseTower} tower
   */
  getTowerGrowthState(tower) {
    const maxLevel = this.calculateMaxLevel(tower.star);
    const xpReqs = this._getXPRequirements(tower.star);
    const currentLevelXP = tower.level < maxLevel ? xpReqs[tower.level] : xpReqs[maxLevel - 1];
    const nextLevelXP = tower.level < maxLevel ? xpReqs[tower.level] : null;

    return {
      star: tower.star,
      level: tower.level,
      maxLevel: maxLevel,
      xp: Math.floor(tower.xp),
      nextLevelXP: nextLevelXP,
      xpProgress: nextLevelXP ? (tower.xp / nextLevelXP) * 100 : 100,
      upgradePoints: tower.upgradePoints,
      canUpgrade: this.canUpgradeStar(tower),
      starBonuses: tower.starBonuses
    };
  }
}
