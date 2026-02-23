/**
 * FoodSpawner — Wave Executor
 *
 * Layer C (DifficultyEngine) 의 difficultyValue 로
 * Layer B (wavePatterns) 에서 웨이브를 선택하고,
 * Layer A (enemyStats) 에서 적을 뽑아 스폰하는 실행기.
 *
 * 상태 흐름:
 *   cooldown → [선택] → waveRunning → (마지막 이벤트 후 cooldown) → 반복
 */

import { ENEMY_STATS, ENEMY_STATS_BY_ID } from '../data/enemyStats.js';
import { WAVE_PATTERNS, getCandidatePatterns } from '../data/wavePatterns.js';
import { BASE_SPEED } from '../config.js';

// 웨이브 사이 최소 쿨다운 (초)
const WAVE_COOLDOWN_SEC = 1.5;

// 스폰 시 속도 지터 (±px)
const SPEED_JITTER = 7;

// 최소 속도 하한
const MIN_SPEED = 45;

// 경로 흐름 기본값
const DEFAULT_PATH_FLOW = {
  rice_stomach:    'small_intestine',
  dessert_stomach: 'small_intestine',
  alcohol_stomach: 'small_intestine',
  small_intestine: 'large_intestine',
  large_intestine: null,
};

export class FoodSpawner {
  /**
   * @param {import('../utils/MultiPathFollowerSystem.js').MultiPathFollowerSystem} multiPathSystem
   * @param {import('./DifficultyEngine.js').DifficultyEngine} difficultyEngine
   */
  constructor(multiPathSystem, difficultyEngine) {
    this.multiPathSystem  = multiPathSystem;
    this.difficultyEngine = difficultyEngine;

    this.spawnablePaths = ['rice_stomach', 'dessert_stomach', 'alcohol_stomach'];
    this.pathCursor     = 0;
    this.pathFlow       = this.multiPathSystem.pathFlow || DEFAULT_PATH_FLOW;

    // Layer A 경로별 tier 인덱스 구축
    this._poolByPathAndTier = this._buildPoolIndex();

    // 안티리피트 큐
    this.recentEmojiQueue = [];
    this.recentQueueMax   = 5;

    // 경로 총 이동 거리 캐시 (스폰 밀도 계산용)
    this.journeyMetaBySpawnPath = this._buildJourneyMeta();

    // ── 웨이브 실행 상태 ──────────────────────────────────────────────
    this._currentWave    = null;   // 현재 실행 중인 WavePattern
    this._waveTimer      = 0;     // 웨이브 시작 후 경과 시간 (초)
    this._nextEventIdx   = 0;     // 다음 실행할 script 이벤트 인덱스
    this._cooldownTimer  = 0;     // 웨이브 간 쿨다운 잔여 시간

    // 이전 웨이브 ID (중복 선택 방지)
    this._lastWaveId     = null;
  }

  // ── 공개 API ─────────────────────────────────────────────────────────

  /**
   * GameLoop 에서 매 프레임 호출.
   * @param {number} dt - 스케일된 delta time (초)
   */
  update(dt) {
    // 쿨다운 처리
    if (this._cooldownTimer > 0) {
      this._cooldownTimer -= dt;
      return;
    }

    // 웨이브 없으면 새로 선택
    if (!this._currentWave) {
      this._selectNewWave();
    }

    // 웨이브 타이머 진행 & 이벤트 실행
    this._waveTimer += dt;
    this._processScriptEvents();

    // 웨이브 완료 체크
    if (this._isWaveComplete()) {
      this._cooldownTimer = WAVE_COOLDOWN_SEC;
      this._currentWave   = null;
    }
  }

  /**
   * 전투 결과 보고 — DifficultyEngine 으로 delegate.
   * GameLoop/MultiPathSystem 에서 기존 인터페이스 호환용.
   * @param {{killed?:boolean, leaked?:boolean, timeToKill?:number}} result
   */
  reportCombatResult(result = {}) {
    if (!this.difficultyEngine) return;
    if (result.killed) {
      this.difficultyEngine.reportKill(result.timeToKill);
    }
    if (result.leaked) {
      this.difficultyEngine.reportLeak();
    }
  }

  /**
   * 현재 웨이브 정보 (디버그/UI 용).
   * @returns {{waveId:string|null, timer:number, difficultyValue:number}}
   */
  getDebugInfo() {
    return {
      waveId:          this._currentWave?.id ?? null,
      waveTimer:       +this._waveTimer.toFixed(2),
      nextEventIdx:    this._nextEventIdx,
      difficultyValue: +(this.difficultyEngine?.difficultyValue ?? 0).toFixed(3),
      cooldown:        +this._cooldownTimer.toFixed(2),
    };
  }

  // ── 웨이브 선택 ───────────────────────────────────────────────────────

  _selectNewWave() {
    const dv = this.difficultyEngine?.difficultyValue ?? 0.05;
    const candidates = getCandidatePatterns(dv);

    // 연속 동일 웨이브 방지 (후보가 2개 이상일 때)
    let pool = candidates;
    if (candidates.length > 1 && this._lastWaveId) {
      const filtered = candidates.filter(p => p.id !== this._lastWaveId);
      if (filtered.length > 0) pool = filtered;
    }

    this._currentWave  = pool[Math.floor(Math.random() * pool.length)];
    this._waveTimer    = 0;
    this._nextEventIdx = 0;
    this._lastWaveId   = this._currentWave.id;
  }

  // ── 스크립트 실행 ────────────────────────────────────────────────────

  _processScriptEvents() {
    const script = this._currentWave?.script;
    if (!script) return;

    while (this._nextEventIdx < script.length) {
      const event = script[this._nextEventIdx];
      if (this._waveTimer < event.at) break;
      this._executeEvent(event);
      this._nextEventIdx++;
    }
  }

  _isWaveComplete() {
    const script = this._currentWave?.script;
    if (!script || script.length === 0) return true;
    return this._nextEventIdx >= script.length;
  }

  /**
   * 개별 스크립트 이벤트 실행.
   * @param {Object} event
   */
  _executeEvent(event) {
    const { mode, tier, path, count = 2, gap = 22, speedScale = 1.0 } = event;

    if (mode === 'triple') {
      // 3개 경로 동시 스폰
      for (const pathKey of this.spawnablePaths) {
        this._spawnOne(pathKey, tier, speedScale, 0);
      }
    } else if (mode === 'line') {
      const pathKey = this._resolvePath(path);
      for (let i = 0; i < count; i++) {
        this._spawnOne(pathKey, tier, speedScale, i * gap);
      }
    } else {
      // single
      const pathKey = this._resolvePath(path);
      this._spawnOne(pathKey, tier, speedScale, 0);
    }
  }

  // ── 단일 스폰 ────────────────────────────────────────────────────────

  /**
   * 경로에 적 1마리 스폰.
   * @param {string} pathKey
   * @param {string} tier      - 'normal'|'strong'|'elite'
   * @param {number} speedScale
   * @param {number} initialOffset - 경로 상 초기 오프셋 (px)
   */
  _spawnOne(pathKey, tier, speedScale, initialOffset) {
    const baseFood = this._pickEnemy(pathKey, tier);
    if (!baseFood) return;

    // DifficultyEngine 스케일 적용
    const hpScale    = this.difficultyEngine?.getHpScale()    ?? 1.0;
    const armorScale = this.difficultyEngine?.getArmorScale() ?? 1.0;

    const scaledHp    = Math.max(1, Math.round(baseFood.hp    * hpScale));
    const scaledArmor = Math.max(0, Math.round(baseFood.armor * armorScale));

    // 속도 = 기본속도 × speedScale + 지터
    const baseSpeed  = Math.max(MIN_SPEED, baseFood.speed * Math.max(0.6, Math.min(1.2, speedScale)));
    const jitter     = (Math.random() - 0.5) * SPEED_JITTER;
    const finalSpeed = Math.max(MIN_SPEED, baseSpeed + jitter);

    this.multiPathSystem.spawn(pathKey, {
      ...baseFood,
      // 스케일된 전투 스탯
      hp:          scaledHp,
      maxHp:       scaledHp,
      armor:       scaledArmor,
      // 이동/렌더
      speed:       finalSpeed,
      baseSpeed,
      speedScale:  Number((finalSpeed / BASE_SPEED).toFixed(3)),
      size:        Math.max(20, baseFood.size + (Math.random() - 0.5) * 2),
      spin:        (Math.random() - 0.5) * 1.8,
      exitThreshold: 25,
      // 타워 태그보너스 호환 (BaseTower 는 food.tags 참조)
      tags:        baseFood.types,
    }, initialOffset);
  }

  // ── 적 선택 ──────────────────────────────────────────────────────────

  /**
   * 경로+티어 풀에서 적 1개 선택 (안티리피트 적용).
   * @param {string} pathKey
   * @param {string} tier
   * @returns {Object|null}
   */
  _pickEnemy(pathKey, tier) {
    const pool = this._poolByPathAndTier[pathKey]?.[tier];
    if (!pool || pool.length === 0) {
      // fallback: 같은 경로에서 티어 무관 랜덤
      const allInPath = ENEMY_STATS[pathKey];
      if (!allInPath || allInPath.length === 0) return null;
      return allInPath[Math.floor(Math.random() * allInPath.length)];
    }

    // 안티리피트 필터
    const filtered = pool.filter(e => !this.recentEmojiQueue.includes(e.emoji));
    const source   = filtered.length > 0 ? filtered : pool;
    const picked   = source[Math.floor(Math.random() * source.length)];

    this.recentEmojiQueue.push(picked.emoji);
    while (this.recentEmojiQueue.length > this.recentQueueMax) {
      this.recentEmojiQueue.shift();
    }

    return picked;
  }

  // ── 경로 결정 ────────────────────────────────────────────────────────

  /**
   * 이벤트의 path 지시자를 실제 pathKey 로 변환.
   * @param {string|null} pathDirective
   * @returns {string}
   */
  _resolvePath(pathDirective) {
    if (pathDirective === 'random') {
      return this.spawnablePaths[Math.floor(Math.random() * this.spawnablePaths.length)];
    }
    // round_robin (default)
    const path = this.spawnablePaths[this.pathCursor % this.spawnablePaths.length];
    this.pathCursor = (this.pathCursor + 1) % this.spawnablePaths.length;
    return path;
  }

  // ── 인덱스 구축 ──────────────────────────────────────────────────────

  /**
   * 경로별 tier 별 풀 인덱스 구축.
   * @returns {Object<string, Object<string, Object[]>>}
   */
  _buildPoolIndex() {
    const index = {};
    for (const [pathKey, enemies] of Object.entries(ENEMY_STATS)) {
      index[pathKey] = { normal: [], strong: [], elite: [] };
      for (const e of enemies) {
        const t = e.tier;
        if (index[pathKey][t]) index[pathKey][t].push(e);
      }
    }
    return index;
  }

  /**
   * 각 스폰 경로의 총 이동 거리 계산 (내부 참고용, 현재는 미사용).
   */
  _buildJourneyMeta() {
    const meta = {};
    const seenLimit = 12;

    for (const startPath of this.spawnablePaths) {
      let distance  = 0;
      let pathCount = 0;
      let current   = startPath;
      const visited = new Set();

      while (current && !visited.has(current) && pathCount < seenLimit) {
        visited.add(current);
        const ps = this.multiPathSystem.getPathSystem(current);
        if (ps) {
          distance  += ps.getPathLength();
          pathCount += 1;
        }
        current = this.pathFlow[current];
      }

      meta[startPath] = { distance: distance + pathCount * 25, paths: pathCount };
    }

    return meta;
  }
}
