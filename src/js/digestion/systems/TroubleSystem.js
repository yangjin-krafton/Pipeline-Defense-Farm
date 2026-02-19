import { CONGESTION_CONFIG, ACIDITY_CONFIG, TROUBLE_TYPES } from '../data/troubleDefinitions.js';

export class TroubleSystem {
  constructor() {
    this.congestion = 0;
    this.acidity = 0;
  }

  update(dt, foodList, multiPathSystem) {
    // Congestion: increases per food alive
    const foodCount = foodList.length;
    this.congestion += CONGESTION_CONFIG.increasePerFood * foodCount * dt;
    this.congestion = Math.max(0, this.congestion - CONGESTION_CONFIG.decreasePerSecond * dt);

    // Acidity: increases when food in stomach paths
    const stomachFoodCount = foodList.filter(f =>
      ACIDITY_CONFIG.stomachPaths.includes(f.currentPath)
    ).length;

    if (stomachFoodCount > 0) {
      this.acidity += ACIDITY_CONFIG.increasePerSecond * dt;
    } else {
      this.acidity = Math.max(0, this.acidity - ACIDITY_CONFIG.decreasePerSecond * dt);
    }
  }

  getCongestionLevel() {
    const config = CONGESTION_CONFIG.thresholds;
    if (this.congestion >= config.CRITICAL) return 'CRITICAL';
    if (this.congestion >= config.DANGER) return 'DANGER';
    if (this.congestion >= config.WARNING) return 'WARNING';
    return 'NORMAL';
  }

  getAcidityLevel() {
    const config = ACIDITY_CONFIG.thresholds;
    if (this.acidity >= config.CRITICAL) return 'CRITICAL';
    if (this.acidity >= config.DANGER) return 'DANGER';
    if (this.acidity >= config.WARNING) return 'WARNING';
    return 'NORMAL';
  }

  getState() {
    return {
      congestion: this.congestion,
      congestionLevel: this.getCongestionLevel(),
      acidity: this.acidity,
      acidityLevel: this.getAcidityLevel()
    };
  }
}
