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

  /**
   * Relocate tower to a new slot
   * @param {Tower} tower - Tower to relocate
   * @param {Object} newSlot - New slot data {x, y, radius}
   * @param {boolean} isEmergency - Is emergency relocation (higher cost)
   * @returns {boolean} Success status
   */
  relocateTower(tower, newSlot, isEmergency = false) {
    // Check if new slot is empty
    if (this.getTowerAtSlot(newSlot)) {
      console.warn('Slot is already occupied');
      return false;
    }

    // Remove from old slot
    const oldSlotKey = `${tower.slotData.x}_${tower.slotData.y}`;
    this.towersBySlot.delete(oldSlotKey);

    // Update tower position
    tower.slotData = newSlot;
    tower.x = newSlot.x;
    tower.y = newSlot.y;

    // Add to new slot
    const newSlotKey = `${newSlot.x}_${newSlot.y}`;
    this.towersBySlot.set(newSlotKey, tower);

    console.log(`Relocated tower from ${oldSlotKey} to ${newSlotKey}`);
    return true;
  }

  /**
   * Sell tower and get partial refund
   * @param {Tower} tower - Tower to sell
   * @param {number} refundRate - Refund rate (0.0-1.0), default 0.6 (60%)
   * @returns {number} Refund amount
   */
  sellTower(tower, refundRate = 0.6) {
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

    const refundAmount = Math.floor(tower.definition.cost * refundRate);
    console.log(`Sold tower for ${refundAmount} NC (${refundRate * 100}% refund)`);
    return refundAmount;
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
