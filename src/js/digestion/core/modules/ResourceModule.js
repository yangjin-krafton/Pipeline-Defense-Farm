import { BaseModule } from './BaseModule.js';

/**
 * RM - ResourceModule
 * 자원 획득/환급 담당
 */
export class ResourceModule extends BaseModule {
  constructor(config = {}) {
    super(config);
    this.nutritionOnKill = config.nutritionOnKill || 0;
    this.energyOnKill = config.energyOnKill || 0;
    this.nutritionOnEliteKill = config.nutritionOnEliteKill || 0;
    this.energyOnEliteKill = config.energyOnEliteKill || 0;
    this.chargeRefund = config.chargeRefund || 0; // 처치 시 충전 환급 (%)
  }

  _applyEffect(context) {
    const { food, damage } = context;

    // 처치 시 자원 획득
    if (food.hp - damage <= 0) {
      const isElite = food.traits?.includes('elite') || food.traits?.includes('boss');

      if (isElite) {
        context.gainNutrition = (context.gainNutrition || 0) + this.nutritionOnEliteKill;
        context.gainEnergy = (context.gainEnergy || 0) + this.energyOnEliteKill;
      } else {
        context.gainNutrition = (context.gainNutrition || 0) + this.nutritionOnKill;
        context.gainEnergy = (context.gainEnergy || 0) + this.energyOnKill;
      }

      // 충전 환급
      if (this.chargeRefund > 0) {
        context.chargeRefund = (context.chargeRefund || 0) + this.chargeRefund;
      }
    }

    return context;
  }
}
