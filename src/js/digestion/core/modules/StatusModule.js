import { BaseModule } from './BaseModule.js';

/**
 * SM - StatusModule
 * 상태이상 부여 담당
 * 상태: slow, armorReduction, stun, acid, mark
 */
export class StatusModule extends BaseModule {
  constructor(config = {}) {
    super(config);
    this.statusType = config.statusType || null; // 'slow', 'armorReduction', 'stun', 'acid', 'mark'
    this.statusValue = config.statusValue || 0;
    this.statusDuration = config.statusDuration || 0;
    this.statusChance = config.statusChance || 1.0; // 적용 확률
  }

  _applyEffect(context) {
    if (!this.statusType) return context;

    // 확률 체크
    if (Math.random() > this.statusChance) return context;

    if (!context.statusEffects) context.statusEffects = [];

    context.statusEffects.push({
      type: this.statusType,
      value: this.statusValue,
      duration: this.statusDuration
    });

    return context;
  }
}

/**
 * 복합 상태 모듈 생성 헬퍼
 */
export function createMultiStatusModule(statuses) {
  return new StatusModule({
    _applyEffect(context) {
      if (!context.statusEffects) context.statusEffects = [];

      for (const status of statuses) {
        if (Math.random() <= (status.chance || 1.0)) {
          context.statusEffects.push({
            type: status.type,
            value: status.value,
            duration: status.duration
          });
        }
      }

      return context;
    }
  });
}
