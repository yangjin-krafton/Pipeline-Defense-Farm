import { BaseModule } from './BaseModule.js';

/**
 * AM - AuraModule
 * 오라/범위 버프 담당
 */
export class AuraModule extends BaseModule {
  constructor(config = {}) {
    super(config);
    this.auraRadius = config.auraRadius || 0;
    this.rangeBonus = config.rangeBonus || 0; // 사거리 보너스 (%)
    this.attackSpeedBonus = config.attackSpeedBonus || 0; // 공속 보너스 (%)
    this.damageBonus = config.damageBonus || 0; // 피해 보너스 (%)
    this.projectileSpeedBonus = config.projectileSpeedBonus || 0; // 투사체 속도 보너스 (%)
  }

  /**
   * 주변 타워에 오라 효과 적용
   * @param {Object} tower - 이 모듈을 가진 타워
   * @param {Array} nearbyTowers - 주변 타워 목록
   */
  applyAura(tower, nearbyTowers) {
    if (this.auraRadius <= 0) return;

    for (const otherTower of nearbyTowers) {
      if (otherTower.id === tower.id) continue;

      const dx = otherTower.x - tower.x;
      const dy = otherTower.y - tower.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= this.auraRadius * this.auraRadius) {
        this._applyAuraEffects(otherTower);
      }
    }
  }

  _applyAuraEffects(tower) {
    if (!tower.auraBonuses) {
      tower.auraBonuses = {
        range: 1,
        attackSpeed: 1,
        damage: 1,
        projectileSpeed: 1
      };
    }

    if (this.rangeBonus > 0) {
      tower.auraBonuses.range += this.rangeBonus;
    }
    if (this.attackSpeedBonus > 0) {
      tower.auraBonuses.attackSpeed += this.attackSpeedBonus;
    }
    if (this.damageBonus > 0) {
      tower.auraBonuses.damage += this.damageBonus;
    }
    if (this.projectileSpeedBonus > 0) {
      tower.auraBonuses.projectileSpeed += this.projectileSpeedBonus;
    }
  }

  _applyEffect(context) {
    // 오라는 공격 시점이 아닌 업데이트 시점에 적용되므로
    // 여기서는 특별한 처리 없음
    return context;
  }
}
