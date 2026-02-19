import { BaseTower } from '../core/BaseTower.js';

export class EnzymeTower extends BaseTower {
  constructor(slotData, definition, bulletSystem = null, particleSystem = null) {
    super(slotData, definition, bulletSystem, particleSystem);
    // Enzyme-specific initialization if needed
  }

  // Can override attack() for special effects
  // For MVP, use base implementation
}
