/**
 * Layer B — Wave Pattern Table
 *
 * 각 이벤트에서 tier 대신 levelMin/levelMax 로 적 수준을 지정.
 * FoodSpawner 가 해당 경로에서 level 이 범위 안에 드는 적을 뽑아 스폰.
 *
 * ScriptEvent 구조:
 * {
 *   at        : number          — 웨이브 시작 후 경과 시간 (초)
 *   mode      : 'single'|'line'|'triple'
 *   levelMin  : number          — 뽑을 적의 최소 level (포함)
 *   levelMax  : number          — 뽑을 적의 최대 level (포함)
 *   path      : 'round_robin'|'random'|null  (null = triple 전용: 전경로 동시)
 *   count     : number?         — line 모드 마리 수 (기본 2)
 *   gap       : number?         — line 모드 간격 px (기본 22)
 *   speedScale: number?         — 이 이벤트 속도 배율 (기본 1.0)
 * }
 *
 * lv 범위 참고:
 *   lv  1~20  : 아주 초반 (candy~rice_cracker)
 *   lv 20~40  : 초반 (sushi~cake)
 *   lv 40~60  : 중반 (donut~sandwich)
 *   lv 60~80  : 후반 (ramen~birthday_cake)
 *   lv 80~100 : 최종 (bento~cut_of_meat)
 */

export const WAVE_PATTERNS = [

  // ══════════════════════════════════════════════════════════════════════
  // 입문  0.00 ~ 0.25  — lv1~20, 하나씩, 느린 간격
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'intro_trickle',
    minDiff: 0.00, maxDiff: 0.25,
    script: [
      { at:  0.0, mode: 'single', levelMin:  1, levelMax: 12, path: 'round_robin' },
      { at:  6.0, mode: 'single', levelMin:  1, levelMax: 15, path: 'round_robin' },
      { at: 12.0, mode: 'single', levelMin:  5, levelMax: 20, path: 'round_robin' },
      { at: 18.0, mode: 'single', levelMin:  5, levelMax: 20, path: 'round_robin' },
    ],
  },
  {
    id: 'intro_two_path',
    minDiff: 0.08, maxDiff: 0.28,
    script: [
      { at:  0.0, mode: 'single', levelMin:  1, levelMax: 18, path: 'round_robin' },
      { at:  5.0, mode: 'single', levelMin:  5, levelMax: 22, path: 'random' },
      { at: 10.0, mode: 'single', levelMin:  8, levelMax: 25, path: 'round_robin' },
      { at: 15.0, mode: 'single', levelMin: 10, levelMax: 28, path: 'random' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // 초반  0.18 ~ 0.48  — lv15~45, 라인 등장
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'early_first_line',
    minDiff: 0.18, maxDiff: 0.45,
    script: [
      { at:  0.0, mode: 'single', levelMin: 15, levelMax: 30, path: 'round_robin' },
      { at:  5.0, mode: 'line',   levelMin: 15, levelMax: 35, path: 'random',       count: 2, gap: 26, speedScale: 0.90 },
      { at: 10.0, mode: 'single', levelMin: 20, levelMax: 38, path: 'round_robin' },
      { at: 14.0, mode: 'single', levelMin: 25, levelMax: 42, path: 'round_robin' },
    ],
  },
  {
    id: 'early_mixed_pace',
    minDiff: 0.25, maxDiff: 0.48,
    script: [
      { at:  0.0, mode: 'single', levelMin: 20, levelMax: 35, path: 'round_robin' },
      { at:  4.0, mode: 'single', levelMin: 28, levelMax: 42, path: 'random' },
      { at:  8.0, mode: 'line',   levelMin: 22, levelMax: 40, path: 'random',       count: 2, gap: 24, speedScale: 0.88 },
      { at: 13.0, mode: 'single', levelMin: 30, levelMax: 45, path: 'round_robin' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // 중반  0.38 ~ 0.65  — lv35~70, triple 등장
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'mid_triple_intro',
    minDiff: 0.38, maxDiff: 0.60,
    script: [
      { at:  0.0, mode: 'line',   levelMin: 35, levelMax: 55, path: 'random',       count: 2, gap: 22, speedScale: 0.87 },
      { at:  6.0, mode: 'triple', levelMin: 30, levelMax: 50, path: null },
      { at: 11.0, mode: 'single', levelMin: 40, levelMax: 60, path: 'round_robin' },
      { at: 15.0, mode: 'single', levelMin: 45, levelMax: 62, path: 'random' },
    ],
  },
  {
    id: 'mid_strong_pressure',
    minDiff: 0.42, maxDiff: 0.65,
    script: [
      { at:  0.0, mode: 'single', levelMin: 40, levelMax: 58, path: 'round_robin' },
      { at:  4.0, mode: 'line',   levelMin: 38, levelMax: 60, path: 'random',       count: 3, gap: 22, speedScale: 0.86 },
      { at:  9.5, mode: 'triple', levelMin: 35, levelMax: 55, path: null },
      { at: 14.0, mode: 'single', levelMin: 45, levelMax: 65, path: 'round_robin' },
    ],
  },
  {
    id: 'mid_elite_peek',
    minDiff: 0.50, maxDiff: 0.68,
    script: [
      { at:  0.0, mode: 'single', levelMin: 45, levelMax: 62, path: 'round_robin' },
      { at:  4.0, mode: 'line',   levelMin: 45, levelMax: 65, path: 'random',       count: 2, gap: 20, speedScale: 0.85 },
      { at:  9.0, mode: 'single', levelMin: 60, levelMax: 75, path: 'round_robin' },
      { at: 13.0, mode: 'single', levelMin: 50, levelMax: 68, path: 'random' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // 후반  0.60 ~ 0.85  — lv60~90, elite 주력
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'late_elite_hunt',
    minDiff: 0.60, maxDiff: 0.82,
    script: [
      { at:  0.0, mode: 'triple', levelMin: 55, levelMax: 72, path: null },
      { at:  5.0, mode: 'line',   levelMin: 65, levelMax: 82, path: 'random',       count: 2, gap: 20, speedScale: 0.84 },
      { at: 10.0, mode: 'single', levelMin: 70, levelMax: 85, path: 'round_robin' },
      { at: 14.0, mode: 'triple', levelMin: 60, levelMax: 78, path: null },
    ],
  },
  {
    id: 'late_dense_line',
    minDiff: 0.65, maxDiff: 0.85,
    script: [
      { at:  0.0, mode: 'single', levelMin: 68, levelMax: 82, path: 'round_robin' },
      { at:  4.0, mode: 'line',   levelMin: 60, levelMax: 80, path: 'random',       count: 4, gap: 18, speedScale: 0.82 },
      { at:  9.5, mode: 'triple', levelMin: 70, levelMax: 88, path: null },
      { at: 14.0, mode: 'line',   levelMin: 65, levelMax: 82, path: 'random',       count: 3, gap: 20, speedScale: 0.83 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // 최고  0.78 ~ 1.00  — lv80~100, 최강 조합
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'max_elite_storm',
    minDiff: 0.78, maxDiff: 1.00,
    script: [
      { at:  0.0, mode: 'triple', levelMin: 80, levelMax: 100, path: null },
      { at:  4.0, mode: 'line',   levelMin: 82, levelMax: 100, path: 'random',       count: 4, gap: 18, speedScale: 0.80 },
      { at:  8.5, mode: 'triple', levelMin: 75, levelMax: 95,  path: null },
      { at: 12.5, mode: 'line',   levelMin: 85, levelMax: 100, path: 'random',       count: 4, gap: 18, speedScale: 0.78 },
      { at: 16.0, mode: 'triple', levelMin: 85, levelMax: 100, path: null },
    ],
  },
  {
    id: 'max_relentless',
    minDiff: 0.85, maxDiff: 1.00,
    script: [
      { at:  0.0, mode: 'line',   levelMin: 88, levelMax: 100, path: 'round_robin', count: 3, gap: 18, speedScale: 0.80 },
      { at:  5.0, mode: 'triple', levelMin: 90, levelMax: 100, path: null },
      { at:  9.0, mode: 'line',   levelMin: 88, levelMax: 100, path: 'random',       count: 4, gap: 16, speedScale: 0.78 },
      { at: 13.5, mode: 'triple', levelMin: 92, levelMax: 100, path: null },
      { at: 17.0, mode: 'line',   levelMin: 90, levelMax: 100, path: 'random',       count: 4, gap: 16, speedScale: 0.76 },
      { at: 21.0, mode: 'triple', levelMin: 95, levelMax: 100, path: null },
    ],
  },
];

/**
 * difficultyValue 에 맞는 패턴 후보 반환.
 * @param {number} dv - 0.0~1.0
 * @returns {Object[]}
 */
export function getCandidatePatterns(dv) {
  const matched = WAVE_PATTERNS.filter(p => dv >= p.minDiff && dv <= p.maxDiff);
  if (matched.length > 0) return matched;

  // fallback: 가장 가까운 패턴 1개
  let best = WAVE_PATTERNS[0];
  let bestDist = Infinity;
  for (const p of WAVE_PATTERNS) {
    const dist = Math.min(Math.abs(dv - p.minDiff), Math.abs(dv - p.maxDiff));
    if (dist < bestDist) { bestDist = dist; best = p; }
  }
  return [best];
}
