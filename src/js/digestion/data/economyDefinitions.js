export const ZONE_REWARD_MULTIPLIERS = {
  rice_stomach: 0.7,
  dessert_stomach: 0.7,
  alcohol_stomach: 0.7,
  small_intestine: 1.3,
  large_intestine: 1.0
};

// ===== 신규 2종 재화 시스템 =====

// NC (Nutrition Credit) - 누적형 재화
export const NC_CONFIG = {
  initialBalance: 500,
  displayName: '영양 크레딧',
  emoji: '🍎',
  // 온라인 수급
  onlineEarnPerHour: 140,           // 시간당 140 NC
  waveCompletionBonus: 25,          // 웨이브 클리어 보너스
  dailyLoginBonus: 300              // 일일 접속 보너스
};

// SC (Supply Charge) - 회복형 재화
export const SC_CONFIG = {
  initialBalance: 40,               // 중간값으로 시작 (상한의 50%)
  maxCap: 80,                       // 상한 80
  displayName: '보급 차지',
  emoji: '⚡',
  // 수급 규칙
  passiveRegenPerHour: 20,          // 시간당 20 회복
  hourlyLoginBonus: 10,             // 60분 접속 보너스
  dailyLoginBonus: 20,              // 일일 접속 보너스
  overflowToNCRatio: 0.5            // 오버플로 50% NC 변환
};

// 재화 소비 규칙 (설치비 기준 배율)
export const COST_RATIOS = {
  // NC 소비
  towerPlacement: 1.0,              // 타워 설치 100%
  upgradeNodeActivation: 0.12,      // 노드 활성화 12%
  upgradeTreeReset: 0.35,           // 트리 리셋 35%
  towerRelocate: 0.20,              // 재배치 20%
  emergencyRelocate: 0.35,          // 긴급 재배치 35%

  // SC 소비
  upgradeTreeResetSC: 12,
  towerRelocateSC: 8,
  emergencyRelocateSC: 12,

  // 성장/부스터
  statReroll: 20,                   // 스탯 리롤
  imprintExpansion: 30,             // 각인 후보 확장
  growthBoost1h: 12,                // 성장 가속 1시간
  timeBoost30m: 8,                  // 시간 부스터 30분
  speed2x10m: 6,                    // 2배속 10분
  speed3x10m: 12                    // 3배속 10분
};

// 성급별 승급 비용 (1->12성)
export const STAR_UPGRADE_COSTS = [
  { from: 1, to: 2, nc: 1000, sc: 20 },
  { from: 2, to: 3, nc: 1400, sc: 22 },
  { from: 3, to: 4, nc: 1900, sc: 24 },
  { from: 4, to: 5, nc: 2500, sc: 26 },
  { from: 5, to: 6, nc: 3200, sc: 28 },
  { from: 6, to: 7, nc: 4000, sc: 30 },
  { from: 7, to: 8, nc: 4900, sc: 32 },
  { from: 8, to: 9, nc: 5900, sc: 34 },
  { from: 9, to: 10, nc: 7000, sc: 36 },
  { from: 10, to: 11, nc: 8200, sc: 40 },
  { from: 11, to: 12, nc: 9500, sc: 45 }
];

// ===== 레거시 설정 (호환성 유지, 향후 제거 예정) =====

export const NUTRITION_CONFIG = {
  initialBalance: 500,      // Starting currency (deprecated)
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
