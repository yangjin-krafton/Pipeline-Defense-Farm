# Devlog: 타워 업그레이드 시스템 및 드래그 스크롤 구현

**Date:** 2026-02-21

## Summary

디자인 문서 기반으로 모듈 시스템과 업그레이드 트리를 가진 3종 단일 타겟 DPS 타워 구현. Splatoon 스타일 UI 디자인 적용, 모바일용 드래그 스크롤 시스템 추가로 터치 친화적인 업그레이드 트리 완성.

---

## 🗣️ 작업 흐름

### 1. 초기 요청: 단일 화력 타워 3종 구현

사용자가 디자인 문서(`docs/tower-attack-fun-types-2026.md`)를 기반으로 실제 타워 구현 요청:

**요구사항:**
- 3종의 단일 타겟 DPS 타워 구현
- 임시로 추가했던 기존 타워 삭제 (EnzymeTower, AcidTower, BileTower)
- 모듈 기반 시스템 아키텍처
- 각 타워당 12개의 업그레이드 노드
- 5 업그레이드 포인트 시스템

**배경:**
- 기존 타워는 간단한 테스트용
- 실제 게임플레이를 위한 전문화된 타워 필요
- 재사용 가능한 모듈 시스템으로 확장성 확보

### 2. 모듈 시스템 설계 및 구현

10가지 모듈 타입을 정의하고 구현:

**모듈 타입:**
1. **TM (TargetingModule)**: 타겟 선택 우선순위
2. **PM (ProjectileModule)**: 투사체 행동 (관통, 체인, AOE)
3. **DM (DamageModule)**: 데미지 계산 (크리티컬, 연속 공격 보너스)
4. **TB (TagBonusModule)**: 음식 태그 기반 보너스
5. **SM (StatusModule)**: 상태 이상 적용
6. **TR (TriggerModule)**: 조건부 효과 (킬 시, 체크포인트 근처 등)
7. **RM (ResourceModule)**: 킬 시 자원 획득
8. **SF (SafetyModule)**: 위험 완화 (과열 방지, 산성 감소)
9. **AM (AuraModule)**: 주변 타워 버프
10. **UM (UtilityModule)**: 기타 유틸리티

**구조:**
```javascript
// 예시: DamageModule
class DamageModule extends BaseModule {
  _applyEffect(context) {
    let { damage } = context;
    damage *= this.damageMultiplier;

    // 연속 공격 보너스
    if (tower.lastTarget === food.id) {
      tower.consecutiveHits++;
      damage *= (1 + consecutiveHits * bonus);
    }

    // 크리티컬
    if (Math.random() < critChance) {
      damage *= critMultiplier;
    }

    return { ...context, damage };
  }
}
```

### 3. 타워 3종 구현

각각 특화된 역할을 가진 타워 구현:

**타워 1: 위산 레일 주입기 (AcidRailTower)**
- 역할: 보스/엘리트 암살자
- 특징: 빠른 공격속도, 체크포인트 근처 크리티컬, 저체력 처형
- 주요 노드:
  - Node 1: 타겟팅 속도 +25%
  - Node 7: 체크포인트 근처 크리티컬 확률 +20%
  - Node 11: 보스/엘리트 15% 이하 처형 (2웨이브 쿨다운)

**타워 2: 효소 축전 캐논 (EnzymeChargeCannon)**
- 역할: 타이밍 기반 버스트 데미지
- 특징: 충전 시스템 (0-100%), 만충시 강력한 한 방
- 주요 노드:
  - Node 2: 만충 데미지 +25%
  - Node 3: 60% 충전부터 발사 가능 (75% 데미지)
  - Node 8: 킬 시 충전량 20% 환불

**타워 3: 연동 관통 볼트기 (PierceBoltTower)**
- 역할: 라인 관통
- 특징: 여러 적 관통, 유제품 특화, 킬 연계 보너스
- 주요 노드:
  - Node 2: 관통 횟수 +1
  - Node 5: 유제품 대상 관통 거리 +30%
  - Node 12: 관통 킬 카운트 → 다음 샷 데미지 최대 +30%

### 4. 타워 타입 불일치 버그 수정

구현 후 에러 발생:

**증상:**
```
UIController.js:486 Uncaught TypeError: Cannot read properties of undefined (reading 'cost')
```

**원인:**
- HTML에서 사용하는 타워 타입: `enzyme`, `acid`, `bile`
- 코드에서 정의한 타워 타입: `acidRail`, `enzymeCharge`, `pierceBolt`
- 타입 불일치로 타워 정의를 찾을 수 없음

**해결:**
- `src/index.html`의 타워 카드 `data-tower-type` 속성 업데이트
- 총 3개 카드 수정 (위산 레일, 효소 축전, 관통 볼트)

### 5. 업그레이드 트리 레이아웃 문제

사용자가 업그레이드 트리가 보이지 않는다고 보고:

**문제:**
- Bottom sheet 높이가 부족
- 업그레이드 트리가 하단에 잘림
- 스크롤 영역이 너무 작음

**해결 과정 (여러 단계):**
1. Bottom sheet 높이 증가: 600px → 700px → 750px
2. Max-height 증가: 85vh → 88vh
3. 패딩/마진 최적화:
   - tower-info-block: 18px → 16px
   - upgrade-block: 18px → 16px
   - 각종 마진: 20px → 15px → 12px
4. Scroll 영역 증가:
   - 320-450px → 340-470px
5. Upgrade-content 영역 증가:
   - 280-450px → 340-500px

### 6. Splatoon 스타일 디자인 적용

사용자가 `sandbox/splatoon-style/single-page.html`을 참고하여 디자인 업그레이드 요청:

**요구사항:**
- 닌텐도 Splatoon 게임 스타일
- 굵은 테두리 (5px+)
- 대담한 폰트 (font-weight: 900)
- 큰 글자
- 생생한 색상과 그라데이션

**구현:**

1. **노드 카드 스타일:**
   - 5px 굵은 테두리 (#1a1a2e)
   - 이중 박스 섀도우 (색상 테두리 + 그림자)
   - 폰트 크기: 14-24px
   - 폰트 굵기: 900
   - 그라데이션 배경 (활성/비활성 구분)

2. **연결선 (SVG):**
   - Bezier 곡선으로 부드러운 연결
   - 3중 레이어 (테두리, 글로우, 메인)
   - 상태별 색상:
     - 활성화: 청록색 (#00d9ff) + 글로우
     - 사용 가능: 금색 (#ffd700) + 대시 애니메이션
     - 잠김: 회색 + 점선

3. **스크롤바 디자인:**
   - 10px 높이
   - 무지개 그라데이션
   - 굵은 테두리
   - 트랙 배경 (#e0e0e0)

4. **애니메이션:**
   - 노드 등장: scale + rotate 애니메이션
   - 글로우 펄스 효과
   - 대시 흐름 애니메이션
   - 잉크 스플래시 효과 (노드 클릭 시)

### 7. 모바일 드래그 스크롤 시스템 구현

사용자가 모바일 친화적인 드래그 스크롤 요청:

**요구사항:**
- 전역 드래그 관리 시스템
- 지도처럼 드래그 스크롤
- 스크롤바 제거
- 드래그와 클릭 구분

**구현 1: DragManager 싱글톤**

전역 드래그 관리 시스템 (`src/js/core/DragManager.js`):

```javascript
class DragManager {
  constructor() {
    this.isDragging = false;
    this.dragHandlers = new Map();
    this.draggableAreas = new Set();
    this._setupGlobalListeners(); // 전역 이벤트 등록
  }

  registerDraggable(element, options) {
    // 요소를 드래그 가능하게 등록
    // options: { onDragStart, onDrag, onDragEnd }
  }

  _isClickableElement(element) {
    // 버튼, 링크, 업그레이드 노드 카드 감지
    // 해당 요소는 드래그하지 않음
  }
}
```

**특징:**
- 터치/마우스 이벤트 통합 처리
- passive: false로 preventDefault 가능
- 클릭 가능한 요소 자동 감지 및 제외

**구현 2: 업그레이드 트리 드래그 스크롤**

UIController에서 드래그 스크롤 설정:

```javascript
_setupDragScroll(container) {
  let velocity = { x: 0, y: 0 };

  dragManager.registerDraggable(container, {
    onDragStart: (e) => {
      scrollStartX = container.scrollLeft;
      scrollStartY = container.scrollTop;
      container.style.cursor = 'grabbing';
    },

    onDrag: (e) => {
      // 지도처럼 반대 방향 스크롤
      container.scrollLeft = scrollStartX - e.totalDeltaX;
      container.scrollTop = scrollStartY - e.totalDeltaY;

      // 속도 계산 (관성 스크롤용)
      velocity.x = e.deltaX / dt;
      velocity.y = e.deltaY / dt;
    },

    onDragEnd: (e) => {
      if (speed > 100) {
        this._applyInertiaScroll(container, velocity);
      }
    }
  });
}
```

**구현 3: 관성 스크롤**

물리 기반 감속 효과:

```javascript
_applyInertiaScroll(container, velocity) {
  const friction = 0.95; // 5% 감속
  const minVelocity = 10;

  const animate = () => {
    velocity.x *= friction;
    velocity.y *= friction;

    container.scrollLeft -= velocity.x * 0.016;
    container.scrollTop -= velocity.y * 0.016;

    const speed = Math.sqrt(velocity.x**2 + velocity.y**2);
    if (speed > minVelocity) {
      requestAnimationFrame(animate);
    }
  };

  animate();
}
```

**구현 4: 드래그 vs 클릭 구분**

노드 카드 이벤트 처리:

```javascript
let touchStartTime = Date.now();
let touchMoved = false;

handlePointerMove: () => {
  touchMoved = true; // 움직였음을 기록
}

handlePointerUp: (e) => {
  const duration = Date.now() - touchStartTime;

  // 300ms 이내 + 움직임 없음 = 클릭
  if (!touchMoved && duration < 300) {
    if (tree.activateNode(node.nodeNumber)) {
      this._createInkSplash(card, '#00d9ff');
      setTimeout(() => this._showUpgradeTree(tower), 200);
    }
  }
}
```

**CSS 최적화:**

스크롤바 제거 및 드래그 지원:

```css
.upgrade-tree-scroll {
  /* 스크롤바 숨김 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.upgrade-tree-scroll::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

/* 드래그 스크롤 */
.upgrade-tree-scroll {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.upgrade-tree-scroll:active {
  cursor: grabbing;
}

/* 노드 카드는 클릭 가능 */
.upgrade-node-card {
  pointer-events: auto;
  touch-action: auto;
}

.upgrade-node-card * {
  pointer-events: none; /* 자식은 이벤트 차단 */
}
```

---

## 🎯 구현된 기능

### 1. 모듈 기반 타워 시스템

**구조:**
- 10가지 모듈 타입 (TM, PM, DM, TB, SM, TR, RM, SF, AM, UM)
- 각 모듈은 독립적으로 동작
- 조합으로 다양한 효과 생성
- 업그레이드 노드에서 모듈 활성화

**장점:**
- 코드 재사용성 극대화
- 새 타워 추가 시 모듈 조합만 변경
- 밸런싱 용이 (모듈 수치만 조정)
- 확장성 (새 모듈 추가 가능)

**작동 방식:**
1. 타워가 공격 시작
2. 활성화된 업그레이드 노드의 모듈 수집
3. 각 모듈의 `apply(context)` 순차 실행
4. Context가 점진적으로 변형됨
5. 최종 context로 공격 실행

### 2. 업그레이드 트리 시스템

**구조:**
- 각 타워당 12개 노드
- 노드마다 전제조건 (prerequisites) 설정
- 5 업그레이드 포인트 제한
- 노드 활성화 시 모듈 적용

**노드 타입:**
- **branch**: 분기 시작 (여러 선택지)
- **mid**: 중간 경로
- **end**: 최종 특화

**시각화:**
- Civilization 스타일 가로 스크롤
- 열(column) 기반 레이아웃
- SVG Bezier 곡선으로 연결
- 상태별 색상 (활성/사용가능/잠김)

### 3. Splatoon 스타일 UI

**디자인 원칙:**
- **대담함**: 굵은 테두리, 큰 글자, 900 폰트
- **생생함**: 청록, 분홍, 금색 그라데이션
- **입체감**: 다중 박스 섀도우, 3D 효과
- **활력**: 펄스, 글로우, 애니메이션

**주요 요소:**
- 노드 카드: 180×120px → 200×140px, 5px 테두리
- 번호 배지: 36×36px, 원형, 그라데이션
- 연결선: 3중 레이어, 6px 두께, 글로우 효과
- 버튼: 굵은 테두리, 그림자, 호버 스케일

**색상 팔레트:**
- 다크: #1a1a2e (테두리, 그림자)
- 핑크: #e94560 (주요 강조)
- 시안: #00d9ff (활성 상태)
- 골드: #ffd700 (사용 가능)

### 4. 모바일 드래그 스크롤

**기능:**
- 터치/마우스 통합 지원
- 지도처럼 반대 방향 스크롤 (드래그 오른쪽 = 스크롤 왼쪽)
- 관성 스크롤 (빠른 스와이프 → 계속 이동)
- 스크롤바 완전 제거

**드래그 vs 클릭 구분:**
- 시간: 300ms 이내만 클릭으로 인정
- 움직임: touchMoved 플래그로 판단
- 드래그 중에는 노드 클릭 방지

**성능 최적화:**
- RequestAnimationFrame으로 60fps 유지
- Passive 이벤트 (필요시만 preventDefault)
- Transform 대신 scrollLeft/Top 직접 조작
- will-change CSS 속성 사용

---

## 🤔 결정 사항 & 논의

### 1. 모듈 vs 상속 아키텍처

**고려사항:**
- **상속**: 전통적, 간단하지만 확장성 낮음
- **모듈**: 조합 가능, 유연하지만 복잡

**결정:** 모듈 시스템
- 디자인 문서에서 명시적으로 모듈 시스템 요구
- 타워마다 고유한 조합 가능
- 새 타워 추가 시 기존 모듈 재사용
- 밸런싱이 모듈 단위로 이루어져 효율적

### 2. 업그레이드 트리 레이아웃: 수직 vs 가로

**고려사항:**
- **수직**: 전통적 스킬 트리, 모바일 친화적
- **가로**: Civilization 스타일, 공간 활용

**결정:** 가로 스크롤 (Civilization 스타일)
- 사용자가 명시적으로 요청
- 12개 노드를 배치하기 적합
- 전제조건 관계를 명확히 표현
- 드래그 스크롤로 모바일에서도 편리

### 3. 노드 크기: 컴팩트 vs 큰 사이즈

**첫 시도:**
- 노드: 180×120px
- 글자: 12-15px
- 번호 배지: 24×24px

**문제:**
사용자 피드백 - "글자도 키워 주고"

**최종:**
- 노드: 200×140px
- 글자: 14-24px
- 번호 배지: 36×36px

**이유:**
- Splatoon 스타일은 대담함이 핵심
- 모바일에서 터치하기 쉬워야 함
- 시각적 임팩트 증가

### 4. 드래그 스크롤: 같은 방향 vs 반대 방향

**선택지:**
1. **같은 방향**: 드래그 오른쪽 → 스크롤 오른쪽 (일반 스크롤)
2. **반대 방향**: 드래그 오른쪽 → 스크롤 왼쪽 (지도 방식)

**결정:** 반대 방향 (지도 방식)
- 사용자가 "작은 지도처럼" 명시적으로 요청
- 더 직관적 (손으로 화면을 끄는 느낌)
- 구글 맵, 게임 미니맵 등에서 익숙한 방식
- 모바일 사용자에게 자연스러움

### 5. 관성 스크롤: friction 계수

**실험:**
- 0.90: 너무 빨리 멈춤
- 0.95: 자연스러운 감속 ✓
- 0.98: 너무 오래 이동

**결정:** 0.95 (5% 감속/프레임)
- 물리적으로 자연스러움
- 빠른 스와이프에 적절히 반응
- 너무 길지도 짧지도 않은 이동 거리

### 6. 클릭 감지: 시간 임계값

**선택지:**
- 100ms: 너무 짧음 (빠른 탭도 드래그로 인식)
- 300ms: 적절 ✓
- 500ms: 너무 김 (느린 드래그도 클릭으로 인식)

**결정:** 300ms
- 인간의 평균 탭 시간
- 모바일 플랫폼 표준 (iOS, Android)
- 빠른 탭과 느린 드래그 명확히 구분

---

## 🐛 문제 & 해결

### 문제 1: 타워 cost undefined 에러

**증상:**
```
UIController.js:486 Uncaught TypeError: Cannot read properties of undefined (reading 'cost')
```

**원인:**
- HTML: `data-tower-type="enzyme"`
- 코드: `TOWER_TYPES.ENZYME_CHARGE = 'enzymeCharge'`
- 타입 불일치로 `TOWER_DEFINITIONS[type]`이 undefined 반환

**디버깅:**
1. 에러 위치 확인: UIController.js:486
2. 코드 검토: `const def = TOWER_DEFINITIONS[type]`
3. HTML 확인: 타워 카드의 data-tower-type 속성
4. 불일치 발견

**해결:**
`src/index.html` 수정:
```html
<!-- Before -->
<div class="tower-card" data-tower-type="enzyme">
<div class="tower-card" data-tower-type="acid">
<div class="tower-card" data-tower-type="bile">

<!-- After -->
<div class="tower-card" data-tower-type="acidRail">
<div class="tower-card" data-tower-type="enzymeCharge">
<div class="tower-card" data-tower-type="pierceBolt">
```

**결과:** 타워 클릭 시 정상적으로 상세 창 표시

### 문제 2: 업그레이드 트리가 화면에 보이지 않음

**증상:**
- 업그레이드 창은 열림
- 트리 영역이 하단에 잘림
- 스크롤해도 전체가 보이지 않음

**원인:**
- Bottom sheet 높이: 600px → 부족
- Max-height: 85vh → 제한적
- 내부 패딩/마진이 공간 차지
- Upgrade content 영역이 작음

**해결 (단계적):**

1단계: Bottom sheet 높이 증가
```css
#bottom-sheet {
  height: 700px; /* was 600px */
  max-height: 88vh; /* was 85vh */
}
```

2단계: 패딩/마진 최적화
```css
.tower-info-block {
  padding: 16px; /* was 18px */
  margin-bottom: 12px; /* was 15px */
}

.upgrade-block {
  padding: 16px; /* was 18px */
  margin-bottom: 12px; /* was 15px */
}
```

3단계: Content 영역 확대
```css
.upgrade-content {
  min-height: 340px; /* was 280px */
  max-height: 500px; /* was 450px */
}
```

**결과:** 트리 전체가 스크롤 없이 보임

### 문제 3: 노드가 너무 작고 글자가 작음

**증상:**
- 노드 카드가 작아서 터치하기 어려움
- 글자가 작아서 읽기 힘듦
- Splatoon 스타일의 대담함 부족

**원인:**
- 초기 디자인이 컴팩트함을 우선시
- 모바일 터치 타겟 크기 고려 부족

**해결:**

노드 크기 증가:
```javascript
// 노드 카드
width: 200px; // was 180px
height: 140px; // was 120px

// 간격
column-gap: 120px; // was 100px
row-gap: 40px; // was 20px
```

폰트 크기 증가:
```css
.node-number {
  font-size: 18px; /* was 14px */
  width: 36px; /* was 24px */
  height: 36px;
}

.node-name {
  font-size: 16px; /* was 12px */
}

.node-description {
  font-size: 14px; /* was 12px */
}

.node-cost {
  font-size: 15px; /* was 12px */
}
```

폰트 굵기 증가:
```css
font-weight: 900; /* was 700 */
```

**결과:**
- 터치하기 쉬움
- 가독성 향상
- Splatoon 스타일 완성

### 문제 4: 드래그 중에 노드가 클릭됨

**증상:**
- 스크롤을 위해 드래그
- 손을 떼는 순간 노드가 활성화됨
- 의도하지 않은 업그레이드

**원인:**
- 드래그와 클릭을 구분하지 않음
- pointerup 이벤트가 항상 클릭으로 처리

**해결:**

1. touchMoved 플래그 추가:
```javascript
let touchMoved = false;

card.addEventListener('pointermove', () => {
  touchMoved = true;
});
```

2. 시간 체크 추가:
```javascript
let touchStartTime = Date.now();

card.addEventListener('pointerup', () => {
  const duration = Date.now() - touchStartTime;

  // 조건: 움직이지 않았고 + 300ms 이내
  if (!touchMoved && duration < 300) {
    // 클릭으로 인정
    activateNode();
  }
});
```

3. DragManager에서 클릭 가능한 요소 감지:
```javascript
_isClickableElement(element) {
  // 업그레이드 노드 카드인지 확인
  let current = element;
  while (current && current !== document.body) {
    if (current.classList.contains('upgrade-node-card')) {
      return true; // 드래그하지 않음
    }
    current = current.parentElement;
  }
  return false;
}
```

**결과:**
- 드래그 중에는 노드 클릭 안 됨
- 빠른 탭만 클릭으로 인정
- 의도하지 않은 업그레이드 방지

---

## 💡 기술 노트

### 모듈 패턴의 힘

전통적인 상속 구조:
```javascript
class TowerA extends BaseTower {
  attack() {
    // 모든 로직을 여기에 작성
    // 재사용 어려움
  }
}
```

모듈 구조:
```javascript
class TowerA extends BaseTower {
  attack() {
    let context = { damage, target };

    // 모듈을 순차 적용
    for (const module of activeModules) {
      context = module.apply(context);
    }

    // 변형된 context로 공격
    fireProjectile(context);
  }
}
```

**장점:**
- 각 모듈은 단일 책임
- 테스트 용이
- 조합으로 무한한 변형
- 밸런싱이 모듈 단위로 가능

### Virtual Coordinates와 노드 배치

노드 위치를 절대 좌표가 아닌 column/row로 관리:

```javascript
// 전제조건 기반 column 계산
for (const node of nodes) {
  if (node.prerequisites.length === 0) {
    positions[node.nodeNumber] = { column: 0, row: 0 };
  } else {
    const maxColumn = Math.max(
      ...node.prerequisites.map(p => positions[p].column)
    );
    positions[node.nodeNumber] = {
      column: maxColumn + 1,
      row: /* distribute */
    };
  }
}

// 실제 픽셀 좌표로 변환
const x = column * columnGap;
const y = row * rowGap;
```

**장점:**
- 전제조건 관계가 시각적으로 명확
- 간격 조정이 간단 (columnGap만 변경)
- 노드 추가 시 자동 배치

### SVG Bezier 곡선으로 연결선

3중 레이어로 입체감:

```javascript
// 1. 테두리 (어두움, 굵음)
const borderLine = createLine({
  stroke: 'rgba(26,26,46,0.3)',
  strokeWidth: 10
});

// 2. 글로우 (색상, 반투명)
const glowLine = createLine({
  stroke: 'rgba(0,217,255,0.4)',
  strokeWidth: 8,
  filter: 'blur(4px)'
});

// 3. 메인 (색상, 선명)
const mainLine = createLine({
  stroke: '#00d9ff',
  strokeWidth: 6
});
```

Bezier 곡선 계산:
```javascript
const midX = (startX + endX) / 2;
const d = `M ${startX} ${startY}
           C ${midX} ${startY},
             ${midX} ${endY},
             ${endX} ${endY}`;
```

**효과:**
- 부드러운 S자 곡선
- 입체적인 느낌
- 상태별 색상으로 명확한 피드백

### Friction-based 관성 스크롤

물리 기반 감속:

```javascript
const friction = 0.95; // 매 프레임 5% 감소
const minVelocity = 10; // 최소 속도

function animate() {
  velocity.x *= friction;
  velocity.y *= friction;

  container.scrollLeft -= velocity.x * 0.016; // 60fps 기준
  container.scrollTop -= velocity.y * 0.016;

  const speed = Math.sqrt(velocity.x**2 + velocity.y**2);
  if (speed > minVelocity) {
    requestAnimationFrame(animate);
  }
}
```

**왜 이 방식?**
- 물리적으로 자연스러움
- 초기 속도에 비례하는 이동 거리
- 부드러운 감속 (선형이 아닌 지수)
- 성능 좋음 (RAF 사용)

### Pointer Events vs Mouse/Touch

Pointer Events API 통합:

```javascript
// 옛날 방식 (복잡)
element.addEventListener('mousedown', handler);
element.addEventListener('touchstart', handler);

// 현대적 방식 (간단)
element.addEventListener('pointerdown', handler);
```

**장점:**
- 마우스, 터치, 펜 모두 지원
- 하나의 이벤트로 통합 처리
- e.pointerType으로 구분 가능
- 더 나은 성능

---

## 📝 다음에 할 일

### 타워 시스템
- [ ] 실제 타워 설치 로직 구현
- [ ] 타워 판매 시 포인트 환불 (50%)
- [ ] 업그레이드 포인트 획득 (레벨업, 퀘스트)
- [ ] 타워 공격 애니메이션 (파티클, 이펙트)

### 모듈 시스템
- [ ] 나머지 모듈 테스트 (AM, UM)
- [ ] 모듈 조합 밸런싱
- [ ] 모듈 툴팁 상세 설명
- [ ] 모듈 디버그 UI (활성화된 모듈 시각화)

### 업그레이드 트리
- [ ] 업그레이드 포인트 재분배 기능
- [ ] 노드 프리뷰 (마우스 오버 시 상세 정보)
- [ ] 트리 프리셋 (빠른 특화 선택)
- [ ] 노드 애니메이션 강화

### 드래그 스크롤
- [ ] 경계 바운스 효과 (iOS 스타일)
- [ ] 스크롤 위치 인디케이터
- [ ] 키보드 네비게이션 (화살표)
- [ ] 제스처: 핀치 줌

### 성능 최적화
- [ ] 모듈 apply 최적화 (캐싱)
- [ ] SVG 연결선 재사용
- [ ] 드래그 이벤트 throttle
- [ ] Virtual scrolling (노드 많을 때)

---

## 💡 메모 / 인사이트

### 모듈 시스템의 우아함

처음에는 복잡해 보였지만:
- 타워마다 attack() 메서드를 오버라이드하는 대신
- 모듈을 조합하는 것이 훨씬 깔끔

**효과:**
- 새 타워 추가: 모듈 조합만 정의
- 밸런싱: 모듈 수치만 조정
- 버그 수정: 모듈 하나만 고치면 모든 타워에 반영

**교훈:** 올바른 추상화는 복잡성을 관리 가능하게 만든다.

### 사용자 피드백의 중요성

업그레이드 트리 레이아웃 문제:
- 처음: 600px 높이로 구현
- 사용자: "트리가 보이지 않아요"
- 결과: 750px로 증가 + 여러 최적화

노드 크기 문제:
- 처음: 컴팩트한 디자인 (180×120px)
- 사용자: "글자도 키워 주고"
- 결과: 대담한 디자인 (200×140px, 24px 글자)

**교훈:** 내가 생각하는 "충분함"과 사용자의 "충분함"은 다르다. 피드백을 경청하라.

### Splatoon 스타일의 철학

Splatoon 디자인 원칙:
- **대담함**: 작은 것은 없다. 모든 것을 크고 굵게
- **생생함**: 회색은 없다. 모든 것에 색을 입혀라
- **입체감**: 평면은 없다. 모든 것에 그림자와 테두리를
- **활력**: 정적은 없다. 모든 것을 움직여라

이 원칙을 따르니:
- 시각적 임팩트 증가
- 게임이 더 재미있어 보임
- 터치 타겟 크기도 자연스럽게 증가

**교훈:** 디자인 시스템의 원칙을 이해하고 일관되게 적용하라.

### 드래그와 클릭의 미묘한 경계

300ms와 touchMoved 플래그:
- 너무 짧으면: 빠른 탭도 드래그로 인식
- 너무 길면: 느린 드래그도 클릭으로 인식
- 움직임 체크 없으면: 드래그 끝이 클릭으로 인식

최종 조건:
```
클릭 = (!touchMoved) && (duration < 300ms)
```

**교훈:** 사용자 입력은 이진법이 아니다. 시간과 움직임의 조합으로 의도를 파악하라.

### 관성 스크롤의 물리학

Friction 0.95는 마법의 숫자:
- 물리적으로 현실감 있음
- 사용자가 기대하는 감속도
- iOS/Android 표준과 유사

RAF를 사용한 이유:
- setTimeout보다 부드러움
- 브라우저 최적화 (60fps)
- 탭이 백그라운드면 자동 일시정지

**교훈:** 물리 법칙을 모방하면 사용자가 직관적으로 이해한다.

### 작은 개선의 누적

이번 세션의 변화:
1. ✅ 타워 시스템 완전 재구현
2. ✅ 업그레이드 트리 구현
3. ✅ Splatoon 스타일 디자인
4. ✅ 드래그 스크롤 시스템
5. ✅ 여러 버그 수정

각각은 독립적이지만, 합치면:
- 완전히 작동하는 타워 업그레이드 시스템
- 터치 친화적인 모바일 UI
- 재미있고 직관적인 게임플레이

**교훈:** 큰 기능은 작은 조각들의 합이다. 하나씩 완성하라.

---

**날짜**: 2026-02-21
**세션 시간**: 약 2-3시간 (대화 압축됨)
**작업 형태**: 대화형 개발 (구현 → 피드백 → 개선 반복)
