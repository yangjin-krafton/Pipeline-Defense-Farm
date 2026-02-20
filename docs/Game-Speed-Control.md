# 게임 속도 조절 기능 (Game Speed Control)

타워 디펜스 게임의 게임 속도 조절 기능 및 타워 선택 시 자동 슬로우 모션 기능 구현 문서

## 기능 개요

### 1. 수동 속도 조절 (1x, 2x, 3x)
- 상단 상태바에 속도 조절 버튼 추가
- 클릭으로 게임 속도를 1배속, 2배속, 3배속으로 변경
- 현재 속도는 버튼 활성화 상태로 표시

### 2. 자동 슬로우 모션 (0.5x)
- 타워 선택 창(bottom sheet)이 열리면 자동으로 **0.5배속**으로 감속
- 타워 정보를 천천히 확인하면서 전략을 세울 수 있음
- 창을 닫으면 이전 속도로 자동 복원

## 구현 상세

### GameLoop 변경사항

**src/js/game/GameLoop.js**

#### 추가된 속성
```javascript
this.timeScale = 1.0;                    // 현재 시간 배율
this.targetTimeScale = 1.0;              // 목표 시간 배율 (부드러운 전환용)
this.timeScaleTransitionSpeed = 5.0;    // 전환 속도
```

#### 시간 배율 적용
- 모든 `update()` 함수에서 `dt * timeScale` 적용
- 부드러운 전환을 위한 보간 로직 추가

#### 새로운 메서드
```javascript
setTimeScale(scale, instant = false)  // 속도 설정 (0.1x ~ 3x)
getTimeScale()                         // 현재 속도 반환
getTargetTimeScale()                   // 목표 속도 반환
```

### UI 변경사항

**src/index.html**

상단 상태바에 속도 조절 버튼 추가:
```html
<div class="controls-group">
  <div class="speed-controls">
    <button class="speed-btn active" data-speed="1">1x</button>
    <button class="speed-btn" data-speed="2">2x</button>
    <button class="speed-btn" data-speed="3">3x</button>
  </div>
  <div class="music-controls">
    <button class="music-btn" id="musicToggle">⏸️</button>
  </div>
</div>
```

**src/styles/components/status-bar.css**

#### 속도 버튼 스타일
- `.speed-controls` - 버튼 그룹 컨테이너
- `.speed-btn` - 개별 속도 버튼
- `.speed-btn.active` - 활성화된 버튼 (청록색)
- `.speed-btn.slow-motion` - 슬로우 모션 표시 (분홍색, 펄스 애니메이션)

### UIController 변경사항

**src/js/ui/UIController.js**

#### 추가된 속성
```javascript
this.previousTimeScale = 1.0;  // 슬로우 모션 전 속도 저장
```

#### 새로운 메서드

**setupSpeedControls()**
- 속도 버튼 클릭 이벤트 핸들러 등록
- bottom sheet가 열려있을 때는 수동 속도 변경 불가

**updateSpeedButtonDisplay(speed)**
- 속도 버튼의 활성화 상태 업데이트
- 슬로우 모션(0.5x) 시 특별한 표시

#### 수정된 메서드

**openSheet()**
- 타워 선택 창이 열릴 때 자동으로 0.5배속으로 변경
- 이전 속도를 저장

**closeSheet()**
- 타워 선택 창이 닫힐 때 이전 속도로 복원

## 사용자 경험

### 속도 조절 흐름

1. **게임 시작** → 1배속 (normal)
2. **2x 버튼 클릭** → 게임이 2배속으로 빨라짐
3. **타워 클릭** → 자동으로 0.5배속 (슬로우 모션)
   - 버튼이 분홍색으로 변하고 "0.5x" 표시
   - 펄스 애니메이션으로 슬로우 모션 상태 강조
4. **타워 창 닫기** → 이전 속도(2배속)로 복원
5. **1x 버튼 클릭** → 정상 속도로 복귀

### 시각적 피드백

#### 정상 속도 버튼 (1x, 2x, 3x)
- **비활성화**: 흰색 배경
- **활성화**: 청록색 배경, 흰색 텍스트, 빛나는 효과
- **호버**: 노란색 배경, 확대 효과

#### 슬로우 모션 표시 (0.5x)
- **배경**: 분홍색 (Splatoon 스타일)
- **텍스트**: "0.5x" (1x 버튼이 변경됨)
- **애니메이션**: 펄스 효과로 눈에 띄게 표시

## 기술적 세부사항

### 시간 배율 보간

부드러운 전환을 위해 선형 보간 사용:
```javascript
if (this.timeScale !== this.targetTimeScale) {
  const diff = this.targetTimeScale - this.timeScale;
  const step = Math.sign(diff) * this.timeScaleTransitionSpeed * dt;
  if (Math.abs(diff) < Math.abs(step)) {
    this.timeScale = this.targetTimeScale;
  } else {
    this.timeScale += step;
  }
}
```

- `timeScaleTransitionSpeed = 5.0` → 약 0.2초 전환 시간
- 즉각적인 변경을 원하면 `setTimeScale(speed, instant=true)` 사용

### 시간 배율 범위

- **최소값**: 0.1x (10%)
- **최대값**: 3.0x (300%)
- **권장값**: 0.5x (슬로우), 1x (보통), 2x (빠름), 3x (매우 빠름)

### 적용 대상

모든 게임 시스템에 `scaledDt` 적용:
- 음식 생성 (FoodSpawner)
- 타워 공격 (TowerManager)
- 보급 시스템 (SupplySystem)
- 문제 시스템 (TroubleSystem)
- 총알 시스템 (BulletSystem)
- 파티클 시스템 (ParticleSystem)
- 경로 이동 (MultiPathSystem)

## 향후 개선 사항

- [ ] 0.25x 초슬로우 모션 지원
- [ ] 키보드 단축키 (1, 2, 3 키로 속도 변경)
- [ ] 일시정지 기능 (timeScale = 0)
- [ ] 속도 프리셋 저장 (사용자 설정)
- [ ] 속도 변경 사운드 효과
- [ ] 슬로우 모션 시 화면 효과 (색상 필터 등)

## 디버그

콘솔에서 테스트:
```javascript
// 속도 변경
gameLoop.setTimeScale(2.0);      // 2배속
gameLoop.setTimeScale(0.5);      // 슬로우 모션
gameLoop.setTimeScale(3.0);      // 3배속
gameLoop.setTimeScale(1.0);      // 정상 속도

// 즉각 변경 (보간 없이)
gameLoop.setTimeScale(2.0, true);

// 현재 속도 확인
console.log(gameLoop.getTimeScale());
console.log(gameLoop.getTargetTimeScale());
```

## 파일 변경 목록

### 수정된 파일
- `src/js/game/GameLoop.js` - timeScale 로직 추가
- `src/js/ui/UIController.js` - 속도 조절 및 자동 슬로우 모션
- `src/index.html` - 속도 버튼 UI 추가
- `src/styles/components/status-bar.css` - 버튼 스타일

### 새로운 파일
- `docs/Game-Speed-Control.md` - 이 문서

## 관련 이슈

- 타워 디펜스 게임 표준 기능
- 플레이어 경험 향상 (전략 수립 시간 확보)
- 접근성 개선 (느린 속도 선호 플레이어 지원)
