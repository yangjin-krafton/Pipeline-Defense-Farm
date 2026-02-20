import { TOWER_DEFINITIONS } from '../data/towerDefinitions.js';
import { AcidRailTower } from '../towers/AcidRailTower.js';
import { EnzymeChargeCannon } from '../towers/EnzymeChargeCannon.js';
import { PierceBoltTower } from '../towers/PierceBoltTower.js';

const TOWER_CLASSES = {
  acidRail: AcidRailTower,
  enzymeCharge: EnzymeChargeCannon,
  pierceBolt: PierceBoltTower
};

export class TowerManager {
  constructor() {
    this.towers = [];
    this.towersBySlot = new Map(); // slotKey -> tower

    // Systems
    this.bulletSystem = null;
    this.particleSystem = null;
  }

  /**
   * Set bullet system for towers to use
   * @param {BulletSystem} bulletSystem
   */
  setBulletSystem(bulletSystem) {
    this.bulletSystem = bulletSystem;
  }

  /**
   * Set particle system for towers to use
   * @param {ParticleSystem} particleSystem
   */
  setParticleSystem(particleSystem) {
    this.particleSystem = particleSystem;
  }

  buildTower(towerType, slotData) {
    const definition = TOWER_DEFINITIONS[towerType];
    if (!definition) {
      console.error(`Tower type ${towerType} not found`);
      return null;
    }

    console.log('TowerManager.buildTower: Systems available?', {
      bulletSystem: this.bulletSystem,
      particleSystem: this.particleSystem
    });

    const TowerClass = TOWER_CLASSES[towerType];
    // Pass systems to tower constructor
    const tower = new TowerClass(
      slotData,
      definition,
      this.bulletSystem,
      this.particleSystem
    );

    this.towers.push(tower);
    const slotKey = `${slotData.x}_${slotData.y}`;
    this.towersBySlot.set(slotKey, tower);

    console.log(`Built ${towerType} tower at (${slotData.x}, ${slotData.y})`);
    return tower;
  }

  getTowerAtSlot(slotData) {
    const slotKey = `${slotData.x}_${slotData.y}`;
    return this.towersBySlot.get(slotKey);
  }

  sellTower(tower) {
    const index = this.towers.indexOf(tower);
    if (index !== -1) {
      this.towers.splice(index, 1);
    }

    // Remove from slot map
    for (const [key, t] of this.towersBySlot.entries()) {
      if (t === tower) {
        this.towersBySlot.delete(key);
        break;
      }
    }

    return Math.floor(tower.definition.cost * 0.7); // 70% refund
  }

  update(dt, foodList, multiPathSystem, currentTime) {
    for (const tower of this.towers) {
      tower.update(dt, foodList, multiPathSystem, currentTime);
    }
  }

  getAllTowers() {
    return this.towers;
  }
}
