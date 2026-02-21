/**
 * UpgradeNode
 * 타워 업그레이드 노드 정의
 */
export class UpgradeNode {
  constructor(config) {
    this.id = config.id;
    this.nodeNumber = config.nodeNumber; // 1~12
    this.position = config.position; // 'branch', 'mid', 'end'
    this.name = config.name;
    this.modules = config.modules || []; // 모듈 인스턴스 배열
    this.effect = config.effect || ''; // 효과 설명
    this.prerequisites = config.prerequisites || []; // 선행 노드 번호 배열
    this.cost = config.cost || 1; // 업그레이드 포인트 비용 (기본 1, 모든 노드 동일)
    this.ncCostMultiplier = config.ncCostMultiplier || 0.12; // NC 비용 배율 (타워 기본 비용의 %)
  }

  /**
   * 이 노드를 활성화할 수 있는지 체크
   *
   * Prerequisites 형식:
   * - 단순 배열: [4, 6] → OR 조건 (4 또는 6)
   * - 배열의 배열: [[4], [6]] → OR 조건 (4 또는 6)
   * - 배열의 배열: [[4, 6]] → AND 조건 (4 그리고 6)
   * - 배열의 배열: [[4, 6], [7]] → 복합 조건 ((4 그리고 6) 또는 7)
   */
  canActivate(activeNodes) {
    if (this.prerequisites.length === 0) return true;

    // 단순 배열인지 배열의 배열인지 확인
    const isNestedArray = Array.isArray(this.prerequisites[0]);

    if (!isNestedArray) {
      // 하위 호환성: 단순 배열은 OR 조건으로 처리
      return this.prerequisites.some(prereqNum =>
        activeNodes.some(node => node.nodeNumber === prereqNum)
      );
    }

    // 배열의 배열: OR of ANDs
    // 각 내부 배열은 AND 조건, 외부 배열은 OR 조건
    return this.prerequisites.some(andGroup => {
      // andGroup의 모든 노드가 활성화되어 있어야 함
      return andGroup.every(prereqNum =>
        activeNodes.some(node => node.nodeNumber === prereqNum)
      );
    });
  }
}

/**
 * UpgradeTree
 * 타워의 업그레이드 트리 관리
 */
export class UpgradeTree {
  constructor(nodes = [], tower = null) {
    this.nodes = nodes; // UpgradeNode 배열
    this.activeNodes = []; // 활성화된 노드
    this.tower = tower; // 타워 참조 (동적 포인트 계산용)
    this.usedPoints = 0;
  }

  /**
   * Get available upgrade points from tower
   */
  get availablePoints() {
    // 타워 참조가 있으면 타워의 upgradePoints 사용
    if (this.tower) {
      return this.tower.upgradePoints || this.tower.level || 5;
    }
    // 타워 참조가 없으면 기본값 5
    return 5;
  }

  /**
   * 노드 활성화
   * @param {number} nodeNumber - 활성화할 노드 번호
   * @param {EconomySystem} economySystem - 경제 시스템 (NC/SC 관리)
   * @param {number} towerBaseCost - 타워 기본 설치 비용
   * @returns {boolean} 활성화 성공 여부
   */
  activateNode(nodeNumber, economySystem, towerBaseCost) {
    const node = this.nodes.find(n => n.nodeNumber === nodeNumber);
    if (!node) return false;

    // 이미 활성화된 노드인지 체크
    if (this.activeNodes.includes(node)) return false;

    // 선행 노드 체크
    if (!node.canActivate(this.activeNodes)) return false;

    // 포인트 체크
    if (this.usedPoints + node.cost > this.availablePoints) return false;

    // NC 비용 체크 (노드별 차등 비용 + 각인 횟수 배율)
    if (economySystem && towerBaseCost) {
      // Get imprint count for this node
      const imprintCount = this.tower ? (this.tower.imprintCounts.get(nodeNumber) || 0) : 0;

      // Calculate cost multiplier based on imprint count
      // 지수 곡선: 1.0, 1.5, 2.2, 3.2, 4.5, 6.2, 8.5, 11.5
      const imprintCostMultiplier = imprintCount > 0 ? (1.0 + Math.pow(imprintCount, 1.4) * 0.5) : 1.0;

      const ncCost = Math.floor(towerBaseCost * node.ncCostMultiplier * imprintCostMultiplier);
      if (!economySystem.canAffordNC(ncCost)) return false;

      // NC 차감
      economySystem.spendNC(ncCost);
    }

    // 활성화
    this.activeNodes.push(node);
    this.usedPoints += node.cost;
    return true;
  }

  /**
   * 노드 비활성화 (리셋용)
   */
  deactivateNode(nodeNumber) {
    const index = this.activeNodes.findIndex(n => n.nodeNumber === nodeNumber);
    if (index === -1) return false;

    const node = this.activeNodes[index];
    this.activeNodes.splice(index, 1);
    this.usedPoints -= node.cost;
    return true;
  }

  /**
   * 전체 리셋
   */
  reset() {
    this.activeNodes = [];
    this.usedPoints = 0;
  }

  /**
   * 특정 타입의 모든 활성 모듈 가져오기 (각인 포함)
   */
  getActiveModulesByType(moduleType) {
    const modules = [];

    // 1. 현재 활성화된 노드의 모듈
    for (const node of this.activeNodes) {
      for (const module of node.modules) {
        if (module.constructor.name === moduleType) {
          modules.push(module);
        }
      }
    }

    // 2. 각인된 노드의 모듈 (영구 효과)
    if (this.tower && this.tower.imprints) {
      for (const imprint of this.tower.imprints) {
        if (imprint.imprintedNode && imprint.imprintedNode.modules) {
          for (const module of imprint.imprintedNode.modules) {
            if (module.constructor.name === moduleType) {
              modules.push(module);
            }
          }
        }
      }
    }

    return modules;
  }

  /**
   * 모든 활성 모듈 가져오기 (각인 포함)
   */
  getAllActiveModules() {
    const modules = [];

    // 1. 현재 활성화된 노드의 모듈
    for (const node of this.activeNodes) {
      modules.push(...node.modules);
    }

    // 2. 각인된 노드의 모듈 (영구 효과)
    if (this.tower && this.tower.imprints) {
      for (const imprint of this.tower.imprints) {
        if (imprint.imprintedNode && imprint.imprintedNode.modules) {
          modules.push(...imprint.imprintedNode.modules);
        }
      }
    }

    return modules;
  }

  /**
   * 활성 모듈 재계산 (저장 로드 후 호출)
   */
  recalculateActiveModules() {
    // activeNodes가 Set으로 nodeNumber만 저장되어 있을 수 있음
    // 실제 노드 객체로 변환
    const newActiveNodes = new Set();

    for (const nodeNumber of this.activeNodes) {
      const node = this.getNode(nodeNumber);
      if (node) {
        newActiveNodes.add(node);
      }
    }

    this.activeNodes = newActiveNodes;
    console.log(`[UpgradeTree] Active modules recalculated: ${this.activeNodes.size} nodes active`);
  }
}
