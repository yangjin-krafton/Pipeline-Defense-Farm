import { TOWER_DEFINITIONS } from '../data/towerDefinitions.js';
import { STAR_UPGRADE_COSTS } from '../data/economyDefinitions.js';
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
    this.unlockedSlots = new Set(); // NC 소비로 언락된 슬롯 키 집합 ('x_y' 형식)

    // Systems
    this.bulletSystem = null;
    this.particleSystem = null;
  }

  _slotKey(slot) {
    return `${slot.x}_${slot.y}`;
  }

  /** unlockCost === 0 이면 처음부터 개방, 그 외엔 Set에 있어야 언락 */
  isSlotUnlocked(slot) {
    if (!slot.unlockCost || slot.unlockCost === 0) return true;
    return this.unlockedSlots.has(this._slotKey(slot));
  }

  unlockSlot(slot) {
    this.unlockedSlots.add(this._slotKey(slot));
  }

  /** 저장용 배열 반환 */
  getUnlockedSlotKeys() {
    return Array.from(this.unlockedSlots);
  }

  /** 로드용 — 저장된 배열로 Set 복원 */
  setUnlockedSlotKeys(keys) {
    this.unlockedSlots = new Set(keys);
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
   * 타워 판매 금액 계산 (레벨·승급 반영)
   * - 설치비 60% 환급
   * - 승급에 투자한 NC의 50% 환급 (star 1→현재까지 누적)
   * - 레벨당 설치비의 4% 보너스 (Lv1 기준)
   * @param {BaseTower} tower
   * @returns {number}
   */
  calculateSellValue(tower) {
    const baseCost = tower.definition.cost;

    // 승급 투자 NC 누적
    let totalStarNC = 0;
    for (const cost of STAR_UPGRADE_COSTS) {
      if (cost.from < tower.star) totalStarNC += cost.nc;
    }

    const baseRefund  = Math.floor(baseCost * 0.6);
    const starRefund  = Math.floor(totalStarNC * 0.5);
    const levelBonus  = Math.floor(baseCost * 0.04 * (tower.level - 1));

    return baseRefund + starRefund + levelBonus;
  }

  /**
   * Sell tower and return refund amount
   * @param {BaseTower} tower - Tower to sell
   * @returns {number} Refund amount (NC)
   */
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

    const refundAmount = this.calculateSellValue(tower);
    console.log(`Sold tower for ${refundAmount} NC (star ${tower.star}, level ${tower.level})`);
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

      // Restore imprints (imprintedNode를 upgradeTree에서 재구성)
      if (towerData.imprints) {
        tower.imprints = towerData.imprints.map(imprint => ({
          ...imprint,
          imprintedNode: tower.upgradeTree?.nodes.find(n => n.nodeNumber === imprint.nodeNumber) || null
        }));
      }

      if (towerData.imprintCounts) {
        tower.imprintCounts = new Map(towerData.imprintCounts);
      }

      // Restore pending upgrade state
      if (towerData.pendingUpgrade) {
        tower.pendingUpgrade = towerData.pendingUpgrade;
      }

      // Restore active nodes (activeNodes는 항상 Array<UpgradeNode>)
      if (towerData.activeNodes && tower.upgradeTree) {
        for (const nodeNumber of towerData.activeNodes) {
          const node = tower.upgradeTree.getNode(nodeNumber);
          if (node && !tower.upgradeTree.activeNodes.some(n => n.nodeNumber === nodeNumber)) {
            tower.upgradeTree.activeNodes.push(node);
            tower.upgradeTree.usedPoints += node.cost;
            console.log(`[TowerManager] Restored node ${nodeNumber} for tower ${towerData.type}`);
          }
        }
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
