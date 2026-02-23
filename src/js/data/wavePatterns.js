/**
 * Layer B — Wave Pattern Table
 *
 * 명시적으로 이름 붙은 웨이브 스크립트 정의.
 * DifficultyEngine(Layer C)의 difficultyValue (0.0~1.0) 에 따라 선택됨.
 *
 * 각 패턴 구조:
 * {
 *   id        : string          — 고유 식별자
 *   minDiff   : number          — 이 패턴이 선택될 최소 difficultyValue
 *   maxDiff   : number          — 이 패턴이 선택될 최대 difficultyValue
 *   script    : ScriptEvent[]   — 시간 순서 스폰 이벤트 배열
 * }
 *
 * ScriptEvent 구조:
 * {
 *   at         : number          — 웨이브 시작 후 경과 시간 (초)
 *   mode       : 'single'|'line'|'triple'
 *                  single  → path 하나에 1마리
 *                  line    → path 하나에 count 마리 연속 (gap 간격)
 *                  triple  → 3개 경로 동시 각 1마리
 *   tier       : 'normal'|'strong'|'elite'  — A 테이블 티어 필터
 *   path       : 'round_robin'|'random'|null
 *                  round_robin → 경로 순환 (single/line 기본값)
 *                  random      → 랜덤 경로 pick
 *                  null        → triple 전용 (모든 경로 동시)
 *   count      : number?        — line 모드 시 마리 수 (기본 2)
 *   gap        : number?        — line 모드 시 간격 px (기본 22)
 *   speedScale : number?        — 이 이벤트 적 속도 배율 (기본 1.0)
 * }
 *
 * 웨이브 완료 조건: 마지막 이벤트(최대 at 값) 이후 FoodSpawner.WAVE_COOLDOWN 초 경과.
 * minDiff/maxDiff 범위가 겹치는 패턴이 있으면 그 중에서 랜덤 선택 → 다양성 확보.
 */

export const WAVE_PATTERNS = [

  // ══════════════════════════════════════════════════════════════
  // 입문 구간  0.00 ~ 0.25  — 느리게, 하나씩, normal 위주
  // ══════════════════════════════════════════════════════════════

  {
    id: 'intro_trickle',
    minDiff: 0.00, maxDiff: 0.25,
    script: [
      { at: 0.0,  mode: 'single', tier: 'normal', path: 'round_robin' },
      { at: 5.0,  mode: 'single', tier: 'normal', path: 'round_robin' },
      { at: 10.0, mode: 'single', tier: 'normal', path: 'round_robin' },
      { at: 15.0, mode: 'single', tier: 'normal', path: 'round_robin' },
    ],
  },

  {
    id: 'intro_two_path',
    minDiff: 0.08, maxDiff: 0.28,
    script: [
      { at: 0.0,  mode: 'single', tier: 'normal', path: 'round_robin' },
      { at: 4.0,  mode: 'single', tier: 'normal', path: 'round_robin' },
      { at: 7.5,  mode: 'single', tier: 'normal', path: 'random' },
      { at: 11.0, mode: 'single', tier: 'normal', path: 'round_robin' },
      { at: 14.5, mode: 'single', tier: 'normal', path: 'random' },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // 초반 구간  0.18 ~ 0.45  — 라인 등장, strong 소량 혼합
  // ══════════════════════════════════════════════════════════════

  {
    id: 'early_first_line',
    minDiff: 0.18, maxDiff: 0.45,
    script: [
      { at: 0.0,  mode: 'single', tier: 'normal', path: 'round_robin' },
      { at: 4.0,  mode: 'line',   tier: 'normal', count: 2, gap: 26, speedScale: 0.90, path: 'random' },
      { at: 9.0,  mode: 'single', tier: 'normal', path: 'round_robin' },
      { at: 13.0, mode: 'single', tier: 'strong', path: 'round_robin' },
    ],
  },

  {
    id: 'early_mixed_pace',
    minDiff: 0.25, maxDiff: 0.48,
    script: [
      { at: 0.0,  mode: 'single', tier: 'normal', path: 'round_robin' },
      { at: 3.5,  mode: 'single', tier: 'strong', path: 'random' },
      { at: 7.0,  mode: 'line',   tier: 'normal', count: 2, gap: 24, speedScale: 0.88, path: 'random' },
      { at: 11.5, mode: 'single', tier: 'normal', path: 'round_robin' },
      { at: 15.0, mode: 'single', tier: 'strong', path: 'round_robin' },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // 중반 구간  0.38 ~ 0.62  — triple 첫 등장, strong 주력, elite 예고
  // ══════════════════════════════════════════════════════════════

  {
    id: 'mid_triple_intro',
    minDiff: 0.38, maxDiff: 0.60,
    script: [
      { at: 0.0,  mode: 'line',   tier: 'strong', count: 2, gap: 22, speedScale: 0.87, path: 'random' },
      { at: 5.0,  mode: 'triple', tier: 'normal', path: null },
      { at: 9.5,  mode: 'single', tier: 'strong', path: 'round_robin' },
      { at: 13.0, mode: 'single', tier: 'strong', path: 'random' },
    ],
  },

  {
    id: 'mid_strong_pressure',
    minDiff: 0.42, maxDiff: 0.65,
    script: [
      { at: 0.0,  mode: 'single', tier: 'strong', path: 'round_robin' },
      { at: 3.0,  mode: 'line',   tier: 'strong', count: 3, gap: 22, speedScale: 0.86, path: 'random' },
      { at: 8.0,  mode: 'triple', tier: 'normal', path: null },
      { at: 12.0, mode: 'single', tier: 'strong', path: 'round_robin' },
    ],
  },

  {
    id: 'mid_elite_peek',
    minDiff: 0.50, maxDiff: 0.68,
    script: [
      { at: 0.0,  mode: 'single', tier: 'strong', path: 'round_robin' },
      { at: 3.5,  mode: 'line',   tier: 'strong', count: 2, gap: 20, speedScale: 0.85, path: 'random' },
      { at: 8.0,  mode: 'single', tier: 'elite',  path: 'round_robin' },
      { at: 12.0, mode: 'single', tier: 'strong', path: 'random' },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // 후반 구간  0.60 ~ 0.85  — elite 주력, 밀집 라인, triple strong
  // ══════════════════════════════════════════════════════════════

  {
    id: 'late_elite_hunt',
    minDiff: 0.60, maxDiff: 0.82,
    script: [
      { at: 0.0,  mode: 'triple', tier: 'strong', path: null },
      { at: 4.0,  mode: 'line',   tier: 'elite',  count: 2, gap: 20, speedScale: 0.84, path: 'random' },
      { at: 9.0,  mode: 'single', tier: 'elite',  path: 'round_robin' },
      { at: 12.5, mode: 'triple', tier: 'strong', path: null },
    ],
  },

  {
    id: 'late_dense_line',
    minDiff: 0.65, maxDiff: 0.85,
    script: [
      { at: 0.0,  mode: 'single', tier: 'elite',  path: 'round_robin' },
      { at: 3.5,  mode: 'line',   tier: 'strong', count: 4, gap: 18, speedScale: 0.82, path: 'random' },
      { at: 8.5,  mode: 'triple', tier: 'elite',  path: null },
      { at: 12.0, mode: 'line',   tier: 'strong', count: 3, gap: 20, speedScale: 0.83, path: 'random' },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // 최고 구간  0.78 ~ 1.00  — elite triple 폭풍, 밀집 최대
  // ══════════════════════════════════════════════════════════════

  {
    id: 'max_elite_storm',
    minDiff: 0.78, maxDiff: 1.00,
    script: [
      { at: 0.0,  mode: 'triple', tier: 'elite',  path: null },
      { at: 3.5,  mode: 'line',   tier: 'elite',  count: 4, gap: 18, speedScale: 0.80, path: 'random' },
      { at: 7.5,  mode: 'triple', tier: 'strong', path: null },
      { at: 11.0, mode: 'line',   tier: 'elite',  count: 4, gap: 18, speedScale: 0.78, path: 'random' },
      { at: 14.5, mode: 'triple', tier: 'elite',  path: null },
    ],
  },

  {
    id: 'max_relentless',
    minDiff: 0.85, maxDiff: 1.00,
    script: [
      { at: 0.0,  mode: 'line',   tier: 'elite',  count: 3, gap: 18, speedScale: 0.80, path: 'round_robin' },
      { at: 4.0,  mode: 'triple', tier: 'elite',  path: null },
      { at: 7.0,  mode: 'line',   tier: 'elite',  count: 4, gap: 16, speedScale: 0.78, path: 'random' },
      { at: 11.0, mode: 'triple', tier: 'elite',  path: null },
      { at: 14.0, mode: 'line',   tier: 'elite',  count: 4, gap: 16, speedScale: 0.76, path: 'random' },
      { at: 17.5, mode: 'triple', tier: 'elite',  path: null },
    ],
  },
];

/**
 * difficultyValue 에 맞는 패턴 후보 목록 반환.
 * @param {number} dv - 0.0~1.0
 * @returns {Object[]} 매칭 패턴 배열 (없으면 가장 가까운 1개 fallback)
 */
export function getCandidatePatterns(dv) {
  const matched = WAVE_PATTERNS.filter(p => dv >= p.minDiff && dv <= p.maxDiff);
  if (matched.length > 0) return matched;

  // Fallback: 가장 가까운 패턴 1개
  let best = WAVE_PATTERNS[0];
  let bestDist = Infinity;
  for (const p of WAVE_PATTERNS) {
    const dist = Math.min(Math.abs(dv - p.minDiff), Math.abs(dv - p.maxDiff));
    if (dist < bestDist) { bestDist = dist; best = p; }
  }
  return [best];
}
