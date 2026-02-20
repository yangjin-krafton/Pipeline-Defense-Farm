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
    this.cost = config.cost || 1; // 업그레이드 포인트 비용 (기본 1)
  }

  /**
   * 이 노드를 활성화할 수 있는지 체크
   */
  canActivate(activeNodes) {
    if (this.prerequisites.length === 0) return true;

    // 선행 노드 중 하나라도 활성화되어 있으면 OK
    return this.prerequisites.some(prereqNum =>
      activeNodes.some(node => node.nodeNumber === prereqNum)
    );
  }
}

/**
 * UpgradeTree
 * 타워의 업그레이드 트리 관리
 */
export class UpgradeTree {
  constructor(nodes = []) {
    this.nodes = nodes; // UpgradeNode 배열
    this.activeNodes = []; // 활성화된 노드
    this.availablePoints = 5; // 사용 가능한 업그레이드 포인트
    this.usedPoints = 0;
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

    // NC 비용 체크 (설치비의 12%)
    if (economySystem && towerBaseCost) {
      const ncCost = Math.floor(towerBaseCost * 0.12);
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
   * 특정 타입의 모든 활성 모듈 가져오기
   */
  getActiveModulesByType(moduleType) {
    const modules = [];
    for (const node of this.activeNodes) {
      for (const module of node.modules) {
        if (module.constructor.name === moduleType) {
          modules.push(module);
        }
      }
    }
    return modules;
  }

  /**
   * 모든 활성 모듈 가져오기
   */
  getAllActiveModules() {
    const modules = [];
    for (const node of this.activeNodes) {
      modules.push(...node.modules);
    }
    return modules;
  }
}
