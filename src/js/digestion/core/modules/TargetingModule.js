import { BaseModule } from './BaseModule.js';

/**
 * TM - TargetingModule
 * 타겟 우선순위/탐색 규칙 담당
 */
export class TargetingModule extends BaseModule {
  constructor(config = {}) {
    super(config);
    // priority: 'boss', 'elite', 'checkpoint', 'first', 'last', 'strongest', 'weakest'
    this.priority = config.priority || 'first';
    this.targetSwitchSpeedBonus = config.targetSwitchSpeedBonus || 0; // 타겟 전환 속도 보너스
    this.critChanceNearCheckpoint = config.critChanceNearCheckpoint || 0; // 체크포인트 인접 치명타 확률
  }

  /**
   * 타겟 선택 로직
   * @param {Object} context - { tower, foodList, multiPathSystem }
   * @returns {Object} 선택된 타겟
   */
  selectTarget(context) {
    const { tower, foodList, multiPathSystem } = context;

    if (!foodList || foodList.length === 0) return null;

    // 사거리 내 적 필터링
    const validTargets = foodList.filter(food => {
      if (food.hp <= 0) return false;

      const pos = multiPathSystem.samplePath(food.currentPath, food.d);
      if (!pos) return false;

      const dx = pos.x - tower.x;
      const dy = pos.y - tower.y;
      const distSq = dx * dx + dy * dy;

      return distSq <= tower.range * tower.range;
    });

    if (validTargets.length === 0) return null;

    // 우선순위에 따라 타겟 선택
    return this._selectByPriority(validTargets, multiPathSystem, tower);
  }

  _selectByPriority(targets, multiPathSystem, tower) {
    switch (this.priority) {
      case 'boss':
        return targets.find(f => f.traits?.includes('boss')) || targets[0];

      case 'elite':
        return targets.find(f => f.traits?.includes('elite') || f.traits?.includes('boss')) || targets[0];

      case 'checkpoint':
        // 체크포인트에 가장 가까운 적
        return targets.reduce((closest, food) => {
          const foodDist = this._distanceToCheckpoint(food, multiPathSystem);
          const closestDist = this._distanceToCheckpoint(closest, multiPathSystem);
          return foodDist < closestDist ? food : closest;
        });

      case 'strongest':
        return targets.reduce((strongest, food) =>
          food.hp > strongest.hp ? food : strongest
        );

      case 'weakest':
        return targets.reduce((weakest, food) =>
          food.hp < weakest.hp ? food : weakest
        );

      case 'last':
        return targets[targets.length - 1];

      case 'first':
      default:
        return targets[0];
    }
  }

  _distanceToCheckpoint(food, multiPathSystem) {
    const pathData = multiPathSystem.paths[food.currentPath];
    if (!pathData) return Infinity;

    const totalLength = pathData.length;
    return totalLength - food.d;
  }

  /**
   * 타겟팅 보정 적용 (치명타 확률 등)
   */
  _applyEffect(context) {
    const { tower, food, multiPathSystem } = context;

    // 체크포인트 인접 치명타 보너스
    if (this.critChanceNearCheckpoint > 0) {
      const distToCheckpoint = this._distanceToCheckpoint(food, multiPathSystem);
      if (distToCheckpoint < 100) { // 100px 이내
        context.critChance = (context.critChance || 0) + this.critChanceNearCheckpoint;
      }
    }

    return context;
  }
}
