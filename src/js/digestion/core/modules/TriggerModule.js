import { BaseModule } from './BaseModule.js';

/**
 * TR - TriggerModule
 * 조건부 발동 담당
 * 트리거: onKill, onHit, onLowHp, onElite, onBoss
 */
export class TriggerModule extends BaseModule {
  constructor(config = {}) {
    super(config);
    this.triggerType = config.triggerType || null; // 'onKill', 'onHit', 'onLowHp', 'onElite', 'onBoss'
    this.triggerCondition = config.triggerCondition || null; // 추가 조건 함수
    this.triggerEffect = config.triggerEffect || null; // 발동 효과
    this.hpThreshold = config.hpThreshold || 0.3; // 체력 임계치 (0~1)
    this.cooldown = config.cooldown || 0; // 쿨다운 (초)
    this.lastTriggerTime = 0;
  }

  _applyEffect(context) {
    const { food, tower, currentTime } = context;

    // 쿨다운 체크
    if (this.cooldown > 0 && currentTime) {
      if (currentTime - this.lastTriggerTime < this.cooldown) {
        return context;
      }
    }

    // 트리거 조건 체크
    let shouldTrigger = false;

    switch (this.triggerType) {
      case 'onLowHp':
        const hpPercent = food.hp / food.maxHp;
        shouldTrigger = hpPercent <= this.hpThreshold;
        break;

      case 'onElite':
        shouldTrigger = food.traits?.includes('elite');
        break;

      case 'onBoss':
        shouldTrigger = food.traits?.includes('boss');
        break;

      case 'onHit':
        shouldTrigger = true; // 매 타격마다
        break;

      case 'onKill':
        // 처치 시 트리거는 공격 후 체크 필요
        shouldTrigger = food.hp - context.damage <= 0;
        break;

      case 'onCrit':
        // 치명타 시 트리거 (BaseTower.js에서 별도 처리)
        shouldTrigger = context.isCritical === true;
        break;
    }

    // 추가 조건 체크
    if (shouldTrigger && this.triggerCondition) {
      shouldTrigger = this.triggerCondition(context);
    }

    // 트리거 발동
    if (shouldTrigger && this.triggerEffect) {
      const effect = this.triggerEffect(context);

      // 효과 적용 (누적 가능한 값은 누적, 그 외는 할당)
      if (effect) {
        // 누적형 보너스 처리
        const accumulativeKeys = [
          'damageBonus',
          'critChanceBonus',
          'critMultiplierBonus',
          'attackSpeedBonus',
          'rangeBonus'
        ];

        for (const key of accumulativeKeys) {
          if (effect[key] !== undefined) {
            context[key] = (context[key] || 0) + effect[key];
          }
        }

        // 상태 이상 효과 누적
        if (effect.statusEffect) {
          if (!context.statusEffects) context.statusEffects = [];
          context.statusEffects.push(effect.statusEffect);
        }

        // 나머지 값들은 그대로 할당 (덮어쓰기)
        for (const key in effect) {
          if (!accumulativeKeys.includes(key) && key !== 'statusEffect') {
            context[key] = effect[key];
          }
        }
      }

      this.lastTriggerTime = currentTime || 0;
    }

    return context;
  }
}

/**
 * 일반적인 트리거 효과 생성 헬퍼
 */
export const TriggerEffects = {
  /**
   * 피해 증가
   */
  damageBoost: (multiplier) => (context) => {
    return { damage: context.damage * multiplier };
  },

  /**
   * 공격 속도 증가
   */
  attackSpeedBoost: (bonus, duration) => (context) => {
    return {
      tempAttackSpeedBonus: bonus,
      tempBoostDuration: duration
    };
  },

  /**
   * 자원 획득
   */
  resourceGain: (nutrition = 0, energy = 0) => (context) => {
    return {
      gainNutrition: nutrition,
      gainEnergy: energy
    };
  },

  /**
   * 다음 샷 충전 환급
   */
  chargeRefund: (percent) => (context) => {
    return {
      chargeRefund: percent
    };
  },

  /**
   * 즉시 처치 (처형)
   */
  execute: () => (context) => {
    return {
      damage: context.food.hp * 999 // 체력의 999배 피해로 즉시 처치
    };
  }
};
