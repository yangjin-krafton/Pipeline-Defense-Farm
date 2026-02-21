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

  /**
   * Load tower from save data
   * @param {Object} towerData - Saved tower data
   * @param {EconomySystem} economySystem - Economy system
   * @param {TowerGrowthSystem} towerGrowthSystem - Tower growth system
   * @param {number} offlineXP - Offline XP to add
   * @returns {BaseTower|null} Restored tower
   */
  loadTowerFromSave(towerData, economySystem, towerGrowthSystem, offlineXP = 0) {
    try {
      const definition = TOWER_DEFINITIONS[towerData.type];
      if (!definition) {
        console.error(`[TowerManager] Tower type ${towerData.type} not found`);
        return null;
      }

      // Create slot data
      const slotData = {
        x: towerData.x,
        y: towerData.y,
        radius: 24
      };

      // Build tower
      const TowerClass = TOWER_CLASSES[towerData.type];
      const tower = new TowerClass(
        slotData,
        definition,
        this.bulletSystem,
        this.particleSystem
      );

      // Restore growth data
      tower.xp = towerData.xp + (offlineXP || 0);
      tower.level = towerData.level;
      tower.star = towerData.star;
      tower.upgradePoints = towerData.upgradePoints;

      // Restore star bonuses
      if (towerData.starBonuses) {
        tower.starBonuses = { ...towerData.starBonuses };
      }

      // Restore imprints
      if (towerData.imprints) {
        tower.imprints = [...towerData.imprints];
      }

      if (towerData.imprintCounts) {
        tower.imprintCounts = new Map(towerData.imprintCounts);
      }

      // Restore active nodes
      if (towerData.activeNodes && tower.upgradeTree) {
        for (const nodeNumber of towerData.activeNodes) {
          const node = tower.upgradeTree.getNode(nodeNumber);
          if (node && !tower.upgradeTree.activeNodes.has(nodeNumber)) {
            tower.upgradeTree.activeNodes.add(nodeNumber);
            console.log(`[TowerManager] Restored node ${nodeNumber} for tower ${towerData.type}`);
          }
        }

        // Recalculate active modules
        tower.upgradeTree.recalculateActiveModules();
      }

      // Check for level up with offline XP
      if (offlineXP > 0) {
        towerGrowthSystem.checkLevelUp(tower);
      }

      // Add to manager
      this.towers.push(tower);
      const slotKey = `${slotData.x}_${slotData.y}`;
      this.towersBySlot.set(slotKey, tower);

      console.log(`[TowerManager] Loaded ${towerData.type} tower at (${towerData.x}, ${towerData.y})`);
      return tower;
    } catch (error) {
      console.error('[TowerManager] Failed to load tower:', error);
      return null;
    }
  }
}
