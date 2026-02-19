# Devlog: 타워 상호작용 시스템 완성

**Date:** 2026-02-20

## Summary

타워 슬롯 클릭 기능의 여러 문제 해결: 클릭 이벤트 차단 문제, UI 버튼 배치 개선, 카메라 포커스 위치 계산 오류 수정. 하단 상세 창과 카메라 시스템이 완전히 통합되어 원활하게 작동하도록 개선.

---

## 🗣️ 작업 흐름

### 1. 초기 문제: 타워 슬롯 클릭이 작동하지 않음

**증상:**
- 타워 슬롯을 클릭해도 아무 반응 없음
- 콘솔에도 클릭 이벤트가 찍히지 않음
- 이전 세션에서 구현한 클릭 기능이 막힌 상태

**원인 파악:**
사용자가 HTML 구조를 공유하면서 문제 발견:
- `#bottom-sheet`가 `z-index: 90`으로 게임 영역 위에 위치
- 접혀있을 때도 높이 600px를 차지하며 클릭 이벤트 차단
- Canvas가 bottom-sheet 뒤에 가려져 클릭 불가

**해결 과정:**
1. `#bottom-sheet`에 `pointer-events: none` 추가
   - 기본적으로 클릭을 통과시킴
2. 실제 상호작용이 필요한 요소만 `pointer-events: auto` 설정
   - `.sheet-handle`: 드래그 핸들
   - `.sheet-header`: 헤더 클릭으로 펼치기/접기
   - `.sheet-content`: 내용물 (버튼, 카드 등)
3. `#pathCanvas`에 명시적으로 `pointer-events: auto` 추가
4. `.canvas-container`에 명시적인 크기 설정 (640px × 1063px)

**추가 개선:**
클릭 이벤트를 `canvas-container` 대신 `pathCanvas`에 직접 등록:
- 좌표 계산이 더 정확해짐
- Canvas의 실제 rect를 직접 사용
- Offset 계산 단순화

### 2. UI 개선 요청: 버튼 위치 변경

사용자가 UI 개선을 요청:
- 판매/닫기 버튼을 상세 창 하단이 아닌 **상단**으로 이동
- 이유: 빠르게 접근 가능해야 함

**구현:**
1. **HTML 구조 변경**
   - `<div class="action-buttons">`를 `.sheet-content` 최상단으로 이동
   - 버튼에 ID 추가: `#closeBtn`, `#sellBtn`

2. **CSS 스타일 조정**
   - `position: sticky` + `top: -15px`로 스크롤해도 상단 고정
   - 배경 그라데이션으로 콘텐츠와 자연스럽게 분리
   - 버튼 크기 축소 (58px → 48px, 더 컴팩트하게)
   - box-shadow 간격 조정 (6px → 4px)

3. **JavaScript 이벤트 연결**
   - 기존: `querySelectorAll('.action-btn.primary')` (모든 primary 버튼)
   - 변경: `getElementById('closeBtn')`, `getElementById('sellBtn')` (명확한 선택)
   - 두 버튼 모두 `closeSheet()` 메서드 호출

### 3. 카메라 리셋 기능 확인

사용자 요청:
- 판매 또는 닫기 버튼 클릭 시 게임 화면이 원래 위치로 복구되어야 함

**확인:**
- `UIController.closeSheet()`가 이미 `onSheetCloseCallback` 호출
- `main.js`에서 `uiController.setOnSheetClose(() => cameraController.reset())` 설정됨
- 판매/닫기 버튼 모두 `closeSheet()` 호출하므로 자동으로 카메라 리셋

**결과:** 추가 작업 없이 이미 작동 중

### 4. 카메라 포커스 위치 부정확 문제

**문제 발견:**
사용자가 타워를 클릭했을 때 카메라 포커스 위치가 정확하지 않다고 보고.

**첫 번째 시도: 실제 DOM 좌표 사용**
```javascript
// canvas.getBoundingClientRect()로 실제 위치 계산
// 문제: 게임 전체에 스케일 적용되어 있어 복잡함
```

**문제점:**
- 전체 게임 화면에 `ScaleManager`로 스케일 적용됨
- 실제 픽셀과 디자인 픽셀이 다름
- 계산이 복잡하고 부정확

**두 번째 시도: Virtual Coordinates 기반 재설계**

사용자 피드백:
> "지금 게임 화면이 전체 스케일 적용하고 있어요. src\js\config.js에 각 타워의 xy 좌표 값이 있어요. 그 값을 이용..."

**깨달음:**
- `config.js`의 타워 좌표는 **virtual coordinates** (360x640 기준)
- 이 좌표를 기준으로 계산해야 정확함
- 실제 DOM 위치를 추적하는 것이 아니라 가상 좌표계에서 계산

**최종 구현:**
```javascript
// 1. Game area: 640x1063 (고정)
// 2. Canvas virtual: 360x640
// 3. Canvas scale: min(640/360, 1063/640) = 1.661
// 4. Canvas CSS: 598x1063
// 5. Canvas offset: (21, 0)

// 타워 위치 계산:
// - Virtual → Canvas: slot.x * 1.661
// - Canvas → Game area: 21 + (slot.x * 1.661)

// 보이는 영역:
// - Sheet height: 600px
// - Visible: 1063 - 600 = 463px
// - Center: 463 / 2 = 231.5px

// 필요한 offset:
// - X: 320 - towerGameAreaX
// - Y: 231.5 - towerGameAreaY
```

**디버깅 강화:**
- 콘솔에 모든 계산 단계 출력
- Virtual coords, scale, canvas offset, tower position, target center 등
- 문제 발생 시 정확한 지점 파악 가능

### 5. 타이밍 문제 해결

**발견:**
카메라가 sheet가 펼쳐지는 중에 이동하면 계산이 어긋날 수 있음.

**해결:**
Bottom sheet의 transition이 0.3초이므로:
- Sheet 펼치기 시작
- 350ms 대기 (transition보다 살짝 길게)
- 카메라 포커스 시작

```javascript
setTimeout(() => {
  this.onSheetOpenCallback(this.selectedTowerSlot);
}, 350);
```

**효과:**
- Sheet가 완전히 펼쳐진 후 카메라 이동
- 부드러운 시각적 흐름
- 계산 오류 방지

### 6. 사용자 질문: 번개 아이콘

**질문:**
"게임 화면 우측 상단에 번개 떠있는 아이콘 뭔가요?"

**답변:**
- `canvas-container::after` CSS pseudo-element
- 순전히 장식용 (Splatoon 스타일)
- `pointer-events: none`이라 클릭 방해 안 함
- 2초마다 bounce 애니메이션
- 삭제 원하면 CSS 블록 제거 가능

---

## 🎯 구현된 기능

### 1. 타워 슬롯 클릭 감지 시스템

**작동 방식:**
- 사용자가 게임 화면의 타워 슬롯 클릭
- `pathCanvas`에서 클릭 이벤트 감지
- 클릭 좌표를 virtual coordinates로 변환
- `checkTowerSlotClick()`으로 어느 슬롯인지 판별
- 해당 슬롯의 상세 정보로 bottom sheet 열림

**좌표 변환:**
```
Screen coords (clientX, clientY)
  ↓ (canvas.getBoundingClientRect())
Canvas coords (canvasX, canvasY)
  ↓ (canvasX / cssW * VIRTUAL_W)
Virtual coords (virtualX, virtualY)
  ↓ (checkTowerSlotClick)
Tower slot matched
```

**클릭 우선순위:**
1. 편집 모드 활성화 시: 타워 클릭 무시
2. Bottom sheet가 클릭을 차단하지 않음 (`pointer-events: none`)
3. Canvas만 클릭 이벤트 수신 (`pointer-events: auto`)

### 2. 상세 창 UI 개선

**버튼 상단 배치:**
- 판매/닫기 버튼이 창 최상단에 배치
- Sticky positioning으로 스크롤해도 항상 보임
- 빠른 접근 가능
- 컴팩트한 디자인 (48px 높이)

**버튼 기능:**
- **닫기 버튼**: Sheet 접고 카메라 리셋
- **판매 버튼**: (TODO) 판매 로직 + Sheet 접고 카메라 리셋

### 3. 카메라 포커스 시스템

**목표:**
타워를 클릭하면, bottom sheet가 펼쳐진 상태에서 보이는 게임 영역(상단 463px)의 정중앙에 타워를 배치.

**계산 방식:**
1. **Virtual coordinates 기반**
   - `config.js`의 타워 좌표 사용 (360x640 가상 좌표계)
   - Canvas scale 계산: 1.661배
   - Canvas CSS 크기: 598x1063
   - Canvas offset: (21, 0)

2. **보이는 영역 계산**
   - Game area height: 1063px
   - Bottom sheet height: 600px
   - Visible area: 463px
   - Target center: 231.5px (상단에서)

3. **Offset 계산**
   - 타워의 현재 위치: `21 + (slot.x * 1.661)`, `slot.y * 1.661`
   - 목표 위치: `320`, `231.5` (game area의 중심 & visible area의 중심)
   - 필요한 offset: 목표 - 현재

4. **애니메이션**
   - Smooth interpolation (animationSpeed: 0.15)
   - 매 프레임 offset 적용
   - `translate(x, y)` CSS transform 사용

**타이밍:**
1. 타워 클릭
2. Bottom sheet 펼치기 시작 (0.3s transition)
3. 350ms 대기
4. 카메라 포커스 시작 (smooth animation)

### 4. 카메라 리셋

**트리거:**
- 닫기 버튼 클릭
- 판매 버튼 클릭
- Sheet handle/header로 창 접기

**동작:**
- `targetOffset = { x: 0, y: 0 }`
- Smooth animation으로 원래 위치로 복귀
- 게임 화면 전체 보임

---

## 🤔 결정 사항 & 논의

### 1. Pointer-events vs z-index 조정

**문제:**
Bottom sheet가 클릭을 차단함.

**선택지:**
1. **Z-index 조정**: Sheet를 낮추고 필요할 때만 올림
2. **Pointer-events 조정**: Sheet는 높게 두되 클릭만 통과

**결정:** Pointer-events
- Sheet의 위치는 그대로 유지 (시각적으로 일관됨)
- 필요한 부분만 클릭 가능하게 세밀한 제어
- 레이어 순서가 복잡해지지 않음

### 2. 버튼 위치: 상단 vs 하단

**고려사항:**
- **하단**: 전통적인 위치, 내용을 먼저 보고 액션
- **상단**: 빠른 접근, 모바일 UX에서 흔한 패턴

**결정:** 상단
- 사용자가 명시적으로 요청
- 게임 중 빠르게 닫아야 하는 경우 많음
- Sticky positioning으로 항상 접근 가능
- 더 현대적인 UX

### 3. 좌표 계산: DOM vs Virtual

**첫 시도 (DOM):**
```javascript
const canvasRect = canvas.getBoundingClientRect();
const towerScreenX = canvasRect.left + slot.x * scale;
```

**문제:**
- 게임 전체에 scale 적용되어 있음
- DOM 좌표가 계속 변함 (resize, scale)
- 계산이 복잡하고 오류 발생

**최종 (Virtual):**
```javascript
const canvasScale = 1.661;
const towerGameAreaX = 21 + slot.x * canvasScale;
```

**장점:**
- Virtual coordinates는 고정됨
- 디자인 단위로 계산 (640x1063)
- 명확하고 예측 가능
- Scale 변경에도 안정적

**결정:** Virtual coordinates
- Config에 정의된 좌표 직접 사용
- 더 간단하고 정확
- 디버깅 쉬움

### 4. 카메라 타이밍: 즉시 vs 딜레이

**선택지:**
1. **즉시**: Sheet 열리는 동시에 카메라 이동
2. **딜레이**: Sheet 완전히 펼쳐진 후 카메라 이동

**결정:** 350ms 딜레이
- Sheet transition (0.3s) 후 시작
- 시각적으로 더 자연스러움
- 계산 오류 방지 (sheet가 이동 중일 때 visible area 불확실)
- 사용자가 sheet 내용을 보는 동안 카메라 이동

---

## 🐛 문제 & 해결

### 문제 1: 타워 클릭이 전혀 작동하지 않음

**증상:**
- 타워를 클릭해도 아무 반응 없음
- 콘솔에 로그도 없음
- 이전 세션에서 구현한 기능이 막힘

**원인:**
- `#bottom-sheet`가 `z-index: 90`으로 게임 영역 위에 위치
- 접혀있을 때도 `height: 600px`로 공간 차지
- 클릭 이벤트가 sheet에 먼저 도달하고 canvas까지 전달 안 됨

**디버깅 과정:**
1. HTML 구조 확인: Sheet가 canvas 위에 있음
2. CSS 확인: Sheet에 pointer-events 설정 없음
3. Z-index 확인: Sheet가 더 높음

**해결:**
```css
#bottom-sheet {
  pointer-events: none; /* 클릭 통과 */
}

.sheet-handle,
.sheet-header,
.sheet-content {
  pointer-events: auto; /* 필요한 부분만 활성화 */
}

#pathCanvas {
  pointer-events: auto; /* Canvas 클릭 가능 */
}
```

**결과:**
- Canvas 클릭이 정상 작동
- Sheet의 버튼/헤더는 여전히 클릭 가능
- 레이어 순서는 그대로 유지

### 문제 2: 카메라 포커스 위치가 부정확

**증상:**
- 타워를 클릭하면 카메라가 이동하긴 함
- 하지만 타워가 정중앙이 아닌 다른 위치에 배치됨
- 콘솔 로그로 보면 계산 값이 이상함

**첫 번째 원인 (추측):**
보이는 영역 계산 오류
- `upperHalfCenterY = gameAreaHeight * 0.25 = 265.75px`
- 실제로는 `visibleAreaHeight / 2 = 231.5px`여야 함

**수정 후에도 문제 지속:**
사용자: "여전히 정확하게 중앙에 포커스하지 못하고 있어요"

**두 번째 원인 (실제):**
- 게임 전체에 scale 적용되어 있음
- DOM getBoundingClientRect()가 scaled 값 반환
- Virtual coordinates와 맞지 않음

**사용자 피드백:**
> "지금 게임 화면이 전체 스케일 적용하고 있어요. config.js에 각 타워의 xy 좌표 값이 있어요. 그 값을 이용..."

**해결:**
Virtual coordinates 기반으로 완전히 재작성:
```javascript
// Canvas scale: 640/360 또는 1063/640 중 작은 값
const canvasScale = Math.min(640/360, 1063/640); // 1.661

// Canvas CSS 크기
const canvasCssWidth = 360 * 1.661 = 598px;
const canvasCssHeight = 640 * 1.661 = 1063px;

// Canvas offset
const canvasOffsetX = (640 - 598) / 2 = 21px;
const canvasOffsetY = 0px;

// Tower position in game area
const towerGameAreaX = 21 + slot.x * 1.661;
const towerGameAreaY = slot.y * 1.661;

// Target center (visible area)
const visibleHeight = 1063 - 600 = 463px;
const targetCenterY = 463 / 2 = 231.5px;

// Required offset
const offsetX = 320 - towerGameAreaX;
const offsetY = 231.5 - towerGameAreaY;
```

**디버깅 추가:**
모든 계산 단계를 콘솔에 출력:
- Tower virtual coords
- Canvas scale
- Canvas CSS size
- Canvas offset
- Tower on canvas
- Tower in game area
- Visible area height
- Target center
- Required offset

**결과:**
- 정확한 중앙 배치
- 모든 타워 슬롯에서 일관된 동작
- 디버깅 가능한 로그

### 문제 3: Camera와 Sheet 타이밍 불일치

**증상:**
- Sheet가 펼쳐지는 동안 카메라가 이동
- 계산이 어긋날 수 있음
- 시각적으로 혼란스러움

**원인:**
- Sheet transition: 0.3s
- Camera 즉시 시작
- 두 애니메이션이 동시에 실행

**해결:**
```javascript
setTimeout(() => {
  this.onSheetOpenCallback(this.selectedTowerSlot);
}, 350); // Sheet transition 후 시작
```

**효과:**
1. 타워 클릭
2. Sheet 펼쳐짐 (0.3s, 사용자가 내용 확인)
3. 350ms 후
4. 카메라 이동 시작 (smooth animation)
5. 타워가 중앙에 배치됨

**결과:**
- 자연스러운 시각적 흐름
- 애니메이션 충돌 없음
- 계산 정확도 향상

---

## 💡 기술 노트

### Pointer-events의 힘

CSS `pointer-events` 속성으로 클릭 이벤트 제어:

**문법:**
```css
pointer-events: none;  /* 클릭 통과 */
pointer-events: auto;  /* 클릭 받음 */
```

**레이어 구조:**
```
z-index: 90  → #bottom-sheet (pointer-events: none)
                  ↓ (클릭 통과)
                ├─ .sheet-handle (pointer-events: auto) ← 클릭 가능
                ├─ .sheet-content (pointer-events: auto) ← 클릭 가능
                └─ 빈 공간 (pointer-events: none) ← 통과

z-index: 낮음 → #pathCanvas (pointer-events: auto) ← 클릭 받음
```

**장점:**
- Z-index 순서를 유지하면서 클릭 제어
- 필요한 부분만 세밀하게 활성화
- 시각적 레이어와 인터랙션 레이어 분리

### Virtual Coordinates 시스템

게임 개발에서 흔히 사용하는 가상 좌표계:

**개념:**
- **Virtual**: 디자인 단위 (360x640)
- **Canvas**: 실제 렌더링 크기 (가변)
- **Screen**: 브라우저 창 크기 (가변)

**변환:**
```javascript
// Virtual → Canvas
const canvasX = virtualX * scale;

// Canvas → Virtual
const virtualX = canvasX / scale;

// Screen → Virtual
const virtualX = (screenX - canvasLeft) / canvasWidth * VIRTUAL_W;
```

**장점:**
- 디자인은 고정된 좌표로 작업
- 다양한 화면 크기에 대응
- Scale이 변해도 로직은 동일

### Sticky Positioning

CSS `position: sticky`로 스크롤 시 고정:

**설정:**
```css
.action-buttons {
  position: sticky;
  top: -15px; /* 스크롤 시 상단에 고정 */
  z-index: 10; /* 다른 요소 위에 */
  background: gradient; /* 뒤 내용 가림 */
}
```

**동작:**
1. 스크롤 전: 일반 위치
2. 스크롤 중: `top: -15px`에 도달하면 고정
3. 스크롤 후: 계속 보임

**장점:**
- `position: fixed`와 달리 자연스러운 흐름
- 스크롤 이벤트 리스너 불필요
- 성능 우수

### Transform vs Position

카메라 이동에 `transform` 사용:

**transform (사용):**
```javascript
container.style.transform = `translate(${x}px, ${y}px)`;
```

**position (사용 안 함):**
```javascript
container.style.left = `${x}px`;
container.style.top = `${y}px`;
```

**이유:**
- Transform은 GPU 가속
- Reflow 없이 렌더링만 (빠름)
- 부드러운 애니메이션
- 하위 픽셀 단위 가능

---

## 📝 다음에 할 일

### 타워 시스템
- [ ] 실제 타워 설치 기능 구현
- [ ] 타워 판매 로직 구현
- [ ] 타워 업그레이드 시스템
- [ ] 타워 타입별 상세 정보 표시

### 카메라 시스템
- [ ] 줌 인/아웃 기능
- [ ] 드래그로 화면 이동 (편집 모드 외)
- [ ] 미니맵 표시
- [ ] 카메라 범위 제한 (게임 영역 밖으로 안 나가게)

### UI/UX 개선
- [ ] 타워 선택 시 범위 표시 (원형 오버레이)
- [ ] 타워 공격 애니메이션
- [ ] 효과음 추가 (클릭, 설치, 판매)
- [ ] 햅틱 피드백 (모바일)

### 성능 최적화
- [ ] 카메라 애니메이션 RAF 최적화
- [ ] 클릭 이벤트 throttle/debounce
- [ ] Sheet 애니메이션 will-change 최적화

---

## 💡 메모 / 인사이트

### Pointer-events의 우아함

`z-index`로만 해결하려고 했다면:
- Sheet를 낮추고
- 필요할 때마다 올리고
- Canvas와 번갈아가며 조정
- JavaScript로 계속 조작

`pointer-events`를 쓰니:
- CSS만으로 해결
- 레이어 순서는 그대로
- 시각적 일관성 유지
- JavaScript 최소화

**교훈:** 적절한 CSS 속성 하나가 복잡한 JavaScript를 대체할 수 있다.

### Virtual Coordinates의 중요성

실제 DOM 좌표를 추적하려다가 삽질:
- getBoundingClientRect()가 scaled 값 반환
- 계산이 복잡하고 오류 발생
- 디버깅 어려움

Virtual coordinates로 전환하니:
- 간단명료한 계산
- 디자인 의도와 일치
- 어떤 scale에서도 동작

**교훈:** 문제를 올바른 좌표계에서 해결하라.

### 디버깅 로그의 가치

처음에는 간단한 로그만:
```javascript
console.log('Focusing on tower:', slot);
```

나중에 상세한 로그:
```javascript
console.log('Tower virtual:', slot);
console.log('Scale:', scale);
console.log('Canvas size:', cssW, cssH);
console.log('Canvas offset:', offsetX, offsetY);
console.log('Tower on canvas:', towerCanvasX, towerCanvasY);
// ... 10줄 이상
```

**효과:**
- 문제 지점 즉시 파악
- 사용자와 디버깅 협업
- 확신을 가지고 수정

**교훈:** 복잡한 계산은 모든 단계를 로그로 남겨라.

### 타이밍의 중요성

Sheet와 Camera가 동시에 움직일 때:
- 사용자 혼란
- 계산 불확실
- 버그 가능성

350ms만 지연시켰을 뿐인데:
- 훨씬 자연스러움
- 계산 정확
- 사용자 만족

**교훈:** 애니메이션은 순서가 중요하다. 동시 실행이 항상 빠른 것은 아니다.

### 사용자와의 협업

사용자: "여전히 정확하지 않아요"
나: *DOM 좌표 추적 시도*
사용자: "게임에 스케일 적용되어 있어요. config.js 좌표 사용하세요"
나: *Virtual coordinates 재설계*

**효과:**
- 올바른 방향 제시
- 시간 절약
- 더 나은 해결책

**교훈:** 사용자는 문제의 맥락을 알고 있다. 경청하라.

### 작은 개선의 누적

이번 세션의 개선:
1. ✅ 클릭 작동 (pointer-events)
2. ✅ 버튼 배치 개선 (상단 이동)
3. ✅ 카메라 정확도 (virtual coords)
4. ✅ 타이밍 조정 (350ms delay)

각각은 작지만, 합치면:
- 완전히 작동하는 타워 상호작용 시스템
- 직관적인 UX
- 버그 없는 카메라 포커스

**교훈:** 완벽한 한 방이 아니라, 작은 개선의 반복이 시스템을 완성한다.

---

**날짜**: 2026-02-20
**세션 시간**: 약 1.5시간
**작업 형태**: 버그 수정 + UI 개선 + 시스템 통합
