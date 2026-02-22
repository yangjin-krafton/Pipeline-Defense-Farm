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

    // XP 설정 (1성 기준) - 초반 가속형 곡선
    // 목표: 첫 10분에 Lv6 만랩 도달
    this.xpRequirements = {
      1: [0, 20, 50, 100, 180, 300],  // 1성: Lv1~6 (누적: 20/50/100/180/300)
      // 성급별로 동적 계산 (지수 곡선)
    };

    // 온라인 XP 수급률 (2초 틱 기반)
    this.xpTickInterval = 2.0;  // 2초마다 XP 획득
    this.xpPerTickPerTower = 1.0;  // 타워당 2초마다 1 XP

    // 승급 히스토리 (구제 메커니즘용)
    this.upgradeHistory = [];

    // 내부 틱 타이머
    this.tickAccumulator = 0;

    console.log('[TowerGrowthSystem] Initialized - 2초 틱 기반, 초반 가속 곡선');
  }

  /**
   * 매 프레임 호출 - 타워들의 XP 증가 (2초 틱 기반)
   * @param {number} dt - delta time (초)
   * @param {BaseTower[]} towers - 타워 목록
   * @param {number} currentTime - 현재 시간 (밀리초)
   */
  update(dt, towers, currentTime) {
    if (!towers || towers.length === 0) return;

    // 틱 누적
    this.tickAccumulator += dt;

    // 2초마다 XP 지급
    if (this.tickAccumulator >= this.xpTickInterval) {
      const tickCount = Math.floor(this.tickAccumulator / this.xpTickInterval);
      this.tickAccumulator -= tickCount * this.xpTickInterval;

      const xpGain = this.xpPerTickPerTower * tickCount;

      for (const tower of towers) {
        this.addXP(tower, xpGain);
      }
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
   * @param {number} star - 성급 (1~7)
   * @returns {number} 최대 레벨
   */
  calculateMaxLevel(star) {
    return 5 + star;  // 1성: Lv6, 7성: Lv12
  }

  /**
   * 성급별 XP 요구량 조회 (누적) - 지수 곡선
   */
  _getXPRequirements(star) {
    if (this.xpRequirements[star]) {
      return this.xpRequirements[star];
    }

    // 성급별 동적 계산 (지수 곡선 - 초반 빠름, 후반 느림)
    const baseLevelCounts = [0, 20, 50, 100, 180, 300];  // 1성 기준 (10분 만랩)
    const maxLevel = this.calculateMaxLevel(star);

    // 지수 곡선 배율: 1성=1.0, 2성=1.5, 3성=2.5, 4성=4.0, ...
    // 공식: multiplier = 1.0 + (star - 1)^1.4 * 0.5
    const multiplier = 1.0 + Math.pow(star - 1, 1.4) * 0.5;

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

    if (tower.star >= 7) {
      return false;  // 최대 성급 (7성)
    }

    const cost = STAR_UPGRADE_COSTS.find(c => c.from === tower.star);
    if (!cost) {
      return false;  // 비용 정의 없음
    }

    return this.economySystem.canAffordBoth(cost.nc, cost.sc);
  }

  /**
   * 승급 비용 조회
   * @param {number} star - 현재 성급
   * @returns {{nc: number, sc: number}} 비용
   */
  getUpgradeCost(star) {
    const cost = STAR_UPGRADE_COSTS.find(c => c.from === star);
    return cost ? { nc: cost.nc, sc: cost.sc } : { nc: 0, sc: 0 };
  }

  /**
   * 다음 레벨까지 필요한 XP 조회
   * @param {BaseTower} tower
   * @returns {number} 필요 XP
   */
  getXPRequiredForNextLevel(tower) {
    const maxLevel = this.calculateMaxLevel(tower.star);
    if (tower.level >= maxLevel) {
      return 0; // 만랩
    }

    const xpReqs = this._getXPRequirements(tower.star);
    return xpReqs[tower.level] || 0;
  }

  /**
   * 승급 실행
   * @param {BaseTower} tower
   * @param {EconomySystem} economySystem - Optional, uses internal if not provided
   * @returns {boolean} 성공 여부
   */
  upgradeStar(tower, economySystem = null) {
    const economy = economySystem || this.economySystem;

    if (!this.canUpgradeStar(tower)) {
      console.warn('[TowerGrowthSystem] Cannot upgrade star');
      return false;
    }

    const cost = STAR_UPGRADE_COSTS.find(c => c.from === tower.star);
    if (!economy.spendBoth(cost.nc, cost.sc)) {
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
   * @returns {{damageMultiplier, attackSpeedMultiplier, rangeMultiplier, critChance}}
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

    // 치명타율: +1%p ~ +4%p (하한 +1%p)
    let critChance = 0.01 + Math.random() * 0.03;
    if (critChance < 0.01) critChance = 0.01;

    return {
      damageMultiplier: damage,
      attackSpeedMultiplier: attackSpeed,
      rangeMultiplier: range,
      critChance: critChance
    };
  }

  /**
   * 스탯 등급 계산 (SSS ~ C)
   * @param {number} value - 실제 스탯 값
   * @param {number} min - 최소값 (하한)
   * @param {number} max - 최대값 (상한)
   * @returns {{grade: string, color: string, emoji: string}}
   */
  calculateStatGrade(value, min, max) {
    // 정규화 (0~1 범위)
    const normalized = (value - min) / (max - min);

    // 등급 기준: SSS(95%↑), SS(85%↑), S(70%↑), A(50%↑), B(30%↑), C(그 외)
    if (normalized >= 0.95) {
      return { grade: 'SSS', color: '#ff6b9d', emoji: '💎' };  // 분홍 (다이아몬드)
    } else if (normalized >= 0.85) {
      return { grade: 'SS', color: '#ffd700', emoji: '⭐' };   // 금색 (별)
    } else if (normalized >= 0.70) {
      return { grade: 'S', color: '#00d9ff', emoji: '✨' };    // 하늘색 (반짝임)
    } else if (normalized >= 0.50) {
      return { grade: 'A', color: '#4caf50', emoji: '🟢' };    // 녹색 (초록 원)
    } else if (normalized >= 0.30) {
      return { grade: 'B', color: '#ff9800', emoji: '🟡' };    // 주황색 (노랑 원)
    } else {
      return { grade: 'C', color: '#9e9e9e', emoji: '⚪' };    // 회색 (하얀 원)
    }
  }

  /**
   * 스탯 롤 (등급 정보 포함)
   * @returns {{damageMultiplier, damageGrade, attackSpeedMultiplier, attackSpeedGrade, rangeMultiplier, rangeGrade, critChance, critGrade}}
   */
  _rollStatGainsWithGrades() {
    const gains = this._rollStatGains();

    return {
      damageMultiplier: gains.damageMultiplier,
      damageGrade: this.calculateStatGrade(gains.damageMultiplier, 0.07, 0.11),

      attackSpeedMultiplier: gains.attackSpeedMultiplier,
      attackSpeedGrade: this.calculateStatGrade(gains.attackSpeedMultiplier, 0.02, 0.04),

      rangeMultiplier: gains.rangeMultiplier,
      rangeGrade: this.calculateStatGrade(gains.rangeMultiplier, 0.01, 0.03),

      critChance: gains.critChance,
      critGrade: this.calculateStatGrade(gains.critChance, 0.01, 0.04)
    };
  }

  /**
   * 스탯 증가 적용
   */
  _applyStatGains(tower, gains) {
    tower.starBonuses.damageMultiplier *= (1 + gains.damageMultiplier);
    tower.starBonuses.attackSpeedMultiplier *= (1 + gains.attackSpeedMultiplier);
    tower.starBonuses.rangeMultiplier *= (1 + gains.rangeMultiplier);
    tower.starBonuses.critChance = (tower.starBonuses.critChance || 0) + gains.critChance;
  }

  /**
   * 스탯 리롤
   * @param {BaseTower} tower
   * @param {EconomySystem} economySystem - Optional, uses internal if not provided
   * @returns {boolean} 성공 여부
   */
  rerollStats(tower, economySystem = null) {
    const economy = economySystem || this.economySystem;
    const cost = 20;  // SC 20

    if (!economy.canAffordSC(cost)) {
      console.warn('[TowerGrowthSystem] Cannot afford stat reroll');
      return false;
    }

    if (tower.star <= 1) {
      console.warn('[TowerGrowthSystem] Cannot reroll stats at star 1');
      return false;
    }

    economy.spendSC(cost);

    // 이전 스탯 롤백 (마지막 승급의 스탯만 리롤)
    const lastGain = this.upgradeHistory[this.upgradeHistory.length - 1];
    if (lastGain) {
      // 이전 스탯 제거
      tower.starBonuses.damageMultiplier /= (1 + lastGain.damageMultiplier);
      tower.starBonuses.attackSpeedMultiplier /= (1 + lastGain.attackSpeedMultiplier);
      tower.starBonuses.rangeMultiplier /= (1 + lastGain.rangeMultiplier);
      tower.starBonuses.critChance = Math.max(0, (tower.starBonuses.critChance || 0) - (lastGain.critChance || 0));
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
