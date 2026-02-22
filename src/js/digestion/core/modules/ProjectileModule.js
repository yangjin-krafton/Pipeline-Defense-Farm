import { BaseModule } from './BaseModule.js';

/**
 * PM - ProjectileModule
 * 투사체 형태/관통/속도 담당
 */
export class ProjectileModule extends BaseModule {
  constructor(config = {}) {
    super(config);
    this.type = config.type || 'normal'; // 'normal', 'pierce', 'rail', 'chain', 'aoe'
    this.speed = config.speed || 300; // 투사체 속도
    this.pierceCount = config.pierceCount || 0; // 관통 횟수
    this.pierceDistanceBonus = config.pierceDistanceBonus || 0; // 관통 거리 보너스 (%)
    this.pierceDamageFalloff = config.pierceDamageFalloff || 0.15; // 관통 후 피해 감소 (기본 15%)
    this.chainCount = config.chainCount || 0; // 연쇄 횟수
    this.chainRange = config.chainRange || 0; // 연쇄 범위
    this.aoeRadius = config.aoeRadius || 0; // 광역 반경
    this.curveCompensation = config.curveCompensation || 0; // 곡선 구간 관통 손실 감소 (%)
    this.rangeMultiplier = config.rangeMultiplier || 1.0; // 사거리 배율 (update()에서 직접 소비)
    this.chargeRateBonus = config.chargeRateBonus || 0; // 충전 속도 보너스 (가산, update()에서 직접 소비)
  }

  _applyEffect(context) {
    const { tower, food } = context;

    // 투사체 설정 추가
    context.projectile = {
      type: this.type,
      speed: this.speed,
      pierceCount: this.pierceCount,
      pierceDistanceBonus: this.pierceDistanceBonus,
      pierceDamageFalloff: this.pierceDamageFalloff,
      chainCount: this.chainCount,
      chainRange: this.chainRange,
      aoeRadius: this.aoeRadius,
      curveCompensation: this.curveCompensation
    };

    return context;
  }

  /**
   * 관통 피해 계산
   */
  calculatePierceDamage(baseDamage, pierceIndex) {
    if (pierceIndex === 0) return baseDamage;

    const falloff = Math.pow(1 - this.pierceDamageFalloff, pierceIndex);
    return baseDamage * falloff;
  }
}
