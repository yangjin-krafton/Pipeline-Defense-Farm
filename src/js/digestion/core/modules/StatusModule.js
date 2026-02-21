import { BaseModule } from './BaseModule.js';

/**
 * SM - StatusModule
 * 상태이상 부여 담당
 *
 * 문서 기준 5가지 상태 이상 타입:
 * - expose (점막 취약 노출): 소화 피해 +8% (최대 3중첩, +24%)
 * - corrode (산성 부식 상태): 소화 저항 -6% (최대 2중첩)
 * - shock (연동 교란 자극): 장운동 속도 -10% (이동 둔화, 감속 합산 캡 -35%)
 * - mark (분해 표식): 치명 보정 +8%p (고위협 대상 +5%p)
 * - clustered (정체 군집 상태): 군집 대상 범위 +10% (반경 합산 캡 +25%)
 *
 * 추가 상태 (기존 호환):
 * - stun (기절): 행동 불가 상태
 * - slow (둔화): shock의 별칭으로 사용 가능
 */
export class StatusModule extends BaseModule {
  constructor(config = {}) {
    super(config);
    this.statusType = config.statusType || null; // 'expose', 'corrode', 'shock', 'mark', 'clustered', 'stun', 'slow'
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
