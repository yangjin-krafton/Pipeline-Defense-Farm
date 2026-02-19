# Pipeline Defense Farm - 소화기관 운영형 방치 디펜스 개발 기획서

## 1. 문서 목적

본 문서는 `Pipeline Defense Farm`의 핵심 정체성을 "타워디펜스"보다 "소화기관 운영"에 두고,
소화 테마에 맞는 전투, 성장, 경제, 아키텍처를 개발 기준으로 정리한다.

핵심 목표:

- 음식 처리 전투를 소화 시뮬레이션 감성으로 구현
- 방치 + 수동 개입(영양 보급) 루프를 자연스럽게 결합
- 타워 성장과 경제를 인체 대사/연구 테마로 일관화

## 2. 게임 정체성

한 줄 정의:

- 음식 웨이브를 "파괴"하는 게임이 아니라, 기관별 규칙에 맞게 "소화"해 병목과 트러블을 관리하는 게임

플레이 감정:

- "막았다"보다 "소화가 안정됐다"는 성취감
- "강한 타워"보다 "기관에 맞는 처방"을 찾는 운영 재미
- 장기적으로는 내 소화기관 문명을 키워가는 발전 재미

## 3. 세계관 기반 코어 루프

### 3.1 접속 중 루프

1. 음식이 3개 위 라인(`rice_stomach` / `dessert_stomach` / `alcohol_stomach`) 중 하나로 유입되어 기관을 따라 이동
2. 소화 장치(타워)가 자동으로 분해/중화/유화/흡수 보조 수행
3. 플레이어가 영양 보급으로 특정 장치 효율을 순간 증폭
4. 정체/가스/염증/과산 등 트러블 지표를 관리
5. 웨이브 종료 후 대사 자원 획득, 연구/강화 진행

### 3.2 방치 루프

1. 오프라인 시간 동안 저속 소화가 계속 진행
2. 복귀 시 처리량/잔류물/트러블 상태를 정산
3. 정산 결과를 바탕으로 기관 튜닝과 다음 처방 선택

## 4. 기관별 전장 규칙 (현재 맵 기준)

`src/js/config.js`의 경로 정의를 기준으로, 현재 전장은 다음 5개 구간으로 구성된다.

- `rice_stomach`(밥 위): 기본 유입량이 많은 주력 라인. 범용 소화 장치의 효율 검증 구간
- `dessert_stomach`(디저트 위): 당류/유제품 계열이 빠르게 누적되어 순간 병목이 잦은 구간
- `alcohol_stomach`(술 위): 산도/자극성 변동이 커서 트러블 관리 장치의 가치가 높은 구간
- `small_intestine`(소장): 장거리 처리 + 흡수 최적화 핵심 구간
- `large_intestine`(대장): 잔류물/발효 리스크를 안정화하는 종단 구간

전략 원칙:

- 같은 장치라도 설치 구간에 따라 가치가 달라진다.
- 웨이브 강도보다 "현재 기관 상태"가 더 중요한 의사결정 기준이 된다.

## 5. 음식(Enemy) 설계

음식은 HP 덩어리가 아니라 "소화 속성 패키지"다.

주요 속성:

- `digestLoad`: 소화 부담도
- `fat/carb/protein/fiber`: 성분 비율
- `acidity`: 산도 반응성
- `fermentRisk`: 발효/가스 위험도
- `residue`: 처리 실패 시 잔류량

예시 계열:

- 지방식: 느리고 단단하며 유화 보조 필요
- 당류식: 빠르게 몰려 병목 유발
- 단백질식: 위 구간 처리 효율 영향 큼
- 복합 보스식: 다중 속성 + 저항 + 트러블 증폭

### 5.1 현재 `config.js` 음식 테이블 진단 (2026-02-19)

`src/js/config.js` 기준으로 현재 분포는 아래와 같다.

- `rice_stomach`: 27종 (평균 hp 144.0, speed 96.9, digestionNeed 106.1)
- `dessert_stomach`: 23종 (평균 hp 118.3, speed 107.3, digestionNeed 88.0)
- `alcohol_stomach`: 14종 (평균 hp 114.6, speed 108.1, digestionNeed 86.9)
- `small_intestine`, `large_intestine`: 0종 (현재 스폰 대상 아님)

현재 상태 판단:

- 라인 난이도 구분(밥 위 = 무겁고 느림 / 디저트·술 위 = 가볍고 빠름)은 의도대로 잘 잡혀 있음
- `threat` 대비 `reward` 비율은 크게 깨진 이상치가 없어 기본 경제 밸런스는 안정적
- 런타임 위험은 없음 (`FoodSpawner`가 3개 위 라인만 스폰)

조정 권장(우선순위):

1. `alcohol_stomach` 음식 수 확충
- 현재 14종으로 반복 체감이 빠름
- 목표: 20종 내외로 확장

2. `category` 체계 정규화
- 현재 `alcohol/sugar/fat/carb/protein/mixed/dairy/fermented/caffeine/acidic`가 혼재
- 향후 타워 상성 계산은 `category` 단일값보다 `tags` 중심으로 처리하고, `category`는 상위 분류로 축소 권장

3. 소장/대장 전용 음식 정책 결정
- 지금은 빈 배열이 정상 동작하지만, 향후 해당 구간 자체 스폰이 필요하면 전용 테이블 추가 필요
- 스폰을 유지하지 않을 계획이면 문서에 \"위 3라인 스폰 고정\"을 명시

즉시 수치 조정 필요 여부:

- 필수(긴급) 조정은 없음
- 콘텐츠 반복도와 향후 상성 시스템 확장을 고려하면 위 3개 항목은 다음 밸런스 스프린트에서 반영 권장

## 6. 소화 장치(타워) 체계

### 6.1 기본 장치군

1. `Enzyme Dispenser`: 성분 분해 특화
2. `Acid Sprayer`: 산성 처리 + 방어 약화
3. `Bile Jet`: 지방 유화 + 광역 약화
4. `Probiotic Cloud`: 장내 환경 안정 + 버프
5. `Peristalsis Pulse`: 밀어내기/정체 해소
6. `Absorption Filter`: 처리 수익 보정 + 자원 효율

### 6.2 확장 장치군(후반)

- 점액 보호막 장치(Mucus Shield): 기관 손상 완화
- 효소 연쇄 반응기(Chain Reactor): 처치 연쇄 처리
- 장내균 배양기(Microbiome Lab): 장기 버프 스택
- 해독 분해기(Detox Unit): 특정 트러블 즉시 안정화

## 7. 영양 보급 시스템(수동 개입 핵심)

보급 철학:

- 자동 전투는 기본 성능을 보장
- 수동 보급은 결정적 구간에서 효율을 폭발시킴
- 과도한 클릭 피로는 상한/회복/자동화로 제어

효율 상태:

- `STARVED`: 0.5x (저속 소화)
- `NORMAL`: 1.0x
- `BOOSTED`: 2.0x
- `OVERCHARGED`: 3.0x (짧은 지속)

MVP 수치:

- `nutritionCapPerTower = 100`
- `supplyPerAction = 25`
- `globalSupplyAPCap = 5`
- `globalSupplyAPRegenSec = 30`
- `boostDurationSec = 20`
- `overchargeDurationSec = 6`
- 동일 장치 연속 보급 시 효율 점감 `-15%`

핵심 체감:

- 방치만 하면 안정적이나 느리다.
- 직접 보급하면 위기 구간을 역전할 수 있다.

## 8. 성장 체계: 소화기관 문명 트리

목표:

- 장치 레벨업을 넘어, 기관 철학 자체를 발전시키는 감각 제공

구조:

- 타워별 `Era 1~5` 트리
- 각 Era 2~3개 선택 노드
- `requires`(선행), `excludes`(배타) 지원
- 해금 조건: 웨이브 + 연구 자원 + 기관 안정도

Enzyme 예시:

- Era 1 기초 분해학: 반응속도 vs 안정성
- Era 2 성분 특화학: 탄수 대사 vs 단백 대사
- Era 3 반응공학: 연쇄 분해 vs 효율 보존
- Era 4 자율조절학: 자동 보급 보정 vs 스마트 타겟팅
- Era 5 초월대사학: 폭발적 처리 vs 저효율 바닥 보정

## 9. 경제 시스템(대사 기반)

경제 원칙:

- 통화마다 역할을 분리하고, 소화 테마와 연결한다.
- 수동 개입은 분당 효율을 올리고, 방치는 장기 누적을 보장한다.

### 9.1 구간별 소화 완료 보상 배율

음식이 어느 구간에서 최종 소화(처치)되었는지에 따라 영양 재화 보상을 다르게 적용한다.

- `위 3라인`(`rice_stomach`, `dessert_stomach`, `alcohol_stomach`)에서 소화 완료: 낮은 보상
- `small_intestine`에서 소화 완료: 최고 보상
- `large_intestine`에서 소화 완료: 기준(정상) 보상

권장 기본 배율:

- 위 3라인: `0.7x`
- 소장: `1.3x`
- 대장: `1.0x`

계산식:

- `finalNutritionReward = baseReward * zoneRewardMultiplier[pathKey]`

기획 의도:

- 초반 위 구간에서 빠르게 처리하면 안전하지만 수익은 낮다.
- 소장까지 끌고 가서 처리하면 리스크가 있지만 수익이 크다.
- 대장은 리스크/수익 균형 구간으로 작동한다.

구현 메모:

- 처치 시점의 `currentPathKey`를 기준으로 배율 적용
- 라운드 통계에 `zoneKillCount`/`zoneReward`를 분리 기록해 밸런스 조정 근거로 사용
- 과도한 파밍 방지를 위해 소장 고수익은 웨이브 난이도 계수와 함께 검증

재화 구성:

1. `Nutrition`:
- 용도: 장치 설치/일반 업그레이드
- 출처: 웨이브 처리량

2. `Enzyme Point`:
- 용도: 타워 개별 강화
- 출처: 성분 특화 처리 보너스

3. `Microbiome`:
- 용도: 기관 안정/보조 시스템 해금
- 출처: 대장 안정 유지, 트러블 억제 보상

4. `Research Cell`:
- 용도: Era 트리 연구
- 출처: 보스/도전 목표

5. `Genome`(프레스티지):
- 용도: 영구 메타 강화
- 출처: 시즌 리셋 또는 누적 진행 리셋 환산

오프라인 정산:

- `OfflineDigest = BaseDigest * OfflineRate * OfflineHours`
- `OfflineRate` 초기 0.25, 메타 성장으로 0.65 상한
- 잔류물 과다 시 보상 일부 감쇠(방치 페널티)

## 10. UX/UI 방향

필수 표시:

- 기관 상태 패널: 산도, 정체도, 염증도, 발효도
- 타워 카드: 현재 효율 배수(`0.5x ~ 3.0x`), 영양 탱크, 보급 버튼
- 전역 보급 AP 게이지 + 회복 타이머
- 웨이브 리포트: "처리량/잔류량/주요 트러블" 요약

복귀 UX:

- 오프라인 정산 카드(잘된 점/문제 구간)
- "오늘 뭐 드셨어요" 체크인과 연계된 특수 웨이브

## 11. 코드 아키텍처(테마 반영)

```text
src/js/
  digestion/
    core/
      BaseTower.js
      DigestStateMachine.js
      TargetingPolicy.js
    towers/
      EnzymeTower.js
      AcidTower.js
      BileTower.js
      ProbioticTower.js
      PeristalsisTower.js
      AbsorptionTower.js
    data/
      towerDefinitions.js
      digestionRules.js
      techTreeDefinitions.js
      economyDefinitions.js
    systems/
      TowerManager.js
      SupplySystem.js
      TroubleSystem.js
      EconomySystem.js
```

원칙:

- 공통 처리 규칙은 코어 시스템에 집중
- 타워별 개성은 오버라이드 + 데이터 정의로 분리
- 수치 밸런스는 코드가 아닌 정의 파일에서 조정

## 12. 개발 단계(로드맵)

### Phase 1: 테마 일치 MVP

- Enzyme/Acid/Bile 전투 완성
- 영양 보급 상태 머신 적용
- 기관 트러블(정체/과산) 2종 구현

### Phase 2: 성장/경제 확장

- Era 트리 1차(타워당 Era 3까지)
- Nutrition/Microbiome/Research Cell 경제 연결
- 오프라인 정산 로직 적용

### Phase 3: 메타 루프

- Genome 프레스티지
- 자동 보급/기관 자동화 연구
- 체크인 웨이브 정식 도입

### Phase 4: 라이브 운영

- 텔레메트리 기반 밸런스
- 신규 음식 계열/장치군 확장
- 시즌 테마 이벤트 운영

## 13. 리스크와 대응

1. 일반 TD처럼 느껴지는 문제
- 대응: 기관 상태/트러블 지표를 승패 핵심으로 강화

2. 클릭 피로도 과다
- 대응: AP 상한 + 자동화 연구 + 추천 보급 UX

3. 경제 폭주
- 대응: 잔류물 페널티, 통화 역할 고정, 프레스티지 완화 곡선

4. 빌드 고착
- 대응: 배타 노드, 음식 조합 기반 카운터 설계

## 14. 성공 지표

- 세션당 평균 보급 횟수
- 기관 트러블 관리 성공률
- 오프라인 복귀 후 10분 내 재도전율
- 타워/트리 선택 다양성(편중률)
- D1/D7 유지율

## 15. 참고 축

- 방치형: Cookie Clicker, Trimps (프레스티지 루프)
- 타워 운용: Legion TD 2, Infinitode 2 (자동 전투 + 수동 선택)
- 성장 철학: Civilization류 테크 트리 (선행/분기/배타)

본 프로젝트는 위 장르 요소를 차용하되, 핵심 경험은 "소화기관을 운영하는 전략 게임"으로 고정한다.
