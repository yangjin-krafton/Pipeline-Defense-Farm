import { SUPPLY_CONFIG } from '../data/economyDefinitions.js';

export class SupplySystem {
  constructor() {
    this.currentAP = SUPPLY_CONFIG.globalSupplyAPCap;
    this.maxAP = SUPPLY_CONFIG.globalSupplyAPCap;
    this.regenTimer = 0;
    this.regenInterval = SUPPLY_CONFIG.globalSupplyAPRegenSec;
  }

  update(dt) {
    if (this.currentAP < this.maxAP) {
      this.regenTimer += dt;

      if (this.regenTimer >= this.regenInterval) {
        this.currentAP = Math.min(this.maxAP, this.currentAP + 1);
        this.regenTimer = 0;
        console.log(`AP regenerated: ${this.currentAP}/${this.maxAP}`);
      }
    }
  }

  canSupply() {
    return this.currentAP > 0;
  }

  supplyTower(tower, currentTime) {
    if (!this.canSupply()) {
      console.warn('Not enough AP to supply tower');
      return false;
    }

    // Check diminishing returns
    const timeSinceLastSupply = currentTime - tower.lastSupplyTime;
    let supplyAmount = SUPPLY_CONFIG.supplyPerAction;

    if (timeSinceLastSupply < 10) { // Within 10 seconds
      supplyAmount *= (1 - SUPPLY_CONFIG.diminishingReturnsPenalty);
      console.log('Diminishing returns applied:', supplyAmount);
    }

    this.currentAP--;
    tower.receiveSupply(supplyAmount, currentTime);

    console.log(`Supplied tower, AP: ${this.currentAP}/${this.maxAP}`);
    return true;
  }

  getAPState() {
    return {
      current: this.currentAP,
      max: this.maxAP,
      regenTimer: this.regenTimer,
      regenInterval: this.regenInterval
    };
  }
}
