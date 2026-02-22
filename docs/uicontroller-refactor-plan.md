# UIController.js 모듈 분리 계획

> 작성일: 2026-02-22
> 대상 파일: `src/js/ui/UIController.js` (2233줄)
> 목표: 각 500줄 내외의 단일 책임 모듈로 분리

---

## 1. 현재 구조 분석

### 전체 현황
- **총 줄수**: 2233줄
- **메서드 수**: 40개 이상
- **문제점**: 단일 클래스가 하단 시트, 타워 상세, 업그레이드 트리, 경제 표시, 속도 컨트롤, 보상 버튼 등 완전히 다른 관심사를 모두 처리

### 메서드 분류표

| 책임 영역 | 메서드 | 줄 범위 | 줄 수 |
|---|---|---|---|
| **Core / Sheet** | constructor, init, setupBottomSheet, setupDrag, openSheet, closeSheet, selectTowerSlot, setOnSheetOpen/Close, setGameLoop, setUISfxSystem, _playUISfx, _triggerSave | 1–443 | ~440 |
| **공통 유틸** | createInkSplash(event), getRandomColor, updateResource | 319–358 | ~40 |
| **타워 상세 패널** | updateTowerInfo, _updateTowerGrowthInfo, _updateTowerActionButtons, _showTowerDetail, _showTowerImprints | 367–629 | ~263 |
| **타워 설치 패널** | _showTowerBuild, _handleSellTower, _setupTowerBuildButtons | 1423–1512 | ~90 |
| **업그레이드 트리** | _showUpgradeTree (헤더+리셋버튼+SVG+노드 배치) | 634–1023 | ~390 |
| **드래그 스크롤** | _setupDragScroll, _applyInertiaScroll | 1028–1118 | ~91 |
| **노드 레이아웃** | _calculateNodePositions | 1128–1160 | ~33 |
| **노드 카드** | _createUpgradeNodeCard, _createInkSplash(element) | 1165–1418 | ~254 |
| **경제 표시** | updateNutritionDisplay, _animateNumberChange, updateAPDisplay, updateTroubleDisplay | 1517–1637 | ~121 |
| **속도 컨트롤** | setupSpeedControls, updateSpeedButtonDisplay, showBoostError, updateBoostDisplay, updateSpeedButtonsForBoost, updateSpeedButtonAffordability | 1642–1849 | ~208 |
| **보상 버튼** | setupHourlyClaimButton, setupSixHourClaimButton, updateHourlyClaimDisplay, updateSixHourClaimDisplay | 1927–2028 | ~102 |
| **공통 UI 유틸** | _showToast, _showConfirmDialog, formatPrerequisites | 1856–2108 | ~253 |
| **각인 계산** | _getImprintCostMultiplier (중복!), _getEnhancedEffectText | 2116–2232 | ~117 |

> ⚠️ `_getImprintCostMultiplier`가 2116, 2130줄에 **중복 정의**되어 있음 — 분리 시 제거 필요

---

## 2. 모듈 분리 설계

### 아키텍처 원칙
- 각 모듈은 `UIController` 인스턴스(또는 필요한 의존성)를 생성자에서 받음
- `UIController.js`는 **얇은 오케스트레이터**로 남아 각 모듈을 초기화·위임
- 모듈 간 직접 참조 없음 — 항상 UIController를 통해 통신

```
UIController (오케스트레이터)
  ├── BottomSheetController  (시트 열기/닫기/드래그)
  ├── TowerDetailPanel       (타워 상세 + 설치 UI)
  ├── UpgradeTreeUI          (업그레이드 트리 렌더링)
  ├── UpgradeNodeCard        (노드 카드 생성 + 각인 계산)
  ├── SpeedControlUI         (속도 버튼 + 부스트 표시)
  ├── ResourceDisplayUI      (NC/SC 경제 표시 + 보상 버튼)
  └── UIUtils                (토스트, 확인 다이얼로그, 유틸)
```

---

## 3. 모듈별 상세 계획

### 3-1) `UIController.js` (리팩토링 후 Core Shell)
**예상 줄수: ~280줄**

**남기는 것:**
- `constructor` — 상태 변수 선언 + 각 모듈 인스턴스 참조
- `init()` — DOM 조회 + 각 모듈 초기화 호출
- `openSheet()`, `closeSheet()`, `selectTowerSlot()` — 시트 상태 관리 + 모듈 위임
- `setGameLoop()`, `setUISfxSystem()`, `setOnSheetOpen/Close()`
- `_playUISfx()`, `_triggerSave()` — 내부 공통 헬퍼

**위임하는 것:**
- 하단 시트 드래그 → `BottomSheetController`
- 타워 패널 렌더링 → `TowerDetailPanel`
- 업그레이드 트리 → `UpgradeTreeUI`
- 속도 컨트롤 → `SpeedControlUI`
- 경제/보상 표시 → `ResourceDisplayUI`

---

### 3-2) `BottomSheetController.js`
**예상 줄수: ~120줄**
**경로:** `src/js/ui/BottomSheetController.js`

**담당 메서드:**
- `setupBottomSheet()` — 핸들 클릭, 닫기 버튼, 판매 버튼 이벤트
- `setupDrag()` — mousedown/touchstart 드래그 감지

**의존성:**
```js
constructor(uiController)
// uiController.openSheet(), closeSheet(), _handleSellTower() 호출
```

---

### 3-3) `TowerDetailPanel.js`
**예상 줄수: ~420줄**
**경로:** `src/js/ui/TowerDetailPanel.js`

**담당 메서드:**
- `showDetail(tower)` ← `_showTowerDetail()`
- `showBuild()` ← `_showTowerBuild()`
- `updateTowerInfo(towerData)`
- `_updateTowerGrowthInfo(tower)`
- `_updateTowerActionButtons(tower)`
- `_showTowerImprints(tower)`
- `_setupTowerBuildButtons()`
- `_handleSellTower()`

**의존성:**
```js
constructor(uiController)
// uiController.gameLoop, closeSheet(), updateNutritionDisplay(), _showToast(), _triggerSave() 접근
```

---

### 3-4) `UpgradeTreeUI.js`
**예상 줄수: ~480줄**
**경로:** `src/js/ui/UpgradeTreeUI.js`

**담당 메서드:**
- `show(tower)` ← `_showUpgradeTree()` (트리 컨테이너 + 헤더 + SVG + 노드 배치)
- `_buildTreeHeader(tree, tower, economySystem)` — 포인트/승급 버튼 + 리셋 버튼 (현재 인라인 ~200줄을 메서드로 추출)
- `_drawConnections(svg, tree, nodePositions, sizes)` — SVG 연결선 (~80줄)
- `_calculateNodePositions(nodes)` — 3행 레이아웃 매핑
- `_setupDragScroll(container)` — DragManager 등록
- `_applyInertiaScroll(container, velocity)` — 관성 스크롤
- `formatPrerequisites(prerequisites)` — 선행 조건 텍스트

**의존성:**
```js
constructor(uiController, nodeCardFactory)
// nodeCardFactory = UpgradeNodeCard 인스턴스
// uiController.gameLoop, starUpgradeManager, _showToast(), _triggerSave() 등
```

---

### 3-5) `UpgradeNodeCard.js`
**예상 줄수: ~310줄**
**경로:** `src/js/ui/UpgradeNodeCard.js`

**담당 메서드:**
- `create(node, tree, tower, economySystem)` ← `_createUpgradeNodeCard()`
- `_createInkSplash(element, color)` — 노드 전용 스플래시
- `_getImprintCostMultiplier(imprintCount)` — 각인 비용 배율 (중복 제거)
- `_getEnhancedEffectText(node, imprintCount)` — 각인 보너스 텍스트

**의존성:**
```js
constructor(uiController)
// uiController._showToast(), _playUISfx(), updateNutritionDisplay(), _triggerSave()
// 콜백: onNodeActivated(tower) → UpgradeTreeUI가 refresh
```

---

### 3-6) `SpeedControlUI.js`
**예상 줄수: ~220줄**
**경로:** `src/js/ui/SpeedControlUI.js`

**담당 메서드:**
- `setup()` ← `setupSpeedControls()`
- `updateDisplay(speed)` ← `updateSpeedButtonDisplay()`
- `showBoostError(reason)` ← `showBoostError()`
- `updateBoostDisplay()` ← `updateBoostDisplay()`
- `updateButtonsForBoost(activeSpeed)` ← `updateSpeedButtonsForBoost()`
- `updateButtonAffordability()` ← `updateSpeedButtonAffordability()`

**의존성:**
```js
constructor(uiController)
// uiController.gameLoop, isExpanded, _playUISfx(), updateNutritionDisplay()
```

---

### 3-7) `ResourceDisplayUI.js`
**예상 줄수: ~280줄**
**경로:** `src/js/ui/ResourceDisplayUI.js`

**담당 메서드 (경제 표시):**
- `updateNutrition(economyState)` ← `updateNutritionDisplay()`
- `_animateNumberChange(element, from, to)`
- `updateAPDisplay(current, max)` (deprecated stub 유지)
- `updateTroubleDisplay()` (deprecated stub 유지)

**담당 메서드 (보상 버튼):**
- `setupHourlyClaimButton()`
- `setupSixHourClaimButton()`
- `updateHourlyClaimDisplay()`
- `updateSixHourClaimDisplay()`

**의존성:**
```js
constructor(uiController)
// uiController.gameLoop, _playUISfx(), _showToast()
```

---

### 3-8) `UIUtils.js`
**예상 줄수: ~160줄**
**경로:** `src/js/ui/UIUtils.js`

**담당 (독립 함수 or 싱글턴 클래스):**
- `showToast(message, type, sfxFn)` — DOM 토스트 생성/애니메이션
- `showConfirmDialog({ title, message, onConfirm, onCancel }, sfxFn)` — 확인 다이얼로그
- `createInkSplash(event, color)` — 이벤트 기반 스플래시 (기존 public 메서드)
- `getRandomColor()` — Splatoon 랜덤 색상
- `updateResource(type, value)` — 레거시 리소스 텍스트 업데이트

> `sfxFn` 파라미터로 SFX 의존성 주입 → UIController와 결합 없음

---

## 4. 줄수 요약

| 모듈 파일 | 예상 줄수 |
|---|---|
| `UIController.js` (코어) | ~280 |
| `BottomSheetController.js` | ~120 |
| `TowerDetailPanel.js` | ~420 |
| `UpgradeTreeUI.js` | ~480 |
| `UpgradeNodeCard.js` | ~310 |
| `SpeedControlUI.js` | ~220 |
| `ResourceDisplayUI.js` | ~280 |
| `UIUtils.js` | ~160 |
| **합계** | **~2270** |

---

## 5. 마이그레이션 순서 (단계별)

각 단계는 독립적으로 동작 확인 가능하도록 설계.

### Step 1 — UIUtils.js 추출 (위험도: 낮음)
- 순수 함수 / DOM 유틸 이므로 의존성 없음
- `_showToast`, `_showConfirmDialog`, `createInkSplash`, `getRandomColor`, `updateResource` 이동
- UIController에서 import하여 인스턴스 메서드 유지 (래퍼 형태)

### Step 2 — SpeedControlUI.js 추출 (위험도: 낮음)
- 독립성 높음, gameLoop 참조만 있음
- UIController.setupSpeedControls() → `this.speedControlUI.setup()` 위임

### Step 3 — ResourceDisplayUI.js 추출 (위험도: 낮음)
- updateNutritionDisplay, 보상 버튼 이동
- UIController에서 `this.resourceDisplayUI.updateNutrition()` 위임

### Step 4 — UpgradeNodeCard.js 추출 (위험도: 중간)
- _createUpgradeNodeCard + 각인 관련 메서드
- `_getImprintCostMultiplier` 중복 제거 (2개 → 1개)
- UpgradeTreeUI가 의존하므로 먼저 추출

### Step 5 — UpgradeTreeUI.js 추출 (위험도: 중간)
- `_showUpgradeTree()` 내부 인라인 코드를 `_buildTreeHeader()`, `_drawConnections()`로 먼저 리팩토링
- BottomSheetController.js 추출 이전에 완료

### Step 6 — TowerDetailPanel.js 추출 (위험도: 중간)
- `_showTowerDetail`, `_showTowerBuild` 등 이동
- StarUpgradeManager 연동 유지 확인

### Step 7 — BottomSheetController.js 추출 (위험도: 낮음)
- setupBottomSheet, setupDrag 이동
- UIController.init()에서 `this.bottomSheetController.setup()` 호출

### Step 8 — UIController.js 정리 (위험도: 낮음)
- 위임 메서드 래퍼 정리
- 불필요한 import 제거

---

## 6. 주요 주의사항

| 항목 | 내용 |
|---|---|
| `_getImprintCostMultiplier` 중복 | 2116, 2130줄 두 곳에 동일 함수 → `UpgradeNodeCard.js`로 1개만 이동 |
| `self = this` 패턴 | `_createUpgradeNodeCard` 내부에서 사용 중 → 클래스 메서드화 시 제거 |
| `starUpgradeManager` 참조 | `openSheet()`, `closeSheet()`, `_showTowerDetail()` 3곳에서 접근 — UIController에 유지 |
| `dragManager` | `_setupDragScroll`에서 사용 — UpgradeTreeUI 생성자에서 주입 |
| 인라인 style 코드 | `_showUpgradeTree()`와 `_createUpgradeNodeCard()`에 대량 존재 — 분리 후 CSS 클래스화 고려 |

---

## 7. 완료 기준

- [ ] 각 모듈 파일 500줄 이하
- [ ] `UIController.js` 300줄 이하
- [ ] 기존 public API (`selectTowerSlot`, `openSheet`, `closeSheet`, `updateNutritionDisplay`, `updateBoostDisplay`, `updateHourlyClaimDisplay`, `updateSixHourClaimDisplay`) 시그니처 유지
- [ ] 게임 동작 동일 (타워 선택, 업그레이드, 판매, 속도 조절, 보상 수령 모두 정상)
