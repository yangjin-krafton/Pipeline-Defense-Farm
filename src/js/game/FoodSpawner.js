/**
 * Food spawner system for multiple paths
 */
import { FOOD_STATS_BY_PATH, FOOD_SPAWN_MS, BASE_SPEED } from '../config.js';

const STAGE_SEQUENCE = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'];

const STAGE_TIER_RATIOS = {
  S0: { normal: 88, strong: 12, elite: 0 },
  S1: { normal: 72, strong: 25, elite: 3 },
  S2: { normal: 55, strong: 35, elite: 10 },
  S3: { normal: 40, strong: 42, elite: 18 },
  S4: { normal: 28, strong: 45, elite: 27 },
  S5: { normal: 20, strong: 42, elite: 38 },
};

const STAGE_MULTIPLIERS = {
  S0: { hp: 1.0, armor: 1.0, digestionNeed: 1.0 },
  S1: { hp: 1.08, armor: 1.05, digestionNeed: 1.08 },
  S2: { hp: 1.2, armor: 1.12, digestionNeed: 1.2 },
  S3: { hp: 1.35, armor: 1.2, digestionNeed: 1.35 },
  S4: { hp: 1.52, armor: 1.28, digestionNeed: 1.52 },
  S5: { hp: 1.7, armor: 1.38, digestionNeed: 1.7 },
};

const STAGE_THREAT_BONUS = {
  S0: 0,
  S1: 2,
  S2: 4,
  S3: 6,
  S4: 8,
  S5: 10,
};

// docs/food-enemy-spawn-design.md "3) 난이도 요구 테이블" 기반 상한/하한
const STAGE_TARGET_BAND = {
  S0: { threatMin: 8, threatMax: 10, digestionMin: 75, digestionMax: 90 },
  S1: { threatMin: 10, threatMax: 12, digestionMin: 90, digestionMax: 105 },
  S2: { threatMin: 12, threatMax: 14, digestionMin: 105, digestionMax: 122 },
  S3: { threatMin: 14, threatMax: 16, digestionMin: 122, digestionMax: 140 },
  S4: { threatMin: 16, threatMax: 18, digestionMin: 140, digestionMax: 160 },
  S5: { threatMin: 18, threatMax: 21, digestionMin: 160, digestionMax: 190 },
};

const PATH_ELITE_FLOOR = {
  rice_stomach: { S4: 30, S5: 30 },
  dessert_stomach: { S4: 25, S5: 25 },
  alcohol_stomach: { S4: 28, S5: 28 },
};

const PATH_TIER_IDS = {
  rice_stomach: {
    normal: ['rice_cracker', 'rice_ball', 'cooked_rice', 'fortune_cookie'],
    strong: ['ramen', 'spaghetti', 'sandwich', 'fried_shrimp', 'dumpling'],
    elite: ['burger', 'pizza', 'burrito', 'cut_of_meat', 'meat_on_bone', 'paella'],
  },
  dessert_stomach: {
    normal: ['candy', 'lollipop', 'shaved_ice', 'pudding'],
    strong: ['cake', 'donut', 'cupcake', 'chocolate_bar', 'boba_dessert'],
    elite: ['birthday_cake', 'moon_cake', 'pie', 'waffle', 'pancakes', 'honey_pot'],
  },
  alcohol_stomach: {
    normal: ['juice', 'lemon_tea', 'hot_coffee', 'cocktail'],
    strong: ['beer', 'wine', 'tropical_cocktail', 'sake', 'mate'],
    elite: ['whisky', 'champagne', 'clink_beers', 'clinking_glasses'],
  },
};

const STAGE_TARGET_CONCURRENT = {
  S0: 8,
  S1: 10,
  S2: 13,
  S3: 16,
  S4: 20,
  S5: 24,
};

const AUTO_TRIPLE_CHANCE = {
  S0: 0.0,
  S1: 0.0,
  S2: 0.2,
  S3: 0.35,
  S4: 0.5,
  S5: 0.6,
};

const DEFAULT_PATH_FLOW = {
  rice_stomach: 'small_intestine',
  dessert_stomach: 'small_intestine',
  alcohol_stomach: 'small_intestine',
  small_intestine: 'large_intestine',
  large_intestine: null
};

export class FoodSpawner {
  constructor(multiPathSystem) {
    this.multiPathSystem = multiPathSystem;
    this.spawnTimer = 0; // seconds accumulator

    // Paths that can spawn food (stomach paths only)
    this.spawnablePaths = ['rice_stomach', 'dessert_stomach', 'alcohol_stomach'];
    this.pathCursor = 0;
    this.spawnMode = 'auto'; // auto | single | triple

    this.foodLookupByPath = this._buildFoodLookupByPath();
    this.recentEmojiQueue = [];
    this.recentQueueMax = 5;
    this.pathFlow = this.multiPathSystem.pathFlow || DEFAULT_PATH_FLOW;
    this.journeyMetaBySpawnPath = this._buildJourneyMetaBySpawnPath();

    // Difficulty state (docs/food-enemy-spawn-design.md 기반)
    this.baseStageIndex = 0;      // S0..S5
    this.dynamicOffset = 0;       // D(-2..+2)
    this.combatWindowSec = 10;
    this.combatWindowTimer = 0;
    this.windowKills = 0;
    this.windowLeaks = 0;
    this.windowTTKSum = 0;
    this.windowTTKCount = 0;
    this.sessionElapsedSec = 0;
  }

  /**
   * Build total journey distance meta from each stomach path to end.
   * Includes extra exit threshold for each path transition to approximate
   * "one enemy full journey time" used for spawn pacing.
   * @returns {Object<string, {distance:number, paths:number}>}
   */
  _buildJourneyMetaBySpawnPath() {
    const meta = {};
    const seenLimit = 12;

    for (const startPath of this.spawnablePaths) {
      let distance = 0;
      let pathCount = 0;
      let current = startPath;
      const visited = new Set();

      while (current && !visited.has(current) && pathCount < seenLimit) {
        visited.add(current);
        const pathSystem = this.multiPathSystem.getPathSystem(current);
        if (pathSystem) {
          distance += pathSystem.getPathLength();
          pathCount += 1;
        }
        current = this.pathFlow[current];
      }

      // PathFollowerSystem removal uses exitThreshold (~25) on each path.
      const exitDistance = pathCount * 25;
      meta[startPath] = {
        distance: distance + exitDistance,
        paths: pathCount
      };
    }

    return meta;
  }

  /**
   * Build fast lookup table by id for each path.
   * @returns {Object<string, Object<string, Object>>}
   */
  _buildFoodLookupByPath() {
    const lookup = {};
    for (const [pathKey, foods] of Object.entries(FOOD_STATS_BY_PATH)) {
      lookup[pathKey] = {};
      for (const food of foods) {
        lookup[pathKey][food.id] = food;
      }
    }
    return lookup;
  }

  /**
   * Pick weighted random key from object like {key: weight}
   * @param {Object<string, number>} weights
   * @returns {string}
   */
  _weightedPick(weights) {
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    if (entries.length === 0) return 'normal';

    const total = entries.reduce((acc, [, w]) => acc + w, 0);
    let roll = Math.random() * total;

    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
  }

  /**
   * Apply path-specific elite floor for S4/S5.
   * @param {string} stageKey
   * @param {string} pathKey
   * @returns {{normal:number,strong:number,elite:number}}
   */
  _getTierRatioForPath(stageKey, pathKey) {
    const base = STAGE_TIER_RATIOS[stageKey] || STAGE_TIER_RATIOS.S0;
    const ratio = { ...base };
    const floor = PATH_ELITE_FLOOR[pathKey]?.[stageKey];

    if (typeof floor === 'number' && ratio.elite < floor) {
      const remain = 100 - floor;
      const ns = base.normal + base.strong;
      if (ns <= 0) {
        ratio.normal = remain;
        ratio.strong = 0;
      } else {
        ratio.normal = Math.round(remain * (base.normal / ns));
        ratio.strong = remain - ratio.normal;
      }
      ratio.elite = floor;
    }

    return ratio;
  }

  /**
   * Resolve stage with performance correction D(-2..+2)
   * @returns {string}
   */
  _getCurrentStageKey() {
    const index = Math.max(0, Math.min(STAGE_SEQUENCE.length - 1, this.baseStageIndex + this.dynamicOffset));
    return STAGE_SEQUENCE[index];
  }

  _getStageIndex(stageKey) {
    const idx = STAGE_SEQUENCE.indexOf(stageKey);
    return idx >= 0 ? idx : 0;
  }

  /**
   * Fetch tier pool from design id list with fallback.
   * @param {string} pathKey - Path key
   * @param {string} tier - normal|strong|elite
   * @returns {Object[]} Food candidates
   */
  _getTierPool(pathKey, tier) {
    const fromPath = PATH_TIER_IDS[pathKey]?.[tier] || [];
    const byId = this.foodLookupByPath[pathKey] || {};
    const mapped = fromPath
      .map((id) => byId[id])
      .filter(Boolean);

    if (mapped.length > 0) return mapped;

    const foods = FOOD_STATS_BY_PATH[pathKey] || [];
    const byTier = foods.filter((food) => food.strengthTier === tier);
    if (byTier.length > 0) return byTier;

    return foods;
  }

  /**
   * Pick one food with anti-repeat queue.
   * @param {string} pathKey
   * @param {string} tier
   * @returns {Object|null}
   */
  _pickFoodForPath(pathKey, tier, stageKey) {
    const pool = this._getTierPool(pathKey, tier);
    if (!pool || pool.length === 0) return null;

    const stageFiltered = this._filterByStageBand(pool, stageKey);
    const antiRepeatPool = stageFiltered.length > 0 ? stageFiltered : pool;
    const filtered = antiRepeatPool.filter((food) => !this.recentEmojiQueue.includes(food.emoji));
    const source = filtered.length > 0 ? filtered : antiRepeatPool;
    const picked = source[Math.floor(Math.random() * source.length)];

    this.recentEmojiQueue.push(picked.emoji);
    while (this.recentEmojiQueue.length > this.recentQueueMax) {
      this.recentEmojiQueue.shift();
    }

    return picked;
  }

  /**
   * Keep spawn candidates within stage target difficulty band.
   * If strict filter yields nothing, returns top easiest subset as fallback.
   * @param {Object[]} pool
   * @param {string} stageKey
   * @returns {Object[]}
   */
  _filterByStageBand(pool, stageKey) {
    const band = STAGE_TARGET_BAND[stageKey];
    if (!band) return pool;

    const strict = pool.filter((food) => {
      const scaled = this._previewScaledFoodForStage(food, stageKey);
      const threat = scaled.threat || 0;
      const need = scaled.digestionNeed || 0;
      return (
        threat >= band.threatMin &&
        threat <= band.threatMax &&
        need >= band.digestionMin &&
        need <= band.digestionMax
      );
    });
    if (strict.length > 0) return strict;

    const upperBoundOnly = pool.filter((food) => {
      const scaled = this._previewScaledFoodForStage(food, stageKey);
      const threat = scaled.threat || 0;
      const need = scaled.digestionNeed || 0;
      return threat <= band.threatMax && need <= band.digestionMax;
    });
    if (upperBoundOnly.length > 0) return upperBoundOnly;

    // Fallback: choose easier side of pool by threat + digestionNeed score.
    const scored = [...pool].sort((a, b) => {
      const saScaled = this._previewScaledFoodForStage(a, stageKey);
      const sbScaled = this._previewScaledFoodForStage(b, stageKey);
      const sa = (saScaled.threat || 0) * 10 + (saScaled.digestionNeed || 0);
      const sb = (sbScaled.threat || 0) * 10 + (sbScaled.digestionNeed || 0);
      return sa - sb;
    });
    return scored.slice(0, Math.max(1, Math.ceil(scored.length * 0.4)));
  }

  _previewScaledFoodForStage(food, stageKey) {
    const m = STAGE_MULTIPLIERS[stageKey] || STAGE_MULTIPLIERS.S0;
    const threatBonus = STAGE_THREAT_BONUS[stageKey] ?? 0;
    return {
      threat: Math.max(0, Math.round((food.threat || 0) + threatBonus)),
      digestionNeed: Math.max(1, Math.round((food.digestionNeed || 1) * m.digestionNeed)),
    };
  }

  /**
   * Apply stage multipliers to baseline food data.
   * @param {Object} food
   * @param {string} stageKey
   * @returns {Object}
   */
  _applyStageMultiplier(food, stageKey) {
    const m = STAGE_MULTIPLIERS[stageKey] || STAGE_MULTIPLIERS.S0;
    const threatBonus = STAGE_THREAT_BONUS[stageKey] ?? 0;
    const maxHp = Math.max(1, Math.round(food.hp * m.hp));

    return {
      ...food,
      hp: maxHp,
      maxHp,
      armor: Math.max(0, Math.round((food.armor || 0) * m.armor)),
      threat: Math.max(0, Math.round((food.threat || 0) + threatBonus)),
      digestionNeed: Math.max(1, Math.round((food.digestionNeed || 1) * m.digestionNeed)),
      reward: Math.max(1, Math.round(food.reward || 1)),
      spawnStage: stageKey,
    };
  }

  /**
   * Pick a random spawnable path
   * @returns {string} Random path key
   */
  _pickRandomPath() {
    return this.spawnablePaths[Math.floor(Math.random() * this.spawnablePaths.length)];
  }

  /**
   * Pick next path in round-robin order for stable single-path spawn pacing.
   * @returns {string}
   */
  _pickRoundRobinPath() {
    const path = this.spawnablePaths[this.pathCursor % this.spawnablePaths.length];
    this.pathCursor = (this.pathCursor + 1) % this.spawnablePaths.length;
    return path;
  }

  /**
   * Estimate average full-journey time (seconds) for one spawned enemy.
   * @param {string} stageKey
   * @returns {number}
   */
  _estimateTraversalTimeSec(stageKey) {
    let total = 0;
    let count = 0;

    for (const pathKey of this.spawnablePaths) {
      const foods = FOOD_STATS_BY_PATH[pathKey] || [];
      if (foods.length === 0) continue;

      const candidates = this._filterByStageBand(foods, stageKey);
      const source = candidates.length > 0 ? candidates : foods;
      const avgSpeed = source.reduce((sum, food) => sum + Math.max(1, food.speed || BASE_SPEED), 0) / source.length;

      const journeyDistance = this.journeyMetaBySpawnPath[pathKey]?.distance || 1000;
      total += journeyDistance / avgSpeed;
      count += 1;
    }

    if (count === 0) return 18;
    return total / count;
  }

  /**
   * Decide current spawn batch mode.
   * @param {string} stageKey
   * @returns {'single'|'triple'}
   */
  _resolveBatchMode(stageKey) {
    if (this.spawnMode === 'single') return 'single';
    if (this.spawnMode === 'triple') return 'triple';

    // auto: mix single/triple by stage and recent performance.
    const baseChance = AUTO_TRIPLE_CHANCE[stageKey] || 0;
    const perfBonus = this.dynamicOffset > 0 ? this.dynamicOffset * 0.08 : 0;
    const perfPenalty = this.dynamicOffset < 0 ? Math.abs(this.dynamicOffset) * 0.1 : 0;
    const tripleChance = Math.max(0, Math.min(0.9, baseChance + perfBonus - perfPenalty));
    return Math.random() < tripleChance ? 'triple' : 'single';
  }

  /**
   * Compute spawn interval from "one enemy full journey time".
   * interval ~= traversalTime * batchSize / targetConcurrent
   * @param {string} stageKey
   * @param {number} batchSize
   * @returns {number} seconds
   */
  _computeSpawnIntervalSec(stageKey, batchSize) {
    const traversalSec = this._estimateTraversalTimeSec(stageKey);
    const baseConcurrent = STAGE_TARGET_CONCURRENT[stageKey] || STAGE_TARGET_CONCURRENT.S0;
    const performanceScale = Math.max(0.7, Math.min(1.25, 1 + this.dynamicOffset * 0.1));
    const targetConcurrent = Math.max(4, baseConcurrent * performanceScale);
    const byJourney = (traversalSec * batchSize) / targetConcurrent;
    const fallbackSec = Math.max(0.3, FOOD_SPAWN_MS / 1000);
    return Math.max(0.25, Math.min(5.0, byJourney || fallbackSec));
  }

  /**
   * Spawn a food item on a specific path
   * @param {string} pathKey - Path key (rice_stomach, dessert_stomach, alcohol_stomach)
   * @param {number} initialOffset - Initial offset on path
   */
  spawnFood(pathKey = null, initialOffset = 0) {
    // If no path specified, pick random stomach path
    if (!pathKey) {
      pathKey = this._pickRandomPath();
    }

    const stageKey = this._getCurrentStageKey();
    const ratio = this._getTierRatioForPath(stageKey, pathKey);
    const tier = this._weightedPick(ratio);
    const food = this._pickFoodForPath(pathKey, tier, stageKey);
    if (!food) {
      return;
    }
    const scaledFood = this._applyStageMultiplier(food, stageKey);

    // Removed: console.log - too verbose

    this.multiPathSystem.spawn(pathKey, {
      ...scaledFood,
      speed: Math.max(52, scaledFood.speed + (Math.random() - 0.5) * 8),
      size: Math.max(20, scaledFood.size + (Math.random() - 0.5) * 2),
      spin: (Math.random() - 0.5) * 1.8,
      exitThreshold: 25,
      baseSpeed: scaledFood.speed,
      speedScale: Number((scaledFood.speed / BASE_SPEED).toFixed(3))
    }, initialOffset);
  }

  /**
   * Spawn one batch by mode.
   * @param {'single'|'triple'} batchMode
   */
  _spawnBatch(batchMode) {
    if (batchMode === 'triple') {
      for (const pathKey of this.spawnablePaths) {
        this.spawnFood(pathKey);
      }
      return;
    }

    const pathKey = this._pickRoundRobinPath();
    this.spawnFood(pathKey);
  }

  /**
   * Optional: update baseline stage from external power index (0..5).
   * @param {number} stageIndex
   */
  setBaseStageIndex(stageIndex) {
    this.baseStageIndex = Math.max(0, Math.min(5, Math.round(stageIndex)));
  }

  /**
   * Set spawn mode.
   * @param {'auto'|'single'|'triple'} mode
   */
  setSpawnMode(mode) {
    if (mode === 'auto' || mode === 'single' || mode === 'triple') {
      this.spawnMode = mode;
    }
  }

  /**
   * Optional: report combat performance for dynamic difficulty.
   * @param {{killed?:boolean, leaked?:boolean, timeToKill?:number}} result
   */
  reportCombatResult(result = {}) {
    if (result.killed) {
      this.windowKills += 1;
      if (typeof result.timeToKill === 'number' && Number.isFinite(result.timeToKill)) {
        this.windowTTKSum += Math.max(0, result.timeToKill);
        this.windowTTKCount += 1;
      }
    }
    if (result.leaked) {
      this.windowLeaks += 1;
    }
  }

  _updateDynamicDifficulty(dt) {
    this.sessionElapsedSec += dt;
    this.combatWindowTimer += dt;
    if (this.combatWindowTimer < this.combatWindowSec) return;

    const kills = this.windowKills;
    const leaks = this.windowLeaks;
    const total = Math.max(1, kills + leaks);
    const leakRate = leaks / total;
    const avgTTK = this.windowTTKCount > 0 ? this.windowTTKSum / this.windowTTKCount : Infinity;
    const hasEnoughSamples = (kills + leaks) >= 6;

    let nextOffset = this.dynamicOffset;
    const isStrong = hasEnoughSamples && kills >= 9 && leakRate <= 0.1 && avgTTK <= 8.0;
    const isWeak = hasEnoughSamples && (leakRate >= 0.25 || kills <= 3 || avgTTK >= 13);

    if (isStrong) nextOffset += 1;
    else if (isWeak) nextOffset -= 1;

    const earlyClamp = this.sessionElapsedSec < 60 ? 1 : 2;
    this.dynamicOffset = Math.max(-earlyClamp, Math.min(earlyClamp, nextOffset));

    // Reset window counters
    this.combatWindowTimer = 0;
    this.windowKills = 0;
    this.windowLeaks = 0;
    this.windowTTKSum = 0;
    this.windowTTKCount = 0;
  }

  /**
   * Update spawner (called each frame)
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    this._updateDynamicDifficulty(dt);
    this.spawnTimer += dt;

    let guard = 0;
    while (guard < 8) {
      const stageKey = this._getCurrentStageKey();
      const batchMode = this._resolveBatchMode(stageKey);
      const batchSize = batchMode === 'triple' ? 3 : 1;
      const intervalSec = this._computeSpawnIntervalSec(stageKey, batchSize);

      if (this.spawnTimer < intervalSec) break;
      this._spawnBatch(batchMode);
      this.spawnTimer -= intervalSec;
      guard += 1;
    }
  }
}
