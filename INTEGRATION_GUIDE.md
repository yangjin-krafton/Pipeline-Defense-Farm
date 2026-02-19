# WebGL2 렌더링 시스템 통합 가이드

이 문서는 총알, 파티클, HP bar를 위한 WebGL2 instanced rendering 시스템을 기존 게임에 통합하는 방법을 설명합니다.

## 📁 생성된 새 파일들

### 렌더러 (src/js/renderer/)
- ✅ `InstancedRenderer.js` - Instanced rendering 베이스 클래스
- ✅ `BulletRenderer.js` - 총알 렌더러
- ✅ `HPBarRenderer.js` - HP bar 렌더러
- ✅ `ParticleRenderer.js` - 파티클 렌더러

### 시스템 (src/js/digestion/)
- ✅ `core/Bullet.js` - 총알 클래스
- ✅ `systems/BulletSystem.js` - 총알 관리 시스템
- ✅ `systems/ParticleSystem.js` - 파티클 관리 시스템

## 🔧 수정이 필요한 기존 파일들

### 1. BaseTower.js (src/js/digestion/core/BaseTower.js)

**변경 사항:**
- Constructor에 `bulletSystem`과 `particleSystem` 파라미터 추가
- `attack()` 메서드에서 즉시 데미지 대신 총알 발사
- 타워 타입별 총알 색상 반환 메서드 추가

**수정 코드:**

```javascript
// Constructor 수정
constructor(slotData, definition, bulletSystem = null, particleSystem = null) {
  // ... 기존 코드 ...

  // 추가: Systems (injected)
  this.bulletSystem = bulletSystem;
  this.particleSystem = particleSystem;
}

// attack() 메서드 수정
attack(food) {
  const efficiency = EFFICIENCY_MULTIPLIERS[this.efficiencyState];
  let damage = this.damage * efficiency;

  // Tag bonuses
  if (food.tags) {
    for (const tag of food.tags) {
      if (this.tagBonuses[tag]) {
        damage *= this.tagBonuses[tag];
        break;
      }
    }
  }

  // Apply armor reduction
  const armorMitigation = Math.max(0, 1 - (food.armor * 0.01));
  damage *= armorMitigation;

  // Fire bullet instead of instant damage
  if (this.bulletSystem) {
    const bulletColor = this.getTowerBulletColor();
    this.bulletSystem.createBullet(
      this.x,
      this.y,
      food,
      damage,
      bulletColor,
      300, // speed
      5,   // size
      true // homing
    );

    // Emit attack particle effect
    if (this.particleSystem) {
      this.particleSystem.emitTowerAttackEffect(this.x, this.y, bulletColor);
    }
  } else {
    // Fallback: instant damage (backwards compatibility)
    food.hp -= damage;
  }
}

// 새 메서드 추가
getTowerBulletColor() {
  switch (this.type) {
    case 'enzyme':
      return [0.2, 1.0, 0.2, 1.0]; // Green
    case 'acid':
      return [1.0, 0.5, 0.0, 1.0]; // Orange
    case 'bile':
      return [1.0, 1.0, 0.2, 1.0]; // Yellow
    default:
      return [1.0, 1.0, 1.0, 1.0]; // White
  }
}
```

---

### 2. TowerManager.js (src/js/digestion/systems/TowerManager.js)

**변경 사항:**
- 시스템 주입 메서드 추가
- `buildTower()`에서 타워 생성 시 시스템 전달

**수정 코드:**

```javascript
export class TowerManager {
  constructor() {
    this.towers = [];
    this.towersBySlot = new Map();

    // 추가: Systems
    this.bulletSystem = null;
    this.particleSystem = null;
  }

  // 새 메서드 추가
  setBulletSystem(bulletSystem) {
    this.bulletSystem = bulletSystem;
  }

  setParticleSystem(particleSystem) {
    this.particleSystem = particleSystem;
  }

  // buildTower() 메서드 수정
  buildTower(towerType, slotData) {
    const definition = TOWER_DEFINITIONS[towerType];
    if (!definition) {
      console.error(`Tower type ${towerType} not found`);
      return null;
    }

    const TowerClass = TOWER_CLASSES[towerType];

    // 수정: 시스템을 타워에 전달
    const tower = new TowerClass(
      slotData,
      definition,
      this.bulletSystem,
      this.particleSystem
    );

    this.towers.push(tower);
    const slotKey = `${slotData.x}_${slotData.y}`;
    this.towersBySlot.set(slotKey, tower);

    console.log(`Built ${towerType} tower at (${slotData.x}, ${slotData.y})`);
    return tower;
  }

  // ... 나머지 코드는 동일 ...
}
```

---

### 3. GameLoop.js (src/js/game/GameLoop.js)

**변경 사항:**
- 새로운 시스템과 렌더러 import
- Constructor에서 시스템 초기화 및 연결
- update()에서 총알과 파티클 업데이트
- 새로운 렌더링 메서드들 추가
- frame()에서 렌더링 순서 조정

**수정 코드:**

```javascript
// Imports 추가
import { BulletSystem } from '../digestion/systems/BulletSystem.js';
import { ParticleSystem } from '../digestion/systems/ParticleSystem.js';
import { BulletRenderer } from '../renderer/BulletRenderer.js';
import { HPBarRenderer } from '../renderer/HPBarRenderer.js';
import { ParticleRenderer } from '../renderer/ParticleRenderer.js';

export class GameLoop {
  constructor(multiPathSystem, webglRenderer, emojiRenderer, staticMeshes, flowSystem, audioSystem) {
    // ... 기존 코드 ...

    // 추가: Initialize bullet and particle systems
    this.bulletSystem = new BulletSystem();
    this.particleSystem = new ParticleSystem();

    // Connect systems
    this.bulletSystem.setParticleSystem(this.particleSystem);
    this.towerManager.setBulletSystem(this.bulletSystem);
    this.towerManager.setParticleSystem(this.particleSystem);

    // 추가: Initialize WebGL2 renderers
    const gl = webglRenderer.gl;
    this.bulletRenderer = new BulletRenderer(gl, 500, [360, 640]);
    this.hpBarRenderer = new HPBarRenderer(gl, 200, [360, 640]);
    this.particleRenderer = new ParticleRenderer(gl, 2000, [360, 640]);

    this.currentTime = 0;
  }

  // update() 메서드 수정
  update(dt) {
    // ... 기존 타워 업데이트 후 ...

    // 추가: Update bullet system
    this.bulletSystem.update(dt, this.multiPathSystem);

    // 추가: Update particle system
    this.particleSystem.update(dt);

    // ... 나머지 코드는 동일 ...
  }

  // 새 메서드 추가
  drawHPBars() {
    const foods = this.multiPathSystem.getObjects();
    if (foods.length > 0) {
      this.hpBarRenderer.update(foods, this.multiPathSystem);
    }
  }

  drawBullets() {
    const bullets = this.bulletSystem.getBullets();
    if (bullets.length > 0) {
      this.bulletRenderer.update(bullets);
    }
  }

  drawParticles() {
    const particles = this.particleSystem.getParticles();
    if (particles.length > 0) {
      this.particleRenderer.update(particles);
    }
  }

  // _processFoodDeaths() 메서드에 파티클 효과 추가
  _processFoodDeaths() {
    // ... 기존 코드 ...

    // Reward player and emit death effects
    for (const food of deadFood) {
      const reward = this.economySystem.earnFromFood(food, food.currentPath);
      this.score += reward;
      this.scoreDirty = true;
      console.log(`Food ${food.emoji} digested in ${food.currentPath}`);

      // 추가: Emit death particle effect
      const pos = this.multiPathSystem.samplePath(food.currentPath, food.d);
      if (pos) {
        // Color based on food tags
        let color = [1.0, 1.0, 0.2, 1.0]; // Default yellow
        if (food.tags?.includes('carb')) {
          color = [1.0, 1.0, 0.2, 1.0]; // Yellow
        } else if (food.tags?.includes('protein')) {
          color = [1.0, 0.2, 0.2, 1.0]; // Red
        } else if (food.tags?.includes('fat')) {
          color = [1.0, 0.5, 0.0, 1.0]; // Orange
        }

        this.particleSystem.emitDeathEffect(pos.x, pos.y, color);
      }
    }
  }

  // frame() 메서드 수정 - 렌더링 순서 조정
  frame(now) {
    if (!this.isRunning) return;

    if (!this.lastTime) this.lastTime = now;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.update(dt);

    // Rendering order (back to front):
    // 1. WebGL: Background, paths, tower slots
    this.drawPath();

    // 2. WebGL: HP bars (below food)
    this.drawHPBars();

    // 3. WebGL: Bullets
    this.drawBullets();

    // 4. WebGL: Particles (semi-transparent)
    this.drawParticles();

    // 5. Canvas 2D: Food emojis and tower emojis (on top)
    this.drawEmojis();

    requestAnimationFrame((t) => this.frame(t));
  }

  // Getter 메서드 추가
  getBulletSystem() {
    return this.bulletSystem;
  }

  getParticleSystem() {
    return this.particleSystem;
  }
}
```

---

## 🎮 통합 후 테스트 방법

### 1. 게임 시작
```bash
# 개발 서버 실행
npm run dev
```

### 2. 확인 사항
- ✅ 타워가 총알을 발사하는지 확인
- ✅ 총알이 음식을 추적하는지 확인
- ✅ 음식 위에 HP bar가 표시되는지 확인
- ✅ HP bar 색상이 HP에 따라 변하는지 확인 (초록 → 노랑 → 빨강)
- ✅ 총알 충돌 시 파티클 효과 발생 확인
- ✅ 음식 사망 시 폭발 효과 확인
- ✅ 타워 공격 시 작은 파티클 효과 확인
- ✅ 타워 타입별 총알 색상 확인:
  - 효소 (enzyme): 초록색
  - 위산 (acid): 주황색
  - 담즙 (bile): 노란색

### 3. 성능 확인
- 개발자 도구(F12) → Console에서 FPS 확인
- gameLoop.getFPS() 호출하여 프레임레이트 확인
- 목표: 60 FPS 유지

### 4. 디버깅
브라우저 콘솔에서 다음 명령어로 상태 확인:
```javascript
// 총알 개수 확인
gameLoop.getBulletSystem().getCount()

// 파티클 개수 확인
gameLoop.getParticleSystem().getCount()

// 타워 목록 확인
gameLoop.getTowerManager().getAllTowers()
```

---

## 🔍 트러블슈팅

### 문제: 총알이 발사되지 않음
**해결:**
- BaseTower.js의 `bulletSystem`이 null이 아닌지 확인
- TowerManager에서 시스템을 올바르게 주입했는지 확인
- GameLoop에서 시스템 연결 코드 확인

### 문제: HP bar가 보이지 않음
**해결:**
- WebGL context가 올바르게 전달되었는지 확인
- 렌더링 순서 확인 (drawPath() 이후에 drawHPBars() 호출)
- 음식 객체에 `hp`와 `maxHp` 속성이 있는지 확인

### 문제: 파티클이 보이지 않음
**해결:**
- ParticleSystem.emit()이 올바르게 호출되는지 확인
- 파티클 lifetime 확인 (너무 짧으면 보이지 않음)
- drawParticles()가 호출되는지 확인

### 문제: 셰이더 컴파일 오류
**해결:**
- 브라우저 콘솔에서 오류 메시지 확인
- WebGL2 지원 브라우저 사용 확인
- InstancedRenderer.js의 셰이더 코드 확인

---

## 📊 성능 최적화 체크리스트

### Instancing 활용 확인
- [ ] 100개 총알을 1개 드로우콜로 렌더링
- [ ] 1000개 파티클을 1개 드로우콜로 렌더링
- [ ] 100개 HP bar를 2개 드로우콜로 렌더링 (배경+전경)

### 메모리 관리
- [ ] 총알/파티클 풀 재사용 (현재는 동적 생성, 추후 개선 가능)
- [ ] 죽은 파티클 즉시 제거
- [ ] 화면 밖 총알 제거

### 추후 최적화 가능 항목
1. **Frustum Culling**: 화면 밖 객체 렌더링 생략
2. **Object Pooling**: 총알/파티클 객체 재사용
3. **LOD**: 거리에 따라 파티클 품질 조정
4. **Z-Sorting**: 투명도 렌더링 최적화

---

## 🎨 커스터마이징 가이드

### 총알 외형 변경
**BulletRenderer.js** - `_createBulletMesh()` 수정:
```javascript
// 원형 대신 삼각형으로 변경
_createBulletMesh(3) // 3개 삼각형
```

### 파티클 효과 조정
**ParticleSystem.js** - `emit()` 파라미터 조정:
```javascript
this.emit(x, y, count, color, speed, lifetime, {
  spread: Math.PI * 2,    // 방사 각도 (0 ~ 2π)
  gravity: 200,           // 중력 (높을수록 빨리 떨어짐)
  sizeMin: 2,             // 최소 크기
  sizeMax: 6,             // 최대 크기
  fadeOut: true,          // 페이드 아웃 여부
  colorVariation: 0.2     // 색상 변화량
});
```

### HP Bar 스타일 변경
**HPBarRenderer.js** - `update()` 메서드:
```javascript
const barWidth = 30;  // HP bar 폭
const barHeight = 4;  // HP bar 높이
const yOffset = -15;  // 음식 위로 거리
```

---

## 🚀 다음 단계 제안

### Phase 2 기능 추가
1. **총알 트레일 효과**: 총알 뒤에 잔상 추가
2. **데미지 숫자 표시**: 피격 시 데미지 텍스트 띄우기
3. **스크린 쉐이크**: 큰 폭발 시 화면 흔들림
4. **음식별 특수 효과**: 보스 음식, 특수 음식 시각 효과

### Phase 3 고급 기능
1. **GPU Particle System**: Transform Feedback 사용
2. **Post-Processing**: Bloom, Motion Blur 효과
3. **Dynamic Lighting**: 총알/폭발 시 조명 효과
4. **Texture Support**: 텍스처 기반 파티클

---

## 📝 코드 구조 요약

```
Pipeline-Defense-Farm/
├── src/js/
│   ├── renderer/
│   │   ├── InstancedRenderer.js      ← 신규 (베이스 클래스)
│   │   ├── BulletRenderer.js         ← 신규
│   │   ├── HPBarRenderer.js          ← 신규
│   │   └── ParticleRenderer.js       ← 신규
│   │
│   ├── digestion/
│   │   ├── core/
│   │   │   ├── Bullet.js             ← 신규
│   │   │   └── BaseTower.js          ← 수정 필요
│   │   │
│   │   └── systems/
│   │       ├── BulletSystem.js       ← 신규
│   │       ├── ParticleSystem.js     ← 신규
│   │       └── TowerManager.js       ← 수정 필요
│   │
│   └── game/
│       └── GameLoop.js               ← 수정 필요
│
└── INTEGRATION_GUIDE.md              ← 이 파일
```

---

## ✅ 체크리스트

통합 완료 후 아래 항목들을 체크하세요:

- [ ] 모든 새 파일이 생성되었는지 확인
- [ ] BaseTower.js 수정 완료
- [ ] TowerManager.js 수정 완료
- [ ] GameLoop.js 수정 완료
- [ ] 게임 시작 및 타워 배치 테스트
- [ ] 총알 발사 확인
- [ ] HP bar 표시 확인
- [ ] 파티클 효과 확인
- [ ] 성능 테스트 (60 FPS)
- [ ] 콘솔에 에러 없는지 확인

---

**통합 작업 화이팅! 🎉**

문제가 발생하면 브라우저 콘솔의 에러 메시지를 먼저 확인하세요.
