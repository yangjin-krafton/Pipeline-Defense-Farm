# 드래그 스크롤 구현 완료

## 📱 모바일 친화적 드래그 시스템

### 1. **DragManager (전역 드래그 관리자)**
위치: `src/js/core/DragManager.js`

#### 주요 기능
- ✅ 전역 터치/마우스 이벤트 관리
- ✅ 드래그 가능한 영역 등록 시스템
- ✅ 싱글톤 패턴으로 전체 게임에서 공유
- ✅ 터치와 마우스 이벤트 통합 처리

#### API
```javascript
// 드래그 가능 영역 등록
dragManager.registerDraggable(element, {
  onDragStart: (e) => { /* 드래그 시작 */ },
  onDrag: (e) => { /* 드래그 중 */ },
  onDragEnd: (e) => { /* 드래그 종료 */ }
});

// 등록 해제
dragManager.unregisterDraggable(element);
```

#### 이벤트 데이터
- **onDragStart**: `{ startX, startY, target, originalEvent }`
- **onDrag**: `{ deltaX, deltaY, currentX, currentY, totalDeltaX, totalDeltaY, target, originalEvent }`
- **onDragEnd**: `{ startX, startY, endX, endY, totalDeltaX, totalDeltaY, target, originalEvent }`

### 2. **업그레이드 트리 드래그 스크롤**

#### 작동 방식
```
사용자가 드래그 → 스크롤 이동 (지도 방식)
                 ↓
            관성 스크롤 적용
```

#### 구현 세부사항
- **드래그 방향**: 터치 방향과 반대로 스크롤 (지도처럼)
- **관성 스크롤**: 빠르게 드래그하면 관성으로 계속 이동
- **마찰 계수**: 0.95 (부드러운 감속)
- **최소 속도**: 100px/s (관성 스크롤 시작 임계값)

#### 커서 변화
- 기본: `cursor: grab`
- 드래그 중: `cursor: grabbing`

### 3. **스크롤바 제거**

#### CSS 설정
```css
.upgrade-tree-scroll {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.upgrade-tree-scroll::-webkit-scrollbar {
  display: none; /* Chrome/Safari/Opera */
}
```

#### 터치 액션 방지
```css
touch-action: none;
user-select: none;
```

### 4. **노드 클릭 vs 드래그 구분**

#### 문제
- 드래그 중에 노드가 클릭되는 것을 방지해야 함

#### 해결
```javascript
// 조건 체크
1. 터치 시간 < 300ms (빠른 탭)
2. touchMoved === false (드래그하지 않음)
→ 클릭으로 인정
```

#### 이벤트 순서
```
1. touchstart/mousedown → 시작 시간 기록, touchMoved = false
2. touchmove/mousemove → touchMoved = true
3. touchend/mouseup → 조건 체크 후 클릭 처리
```

### 5. **관성 스크롤 알고리즘**

```javascript
속도 계산:
  velocity = delta / deltaTime

관성 적용:
  while (speed > minVelocity) {
    velocity *= friction (0.95)
    scroll -= velocity * frameTime
  }
```

#### 파라미터
- **friction**: 0.95 (매 프레임마다 5% 감속)
- **minVelocity**: 10px/s (정지 임계값)
- **frameTime**: 0.016s (약 60fps)

### 6. **모바일 최적화**

#### 터치 이벤트
- `touchstart`, `touchmove`, `touchend`, `touchcancel` 모두 처리
- `passive: false` - 기본 동작 방지 가능
- `-webkit-overflow-scrolling: touch` - iOS 부드러운 스크롤

#### 데스크톱 호환
- 마우스 이벤트도 동일하게 처리
- 호버 효과는 터치 디바이스에서 비활성화

### 7. **UIController 통합**

```javascript
class UIController {
  constructor() {
    this.dragManager = dragManager; // 전역 싱글톤
    this.currentScrollContainer = null; // 현재 드래그 스크롤 컨테이너
  }

  _setupDragScroll(container) {
    // 이전 등록 해제
    if (this.currentScrollContainer) {
      this.dragManager.unregisterDraggable(this.currentScrollContainer);
    }

    // 새 컨테이너 등록
    this.dragManager.registerDraggable(container, { ... });
  }
}
```

### 8. **성능 최적화**

#### requestAnimationFrame 사용
- 관성 스크롤은 RAF로 부드러운 60fps
- 브라우저 최적화 활용

#### 이벤트 최소화
- 전역 이벤트 리스너 1회만 등록
- 버블링 활용하여 효율적인 타겟 찾기

#### GPU 가속
```css
transform: translate3d(0, 0, 0); /* GPU 레이어 생성 */
will-change: scroll-position; /* 스크롤 최적화 힌트 */
```

## 🎮 사용 예시

### 업그레이드 트리
```javascript
// 자동으로 드래그 스크롤 설정됨
_showUpgradeTree(tower) {
  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'upgrade-tree-scroll';

  // ... 컨텐츠 추가 ...

  this._setupDragScroll(scrollContainer); // 드래그 활성화
}
```

### 다른 영역에 적용 (예시)
```javascript
const mapContainer = document.querySelector('.game-map');
dragManager.registerDraggable(mapContainer, {
  onDrag: (e) => {
    mapContainer.scrollLeft -= e.deltaX;
    mapContainer.scrollTop -= e.deltaY;
  }
});
```

## ✨ 주요 개선점

1. **직관적인 조작**: 지도 앱처럼 자연스러운 드래그
2. **관성 스크롤**: 빠르게 드래그하면 슝~ 이동
3. **깔끔한 UI**: 스크롤바 없이 넓은 화면 활용
4. **모바일 최적화**: 터치 이벤트 완벽 지원
5. **클릭 안전**: 드래그와 클릭 명확히 구분

## 🔧 향후 확장 가능성

- 핀치 줌 (두 손가락으로 확대/축소)
- 더블탭 줌 (빠른 확대)
- 경계 반동 효과 (iOS 스타일)
- 드래그 방향 잠금 (가로/세로만)
- 스냅 포인트 (특정 위치로 자동 정렬)
