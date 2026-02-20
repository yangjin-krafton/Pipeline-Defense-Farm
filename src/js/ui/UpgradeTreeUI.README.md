# UpgradeTreeUI 모듈

타워 업그레이드 트리를 동적으로 생성하고 관리하는 UI 모듈입니다.

## 특징

- 📊 **모듈화된 구조**: 타워 데이터와 UI를 분리
- 🎨 **Splatoon 스타일**: 게임의 전체 디자인과 일치
- ⚡ **동적 생성**: 데이터 기반으로 트리 구조 자동 생성
- 🔄 **실시간 업데이트**: 노드 및 연결선 상태 동적 변경 가능
- 🌳 **분기 지원**: 선형 및 분기형 트리 모두 지원

## 파일 구조

```
src/js/ui/
├── UpgradeTreeUI.js           # 메인 클래스
├── UpgradeTreeUI.example.js   # 사용 예제
└── UpgradeTreeUI.README.md    # 이 문서

src/styles/components/
└── upgrade-tree.css            # 스타일시트
```

## 기본 사용법

### 1. 모듈 임포트

```javascript
import { UpgradeTreeUI, createDefaultUpgradeTree } from './ui/UpgradeTreeUI.js';
```

### 2. 트리 데이터 생성

```javascript
// 기본 선형 트리 (최대 레벨 5, 현재 레벨 3)
const treeData = createDefaultUpgradeTree(5, 3);
```

### 3. UI 생성

```javascript
const container = document.querySelector('.action-section');

const upgradeTreeUI = new UpgradeTreeUI(
  container,
  treeData,
  (nodeData) => {
    // 노드 클릭 시 콜백
    console.log('Clicked:', nodeData);
  }
);
```

## 트리 데이터 구조

### 기본 구조

```javascript
{
  width: 600,      // 트리 전체 너비 (px)
  height: 160,     // 트리 전체 높이 (px)
  nodes: [         // 노드 배열
    {
      id: 'level_1',           // 고유 ID
      name: 'Lv 1',            // 표시 이름
      icon: '🧪',              // 아이콘 (이모지)
      x: 50,                   // X 좌표
      y: 80,                   // Y 좌표
      state: 'unlocked',       // 상태 (unlocked, current, available, locked)
      cost: '🍎 100'           // 비용 (optional)
    },
    // ... 더 많은 노드
  ],
  connections: [   // 연결선 배열
    {
      x1: 90,      // 시작 X
      y1: 100,     // 시작 Y
      x2: 150,     // 끝 X
      y2: 100,     // 끝 Y
      state: 'unlocked'  // 연결선 상태
    },
    // ... 더 많은 연결선
  ]
}
```

### 노드 상태 (state)

- **`unlocked`**: 이미 업그레이드 완료 (파란색, ✓ 표시)
- **`current`**: 현재 레벨 (금색, 반짝임 효과, ★ 표시)
- **`available`**: 업그레이드 가능 (빨간색, 클릭 가능)
- **`locked`**: 잠김 (회색, 클릭 불가)

## 템플릿 함수

### 1. `createDefaultUpgradeTree(maxLevel, currentLevel)`

기본 선형 업그레이드 트리 생성

```javascript
const treeData = createDefaultUpgradeTree(5, 3);
// 레벨 1-5까지의 선형 트리, 현재 레벨 3
```

### 2. `createBranchedUpgradeTree(config)`

분기형 업그레이드 트리 생성

```javascript
const treeData = createBranchedUpgradeTree({
  mainPath: 5,      // 메인 경로 레벨 수
  currentLevel: 3,  // 현재 레벨
  branches: [
    {
      id: 'speed_upgrade',
      name: '속도↑',
      icon: '⏱️',
      fromLevel: 4,  // 어느 레벨에서 분기할지
      offset: -40,   // Y축 오프셋 (음수 = 위, 양수 = 아래)
      state: 'available',
      cost: '⚡ 40'
    },
    {
      id: 'range_upgrade',
      name: '범위↑',
      icon: '📍',
      fromLevel: 4,
      offset: 40,
      state: 'locked',
      cost: '🍎 400'
    }
  ]
});
```

## 동적 업데이트

### 노드 업데이트

```javascript
// 특정 노드의 상태 변경
upgradeTreeUI.updateNode('level_4', {
  state: 'unlocked',
  icon: '✓',
  name: 'Lv 4' // optional
});
```

### 연결선 업데이트

```javascript
// 연결선 상태 변경 (인덱스 기반)
upgradeTreeUI.updateConnection(3, 'unlocked');
```

### 전체 트리 재렌더링

```javascript
const newTreeData = createDefaultUpgradeTree(6, 4);
upgradeTreeUI.update(newTreeData);
```

## UIController 통합 예제

```javascript
// UIController.js에서
import { UpgradeTreeUI, createDefaultUpgradeTree } from './UpgradeTreeUI.js';

_showTowerDetail(tower) {
  // ... 기존 코드 ...

  // 업그레이드 트리 추가 (새로운 블록 구조 사용)
  const upgradeContent = document.querySelector('#tower-detail .upgrade-content');

  // 레거시 구조 지원
  const container = upgradeContent || document.querySelector('#tower-detail .action-section');

  if (!container) {
    console.warn('Upgrade container not found');
    return;
  }

  // 타워 정의에서 트리 데이터 가져오기 또는 생성
  const treeData = tower.definition.upgradeTree ||
                   createDefaultUpgradeTree(5, tower.level || 1);

  // 기존 트리 제거
  const existingTree = container.querySelector('.skill-tree-scroll');
  if (existingTree) {
    existingTree.remove();
  }

  // 업그레이드 트리 UI 생성
  const upgradeTreeUI = new UpgradeTreeUI(
    container,
    treeData,
    (nodeData) => {
      this._handleUpgrade(tower, nodeData);
    }
  );

  // 참조 저장 (나중에 업데이트하기 위해)
  this.currentUpgradeTreeUI = upgradeTreeUI;
}

_handleUpgrade(tower, nodeData) {
  if (nodeData.state !== 'available') return;

  const economySystem = this.gameLoop.getEconomySystem();
  const cost = this._parseUpgradeCost(nodeData.cost);

  if (economySystem.canAfford(cost)) {
    // 업그레이드 실행
    tower.upgrade(nodeData.id);
    economySystem.spend(cost);

    // UI 새로고침
    this.selectTowerSlot(this.selectedSlot);
  }
}

_parseUpgradeCost(costString) {
  const match = costString.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}
```

## 타워 정의에 업그레이드 트리 추가

```javascript
// towerDefinitions.js
export const TOWER_DEFINITIONS = {
  enzyme: {
    id: 'enzyme',
    name: '효소 분사기',
    emoji: '🧪',
    // ... 기존 스탯 ...

    // 업그레이드 트리 추가
    upgradeTree: {
      width: 600,
      height: 160,
      nodes: [
        {
          id: 'enzyme_lv1',
          name: 'Lv 1',
          icon: '🧪',
          x: 50,
          y: 80,
          state: 'unlocked'
        },
        {
          id: 'enzyme_lv2',
          name: 'Lv 2',
          icon: '💪',
          x: 150,
          y: 80,
          state: 'current'
        },
        {
          id: 'enzyme_lv3',
          name: 'Lv 3',
          icon: '⚡',
          x: 250,
          y: 80,
          state: 'available',
          cost: '🍎 200'
        }
        // ... 더 많은 노드
      ],
      connections: [
        { x1: 90, y1: 100, x2: 150, y2: 100, state: 'unlocked' },
        { x1: 190, y1: 100, x2: 250, y2: 100, state: 'available' }
      ]
    }
  }
};
```

## HTML 구조

### 새로운 블록 구조 (권장)

```html
<!-- 타워 정보 블록 (헤더 + 스탯 통합) -->
<div class="tower-info-block">
  <div class="tower-header">
    <div class="tower-icon-large">🧪</div>
    <div class="tower-title">
      <h2>효소 분사기</h2>
      <p class="tower-subtitle">Lv 3 • 탄수화물 분해 특화</p>
    </div>
  </div>
  <div class="tower-stats">
    <div class="stat-row">...</div>
    <!-- ... 더 많은 스탯 -->
  </div>
</div>

<!-- 업그레이드 블록 -->
<div class="upgrade-block">
  <div class="upgrade-header">
    <h3>💥 업그레이드 트리</h3>
  </div>
  <div class="upgrade-content">
    <!-- UpgradeTreeUI가 여기에 트리를 생성 -->
    <div class="skill-tree-scroll">
      <div class="skill-tree" style="width: 600px; height: 160px;">
        <!-- SVG 연결선 -->
        <svg class="skill-connections" width="600" height="160">
          <line class="connection unlocked" x1="90" y1="100" x2="150" y2="100" />
          <!-- ... 더 많은 연결선 -->
        </svg>

        <!-- 스킬 노드들 -->
        <div class="skill-node unlocked" style="left: 50px; top: 80px;" data-node-id="level_1">
          <div class="node-icon">🧪</div>
          <div class="node-name">Lv 1</div>
          <div class="node-status">✓</div>
        </div>
        <!-- ... 더 많은 노드 -->
      </div>
    </div>
  </div>
</div>
```

### 레거시 구조 (하위 호환성)

```html
<div class="detail-header">...</div>
<div class="stats-list">...</div>
<div class="action-section">
  <h3>💥 업그레이드 트리</h3>
  <!-- UpgradeTreeUI 삽입 -->
</div>
```

## 스타일 커스터마이징

`src/styles/components/upgrade-tree.css`에서 스타일을 수정할 수 있습니다:

- `.skill-tree-scroll`: 스크롤 컨테이너
- `.skill-node`: 노드 기본 스타일
- `.skill-node.unlocked`: 잠금 해제된 노드
- `.skill-node.current`: 현재 레벨 노드
- `.skill-node.available`: 업그레이드 가능한 노드
- `.skill-node.locked`: 잠긴 노드
- `.connection`: 연결선 기본 스타일

## 주의사항

1. **컨테이너 선택**: `UpgradeTreeUI`는 전달받은 컨테이너의 내용을 모두 지웁니다.
2. **노드 ID**: 각 노드의 ID는 고유해야 합니다.
3. **좌표 시스템**: 노드의 (x, y)는 중심점 기준입니다 (`transform: translate(-50%, -50%)`).
4. **연결선 인덱스**: `updateConnection()`에서 사용하는 인덱스는 `connections` 배열의 순서입니다.

## 향후 개선 사항

- [ ] 자동 레이아웃 알고리즘
- [ ] 드래그 앤 드롭 지원
- [ ] 애니메이션 효과 추가
- [ ] 툴팁 지원
- [ ] 접근성 개선 (키보드 네비게이션)

## 라이센스

이 프로젝트의 라이센스를 따릅니다.
