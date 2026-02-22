import { BaseModule } from './BaseModule.js';

/**
 * SF - SafetyModule
 * 리스크 완화 담당 (과열, 과산 등)
 */
export class SafetyModule extends BaseModule {
  constructor(config = {}) {
    super(config);
    this.overheatingReduction = config.overheatingReduction || 0; // 과열 페널티 감소 (%)
    this.acidLoadReduction = config.acidLoadReduction || 0; // 과산 누적 감소
    this.minDamageGuarantee = config.minDamageGuarantee || 0; // 최소 피해 보장 (%)
    this.stabilityBonus = config.stabilityBonus || 0; // 안정성 보너스
    this.auraAcidReduction = config.auraAcidReduction || 0; // 주변 타워 과산 누적 감소
    this.minChargeToFire = config.minChargeToFire || 0; // 최소 발사 충전 비율 (0~1, 0=미적용), update()에서 직접 소비
    this.incompleteFirPenaltyReduction = config.incompleteFirPenaltyReduction || 0; // 미완충 피해 페널티 감소 (가산, update()에서 직접 소비)
  }

  _applyEffect(context) {
    const { tower, damage } = context;

    // 최소 피해 보장
    if (this.minDamageGuarantee > 0) {
      const baseDamage = tower.damage || damage;
      const minDamage = baseDamage * this.minDamageGuarantee;
      context.damage = Math.max(context.damage, minDamage);
    }

    // 과열 감소
    if (this.overheatingReduction > 0) {
      context.overheatingReduction = (context.overheatingReduction || 0) + this.overheatingReduction;
    }

    // 과산 누적 감소
    if (this.acidLoadReduction > 0) {
      context.acidLoadReduction = (context.acidLoadReduction || 0) + this.acidLoadReduction;
    }

    // 주변 타워 과산 감소 (오라)
    if (this.auraAcidReduction > 0) {
      context.auraAcidReduction = (context.auraAcidReduction || 0) + this.auraAcidReduction;
    }

    return context;
  }
}
