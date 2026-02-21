import { BaseModule } from './BaseModule.js';

/**
 * TB - TagBonusModule
 * 음식 태그 상성 담당
 * 태그: carb, fat, protein, dairy, spicy, soda, fermented
 */
export class TagBonusModule extends BaseModule {
  constructor(config = {}) {
    super(config);
    // 태그별 피해 보너스 { tag: multiplier }
    this.tagBonuses = config.tagBonuses || {};
    // 태그별 특수 효과 { tag: effect }
    this.tagEffects = config.tagEffects || {};
  }

  _applyEffect(context) {
    const { food, damage } = context;
    let finalDamage = damage;

    if (!food.tags || food.tags.length === 0) {
      context.damage = finalDamage;
      return context;
    }

    // 태그 보너스 적용 (첫 번째 매칭만)
    for (const tag of food.tags) {
      if (this.tagBonuses[tag]) {
        finalDamage *= this.tagBonuses[tag];
        context.appliedTagBonus = tag;
        break;
      }
    }

    // 태그별 특수 효과 적용
    for (const tag of food.tags) {
      if (this.tagEffects[tag]) {
        this._applyTagEffect(context, tag, this.tagEffects[tag]);
      }
    }

    context.damage = finalDamage;
    return context;
  }

  _applyTagEffect(context, tag, effect) {
    const { food, tower } = context;

    switch (effect.type) {
      case 'armorReduction':
        // 방어력 감소 → corrode (산성 부식 상태)로 매핑
        if (!context.statusEffects) context.statusEffects = [];
        context.statusEffects.push({
          type: 'corrode',
          value: effect.value,
          duration: effect.duration || 3
        });
        break;

      case 'slow':
        // 이동 속도 감소 → shock (연동 교란 자극)로 매핑
        if (!context.statusEffects) context.statusEffects = [];
        context.statusEffects.push({
          type: 'shock',
          value: effect.value,
          duration: effect.duration || 1.5
        });
        break;

      // 문서 기준 5가지 상태 이상 직접 지원
      case 'expose':
        // 점막 취약 노출: 소화 피해 +8% (최대 3중첩, +24%)
        if (!context.statusEffects) context.statusEffects = [];
        context.statusEffects.push({
          type: 'expose',
          value: effect.value || 0.08,
          duration: effect.duration || 3
        });
        break;

      case 'corrode':
        // 산성 부식 상태: 소화 저항 -6% (최대 2중첩)
        if (!context.statusEffects) context.statusEffects = [];
        context.statusEffects.push({
          type: 'corrode',
          value: effect.value || 0.06,
          duration: effect.duration || 3
        });
        break;

      case 'shock':
        // 연동 교란 자극: 장운동 속도 -10% (감속 합산 캡 -35%)
        if (!context.statusEffects) context.statusEffects = [];
        context.statusEffects.push({
          type: 'shock',
          value: effect.value || 0.10,
          duration: effect.duration || 2
        });
        break;

      case 'mark':
        // 분해 표식: 치명 보정 +8%p
        if (!context.statusEffects) context.statusEffects = [];
        context.statusEffects.push({
          type: 'mark',
          value: effect.value || 0.08,
          duration: effect.duration || 4
        });
        break;

      case 'clustered':
        // 정체 군집 상태: 군집 대상 범위 +10%
        if (!context.statusEffects) context.statusEffects = [];
        context.statusEffects.push({
          type: 'clustered',
          value: effect.value || 0.10,
          duration: effect.duration || 3
        });
        break;

      case 'stun':
        // 기절: 행동 불가 상태
        if (!context.statusEffects) context.statusEffects = [];
        context.statusEffects.push({
          type: 'stun',
          value: effect.value || 1.0,
          duration: effect.duration || 1.5
        });
        break;

      case 'explosion':
        // 처치 시 폭발
        if (!context.onKillEffects) context.onKillEffects = [];
        context.onKillEffects.push({
          type: 'explosion',
          radius: effect.radius || 50,
          slowAmount: effect.slowAmount || 0.25
        });
        break;

      case 'additionalDamage':
        // 고정 추가 피해
        context.damage += effect.value;
        break;
    }
  }
}
