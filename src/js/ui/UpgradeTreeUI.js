/**
 * UpgradeTreeUI.js
 * 타워 업그레이드 트리 UI 모듈
 * 각 타워의 업그레이드 트리를 동적으로 생성하고 관리
 */

export class UpgradeTreeUI {
  /**
   * 업그레이드 트리 UI 생성
   * @param {HTMLElement} container - 업그레이드 트리를 렌더링할 컨테이너
   * @param {Object} treeData - 업그레이드 트리 데이터
   * @param {Function} onNodeClick - 노드 클릭 시 콜백 함수
   */
  constructor(container, treeData = null, onNodeClick = null) {
    this.container = container;
    this.treeData = treeData;
    this.onNodeClick = onNodeClick;
    this.elements = {};

    if (treeData) {
      this.render(treeData);
    }
  }

  /**
   * 업그레이드 트리 렌더링
   * @param {Object} treeData - 업그레이드 트리 데이터
   * @param {Array} treeData.nodes - 노드 배열
   * @param {Array} treeData.connections - 연결선 배열
   */
  render(treeData) {
    this.treeData = treeData;
    this.container.innerHTML = '';

    // 스킬 트리 컨테이너 생성
    const scrollContainer = this.createScrollContainer();
    const treeContainer = this.createTreeContainer();

    // 연결선 SVG 생성
    const connections = this.createConnections(treeData.connections);
    treeContainer.appendChild(connections);

    // 노드 생성
    treeData.nodes.forEach(nodeData => {
      const node = this.createNode(nodeData);
      treeContainer.appendChild(node);
    });

    scrollContainer.appendChild(treeContainer);
    this.container.appendChild(scrollContainer);
  }

  /**
   * 스크롤 가능한 컨테이너 생성
   */
  createScrollContainer() {
    const scroll = document.createElement('div');
    scroll.className = 'skill-tree-scroll';
    this.elements.scroll = scroll;
    return scroll;
  }

  /**
   * 트리 컨테이너 생성
   */
  createTreeContainer() {
    const tree = document.createElement('div');
    tree.className = 'skill-tree';

    // 트리 크기를 데이터에서 계산하거나 기본값 사용
    const width = this.treeData.width || 600;
    const height = this.treeData.height || 160;

    tree.style.width = `${width}px`;
    tree.style.height = `${height}px`;
    tree.style.minWidth = `${width}px`;

    this.elements.tree = tree;
    return tree;
  }

  /**
   * 연결선 SVG 생성
   * @param {Array} connections - 연결선 데이터 배열
   * @returns {SVGElement}
   */
  createConnections(connections = []) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'skill-connections');
    svg.setAttribute('width', this.treeData.width || 600);
    svg.setAttribute('height', this.treeData.height || 160);

    connections.forEach(conn => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', conn.x1);
      line.setAttribute('y1', conn.y1);
      line.setAttribute('x2', conn.x2);
      line.setAttribute('y2', conn.y2);
      line.setAttribute('class', `connection ${conn.state || 'locked'}`);
      svg.appendChild(line);
    });

    this.elements.connections = svg;
    return svg;
  }

  /**
   * 스킬 노드 생성
   * @param {Object} nodeData - 노드 데이터
   * @returns {HTMLElement}
   */
  createNode(nodeData) {
    const node = document.createElement('div');
    node.className = `skill-node ${nodeData.state || 'locked'}`;
    node.style.left = `${nodeData.x}px`;
    node.style.top = `${nodeData.y}px`;
    node.dataset.nodeId = nodeData.id;

    // 노드 아이콘
    const icon = document.createElement('div');
    icon.className = 'node-icon';
    icon.textContent = nodeData.icon || '🔒';
    node.appendChild(icon);

    // 노드 이름
    const name = document.createElement('div');
    name.className = 'node-name';
    name.textContent = nodeData.name || 'Unknown';
    node.appendChild(name);

    // 상태별 추가 요소
    if (nodeData.state === 'unlocked') {
      const status = document.createElement('div');
      status.className = 'node-status';
      status.textContent = '✓';
      node.appendChild(status);
    } else if (nodeData.state === 'current') {
      const status = document.createElement('div');
      status.className = 'node-status';
      status.textContent = '★';
      node.appendChild(status);
    } else if (nodeData.state === 'available' || nodeData.state === 'locked') {
      const cost = document.createElement('div');
      cost.className = 'node-cost';
      cost.textContent = nodeData.cost || '';
      node.appendChild(cost);
    }

    // 클릭 이벤트
    if (nodeData.state === 'available' && this.onNodeClick) {
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onNodeClick(nodeData);
      });
    }

    return node;
  }

  /**
   * 특정 노드 업데이트
   * @param {string} nodeId - 노드 ID
   * @param {Object} updates - 업데이트할 데이터
   */
  updateNode(nodeId, updates) {
    const nodeElement = this.container.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return;

    // 상태 업데이트
    if (updates.state) {
      nodeElement.className = `skill-node ${updates.state}`;
    }

    // 아이콘 업데이트
    if (updates.icon) {
      const iconElement = nodeElement.querySelector('.node-icon');
      if (iconElement) iconElement.textContent = updates.icon;
    }

    // 이름 업데이트
    if (updates.name) {
      const nameElement = nodeElement.querySelector('.node-name');
      if (nameElement) nameElement.textContent = updates.name;
    }
  }

  /**
   * 연결선 업데이트
   * @param {number} index - 연결선 인덱스
   * @param {string} state - 새 상태 (unlocked, available, locked)
   */
  updateConnection(index, state) {
    const svg = this.elements.connections;
    if (!svg) return;

    const lines = svg.querySelectorAll('line');
    if (lines[index]) {
      lines[index].setAttribute('class', `connection ${state}`);
    }
  }

  /**
   * 전체 트리 데이터 업데이트 및 재렌더링
   * @param {Object} newTreeData - 새로운 트리 데이터
   */
  update(newTreeData) {
    this.render(newTreeData);
  }

  /**
   * 트리 제거
   */
  destroy() {
    this.container.innerHTML = '';
    this.elements = {};
    this.treeData = null;
  }
}

/**
 * 기본 업그레이드 트리 템플릿 생성 함수
 * @param {number} maxLevel - 최대 레벨
 * @param {number} currentLevel - 현재 레벨
 * @returns {Object} 트리 데이터
 */
export function createDefaultUpgradeTree(maxLevel = 5, currentLevel = 1) {
  const nodes = [];
  const connections = [];
  const spacing = 100;
  const startX = 50;
  const centerY = 80;

  for (let i = 1; i <= maxLevel; i++) {
    let state = 'locked';
    if (i < currentLevel) {
      state = 'unlocked';
    } else if (i === currentLevel) {
      state = 'current';
    } else if (i === currentLevel + 1) {
      state = 'available';
    }

    nodes.push({
      id: `level_${i}`,
      name: `Lv ${i}`,
      icon: state === 'unlocked' ? '✓' : state === 'current' ? '⚡' : '🔒',
      x: startX + (i - 1) * spacing,
      y: centerY,
      state: state,
      cost: state === 'available' ? `🍎 ${100 * i}` : ''
    });

    // 연결선 추가 (이전 레벨 → 현재 레벨)
    if (i > 1) {
      let connState = 'locked';
      if (i <= currentLevel) {
        connState = 'unlocked';
      } else if (i === currentLevel + 1) {
        connState = 'available';
      }

      connections.push({
        x1: startX + (i - 2) * spacing + 40,
        y1: centerY + 20,
        x2: startX + (i - 1) * spacing - 40,
        y2: centerY + 20,
        state: connState
      });
    }
  }

  return {
    width: startX + (maxLevel - 1) * spacing + 100,
    height: 160,
    nodes,
    connections
  };
}

/**
 * 분기형 업그레이드 트리 템플릿 생성 함수
 * @param {Object} config - 트리 설정
 * @returns {Object} 트리 데이터
 */
export function createBranchedUpgradeTree(config) {
  const {
    mainPath = 5,
    currentLevel = 3,
    branches = []
  } = config;

  const nodes = [];
  const connections = [];
  const spacing = 100;
  const startX = 50;
  const centerY = 80;

  // 메인 경로 노드 생성
  for (let i = 1; i <= mainPath; i++) {
    let state = 'locked';
    if (i < currentLevel) {
      state = 'unlocked';
    } else if (i === currentLevel) {
      state = 'current';
    } else if (i === currentLevel + 1) {
      state = 'available';
    }

    nodes.push({
      id: `main_${i}`,
      name: `Lv ${i}`,
      icon: getIconForState(state),
      x: startX + (i - 1) * spacing,
      y: centerY,
      state: state,
      cost: state === 'available' ? `🍎 ${100 * i}` : ''
    });

    // 메인 경로 연결선
    if (i > 1) {
      connections.push({
        x1: startX + (i - 2) * spacing + 40,
        y1: centerY + 20,
        x2: startX + (i - 1) * spacing - 40,
        y2: centerY + 20,
        state: i <= currentLevel ? 'unlocked' : i === currentLevel + 1 ? 'available' : 'locked'
      });
    }
  }

  // 분기 노드 추가
  branches.forEach(branch => {
    const parentX = startX + (branch.fromLevel - 1) * spacing;
    const branchX = parentX + 70;
    const branchY = centerY + (branch.offset || 40);

    nodes.push({
      id: branch.id,
      name: branch.name,
      icon: branch.icon || '⚡',
      x: branchX,
      y: branchY,
      state: branch.state || 'locked',
      cost: branch.cost || ''
    });

    // 분기 연결선
    connections.push({
      x1: parentX + 40,
      y1: centerY + 20,
      x2: branchX - 40,
      y2: branchY + 20,
      state: branch.state === 'available' || branch.state === 'unlocked' ? branch.state : 'locked'
    });
  });

  return {
    width: startX + (mainPath - 1) * spacing + 200,
    height: 200,
    nodes,
    connections
  };
}

/**
 * 상태에 따른 아이콘 반환
 */
function getIconForState(state) {
  switch (state) {
    case 'unlocked': return '✓';
    case 'current': return '⚡';
    case 'available': return '🔥';
    default: return '🔒';
  }
}
