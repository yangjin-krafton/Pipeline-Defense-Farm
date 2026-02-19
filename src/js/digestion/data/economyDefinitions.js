export const ZONE_REWARD_MULTIPLIERS = {
  rice_stomach: 0.7,
  dessert_stomach: 0.7,
  alcohol_stomach: 0.7,
  small_intestine: 1.3,
  large_intestine: 1.0
};

export const NUTRITION_CONFIG = {
  initialBalance: 500,      // Starting currency
  displayName: '영양분',
  emoji: '🍎'
};

export const SUPPLY_CONFIG = {
  nutritionCapPerTower: 100,
  supplyPerAction: 25,
  globalSupplyAPCap: 5,
  globalSupplyAPRegenSec: 30,
  boostDurationSec: 20,
  overchargeDurationSec: 6,
  diminishingReturnsPenalty: 0.15  // -15% on repeated supply
};
