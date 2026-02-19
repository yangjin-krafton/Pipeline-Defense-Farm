# 타워 모듈 개발 구조 제안

이 문서는 `BaseTower`를 공통 부모로 두고, 타워 타입별로 오버라이드하여 확장하는 구조를 정의한다.
목표는 다음 3가지다.

- 타입별 로직 분리(공격, 타겟팅, 스킬)
- 데이터 중심 밸런싱(스탯 테이블 분리)
- 런타임 조립(팩토리/레지스트리 기반)

## 1) 핵심 아키텍처

- `BaseTower`:
공통 생명주기와 상태를 담당한다. (`tick`, `acquireTarget`, `canFire`, `fire`, `upgrade`, `sell`)
- `TowerTypeClass`:
`BaseTower`를 상속하고 필요한 메서드를 오버라이드한다.
- `TowerDefinition`:
타워 스탯/비용/사거리/업그레이드 데이터. 코드가 아니라 데이터로 관리한다.
- `TowerFactory`:
`towerType + level + position`으로 실제 타워 인스턴스를 생성한다.
- `TowerRegistry`:
타워 타입 문자열과 클래스/정의를 등록한다.

## 2) 제안 폴더 구조

```text
src/js/
  towers/
    base/
      BaseTower.js
      TargetingPolicy.js
      AttackResolver.js
    types/
      EnzymeTower.js
      AcidTower.js
      BileTower.js
      ProbioticTower.js
      PeristalsisTower.js
      AbsorptionTower.js
      CannonTower.js
      SniperTower.js
      SplashTower.js
      SlowTower.js
      PoisonTower.js
      SupportTower.js
    data/
      towerDefinitions.js
      upgradeCurves.js
      statusEffects.js
    systems/
      TowerManager.js
      TowerFactory.js
      TowerRegistry.js
```

## 3) BaseTower 계약(권장 인터페이스)

```js
export class BaseTower {
  constructor({ id, type, position, level, stats, targeting = 'first' }) {}

  tick(dt, context) {}
  acquireTarget(enemies, context) {}
  canFire(now) {}
  fire(target, context) {}

  // Optional hooks for child towers
  onHit(target, context) {}
  onKill(target, context) {}
  onWaveStart(context) {}

  upgrade(nextLevelDef) {}
  getSellValue() {}
}
```

`context`에는 최소한 아래를 포함한다.

- `now`: 현재 시간
- `enemies`: 활성 적 목록
- `projectileSystem`: 투사체 생성 시스템
- `statusSystem`: 상태이상 적용 시스템
- `economySystem`: 골드/리워드 시스템

## 4) 오버라이드 가이드

타워별로 아래 중 필요한 메서드만 오버라이드한다.

- 단일 딜러: `fire()`
- 범위 딜러: `fire()`, `onHit()`
- 디버프형: `onHit()`
- 버퍼형: `tick()` 또는 `onWaveStart()`

규칙:

- 공통 쿨다운/타겟팅/업그레이드 계산은 `BaseTower`에 유지
- 타입 특화 수치/효과만 자식 클래스에 둔다
- 레벨별 수치는 클래스 하드코딩 금지, `towerDefinitions.js`에서 로드

## 5) 데이터 스키마 예시

```js
export const TOWER_DEFS = {
  enzyme: {
    className: 'EnzymeTower',
    role: 'single_dps',
    cost: 100,
    upgradeCost: [80, 120, 180],
    base: {
      damage: 16,
      cooldownMs: 900,
      range: 110,
      projectileSpeed: 260
    },
    scaling: {
      damage: [1.0, 1.35, 1.8, 2.4],
      cooldown: [1.0, 0.93, 0.86, 0.8],
      range: [1.0, 1.05, 1.1, 1.15]
    },
    effects: []
  }
};
```

## 6) 런타임 흐름

1. 맵 로딩 시 `TowerRegistry`에 타입 등록
2. 플레이어가 슬롯 클릭 후 타워 타입 선택
3. `TowerFactory.create(type, slot)` 호출
4. `TowerManager`가 타워를 업데이트 루프에 포함
5. 각 타워는 `tick(dt, context)`에서 타겟 획득/발사 처리

## 7) 실제 타워디펜스에서 자주 쓰는 타워 타입 제안

아래는 장르에서 반복적으로 검증된 타입들이다.

1. 기본 포탑(Single Target / Cannon)
2. 스나이퍼(Long Range / High Damage)
3. 연사형(Gatling / Rapid Fire)
4. 범위 공격형(Splash / Bomb / Mortar)
5. 관통형(Pierce / Line Shot)
6. 슬로우형(Freeze / Glue / Web)
7. 독/도트형(Poison / Burn / Bleed)
8. 체인 번개형(Chain Lightning)
9. 디버프 오라형(Armor Break / Vulnerability)
10. 버프 오라형(Attack Speed Buff / Damage Buff)
11. 소환형(Summoner / Drone / Minion)
12. 수익형(Economy / Farm / Interest)
13. 유틸형(Detection / Reveal Camo)
14. 보스 특화형(Execute / %HP Damage)
15. 군중 제어형(Stun / Knockback / Pull)

## 8) 현재 프로젝트 테마 매핑 예시

`Pipeline Defense Farm` 테마로는 아래 매핑이 자연스럽다.

- Enzyme: 기본 단일딜
- Acid: 방어력 감소 + 지속 피해
- Bile: 광역 처리 + 지방 계열 추가 계수
- Probiotic: 아군 버프/디버프 저항
- Peristalsis: 밀어내기/이동 제어
- Absorption: 처치 시 자원 보너스

## 9) 적용 순서(권장)

1. `BaseTower`, `TowerRegistry`, `TowerFactory` 골격 구현
2. `towerDefinitions.js`로 스탯 분리
3. MVP 타워 3종(Enzyme/Acid/Bile) 구현
4. `TowerManager`를 게임 루프에 연결
5. UI(`tower-card`)와 타입 선택/배치 연동
6. 상태이상 시스템(슬로우/독/방깎) 확장

## 10) 구현 체크리스트

- 타워 클래스에 하드코딩 수치가 남아있지 않은가?
- 타겟팅 정책 변경이 클래스 수정 없이 가능한가?
- 새 타워 타입 추가 시 수정 파일이 3개 이하인가?
- 레벨/업그레이드 밸런싱이 데이터 수정만으로 가능한가?
- 테스트에서 `tick -> target -> fire -> effect` 순서를 검증하는가?
