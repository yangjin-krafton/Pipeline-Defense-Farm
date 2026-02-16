# 🧬 Pipeline Defense Farm

> 2D Grid 기반
> 타워디펜스 + 방치형 농장 + 파이프라인 최적화 전략

---

## 🎮 Game Concept

**Pipeline Defense Farm**은
전통적인 타워 디펜스를 변형한 구조에
방치형 농장 시스템을 결합한 전략 게임입니다.

기존 TD와의 차이점:

* Enemy는 단순히 지나가는 존재가 아님
* 길이 막히면 정체되고 “쌓임”
* 유저는 **킬 효율 파이프라인을 설계**
* 오프라인 동안 일부 시스템은 자동 성장

---

## 🧩 Core Gameplay Loop

1. 2D Grid 맵 생성
2. Enemy 웨이브 생성 → 길 따라 이동
3. 유저는 길 외 영역에 타워 설치
4. Enemy는 도발(trigger) 전까지 대기 가능
5. 길이 막히면 적이 쌓이고 병목 발생
6. 유저는 효율적인 “처리 파이프라인” 설계
7. 농장 시스템으로 자원 생산
8. 오프라인 시간 보상 획득
9. 확장 / 업그레이드

---

## 🗺 Map Structure

* 2D Grid 기반
* Tile 종류:

  * Path Tile
  * Buildable Tile
  * Farm Tile
  * Special Tile (확장 예정)

맵은 정적 or Seed 기반 생성 가능.

---

## 👾 Enemy System

### 기본 특징

* Path 기반 이동
* 막히면 대기 (stack)
* 도발 조건 충족 시 이동 재개
* 밀집도 → 전략적 변수

### 전략 요소

* 병목 유도
* 광역 타워 효율 극대화
* 흐름 설계 = 핵심 플레이

---

## 🏗 Tower System

* Path 외 영역에 설치
* 단일 / 광역 / 지속 피해 등 타입 존재
* 공격 대상 우선순위 설정 가능

예:

* First
* Last
* Highest HP
* Most Clustered

---

## 🌾 Idle Farm System

### 목적

* 실시간 접속 중 자원 생산
* 오프라인 시간 보상 계산

### 구조

* 농장 건물 배치
* 생산량 = 시간 기반 계산
* 재접속 시:

  * (현재 시간 - 종료 시간) 계산
  * 생산 공식 적용
  * 보상 지급

게임 자체 시뮬레이션은 중지되며
일부 건물만 오프라인 계산 대상.

---

## 🧠 Design Philosophy

### 1. Pipeline Optimization > Reflex

이 게임은 반응 속도 게임이 아님.
**흐름 설계 게임**이다.

### 2. Stack Pressure Mechanics

Enemy가 쌓이면서

* 압력 증가
* 타워 효율 변화
* 보너스 / 페널티 발생 가능

### 3. LLM-Friendly Expandable Architecture

콘텐츠 확장이 매우 쉬운 구조를 목표로 한다.

---

# 🏗 Technical Architecture

## 📦 Engine

* WebGL2 기반
* 2D Grid Simulation
* Local-first 구조
* 서버 없이 실행 가능

---

## 🗃 Save System

* localStorage / IndexedDB
* Save Snapshot 구조
* 저장 항목:

  * Grid 상태
  * Enemy 상태
  * Building 상태
  * Resource
  * Timestamp

---

## 🧱 Core Code Structure

### Base Class Philosophy

모든 콘텐츠는 Base Class 기반.

```text
BaseEntity
 ├── BaseEnemy
 ├── BaseTower
 ├── BaseBuilding
```

### Example

#### BaseEnemy

```js
class BaseEnemy {
    constructor(config) {}
    update(deltaTime) {}
    takeDamage(amount) {}
    onDeath() {}
}
```

#### Custom Enemy

```js
class HeavyEnemy extends BaseEnemy {
    update(deltaTime) {
        super.update(deltaTime)
        // override logic
    }
}
```

---

## 🧩 Content Extension Strategy

* 모든 Enemy/Tower/Building은 데이터 기반 정의
* JSON + Class Override 혼합 방식
* LLM이 신규 콘텐츠 자동 생성 가능
* 핵심 엔진 수정 없이 확장 가능

---

# 📊 Core Systems Overview

| System                  | Real-time | Offline |
| ----------------------- | --------- | ------- |
| Enemy Movement          | ✅         | ❌       |
| Tower Attack            | ✅         | ❌       |
| Farm Production         | ✅         | ✅       |
| Passive Income Building | ❌         | ✅       |

---

# 🔥 Unique Selling Points

1. 적이 “흐르는” 것이 아니라 “쌓인다”
2. 병목 설계 중심 전략
3. 타워디펜스 + 방치형 농장 결합
4. 로컬 기반 오프라인 친화 구조
5. 확장성 높은 LLM 기반 콘텐츠 설계

---

# 🛣 Roadmap (Early)

### Phase 1

* Grid 시스템
* Pathfinding
* Enemy Stack Logic
* Basic Tower

### Phase 2

* Farm 시스템
* 오프라인 계산 로직
* Resource 시스템

### Phase 3

* 다양한 Enemy 타입
* 다양한 Tower 타입
* 압력 시스템
* UI 개선

---

# 🚀 Long-Term Vision

* Procedural Map
* Mutation Enemy
* Seasonal Event
* Meta Progression Tree
* Community Modding (JSON 기반)

---