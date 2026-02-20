import { createAcidRailUpgradeNodes } from '../towers/AcidRailTower.js';
import { createEnzymeChargeCannonUpgradeNodes } from '../towers/EnzymeChargeCannon.js';
import { createPierceBoltUpgradeNodes } from '../towers/PierceBoltTower.js';

/**
 * 타워 타입 정의
 */
export const TOWER_TYPES = {
  ACID_RAIL: 'acidRail',
  ENZYME_CHARGE: 'enzymeCharge',
  PIERCE_BOLT: 'pierceBolt'
};

/**
 * 타워 정의
 */
export const TOWER_DEFINITIONS = {
  acidRail: {
    id: 'acidRail',
    name: '위산 레일 주입기',
    emoji: '💉',
    description: '보스/엘리트 암살 특화',
    category: '단일 화력',
    cost: 150,
    stats: {
      damage: 30,
      attackSpeed: 0.8,
      range: 180,
      projectileSpeed: 400
    },
    tagBonuses: {
      protein: 1.3,
      fat: 1.2
    },
    upgradeTree: createAcidRailUpgradeNodes()
  },

  enzymeCharge: {
    id: 'enzymeCharge',
    name: '효소 축전 캐논',
    emoji: '🔋',
    description: '타이밍 기반 고점 딜러',
    category: '단일 화력',
    cost: 180,
    stats: {
      damage: 50, // 완충 시 고점
      attackSpeed: 0.5, // 충전 시간 포함
      range: 160,
      projectileSpeed: 300
    },
    tagBonuses: {
      carb: 1.4,
      sugar: 1.3
    },
    upgradeTree: createEnzymeChargeCannonUpgradeNodes()
  },

  pierceBolt: {
    id: 'pierceBolt',
    name: '연동 관통 볼트기',
    emoji: '🎯',
    description: '라인형 중장갑 관통',
    category: '단일 화력',
    cost: 160,
    stats: {
      damage: 25,
      attackSpeed: 1.0,
      range: 200,
      projectileSpeed: 350
    },
    tagBonuses: {
      protein: 1.3,
      fat: 1.25
    },
    upgradeTree: createPierceBoltUpgradeNodes()
  }
};
