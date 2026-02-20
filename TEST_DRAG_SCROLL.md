# 드래그 스크롤 테스트 가이드

## 🧪 테스트 방법

### 1. 데스크톱 (마우스)
```
1. 타워를 클릭하여 업그레이드 트리 열기
2. 업그레이드 트리 스크롤 영역에 마우스 올리기
   → 커서가 'grab'으로 변경되는지 확인
3. 드래그 시작 (마우스 다운)
   → 커서가 'grabbing'으로 변경되는지 확인
4. 드래그하며 이동
   → 스크롤이 드래그 방향 반대로 이동하는지 확인
5. 빠르게 드래그하고 놓기
   → 관성으로 계속 이동하는지 확인
6. 노드 카드 빠르게 클릭
   → 클릭이 정상 작동하는지 확인
7. 노드 카드 위에서 드래그
   → 스크롤이 이동하고 노드가 클릭되지 않는지 확인
```

### 2. 모바일 (터치)
```
1. 타워를 탭하여 업그레이드 트리 열기
2. 업그레이드 트리 영역을 손가락으로 드래그
   → 부드럽게 스크롤되는지 확인
3. 빠르게 스와이프
   → 관성으로 계속 이동하는지 확인
4. 노드 카드 빠르게 탭
   → 클릭이 정상 작동하는지 확인
5. 노드 카드에서 드래그 시작
   → 스크롤이 이동하고 노드가 활성화되지 않는지 확인
```

## ✅ 확인 항목

### 시각적 피드백
- [ ] 커서 변화 (grab ↔ grabbing)
- [ ] 노드 호버 효과 (데스크톱)
- [ ] 노드 눌림 효과
- [ ] 관성 스크롤 부드러움

### 기능적 테스트
- [ ] 가로 스크롤 작동
- [ ] 세로 스크롤 작동 (노드가 많을 때)
- [ ] 관성 스크롤 작동
- [ ] 노드 클릭 작동
- [ ] 드래그 중 노드 클릭 안됨
- [ ] 스크롤바 숨김

### 성능 테스트
- [ ] 60fps 유지 (관성 스크롤 중)
- [ ] 부드러운 드래그 (끊김 없음)
- [ ] 터치 응답성 (지연 없음)

## 🐛 알려진 이슈 및 해결

### 이슈 1: 노드 클릭이 안됨
**원인**: 드래그로 인식됨
**해결**: touchMoved 플래그 확인, 300ms 이내 탭만 클릭으로 인정

### 이슈 2: 드래그 중 노드가 활성화됨
**원인**: 클릭 이벤트가 발생함
**해결**: touchMoved = true일 때 클릭 무시

### 이슈 3: 스크롤이 끊김
**원인**: 이벤트 핸들러가 무거움
**해결**: RAF 사용, passive 이벤트

### 이슈 4: iOS에서 스크롤이 느림
**원인**: -webkit-overflow-scrolling 미설정
**해결**: CSS에 -webkit-overflow-scrolling: touch 추가

## 🔧 디버깅 팁

### 콘솔 로그 추가
```javascript
// DragManager.js
_handleStart(e) {
  console.log('Drag Start:', e.target);
  // ...
}

_handleDrag(e) {
  console.log('Dragging:', e.deltaX, e.deltaY);
  // ...
}
```

### 드래그 영역 시각화
```javascript
// 드래그 가능 영역에 테두리 추가
element.style.outline = '2px dashed red';
```

### 터치 이벤트 로깅
```javascript
element.addEventListener('touchstart', (e) => {
  console.log('Touch Start:', e.touches[0]);
}, { passive: true });
```

## 📊 성능 측정

### Chrome DevTools
```
1. Performance 탭 열기
2. 녹화 시작
3. 드래그 스크롤 수행
4. 녹화 중지
5. FPS 그래프 확인 (60fps 유지되어야 함)
```

### FPS 카운터
```javascript
let lastTime = performance.now();
let frames = 0;

function measureFPS() {
  frames++;
  const now = performance.now();
  if (now >= lastTime + 1000) {
    console.log(`FPS: ${frames}`);
    frames = 0;
    lastTime = now;
  }
  requestAnimationFrame(measureFPS);
}

measureFPS();
```

## 🎯 테스트 시나리오

### 시나리오 1: 기본 드래그
1. 스크롤 영역 중앙에서 드래그 시작
2. 좌우로 100px 이동
3. 놓기
4. 결과: 스크롤이 반대 방향으로 100px 이동

### 시나리오 2: 관성 스크롤
1. 빠르게 스와이프 (속도 > 100px/s)
2. 놓기
3. 결과: 관성으로 계속 이동, 점점 감속

### 시나리오 3: 노드 클릭
1. 노드 카드 빠르게 탭 (< 300ms)
2. 드래그 없음 (touchMoved = false)
3. 결과: 노드 활성화, 잉크 스플래시 효과

### 시나리오 4: 혼합 조작
1. 드래그 시작
2. 노드 카드 위에서 드래그 계속
3. 놓기
4. 결과: 스크롤만 이동, 노드 활성화 안됨

## 📱 디바이스별 테스트

### Android
- Chrome
- Samsung Internet
- Firefox

### iOS
- Safari
- Chrome (WebKit)

### 데스크톱
- Chrome
- Firefox
- Safari
- Edge

## 🚀 최적화 체크리스트

- [ ] passive 이벤트 사용
- [ ] RAF로 스크롤 애니메이션
- [ ] will-change CSS 속성
- [ ] transform 대신 scrollLeft/Top 직접 조작
- [ ] 이벤트 디바운싱/쓰로틀링 불필요 (네이티브 성능)
