# 음식 Enemy 소환 설계 (표 기반 리뉴얼)

## 1) 설계 기준 요약

| 항목 | 기준 |
|---|---|
| 기준 문서 | `docs/tower-attack-fun-types-2026.md`의 `7-11) 전체 맵 기준 난이도 요구 수치 시뮬레이션` |
| 난이도 축 | `S0 ~ S5` (입문 -> 7성 풀세팅) |
| 강도 표현 | `1 emoji = 1 대표 강도` |
| 소환 축 | `single(1개)` / `triple(3개 동시)` / `auto` |
| 난이도 제어 | 단계 비율 + 성능 보정 `D(-2..+2)` + 완주시간 기반 간격 |

## 2) emoji 자체 강도 표 (경로/티어)

| 경로 | 티어 | 대표 emoji | 강도 범위(threat) | 소화부하 범위(digestionNeed) | 속도 성격 |
|---|---|---|---:|---:|---|
| `rice_stomach` | normal | 🍘 🍙 🍚 🥠 | 8~10 | 75~90 | 빠름(초반 압박) |
| `rice_stomach` | strong | 🍜 🍝 🥪 🍤 🥟 | 11~14 | 95~117 | 표준 |
| `rice_stomach` | elite | 🍔 🍕 🌯 🥩 🍖 🥘 | 15~18 | 120~132 | 느리지만 고체력 |
| `dessert_stomach` | normal | 🍬 🍭 🍧 🍮 | 7~9 | 66~79 | 매우 빠름 |
| `dessert_stomach` | strong | 🍰 🍩 🧁 🍫 🧋 | 9~12 | 82~94 | 표준 |
| `dessert_stomach` | elite | 🎂 🥮 🥧 🧇 🥞 🍯 | 12~13 | 95~110 | 중속/고밀도 |
| `alcohol_stomach` | normal | 🧃 🍋 ☕ 🍸 | 7~10 | 67~83 | 빠름 |
| `alcohol_stomach` | strong | 🍺 🍷 🍹 🍶 🧉 | 10~12 | 80~95 | 표준 |
| `alcohol_stomach` | elite | 🥃 🍾 🍻 🥂 | 13~15 | 98~111 | 중속/고위협 |

## 3) 난이도별 배치 스폰 조합 표

| 단계 | 유저 상태 | 티어 비율(normal/strong/elite) | 기본 배치 모드 | triple 비중(가이드) | 배치 크기 |
|---|---|---|---|---:|---:|
| S0 | 입문 | 88 / 12 / 0 | single 고정 | 0% | 1 |
| S1 | 초반 안정 | 72 / 25 / 3 | single 우선 | 0% | 1 |
| S2 | 중반 전개 | 55 / 35 / 10 | auto | 20% | 1 또는 3 |
| S3 | 후반 진입 | 40 / 42 / 18 | auto | 35% | 1 또는 3 |
| S4 | 최종 직전 | 28 / 45 / 27 | auto | 50% | 1 또는 3 |
| S5 | 최종 | 20 / 42 / 38 | auto/triple 우선 | 60% | 1 또는 3 |

보정 규칙:
- S4~S5는 경로별 elite 하한 적용: `rice 30%+`, `dessert 25%+`, `alcohol 28%+`
- 유저 성능이 좋으면(`D>0`) triple 비중 증가, 밀리면(`D<0`) single 비중 증가

## 4) 위 3개 동시 스폰 여부 표

| 모드 | 동작 | 사용 시점 | 밸런스 의도 |
|---|---|---|---|
| `single` | 한 번에 1개만 스폰 (라운드로빈: rice -> dessert -> alcohol) | S0~S1, 또는 밀리는 구간 | 초반 과부하 방지 |
| `auto` | 단계/성능 따라 single/triple 혼합 | S2~S5 기본 | 난이도 자연 전환 |
| `triple` | 한 번에 3경로 동시 스폰 | 이벤트/후반 압축 테스트 | 고성장 유저 검증 |

## 5) 전체 path 완주시간 기반 이동/간격 표

### 5-A) 계산 기준

| 항목 | 식 |
|---|---|
| 경로 총거리 | `위 시작경로 + 소장 + 대장 + path별 exitThreshold 보정` |
| 평균 속도 | `현재 단계 후보군 평균 speed` |
| 적 1개 완주 예상시간 | `traversalTime = totalDistance / avgSpeed` |
| 배치 스폰 간격 | `spawnInterval ~= traversalTime * batchSize / targetConcurrent` |

### 5-B) 단계별 목표 동시 개체수/간격 가이드

| 단계 | targetConcurrent | 권장 완주시간(참고) | single 간격(참고) | triple 간격(참고) |
|---|---:|---:|---:|---:|
| S0 | 8 | 20~24초 | 2.5~3.0초 | 7.5~9.0초 |
| S1 | 10 | 19~23초 | 1.9~2.3초 | 5.7~6.9초 |
| S2 | 13 | 18~22초 | 1.4~1.7초 | 4.2~5.1초 |
| S3 | 16 | 17~21초 | 1.1~1.3초 | 3.2~3.9초 |
| S4 | 20 | 16~20초 | 0.8~1.0초 | 2.4~3.0초 |
| S5 | 24 | 15~19초 | 0.6~0.8초 | 1.9~2.4초 |

참고:
- 실제 게임에서는 `D(-2..+2)` 보정으로 간격이 소폭 가감됨
- 밀리는 상황이면 간격이 늘고(single 우세), 여유 있으면 간격이 줄고(triple 비중 증가)

## 6) 구현 매핑 표 (코드 연결)

| 설계 항목 | 코드 위치 |
|---|---|
| 단계/티어 비율 | `src/js/game/FoodSpawner.js` (`STAGE_TIER_RATIOS`) |
| 단계별 강도 밴드 | `src/js/game/FoodSpawner.js` (`STAGE_TARGET_BAND`) |
| 경로별 티어 emoji 풀 | `src/js/game/FoodSpawner.js` (`PATH_TIER_IDS`) |
| 동시 스폰 모드 | `src/js/game/FoodSpawner.js` (`setSpawnMode`, `_resolveBatchMode`, `_spawnBatch`) |
| 완주시간 기반 간격 | `src/js/game/FoodSpawner.js` (`_buildJourneyMetaBySpawnPath`, `_estimateTraversalTimeSec`, `_computeSpawnIntervalSec`) |
| 성능 연동 | `src/js/game/FoodSpawner.js` (`reportCombatResult`) + `src/js/game/GameLoop.js` 호출 |

## 7) 검증 표 (운영 KPI)

| KPI | 목표 |
|---|---|
| 단계별 평균 threat | 각 단계 목표 범위 내 진입 |
| 단계별 평균 digestionNeed | 각 단계 목표 범위 내 진입 |
| S5 elite 하한 | 경로별 하한 유지 (`rice/dessert/alcohol`) |
| 이모지 반복률(3분) | 25% 이하 |
| 난이도 하향 반응 | 성능 악화 후 40~60초 내 하향 |
| single 안정성 | 초반(5분) 유출률 급증 없음 |
| triple 검증력 | 후반(10분) 목표 동시 개체수 수렴 |
