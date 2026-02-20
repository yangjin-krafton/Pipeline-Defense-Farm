# 음식 Enemy 소환 설계 (7-11 난이도 시뮬레이션 연동판)

## 1) 문서 기준

- 본 문서는 `docs/tower-attack-fun-types-2026.md`의 `7-11) 전체 맵 기준 난이도 요구 수치 시뮬레이션`을 단일 기준으로 사용한다.
- 소환 설계는 먼저 `요구 난이도 수치`를 맞추고, 그 다음에 이모지/태그/랜덤 규칙을 적용한다.

## 2) 목표 상태

- 게임 시작(S0)부터 12성 풀세팅(S5)까지 난이도가 계단형으로 상승해야 한다.
- 유저가 체감하는 강함은 수치뿐 아니라 `이모지 종류 변화`로도 명확히 보여야 한다.
- `1 이모지 = 1 대표 Enemy 강도` 원칙을 유지한다.

## 3) 난이도 요구 테이블 (7-11 반영)

| 단계 | 유저 상태 요약 | 목표 threat | 목표 digestionNeed | HP/Armor 배율(현행 대비) | elite 비율 |
|---|---|---:|---:|---|---:|
| S0 | 입문 (2~3타워, 1성) | 8~10 | 75~90 | x1.00 / x1.00 | 0~2% |
| S1 | 초반 안정 (5~6타워, 2~3성) | 10~12 | 90~105 | x1.08 / x1.05 | 3~6% |
| S2 | 중반 전개 (8~10타워, 4~6성) | 12~14 | 105~122 | x1.20 / x1.12 | 8~12% |
| S3 | 후반 진입 (12~14타워, 7~9성) | 14~16 | 122~140 | x1.35 / x1.20 | 14~20% |
| S4 | 최종 직전 (15~17타워, 10~11성) | 16~18 | 140~160 | x1.52 / x1.28 | 22~30% |
| S5 | 최종 (18타워, 12성) | 18~21 | 160~190 | x1.70 / x1.38 | 32~40% |

경로별 elite 하한 (S4~S5):
- `rice_stomach`: 30%+
- `dessert_stomach`: 25%+
- `alcohol_stomach`: 28%+

## 4) 강도 티어와 이모지 풀 재설계

티어 역할:
- `normal`: 속도형/가벼운 압박
- `strong`: 기본 전투 중심
- `elite`: 고밀도/고위협 압박

원칙:
- 같은 이모지를 다른 티어에 중복 배치하지 않는다.
- 현실 재질/속성 분류(`carb`, `fat`, `protein`, `dairy`, `sugar`, `alcohol`, `acidic`, `fermented`)를 우선한다.

### 4-1) 경로별 대표 이모지 풀 (예시)

| 경로 | normal | strong | elite |
|---|---|---|---|
| `rice_stomach` | 🍘 🍙 🍚 🥠 | 🍜 🍝 🥪 🍤 🥟 | 🍔 🍕 🌯 🥩 🍖 🥘 |
| `dessert_stomach` | 🍬 🍭 🍧 🍮 | 🍰 🍩 🧁 🍫 🧋 | 🎂 🥮 🥧 🧇 🥞 🍯 |
| `alcohol_stomach` | 🧃 🍋 ☕ 🍸 | 🍺 🍷 🍹 🍶 🧉 | 🥃 🍾 🍻 🥂 |

## 5) 단계별 티어 비율 테이블

| 단계 | normal | strong | elite |
|---|---:|---:|---:|
| S0 | 88 | 12 | 0 |
| S1 | 72 | 25 | 3 |
| S2 | 55 | 35 | 10 |
| S3 | 40 | 42 | 18 |
| S4 | 28 | 45 | 27 |
| S5 | 20 | 42 | 38 |

보정 규칙:
- 경로 elite 하한이 있으면 `elite`를 하한까지 먼저 채우고, 남은 비율을 normal/strong에 비례 재분배.

## 6) 소환 알고리즘 (최종)

1. 현재 유저 전력으로 단계 `S0~S5` 결정
2. 단계 기본 티어 비율 로드
3. 경로별 elite 하한/테마 보정 적용
4. 해당 경로 + 티어의 이모지 풀에서 후보 추출
5. 최근 이모지 큐(중복 방지) 필터
6. 가중치 랜덤으로 1개 선택
7. 선택한 Enemy에 단계 배율(HP/Armor/digestionNeed) 적용

의사코드:

```js
const stage = resolveStage(playerPower); // S0..S5
const ratio = applyPathRules(stageTierRatio[stage], pathKey);
const tier = weightedPick(ratio);

const pool = emojiPools[pathKey][tier]
  .filter((id) => !recentEmojiQueue.includes(id));

const enemy = weightedPick(pool);
const scaled = applyStageMultiplier(enemy, stage); // hp/armor/digestionNeed
spawn(pathKey, scaled);
```

### 6-A) 이모지 혼합 비율로 난이도 조립 (권장)

개념:
- 난이도 레벨을 올릴 때 이모지를 통째로 교체하지 않고, `low/high` 대표 이모지 비율을 섞어서 전환
- 유저가 난이도 상승을 시각적으로 자연스럽게 체감

기본 규칙(레벨 1~10):
- `lowEmoji`: 낮은 강도 대표 (예: `🍘`)
- `highEmoji`: 높은 강도 대표 (예: `🍙`)
- `pHigh = (L - 1) / 9`
- 웨이브 스폰 수가 `N`일 때:
  - `highCount = round(N * pHigh)`
  - `lowCount = N - highCount`

예시(`N=5`):
- `Lv1` -> `🍘🍘🍘🍘🍘`
- `Lv5` -> `🍘🍘🍙🍘🍙`
- `Lv8` -> `🍙🍘🍙🍙🍙`
- `Lv10` -> `🍙🍙🍙🍙🍙`

적용 확장:
- `low/high` 2점만 쓰지 않고, `normal/strong/elite` 3단 비율에도 동일 방식 적용 가능
- 각 경로(`rice/dessert/alcohol`)별로 대표 이모지 쌍(또는 3쌍)을 따로 운영

안전장치:
- 동일 이모지 3연속 금지
- 난이도 레벨 변경 시 웨이브당 `highCount` 변동폭 최대 `±1`
- 최근 큐(`recentEmojiQueue`)와 함께 사용해 반복 체감 최소화

## 7) 유저 성능 연동(상승/하락)

- 성능 지표: `killRate`, `leakRate`, `timeToKill`
- 20초마다 보정 단계 `D(-2..+2)` 갱신
  - 빨리 처치 + 유출 낮음: `D` 상승
  - 처치 밀림 + 유출 높음: `D` 하락
- 최종 단계: `clamp(S + D, S0, S5)`

안전장치:
- 60초 이전에는 `D`를 `-1..+1`로 제한
- 한 번에 1단계 이상 점프 금지

## 8) 구현 포인트

대상 파일:
- `src/js/game/FoodSpawner.js`
- `src/js/config.js`

필요 데이터:
- `stageTierRatio` (S0~S5 비율)
- `emojiPools[pathKey][tier]`
- `pathEliteFloor`
- `stageMultipliers` (HP/Armor/digestionNeed)
- `recentEmojiQueue`

## 9) 검증 KPI

- 단계별 평균 `threat`가 목표 범위에 들어오는가
- S5에서 `digestionNeed` 평균이 160~190에 근접하는가
- S5에서 경로별 elite 하한이 유지되는가
- 3분 단위 이모지 중복률이 25% 이하인가
- 성능 악화 시 40~60초 내 단계 하향이 발생하는가
