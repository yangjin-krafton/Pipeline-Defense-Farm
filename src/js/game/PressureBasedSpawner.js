/**
 * PressureBasedSpawner — 압박도 기반 동적 스폰 시스템
 *
 * 기존 시간 기반 웨이브 시스템을 대체하는 압박도(pressure) 기반 스폰 시스템.
 *
 * 동작 원리:
 * 1. 실시간으로 전장 압박도 측정 (alive count, tower busy%, TTK 등)
 * 2. 압박도 < 목표 → 스폰 간격 감소 (더 빠르게)
 *    압박도 > 목표 → 스폰 간격 증가 (더 느리게)
 * 3. 스폰 간격이 최소치 도달했는데도 압박도 부족 → 레벨 에스컬레이션
 * 4. 레벨 범위 상승 → 더 강한 적 등장 → 압박도 증가
 *
 * 장점:
 * - 플레이어 전력에 따라 자동으로 난이도 조정
 * - 공백 시간 없이 연속적인 전투
 * - 타워가 강해지면 자연스럽게 적도 강해짐
 */

import { ENEMY_STATS } from '../data/enemyStats.js';
import { BASE_SPEED } from '../config.js';

// ── 압박도 설정 ─────────────────────────────────────────────────────────
/** 목표 압박도 (0.0 ~ 1.0) - 높을수록 더 많은 적 스폰 */
const TARGET_PRESSURE = 0.80;

/** 압박도 계산 가중치 */
const PRESSURE_WEIGHTS = {
  aliveCount: 0.60,    // 화면 내 적 수 비중 (가장 중요)
  towerBusy:  0.25,    // 타워 바쁜 정도 비중
  ttkFactor:  0.15,    // 처치 시간 비중
};

// ── 스폰 간격 설정 ────────────────────────────────────────────────────────
/** 최소 스폰 간격 (초) - 이보다 빠르게는 스폰 안 함 */
const MIN_SPAWN_INTERVAL = 0.12;

/** 최대 스폰 간격 (초) - 이보다 느리게는 스폰 안 함 */
const MAX_SPAWN_INTERVAL = 2.5;

/** 초기 스폰 간격 (초) */
const INITIAL_SPAWN_INTERVAL = 0.3;

/** 스폰 간격 조정 속도 - 압박도 부족 시 (빠르게 증가) */
const INTERVAL_ADJUST_RATE_FAST = 6.0;

/** 스폰 간격 조정 속도 - 압박도 초과 시 (천천히 감소) */
const INTERVAL_ADJUST_RATE_SLOW = 0.2;

// ── 레벨 에스컬레이션 설정 ──────────────────────────────────────────────────
/** 초기 레벨 범위 */
const INITIAL_LEVEL_MIN = 1;
const INITIAL_LEVEL_MAX = 20;

/** 레벨 에스컬레이션 단계 (각 단계마다 범위 상승) */
const LEVEL_ESCALATION_STEPS = [
  { min:  1, max: 20 },   // 0단계 (초보)
  { min: 15, max: 35 },   // 1단계
  { min: 25, max: 50 },   // 2단계
  { min: 40, max: 65 },   // 3단계
  { min: 55, max: 80 },   // 4단계
  { min: 70, max: 90 },   // 5단계
  { min: 80, max: 100 },  // 6단계 (최종)
];

/** 에스컬레이션 대기 시간 (초) - 레벨 상승 전 쿨다운 */
const ESCALATION_COOLDOWN = 0.5;

/** 에스컬레이션 조건: 스폰 간격이 최소치에 머문 시간 (초) */
const ESCALATION_THRESHOLD_TIME = 0.8;

// ── 기타 설정 ──────────────────────────────────────────────────────────────
/** 속도 지터 (±px) */
const SPEED_JITTER = 7;

/** 최소 속도 하한 */
const MIN_SPEED = 45;

/** 압박도 계산용 목표 적 수 */
const TARGET_ALIVE_COUNT = 35;

/** 안티리피트 큐 크기 */
const RECENT_QUEUE_MAX = 5;

// ═══════════════════════════════════════════════════════════════════════════

export class PressureBasedSpawner {
  /**
   * @param {import('../utils/MultiPathFollowerSystem.js').MultiPathFollowerSystem} multiPathSystem
   * @param {import('./DifficultyEngine.js').DifficultyEngine} difficultyEngine
   * @param {import('../digestion/systems/TowerManager.js').TowerManager} towerManager
   */
  constructor(multiPathSystem, difficultyEngine, towerManager = null) {
    this.multiPathSystem  = multiPathSystem;
    this.difficultyEngine = difficultyEngine;
    this.towerManager     = towerManager;

    this.spawnablePaths = ['rice_stomach', 'dessert_stomach', 'alcohol_stomach'];
    this.pathCursor     = 0;

    // 안티리피트 큐
    this.recentEmojiQueue = [];

    // ── 압박도 추적 ──────────────────────────────────────────────────────
    this.currentPressure = 0.0;
    this.targetPressure  = TARGET_PRESSURE;

    // ── 스폰 간격 제어 ────────────────────────────────────────────────────
    this.currentInterval  = INITIAL_SPAWN_INTERVAL;
    this.spawnTimer       = 0;
    this.minIntervalTime  = 0; // 최소 간격에 머문 시간 (에스컬레이션 조건)

    // ── 디버그 로깅 ────────────────────────────────────────────────────────
    this.debugLogTimer = 0;
    this.debugLogInterval = 2.0; // 2초마다 디버그 로그

    // ── 레벨 에스컬레이션 ─────────────────────────────────────────────────
    this.escalationLevel  = 0;
    this.currentLevelMin  = INITIAL_LEVEL_MIN;
    this.currentLevelMax  = INITIAL_LEVEL_MAX;
    this.escalationCooldown = 0;

    // ── 전투 통계 추적 (TTK 계산용) ────────────────────────────────────────
    this.recentTTKs = [];
    this.maxTTKSamples = 10;

    console.log('[PressureBasedSpawner] Initialized | Target Pressure:', TARGET_PRESSURE, '| Initial Interval:', this.currentInterval + 's');
  }

  // ── 공개 API ─────────────────────────────────────────────────────────────

  /**
   * GameLoop 에서 매 프레임 호출.
   * @param {number} dt - 스케일된 delta time (초)
   */
  update(dt) {
    // 에스컬레이션 쿨다운 처리
    if (this.escalationCooldown > 0) {
      this.escalationCooldown -= dt;
      return;
    }

    // 1. 압박도 계산
    this._updatePressure();

    // 2. 압박도에 따라 스폰 간격 조정
    this._adjustSpawnInterval(dt);

    // 3. 스폰 타이머 진행
    this.spawnTimer += dt;

    // 4. 스폰 간격 도달 시 적 스폰
    if (this.spawnTimer >= this.currentInterval) {
      this._spawnEnemy();
      this.spawnTimer = 0;
    }

    // 5. 에스컬레이션 체크
    this._checkEscalation(dt);

    // 디버그 로그
    this.debugLogTimer += dt;
    if (this.debugLogTimer >= this.debugLogInterval) {
      console.log(`[Spawn] Pressure: ${(this.currentPressure*100).toFixed(1)}% | Target: ${(this.targetPressure*100).toFixed(1)}% | Interval: ${this.currentInterval.toFixed(2)}s | Alive: ${this.multiPathSystem.getObjects().length}`);
      this.debugLogTimer = 0;
    }
  }

  /**
   * 게임 시작 시 첫 스폰 트리거 (초기 8마리 동시 스폰).
   */
  triggerInitialSpawn() {
    // 초기에 8마리를 빠르게 스폰하여 즉시 전투 시작
    for (let i = 0; i < 8; i++) {
      this._spawnEnemy();
    }
    this.spawnTimer = 0;
    console.log('[PressureBasedSpawner] Initial spawn: 8 enemies');
  }

  /**
   * 전투 결과 보고 — DifficultyEngine 으로 delegate + TTK 추적.
   * @param {{killed?:boolean, leaked?:boolean, timeToKill?:number}} result
   */
  reportCombatResult(result = {}) {
    if (!this.difficultyEngine) return;

    if (result.killed) {
      this.difficultyEngine.reportKill(result.timeToKill);

      // TTK 추적
      if (typeof result.timeToKill === 'number' && result.timeToKill > 0) {
        this.recentTTKs.push(result.timeToKill);
        if (this.recentTTKs.length > this.maxTTKSamples) {
          this.recentTTKs.shift();
        }
      }
    }

    if (result.leaked) {
      this.difficultyEngine.reportLeak();
    }
  }

  /**
   * 디버그/UI 정보.
   * @returns {Object}
   */
  getDebugInfo() {
    const details = this._lastPressureDetails || {};
    return {
      pressure:         +(this.currentPressure * 100).toFixed(1) + '%',
      targetPressure:   +(this.targetPressure * 100).toFixed(1) + '%',
      spawnInterval:    +this.currentInterval.toFixed(2) + 's',
      escalationLevel:  this.escalationLevel,
      levelRange:       `${this.currentLevelMin}-${this.currentLevelMax}`,
      difficultyValue:  +(this.difficultyEngine?.difficultyValue ?? 0).toFixed(3),
      // 압박도 상세
      aliveCount:       details.aliveCount || 0,
      towerCount:       details.towerCount || 0,
      alivePressure:    details.alivePressure + '%' || 'N/A',
      towerBusyPressure: details.towerBusyPressure + '%' || 'N/A',
      ttkPressure:      details.ttkPressure + '%' || 'N/A',
    };
  }

  // ── 압박도 계산 ───────────────────────────────────────────────────────────

  _updatePressure() {
    const aliveCount = this.multiPathSystem.getObjects().length;

    // 1. Alive Count 압박도 (0~1)
    const alivePressure = Math.min(1.0, aliveCount / TARGET_ALIVE_COUNT);

    // 2. Tower Busy 압박도 (타워가 얼마나 바쁜가?)
    // 타워가 없으면 압박도를 낮게 → 스폰 빨라짐
    let towerBusyPressure = 0.2; // 기본값 (타워 정보 없을 때 낮게 설정)
    let towerCount = 0;
    if (this.towerManager) {
      const towers = this.towerManager.getAllTowers();
      towerCount = towers.length;
      if (towers.length > 0) {
        let busyCount = 0;
        for (const tower of towers) {
          // 타워가 타겟을 갖고 있거나 공격 쿨다운 중이면 busy
          if (tower.currentTarget || (tower.attackCooldown && tower.attackCooldown > 0)) {
            busyCount++;
          }
        }
        towerBusyPressure = busyCount / towers.length;
      }
    }

    // 3. TTK 압박도 (처치가 빠르면 압박도 낮음, 느리면 높음)
    // 샘플 부족 시 낮게 → 스폰 빨라짐
    let ttkPressure = 0.3; // 기본값 (낮게 설정)
    if (this.recentTTKs.length >= 3) {
      const avgTTK = this.recentTTKs.reduce((sum, v) => sum + v, 0) / this.recentTTKs.length;
      // TTK 3초 미만 → 0.2, 13초 이상 → 0.8
      ttkPressure = Math.max(0.2, Math.min(0.8, (avgTTK - 3) / 10));
    }

    // 통합 압박도
    this.currentPressure =
      alivePressure      * PRESSURE_WEIGHTS.aliveCount +
      towerBusyPressure  * PRESSURE_WEIGHTS.towerBusy +
      ttkPressure        * PRESSURE_WEIGHTS.ttkFactor;

    this.currentPressure = Math.max(0, Math.min(1, this.currentPressure));

    // 상세 디버그 (압박도 계산 시 저장)
    this._lastPressureDetails = {
      aliveCount,
      towerCount,
      alivePressure: +(alivePressure * 100).toFixed(1),
      towerBusyPressure: +(towerBusyPressure * 100).toFixed(1),
      ttkPressure: +(ttkPressure * 100).toFixed(1),
    };
  }

  // ── 스폰 간격 조정 ─────────────────────────────────────────────────────────

  _adjustSpawnInterval(dt) {
    const pressureDiff = this.currentPressure - this.targetPressure;

    // 비대칭 조정: 압박도 부족 시 빠르게, 초과 시 천천히
    let adjustRate;
    if (pressureDiff < 0) {
      // 압박도 부족 → 간격을 빠르게 줄임 (적을 더 빠르게 스폰)
      adjustRate = INTERVAL_ADJUST_RATE_FAST;
    } else {
      // 압박도 초과 → 간격을 천천히 늘림 (적을 천천히 줄임)
      adjustRate = INTERVAL_ADJUST_RATE_SLOW;
    }

    // 부호 수정: pressureDiff가 음수(부족)면 adjustment도 음수(간격 감소)
    const adjustment = pressureDiff * adjustRate * dt;

    const oldInterval = this.currentInterval;
    this.currentInterval += adjustment;
    this.currentInterval = Math.max(MIN_SPAWN_INTERVAL, Math.min(MAX_SPAWN_INTERVAL, this.currentInterval));

    // 디버그: 간격 변화 로그 (큰 변화가 있을 때만)
    if (Math.abs(this.currentInterval - oldInterval) > 0.05) {
      console.log(`[Adjust] Pressure: ${(this.currentPressure*100).toFixed(1)}% → Interval: ${oldInterval.toFixed(2)}s → ${this.currentInterval.toFixed(2)}s (${adjustment > 0 ? '+' : ''}${adjustment.toFixed(3)})`);
    }
  }

  // ── 에스컬레이션 체크 ──────────────────────────────────────────────────────

  _checkEscalation(dt) {
    // 스폰 간격이 최소치에 근접하고 압박도가 목표 미달이면 에스컬레이션 준비
    const atMinInterval = this.currentInterval <= MIN_SPAWN_INTERVAL + 0.2;
    // 압박도가 목표의 75% 미만이면 부족한 것으로 판단
    const pressureDeficit = this.currentPressure < this.targetPressure * 0.75;

    if (atMinInterval && pressureDeficit) {
      this.minIntervalTime += dt;
    } else {
      this.minIntervalTime = 0;
    }

    // 일정 시간 이상 최소 간격에 머물렀으면 에스컬레이션
    if (this.minIntervalTime >= ESCALATION_THRESHOLD_TIME) {
      this._escalateLevel();
      this.minIntervalTime = 0;
    }
  }

  _escalateLevel() {
    if (this.escalationLevel >= LEVEL_ESCALATION_STEPS.length - 1) {
      console.log('[PressureBasedSpawner] Already at max escalation level');
      return;
    }

    this.escalationLevel++;
    const step = LEVEL_ESCALATION_STEPS[this.escalationLevel];
    this.currentLevelMin = step.min;
    this.currentLevelMax = step.max;

    // 스폰 간격 리셋 (중간보다 약간 작은 값으로 - 빠르게 재개)
    this.currentInterval = MIN_SPAWN_INTERVAL + (MAX_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL) * 0.35;

    // 에스컬레이션 쿨다운 시작
    this.escalationCooldown = ESCALATION_COOLDOWN;

    console.log(`[PressureBasedSpawner] ⬆️ ESCALATION to level ${this.escalationLevel}: lv${this.currentLevelMin}-${this.currentLevelMax}`);
  }

  // ── 적 스폰 ───────────────────────────────────────────────────────────────

  _spawnEnemy() {
    // 경로 선택 (round robin)
    const pathKey = this.spawnablePaths[this.pathCursor % this.spawnablePaths.length];
    this.pathCursor = (this.pathCursor + 1) % this.spawnablePaths.length;

    // 적 선택
    const baseFood = this._pickEnemy(pathKey, this.currentLevelMin, this.currentLevelMax);
    if (!baseFood) {
      console.warn('[PressureBasedSpawner] No enemy found for', pathKey, this.currentLevelMin, this.currentLevelMax);
      return;
    }

    // DifficultyEngine 스케일 적용
    const hpScale    = this.difficultyEngine?.getHpScale()    ?? 1.0;
    const armorScale = this.difficultyEngine?.getArmorScale() ?? 1.0;

    const scaledHp    = Math.max(1, Math.round(baseFood.hp    * hpScale));
    const scaledArmor = Math.max(0, Math.round(baseFood.armor * armorScale));

    // 속도
    const baseSpeed  = Math.max(MIN_SPEED, baseFood.speed);
    const jitter     = (Math.random() - 0.5) * SPEED_JITTER;
    const finalSpeed = Math.max(MIN_SPEED, baseSpeed + jitter);

    this.multiPathSystem.spawn(pathKey, {
      ...baseFood,
      hp:          scaledHp,
      maxHp:       scaledHp,
      armor:       scaledArmor,
      speed:       finalSpeed,
      baseSpeed,
      speedScale:  Number((finalSpeed / BASE_SPEED).toFixed(3)),
      size:        Math.max(20, baseFood.size + (Math.random() - 0.5) * 2),
      spin:        (Math.random() - 0.5) * 1.8,
      exitThreshold: 25,
      tags:        baseFood.types,
    }, 0);
  }

  // ── 적 선택 ──────────────────────────────────────────────────────────────

  /**
   * 경로 + 레벨 범위에서 적 1개 선택 (안티리피트 적용).
   * @param {string} pathKey
   * @param {number} levelMin
   * @param {number} levelMax
   * @returns {Object|null}
   */
  _pickEnemy(pathKey, levelMin, levelMax) {
    const allInPath = ENEMY_STATS[pathKey];
    if (!allInPath || allInPath.length === 0) return null;

    // 레벨 범위 필터
    let pool = allInPath.filter(e => e.level >= levelMin && e.level <= levelMax);

    // fallback: 범위 내 없으면 가장 가까운 레벨 적
    if (pool.length === 0) {
      const mid = (levelMin + levelMax) / 2;
      const sorted = [...allInPath].sort((a, b) => Math.abs(a.level - mid) - Math.abs(b.level - mid));
      pool = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.3)));
    }

    // 안티리피트 필터
    const filtered = pool.filter(e => !this.recentEmojiQueue.includes(e.emoji));
    const source   = filtered.length > 0 ? filtered : pool;
    const picked   = source[Math.floor(Math.random() * source.length)];

    this.recentEmojiQueue.push(picked.emoji);
    while (this.recentEmojiQueue.length > RECENT_QUEUE_MAX) {
      this.recentEmojiQueue.shift();
    }

    return picked;
  }
}
