# 상태 이상 시각화 시스템

## 개요

음식 enemy의 상태 이상을 HP 바와 아이콘으로 시각적으로 표시하는 시스템입니다.

## 시각화 구성 요소

### 1. HP 바 색상 변경 (HPBarRenderer)

HP 바의 전경 색상이 상태 이상에 따라 자동으로 변경됩니다.

#### 기본 색상
- **빨간색** `rgb(255, 76, 76)`: 기본 상태 (상태 이상 없음)

#### 상태 이상별 색상 (우선순위 순)

| 우선순위 | 상태 이상 | 색상 | RGB | 설명 |
|---------|----------|------|-----|------|
| 1 | `corrode` (산성 부식) | 초록색 | `rgb(76, 255, 76)` | 소화 저항 감소 |
| 2 | `shock` (연동 교란) | 노란색 | `rgb(255, 255, 76)` | 이동 속도 감소 |
| 3 | `expose` (점막 취약) | 주황색 | `rgb(255, 153, 51)` | 소화 피해 증가 |
| 4 | `mark` (분해 표식) | 보라색 | `rgb(204, 76, 255)` | 치명 보정 증가 |
| 5 | `clustered` (정체 군집) | 하늘색 | `rgb(76, 204, 255)` | 군집 범위 증가 |
| 6 | `stun` (기절) | 회색 | `rgb(153, 153, 153)` | 행동 불가 |

**우선순위 규칙**: 여러 상태 이상이 동시에 적용되면 우선순위가 높은 색상이 표시됩니다.

### 2. 상태 이상 아이콘 (StatusEffectRenderer)

HP 바 위(8픽셀)에 작은 아이콘으로 표시됩니다.

#### 아이콘 구성

| 상태 이상 | 이모지 | 배경 색상 | 크기 |
|----------|--------|----------|------|
| `expose` (점막 취약) | 🎯 | 주황색 `#FF8C00` | 8px |
| `corrode` (산성 부식) | 🧪 | 초록색 `#32CD32` | 8px |
| `shock` (연동 교란) | ⚡ | 노란색 `#FFD700` | 8px |
| `mark` (분해 표식) | 🔴 | 빨간색 `#FF4500` | 8px |
| `clustered` (정체 군집) | 👥 | 보라색 `#9370DB` | 8px |
| `stun` (기절) | 😵 | 회색 `#808080` | 8px |
| `slow` (둔화) | 🐌 | 파란색 `#4682B4` | 8px |

**표시 규칙**:
- 중복 제거: 같은 타입은 하나만 표시
- 가로 정렬: 10픽셀 간격으로 나열
- 만료 확인: 지속 시간이 지난 효과는 자동 숨김

## 렌더링 순서

```
1. WebGL: Background, paths, tower slots
2. WebGL: HP bars (배경 + 전경)
   └─ 전경 색상: 상태 이상에 따라 자동 변경
3. WebGL: Bullets
4. WebGL: Particles
5. Canvas 2D: Status effect icons
6. Canvas 2D: Food emojis
7. Canvas 2D: Tower emojis
```

## 코드 구조

### HPBarRenderer.js

```javascript
/**
 * HP 바 색상을 결정합니다.
 * 기본: 빨간색
 * 상태 이상에 따라 색상 변경
 */
_getBarColor(food, hpPercent) {
  // 기본: 빨간색
  const defaultColor = [1.0, 0.3, 0.3, 1.0];

  // 상태 이상 확인 후 우선순위에 따라 색상 반환
  const activeEffects = this._getActiveStatusEffects(food.statusEffects);
  for (const effect of activeEffects) {
    switch (effect.type) {
      case 'corrode': return [0.3, 1.0, 0.3, 1.0]; // 초록
      case 'shock': return [1.0, 1.0, 0.3, 1.0];   // 노랑
      case 'expose': return [1.0, 0.6, 0.2, 1.0];  // 주황
      // ...
    }
  }

  return defaultColor;
}
```

### StatusEffectRenderer.js

```javascript
/**
 * 상태 이상 아이콘을 렌더링합니다.
 */
render(foods, multiPathSystem, currentTime) {
  for (const food of foods) {
    // 활성 상태 이상 필터링
    const activeEffects = this._getActiveEffects(food.statusEffects, currentTime);

    // 중복 제거
    const uniqueEffects = this._getUniqueEffects(activeEffects);

    // 아이콘 렌더링 (HP 바 위 8픽셀)
    this._renderStatusIcons(x, y - 8, uniqueEffects);
  }
}
```

## 상태 이상 적용 예시

### 타워에서 상태 이상 부여

```javascript
// AcidRailTower.js - Node 5 (단백질 가수분해 탄)
new TagBonusModule({
  tagBonuses: { protein: 1.25 },
  tagEffects: {
    protein: {
      type: 'corrode',  // 산성 부식 상태
      value: 10,
      duration: 3
    }
  }
})
```

### Food 객체에 상태 이상 저장

```javascript
food.statusEffects = [
  {
    type: 'corrode',
    value: 10,
    duration: 3,
    appliedTime: Date.now()
  }
]
```

### 시각화 결과

1. **HP 바**: 초록색으로 변경 (corrode)
2. **아이콘**: HP 바 위에 🧪 초록색 점 표시
3. **지속 시간**: 3초 후 자동으로 사라짐

## 확장 방법

### 새로운 상태 이상 추가

1. **StatusModule.js**에 새 타입 추가
2. **HPBarRenderer.js** `_getBarColor()`에 색상 추가
3. **StatusEffectRenderer.js** `statusIcons`에 아이콘 추가

```javascript
// 1. StatusModule.js (이미 지원됨)
this.statusType = 'burning'; // 새로운 타입

// 2. HPBarRenderer.js
case 'burning':
  return [1.0, 0.5, 0.0, 1.0]; // 주황색

// 3. StatusEffectRenderer.js
this.statusIcons = {
  burning: { emoji: '🔥', color: '#FF4500', label: '화상' }
};
```

## 성능 최적화

- **HP 바**: WebGL2 Instanced Rendering (200개까지 2 draw calls)
- **아이콘**: Canvas 2D (활성 효과만 렌더링)
- **만료 확인**: 1초마다 필터링 (Date.now() 비교)

## 문서 기준 (tower-attack-fun-types-2026.md)

문서에 정의된 5가지 핵심 상태 이상:

| 태그 | 테마 이름 | 효과 | 상한 | HP 바 색상 |
|------|----------|------|------|-----------|
| `expose` | 점막 취약 노출 | 소화 피해 +8% | 최대 3중첩, +24% | 주황색 |
| `corrode` | 산성 부식 상태 | 소화 저항 -6% | 최대 2중첩 | 초록색 |
| `shock` | 연동 교란 자극 | 이동 속도 -10% | 감속 합산 캡 -35% | 노란색 |
| `mark` | 분해 표식 | 치명 보정 +8%p | 고위협 대상 +5%p | 보라색 |
| `clustered` | 정체 군집 상태 | 군집 범위 +10% | 반경 합산 캡 +25% | 하늘색 |

## 디버깅

브라우저 콘솔에서 상태 이상 확인:

```javascript
// 현재 활성 음식의 상태 이상 확인
const foods = gameLoop.multiPathSystem.getObjects();
foods[0].statusEffects.forEach(effect => {
  console.log(effect.type, 'remaining:', effect.duration - (Date.now() - effect.appliedTime) / 1000);
});
```
