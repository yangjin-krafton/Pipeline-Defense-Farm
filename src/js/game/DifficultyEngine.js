/**
 * Layer C — DifficultyEngine
 *
 * 실시간 전장 지표를 수집해 difficultyValue (0.0~1.0) 하나를 출력.
 * FoodSpawner 가 이 값으로:
 *   1. Layer B 웨이브 패턴 선택 (minDiff~maxDiff 범위 매칭)
 *   2. Layer A 스탯 스케일링 (getHpScale / getArmorScale)
 *
 * 지표 수집 윈도우: 10초
 * 평가 축:
 *   - aliveScore  : 화면 잔존 적 수 (많으면 → pressure 上)
 *   - ttkScore    : 평균 처치 시간 (짧으면 = 플레이어 강함 → pressure 上)
 *   - leakScore   : 누수율 (높으면 → pressure 下, 적이 너무 쉬워 지나가는 게 아니라 버거워서 지나가는 것)
 *
 * EMA 스무딩:
 *   - 상승 방향 alpha=0.30 (느리게 올라감 — 급등 방지)
 *   - 하강 방향 alpha=0.55 (빠르게 내려옴 — 과부하 즉시 완화)
 */

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function lerp(a, b, t) {
  return a + (b - a) * clamp01(t);
}

export class DifficultyEngine {
  constructor() {
    /** 외부 공개 — FoodSpawner 가 읽는 현재 난이도 (0.0~1.0) */
    this.difficultyValue = 0.05;

    // EMA 내부 상태
    this._smoothed = 0.05;

    // 10초 윈도우 카운터
    this._windowSec   = 10.0;
    this._timer       = 0;
    this._aliveIntegral = 0;   // sum(alive * dt)
    this._kills       = 0;
    this._leaks       = 0;
    this._ttkSum      = 0;
    this._ttkCount    = 0;
    this._sessionSec  = 0;

    // 스탯 스케일 상한
    // difficultyValue=1.0 에서 각 배율 최대값
    this.HP_SCALE_MAX    = 2.5;  // hp 최대 2.5배
    this.ARMOR_SCALE_MAX = 3.0;  // armor 최대 3배 (armor=14 → 42 → 42% 감소)

    // 최근 평가 결과 (디버그/UI 노출용)
    this.lastEvalStats = null;
  }

  // ── 외부 API ───────────────────────────────────────────────────────────

  /**
   * GameLoop 에서 매 프레임 호출.
   * @param {number} dt         - 스케일된 delta time (초)
   * @param {number} aliveCount - 현재 화면 내 생존 적 수
   */
  update(dt, aliveCount) {
    this._sessionSec      += dt;
    this._timer           += dt;
    this._aliveIntegral   += aliveCount * dt;

    if (this._timer >= this._windowSec) {
      this._evaluate();
      this._resetWindow();
    }
  }

  /**
   * 적 처치 이벤트 보고.
   * @param {number|undefined} timeToKill - 스폰~처치 경과 시간 (초)
   */
  reportKill(timeToKill) {
    this._kills += 1;
    if (typeof timeToKill === 'number' && Number.isFinite(timeToKill) && timeToKill >= 0) {
      this._ttkSum   += timeToKill;
      this._ttkCount += 1;
    }
  }

  /**
   * 적 누수(경로 통과) 이벤트 보고.
   */
  reportLeak() {
    this._leaks += 1;
  }

  /**
   * 현재 difficultyValue 에 따른 HP 스케일 배율.
   * @returns {number}
   */
  getHpScale() {
    return lerp(1.0, this.HP_SCALE_MAX, this.difficultyValue);
  }

  /**
   * 현재 difficultyValue 에 따른 Armor 스케일 배율.
   * @returns {number}
   */
  getArmorScale() {
    return lerp(1.0, this.ARMOR_SCALE_MAX, this.difficultyValue);
  }

  // ── 내부 평가 ──────────────────────────────────────────────────────────

  _evaluate() {
    const elapsed  = Math.max(0.001, this._timer);
    const avgAlive = this._aliveIntegral / elapsed;
    const avgTTK   = this._ttkCount > 0 ? this._ttkSum / this._ttkCount : 12.0;
    const total    = Math.max(1, this._kills + this._leaks);
    const leakRate = this._leaks / total;
    const hasSamples = (this._kills + this._leaks) >= 4;

    // ── 각 축 점수 ────────────────────────────────────────────────────
    // aliveScore  : 잔존 적 4~24명 → 0~1 (더 많이 살아남을수록 압박 높음)
    const aliveScore = clamp01((avgAlive - 4) / 20);

    // ttkScore : TTK 가 짧을수록(= 플레이어 강함) 높게 → pressure 上 필요
    //   TTK 3초(매우 빠름)→1.0,  15초(느림)→0.0
    const ttkScore = hasSamples
      ? clamp01(1 - (avgTTK - 3) / 12)
      : 0.5; // 샘플 부족 시 중립

    // leakScore : 누수율 높으면 → 플레이어가 못 막는 것 → pressure 下
    //   (누수 = 난이도를 낮춰야 한다는 신호)
    //   leakRate 30% 이상이면 1.0
    const leakScore = clamp01(leakRate / 0.30);

    // ── 통합 rawTarget ────────────────────────────────────────────────
    // aliveScore, ttkScore 는 "올려야" 하는 신호
    // leakScore 는 "내려야" 하는 신호
    const rawTarget = hasSamples
      ? clamp01((aliveScore * 0.40) + (ttkScore * 0.40) - (leakScore * 0.30) + 0.15)
      : this._smoothed; // 샘플 부족 시 현상 유지

    // ── EMA 스무딩 ────────────────────────────────────────────────────
    // 상승은 느리게(0.30), 하강은 빠르게(0.55) → 과부하 즉시 완화
    const alpha = rawTarget > this._smoothed ? 0.30 : 0.55;
    this._smoothed = clamp01(this._smoothed * (1 - alpha) + rawTarget * alpha);

    // 세션 초반(30초) 은 최대 0.40 으로 제한 — 튜토리얼 보호
    if (this._sessionSec < 30) {
      this._smoothed = Math.min(0.40, this._smoothed);
    }

    this.difficultyValue = this._smoothed;

    // 디버그 보존
    this.lastEvalStats = {
      avgAlive: +avgAlive.toFixed(2),
      avgTTK:   +avgTTK.toFixed(2),
      leakRate: +leakRate.toFixed(3),
      aliveScore: +aliveScore.toFixed(3),
      ttkScore:   +ttkScore.toFixed(3),
      leakScore:  +leakScore.toFixed(3),
      rawTarget:  +rawTarget.toFixed(3),
      difficultyValue: +this.difficultyValue.toFixed(3),
    };
  }

  _resetWindow() {
    this._timer         = 0;
    this._aliveIntegral = 0;
    this._kills         = 0;
    this._leaks         = 0;
    this._ttkSum        = 0;
    this._ttkCount      = 0;
  }
}
