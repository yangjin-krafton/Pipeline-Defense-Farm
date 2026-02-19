export const TOWER_TYPES = {
  ENZYME: 'enzyme',
  ACID: 'acid',
  BILE: 'bile'
};

export const TOWER_DEFINITIONS = {
  enzyme: {
    id: 'enzyme',
    name: '효소 분사기',
    emoji: '🧪',
    description: '탄수화물 분해 특화',
    cost: 100,
    stats: {
      damage: 15,          // Base DPS
      attackSpeed: 1.2,    // Attacks per second
      range: 150,          // Detection range in virtual pixels (INCREASED FOR DEBUG)
      projectileSpeed: 150 // For future visual projectiles
    },
    // Tag bonuses (multiplicative)
    tagBonuses: {
      carb: 1.5,          // 1.5x damage to carb foods
      sugar: 1.3
    }
  },
  acid: {
    id: 'acid',
    name: '위산 분사기',
    emoji: '💧',
    description: '단백질 분해 + 방어 약화',
    cost: 150,
    stats: {
      damage: 12,
      attackSpeed: 1.0,
      range: 150,          // INCREASED FOR DEBUG
      armorReduction: 5    // Reduces target armor
    },
    tagBonuses: {
      protein: 1.6,
      fat: 1.2
    }
  },
  bile: {
    id: 'bile',
    name: '담즙 분사기',
    emoji: '💛',
    description: '지방 유화 특화',
    cost: 200,
    stats: {
      damage: 20,
      attackSpeed: 0.8,
      range: 150,          // INCREASED FOR DEBUG
      splash: 30           // Splash damage range
    },
    tagBonuses: {
      fat: 1.8,
      fried: 1.4
    }
  }
};
