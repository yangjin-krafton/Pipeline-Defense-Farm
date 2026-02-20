/**
 * UpgradeTreeUI 사용 예제
 *
 * 이 파일은 UpgradeTreeUI 클래스를 사용하는 방법을 보여주는 예제입니다.
 */

import { UpgradeTreeUI, createDefaultUpgradeTree, createBranchedUpgradeTree } from './UpgradeTreeUI.js';

/**
 * 예제 1: 기본 선형 업그레이드 트리
 */
export function example1_SimpleLinearTree() {
  const container = document.querySelector('.action-section');

  // 기본 트리 데이터 생성 (최대 레벨 5, 현재 레벨 3)
  const treeData = createDefaultUpgradeTree(5, 3);

  // UI 생성
  const upgradeTreeUI = new UpgradeTreeUI(
    container,
    treeData,
    (nodeData) => {
      console.log('Node clicked:', nodeData);
      // 업그레이드 처리 로직
      if (nodeData.state === 'available') {
        alert(`업그레이드: ${nodeData.name} - 비용: ${nodeData.cost}`);
      }
    }
  );
}

/**
 * 예제 2: 분기형 업그레이드 트리
 */
export function example2_BranchedTree() {
  const container = document.querySelector('.action-section');

  // 분기형 트리 데이터 생성
  const treeData = createBranchedUpgradeTree({
    mainPath: 5,      // 메인 경로 레벨 수
    currentLevel: 3,  // 현재 레벨
    branches: [
      {
        id: 'speed_upgrade',
        name: '속도↑',
        icon: '⏱️',
        fromLevel: 4,  // 레벨 4에서 분기
        offset: -40,   // Y축 오프셋 (위쪽)
        state: 'available',
        cost: '⚡ 40'
      },
      {
        id: 'range_upgrade',
        name: '범위↑',
        icon: '📍',
        fromLevel: 4,  // 레벨 4에서 분기
        offset: 40,    // Y축 오프셋 (아래쪽)
        state: 'locked',
        cost: '🍎 400'
      }
    ]
  });

  const upgradeTreeUI = new UpgradeTreeUI(
    container,
    treeData,
    (nodeData) => {
      console.log('Node clicked:', nodeData);
    }
  );
}

/**
 * 예제 3: 커스텀 트리 데이터
 */
export function example3_CustomTree() {
  const container = document.querySelector('.action-section');

  // 완전히 커스텀한 트리 데이터
  const customTreeData = {
    width: 600,
    height: 160,
    nodes: [
      // 레벨 1
      {
        id: 'level_1',
        name: 'Lv 1',
        icon: '🧪',
        x: 50,
        y: 80,
        state: 'unlocked'
      },
      // 레벨 2
      {
        id: 'level_2',
        name: 'Lv 2',
        icon: '💪',
        x: 150,
        y: 80,
        state: 'unlocked'
      },
      // 레벨 3 (현재)
      {
        id: 'level_3',
        name: 'Lv 3',
        icon: '⚡',
        x: 250,
        y: 80,
        state: 'current'
      },
      // 레벨 4 (업그레이드 가능)
      {
        id: 'level_4',
        name: 'Lv 4',
        icon: '🔥',
        x: 350,
        y: 80,
        state: 'available',
        cost: '🍎 300'
      },
      // 분기: 속도 강화
      {
        id: 'speed_branch',
        name: '속도↑',
        icon: '⏱️',
        x: 420,
        y: 40,
        state: 'available',
        cost: '⚡ 40'
      },
      // 분기: 범위 강화
      {
        id: 'range_branch',
        name: '범위↑',
        icon: '📍',
        x: 420,
        y: 120,
        state: 'locked',
        cost: '🍎 400'
      },
      // 레벨 5 (잠김)
      {
        id: 'level_5',
        name: 'Lv 5',
        icon: '💎',
        x: 520,
        y: 80,
        state: 'locked',
        cost: '🦠 50'
      }
    ],
    connections: [
      // Lv1 → Lv2
      { x1: 90, y1: 100, x2: 150, y2: 100, state: 'unlocked' },
      // Lv2 → Lv3
      { x1: 190, y1: 100, x2: 250, y2: 100, state: 'unlocked' },
      // Lv3 → Lv4
      { x1: 290, y1: 100, x2: 350, y2: 100, state: 'available' },
      // Lv4 → 속도
      { x1: 390, y1: 90, x2: 420, y2: 70, state: 'available' },
      // Lv4 → 범위
      { x1: 390, y1: 110, x2: 420, y2: 140, state: 'locked' },
      // Lv4 → Lv5
      { x1: 390, y1: 100, x2: 520, y2: 100, state: 'locked' }
    ]
  };

  const upgradeTreeUI = new UpgradeTreeUI(
    container,
    customTreeData,
    (nodeData) => {
      console.log('Node clicked:', nodeData);
      // 업그레이드 처리
      handleUpgrade(nodeData);
    }
  );

  return upgradeTreeUI;
}

/**
 * 예제 4: 동적 업데이트
 */
export function example4_DynamicUpdate() {
  const container = document.querySelector('.action-section');

  const treeData = createDefaultUpgradeTree(5, 3);
  const upgradeTreeUI = new UpgradeTreeUI(container, treeData);

  // 3초 후 노드 상태 업데이트
  setTimeout(() => {
    // 레벨 4를 언락 상태로 변경
    upgradeTreeUI.updateNode('level_4', {
      state: 'unlocked',
      icon: '✓'
    });

    // 연결선도 업데이트 (인덱스 3 = Lv3→Lv4 연결선)
    upgradeTreeUI.updateConnection(3, 'unlocked');
  }, 3000);
}

/**
 * 업그레이드 처리 함수 (예제)
 */
function handleUpgrade(nodeData) {
  if (nodeData.state !== 'available') {
    console.log('This node is not available for upgrade');
    return;
  }

  // 비용 확인 및 업그레이드 처리
  console.log(`Upgrading ${nodeData.name}...`);

  // 업그레이드 성공 후 UI 업데이트
  // (실제로는 게임 로직에서 처리)
}

/**
 * UIController에 통합하는 예제 (새로운 블록 구조 사용)
 */
export function integrateWithUIController(uiController, tower) {
  // UIController에서 타워 상세 정보를 표시할 때
  // 새로운 구조: .upgrade-block > .upgrade-content
  let upgradeContent = document.querySelector('#tower-detail .upgrade-content');

  // 레거시 구조 지원
  if (!upgradeContent) {
    upgradeContent = document.querySelector('#tower-detail .action-section');
  }

  if (!upgradeContent) {
    console.warn('Upgrade content container not found');
    return null;
  }

  // 업그레이드 트리 데이터를 타워 정의에서 가져오거나 생성
  const treeData = tower.definition.upgradeTree || createDefaultUpgradeTree(5, tower.level || 1);

  // 기존 트리 제거
  const existingTree = upgradeContent.querySelector('.skill-tree-scroll');
  if (existingTree) {
    existingTree.remove();
  }

  // 새 트리 생성
  const upgradeTreeUI = new UpgradeTreeUI(
    upgradeContent,
    treeData,
    (nodeData) => {
      // 업그레이드 처리
      if (nodeData.state === 'available') {
        const economySystem = uiController.gameLoop.getEconomySystem();
        const cost = parseUpgradeCost(nodeData.cost);

        if (economySystem.canAfford(cost)) {
          // 업그레이드 실행
          tower.upgrade(nodeData.id);
          economySystem.spend(cost);

          // UI 새로고침
          uiController.selectTowerSlot(uiController.selectedSlot);
        } else {
          console.log('Not enough resources');
        }
      }
    }
  );

  return upgradeTreeUI;
}

/**
 * 비용 문자열 파싱 (예: "🍎 300" → 300)
 */
function parseUpgradeCost(costString) {
  if (!costString) return 0;
  const match = costString.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}
