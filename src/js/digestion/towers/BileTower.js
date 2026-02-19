import { BaseTower } from '../core/BaseTower.js';

export class BileTower extends BaseTower {
  constructor(slotData, definition, bulletSystem = null, particleSystem = null) {
    super(slotData, definition, bulletSystem, particleSystem);
    this.splashRange = definition.stats.splash || 0;
  }

  // MVP: No splash implementation yet (save for Phase 2)
  // Just use base attack
}
