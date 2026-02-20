import { BaseModule } from './BaseModule.js';

/**
 * UM - UnitModule
 * 소환/유닛 제어 담당
 */
export class UnitModule extends BaseModule {
  constructor(config = {}) {
    super(config);
    this.unitType = config.unitType || null; // 'minion', 'drone', 'turret', 'bomb'
    this.unitCount = config.unitCount || 1;
    this.unitLifetime = config.unitLifetime || 0; // 0 = 영구
    this.unitStats = config.unitStats || {};
    this.spawnInterval = config.spawnInterval || 0; // 생산 주기
    this.lastSpawnTime = 0;
  }

  _applyEffect(context) {
    // 소환 유닛 설정
    if (this.unitType) {
      if (!context.spawnUnits) context.spawnUnits = [];

      context.spawnUnits.push({
        type: this.unitType,
        count: this.unitCount,
        lifetime: this.unitLifetime,
        stats: this.unitStats
      });
    }

    return context;
  }

  /**
   * 주기적 유닛 생산
   */
  updateProduction(tower, currentTime) {
    if (this.spawnInterval <= 0) return;

    if (currentTime - this.lastSpawnTime >= this.spawnInterval) {
      // 유닛 생산 로직
      this.lastSpawnTime = currentTime;
      return {
        type: this.unitType,
        count: this.unitCount,
        lifetime: this.unitLifetime,
        stats: this.unitStats
      };
    }

    return null;
  }
}
