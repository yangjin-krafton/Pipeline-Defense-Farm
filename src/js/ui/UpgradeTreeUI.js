/**
 * UpgradeTreeUI.js
 * 업그레이드 트리 렌더링 UI 모듈
 * 헤더(포인트/승급/리셋), SVG 연결선, 노드 배치, 드래그 스크롤 담당
 */

import { dragManager } from '../core/DragManager.js';

export class UpgradeTreeUI {
  constructor(uiController, nodeCardFactory) {
    this.ui = uiController;
    this.nodeCard = nodeCardFactory;
    this.dragManager = dragManager;
    this.currentScrollContainer = null;
  }

  /**
   * 업그레이드 트리 전체 렌더링 (_showUpgradeTree)
   * @param {Object} tower - 타워 인스턴스
   */
  show(tower) {
    const upgradeContent = document.querySelector('.upgrade-content');
    if (!upgradeContent) return;

    upgradeContent.innerHTML = '';

    if (!tower.upgradeTree || !tower.upgradeTree.nodes || tower.upgradeTree.nodes.length === 0) {
      upgradeContent.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">이 타워는 아직 업그레이드를 지원하지 않습니다.</p>';
      return;
    }

    const tree = tower.upgradeTree;
    const economySystem = this.ui.gameLoop?.getEconomySystem();
    if (!economySystem) return;

    upgradeContent.appendChild(this._buildTreeHeader(tree, tower, economySystem));

    // 스크롤 컨테이너
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'upgrade-tree-scroll';
    scrollContainer.style.cssText = `
      overflow: auto;
      padding: 20px 15px;
      position: relative;
      background:
        repeating-linear-gradient(
          45deg,
          rgba(233, 69, 96, 0.08),
          rgba(233, 69, 96, 0.08) 15px,
          rgba(0, 217, 255, 0.08) 15px,
          rgba(0, 217, 255, 0.08) 30px
        ),
        linear-gradient(135deg, rgba(248, 249, 250, 0.95) 0%, rgba(233, 236, 239, 0.95) 100%);
      border-radius: 15px;
      border: 5px solid #1a1a2e;
      min-height: 340px;
      max-height: 470px;
      box-shadow:
        inset 0 3px 10px rgba(0, 0, 0, 0.15),
        inset 0 -2px 5px rgba(255, 255, 255, 0.1),
        0 0 0 2px rgba(233, 69, 96, 0.3);
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    `;

    const treeWrapper = document.createElement('div');
    treeWrapper.style.cssText = 'position: relative; min-width: max-content; min-height: 250px;';

    const nodePositions = this._calculateNodePositions(tree.nodes);
    const maxColumn = Math.max(...Object.values(nodePositions).map(p => p.column));
    const maxRow = Math.max(...Object.values(nodePositions).map(p => p.row));

    const sizes = { nodeWidth: 260, nodeHeight: 130, columnGap: 100, rowGap: 20 };
    const { nodeWidth, nodeHeight, columnGap, rowGap } = sizes;

    const totalWidth = (maxColumn + 1) * (nodeWidth + columnGap);
    const totalHeight = Math.max((maxRow + 1) * (nodeHeight + rowGap), 280);

    treeWrapper.style.height = `${totalHeight}px`;
    treeWrapper.style.minHeight = '280px';

    // SVG 연결선
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', totalWidth);
    svg.setAttribute('height', totalHeight);
    svg.style.cssText = 'position: absolute; top: 0; left: 0; pointer-events: none; z-index: 0;';
    this._drawConnections(svg, tree, nodePositions, sizes);
    treeWrapper.appendChild(svg);

    // 노드 카드 배치
    for (const node of tree.nodes) {
      const nodePos = nodePositions[node.nodeNumber];
      const nodeCard = this.nodeCard.create(node, tree, tower, economySystem);

      nodeCard.style.position = 'absolute';
      nodeCard.style.left = `${nodePos.column * (nodeWidth + columnGap)}px`;
      nodeCard.style.top = `${nodePos.row * (nodeHeight + rowGap)}px`;
      nodeCard.style.width = `${nodeWidth}px`;
      nodeCard.style.height = `${nodeHeight}px`;
      nodeCard.style.display = 'flex';
      nodeCard.style.flexDirection = 'column';
      nodeCard.style.justifyContent = 'space-between';
      nodeCard.style.zIndex = '1';
      nodeCard.style.pointerEvents = 'auto';

      treeWrapper.appendChild(nodeCard);
    }

    svg.style.pointerEvents = 'none';
    scrollContainer.appendChild(treeWrapper);
    upgradeContent.appendChild(scrollContainer);

    this._setupDragScroll(scrollContainer);
  }

  /**
   * 트리 헤더 생성 (포인트 표시 or 승급 버튼 + 리셋 버튼)
   */
  _buildTreeHeader(tree, tower, economySystem) {
    const headerContainer = document.createElement('div');
    headerContainer.className = 'upgrade-tree-header';
    headerContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      position: sticky;
      top: 0;
      z-index: 10;
    `;

    const towerGrowthSystem = this.ui.gameLoop?.getTowerGrowthSystem();
    const maxLevel = towerGrowthSystem ? towerGrowthSystem.calculateMaxLevel(tower.star) : 6;
    const isMaxLevel = tower.level >= maxLevel;
    const allPointsUsed = tree.usedPoints === tree.availablePoints;
    const canStarUpgrade = tower.star < 7 && isMaxLevel && allPointsUsed;

    const pointsDisplay = document.createElement('div');
    pointsDisplay.className = 'upgrade-points';

    if (canStarUpgrade) {
      const upgradeCost = towerGrowthSystem.getUpgradeCost(tower.star);
      const canAfford = economySystem.canAffordBoth(upgradeCost.nc, upgradeCost.sc);

      pointsDisplay.style.cssText = `
        flex: 1;
        padding: 10px 18px;
        background: linear-gradient(135deg, #00d9ff 0%, #00b8d4 100%);
        border: 5px solid #1a1a2e;
        border-radius: 20px;
        text-align: center;
        font-weight: 900;
        font-size: 18px;
        color: #fff;
        text-shadow: 3px 3px 0 rgba(0, 0, 0, 0.3);
        box-shadow:
          0 0 0 3px ${canAfford ? '#ffd700' : '#666'},
          0 6px 0 #1a1a2e,
          0 8px 20px rgba(0, 217, 255, ${canAfford ? '0.5' : '0.2'});
        letter-spacing: 1px;
        cursor: ${canAfford ? 'pointer' : 'not-allowed'};
        opacity: ${canAfford ? '1' : '0.6'};
        transition: all 0.2s;
      `;
      pointsDisplay.innerHTML = `
        ⭐ 승급 가능! ${tower.star}성 → ${tower.star + 1}성<br>
        <span style="font-size: 14px; opacity: 0.9;">🍎${upgradeCost.nc} ⚡${upgradeCost.sc}</span>
      `;

      if (canAfford) {
        pointsDisplay.addEventListener('click', () => {
          const es = this.ui.gameLoop.getEconomySystem();
          const tgs = this.ui.gameLoop.getTowerGrowthSystem();
          const cost = tgs.getUpgradeCost(tower.star);

          if (!es.spendBoth(cost.nc, cost.sc)) {
            this.ui._showToast('비용 부족', 'error');
            return;
          }

          this.ui._playUISfx('tower_upgrade', { volume: 0.7 });
          this.ui.updateNutritionDisplay(es.getState());
          this.ui.starUpgradeManager.showStarUpgradeUI(tower);
          this.ui._triggerSave();

          // NC·SC 소비 낙하 연출
          if (this.ui.resourceAbsorptionSystem) {
            if (cost.nc > 0) this.ui.resourceAbsorptionSystem.emitDrop('nc', cost.nc);
            if (cost.sc > 0) this.ui.resourceAbsorptionSystem.emitDrop('sc', cost.sc);
          }
        });

        pointsDisplay.onmouseenter = () => {
          pointsDisplay.style.transform = 'translateY(-3px) scale(1.02)';
          pointsDisplay.style.boxShadow = `
            0 0 0 3px #ffd700,
            0 10px 0 #1a1a2e,
            0 12px 30px rgba(0, 217, 255, 0.7)
          `;
        };
        pointsDisplay.onmouseleave = () => {
          pointsDisplay.style.transform = 'translateY(0) scale(1)';
          pointsDisplay.style.boxShadow = `
            0 0 0 3px #ffd700,
            0 6px 0 #1a1a2e,
            0 8px 20px rgba(0, 217, 255, 0.5)
          `;
        };
      }
    } else {
      pointsDisplay.style.cssText = `
        flex: 1;
        padding: 10px 18px;
        background: linear-gradient(135deg, #e94560 0%, #ff6b9d 100%);
        border: 5px solid #1a1a2e;
        border-radius: 20px;
        text-align: center;
        font-weight: 900;
        font-size: 18px;
        color: #fff;
        text-shadow: 3px 3px 0 rgba(0, 0, 0, 0.3);
        box-shadow:
          0 0 0 3px #ffd700,
          0 6px 0 #1a1a2e,
          0 8px 20px rgba(255, 215, 0, 0.5);
        letter-spacing: 1px;
      `;
      pointsDisplay.innerHTML = `
        💎 업그레이드 포인트: <span style="color: #ffd700; font-size: 22px; text-shadow: 2px 2px 0 rgba(0,0,0,0.5);">${tree.usedPoints}</span> / ${tree.availablePoints}
      `;
    }

    // 리셋 버튼
    const towerBaseCost = tower.definition.cost;
    const resetNCCost = Math.floor(towerBaseCost * 0.35);
    const resetSCCost = 12;
    const canAffordReset = economySystem.canAffordBoth(resetNCCost, resetSCCost);
    const hasActiveNodes = tree.activeNodes.length > 0;

    const resetButton = document.createElement('button');
    resetButton.className = 'upgrade-reset-button';
    resetButton.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: linear-gradient(135deg, #ff006e 0%, #ff4d8f 100%);
      border: 5px solid #1a1a2e;
      border-radius: 18px;
      color: white;
      font-weight: 900;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow:
        0 0 0 3px ${canAffordReset && hasActiveNodes ? '#ff006e' : '#666'},
        0 6px 0 #1a1a2e,
        0 8px 20px rgba(255, 0, 110, ${canAffordReset && hasActiveNodes ? '0.5' : '0.2'});
      opacity: ${canAffordReset && hasActiveNodes ? '1' : '0.5'};
      pointer-events: ${canAffordReset && hasActiveNodes ? 'auto' : 'none'};
      white-space: nowrap;
    `;
    resetButton.innerHTML = `
      <span style="font-size: 20px;">🔄</span>
      <span>리셋</span>
      <span style="font-size: 14px; opacity: 0.9;">🍎${resetNCCost} ⚡${resetSCCost}</span>
    `;

    resetButton.addEventListener('click', () => {
      this.ui._playUISfx('ui_click', { volume: 0.6 });

      if (!canAffordReset) {
        this.ui._showToast('비용 부족', 'error');
        return;
      }
      if (!hasActiveNodes) {
        this.ui._showToast('활성화된 노드가 없습니다', 'error');
        return;
      }

      this.ui._showConfirmDialog({
        title: '스킬트리 리셋',
        message: `🍎 ${resetNCCost} NC와 ⚡ ${resetSCCost} SC를 소비하여 모든 노드를 비활성화합니다.`,
        onConfirm: () => {
          economySystem.spendBoth(resetNCCost, resetSCCost);
          tower.upgradeTree.reset();
          this.ui._playUISfx('tower_upgrade', { volume: 0.8 });
          this.ui._showToast('스킬트리 리셋 완료', 'success');
          this.ui.updateNutritionDisplay(economySystem.getState());
          this.ui._triggerSave();
          this.show(tower);
          this.ui._refreshTowerStats(tower);

          // NC·SC 소비 낙하 연출
          if (this.ui.resourceAbsorptionSystem) {
            if (resetNCCost > 0) this.ui.resourceAbsorptionSystem.emitDrop('nc', resetNCCost);
            if (resetSCCost > 0) this.ui.resourceAbsorptionSystem.emitDrop('sc', resetSCCost);
          }
        }
      });
    });

    if (canAffordReset && hasActiveNodes) {
      resetButton.onmouseenter = () => {
        resetButton.style.transform = 'translateY(-3px) scale(1.05)';
        resetButton.style.boxShadow = `
          0 0 0 3px #ff006e,
          0 10px 0 #1a1a2e,
          0 12px 30px rgba(255, 0, 110, 0.7)
        `;
      };
      resetButton.onmouseleave = () => {
        resetButton.style.transform = 'translateY(0) scale(1)';
        resetButton.style.boxShadow = `
          0 0 0 3px #ff006e,
          0 6px 0 #1a1a2e,
          0 8px 20px rgba(255, 0, 110, 0.5)
        `;
      };
    }

    headerContainer.appendChild(pointsDisplay);
    headerContainer.appendChild(resetButton);
    return headerContainer;
  }

  /**
   * SVG 연결선 그리기
   */
  _drawConnections(svg, tree, nodePositions, sizes) {
    const { nodeWidth, nodeHeight, columnGap, rowGap } = sizes;

    for (const node of tree.nodes) {
      const nodePos = nodePositions[node.nodeNumber];
      const nodeX = nodePos.column * (nodeWidth + columnGap) + nodeWidth / 2;
      const nodeY = nodePos.row * (nodeHeight + rowGap) + nodeHeight / 2;

      // prerequisites 평탄화 ([[1,2]] → [1,2] 또는 [1,2] → [1,2])
      let prereqNums = [];
      if (node.prerequisites.length > 0) {
        prereqNums = Array.isArray(node.prerequisites[0])
          ? node.prerequisites.flat()
          : node.prerequisites;
      }

      for (const prereqNum of prereqNums) {
        const prereqPos = nodePositions[prereqNum];
        if (!prereqPos) continue;

        const prereqX = prereqPos.column * (nodeWidth + columnGap) + nodeWidth / 2;
        const prereqY = prereqPos.row * (nodeHeight + rowGap) + nodeHeight / 2;

        const isPrereqActive = tree.activeNodes.some(n => n.nodeNumber === prereqNum);
        const isBothActive = isPrereqActive && tree.activeNodes.some(n => n.nodeNumber === node.nodeNumber);

        const midX = (prereqX + nodeX) / 2;
        const d = `M ${prereqX} ${prereqY} C ${midX} ${prereqY}, ${midX} ${nodeY}, ${nodeX} ${nodeY}`;

        // 테두리 선 (맨 아래)
        const borderLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        borderLine.setAttribute('d', d);
        borderLine.setAttribute('stroke', '#1a1a2e');
        borderLine.setAttribute('stroke-width', isBothActive ? '8' : '7');
        borderLine.setAttribute('fill', 'none');
        borderLine.setAttribute('stroke-dasharray', isBothActive ? '0' : isPrereqActive ? '12,8' : '8,6');
        borderLine.setAttribute('stroke-linecap', 'round');
        borderLine.setAttribute('opacity', '0.5');

        // 글로우 선
        const glowLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        glowLine.setAttribute('d', d);
        glowLine.setAttribute('stroke', isBothActive ? '#00d9ff' : isPrereqActive ? '#ffd700' : 'rgba(26, 26, 46, 0.3)');
        glowLine.setAttribute('stroke-width', isBothActive ? '10' : '8');
        glowLine.setAttribute('fill', 'none');
        glowLine.setAttribute('opacity', isBothActive ? '0.4' : '0.2');
        glowLine.setAttribute('stroke-linecap', 'round');

        // 메인 선
        const mainLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        mainLine.setAttribute('d', d);
        mainLine.setAttribute('stroke', isBothActive ? '#00d9ff' : isPrereqActive ? '#ffd700' : '#999');
        mainLine.setAttribute('stroke-width', isBothActive ? '6' : '5');
        mainLine.setAttribute('fill', 'none');
        mainLine.setAttribute('stroke-dasharray', isBothActive ? '0' : isPrereqActive ? '12,8' : '8,6');
        mainLine.setAttribute('stroke-linecap', 'round');

        if (!isBothActive && isPrereqActive) {
          const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
          animate.setAttribute('attributeName', 'stroke-dashoffset');
          animate.setAttribute('from', '0');
          animate.setAttribute('to', '20');
          animate.setAttribute('dur', '1s');
          animate.setAttribute('repeatCount', 'indefinite');
          mainLine.appendChild(animate);
        }

        svg.appendChild(borderLine);
        svg.appendChild(glowLine);
        svg.appendChild(mainLine);
      }
    }
  }

  /**
   * 3행 고정 레이아웃으로 노드 위치 계산 (_calculateNodePositions)
   *
   * Row 0: [1][4][7][10]
   * Row 1: [2][5][8][11]
   * Row 2: [3][6][9][12]
   */
  _calculateNodePositions(nodes) {
    const NODE_LAYOUT = {
      1:  { column: 0, row: 0 }, 2:  { column: 0, row: 1 }, 3:  { column: 0, row: 2 },
      4:  { column: 1, row: 0 }, 5:  { column: 1, row: 1 }, 6:  { column: 1, row: 2 },
      7:  { column: 2, row: 0 }, 8:  { column: 2, row: 1 }, 9:  { column: 2, row: 2 },
      10: { column: 3, row: 0 }, 11: { column: 3, row: 1 }, 12: { column: 3, row: 2 }
    };

    const positions = {};
    for (const node of nodes) {
      const layout = NODE_LAYOUT[node.nodeNumber];
      if (layout) {
        positions[node.nodeNumber] = { ...layout };
      } else {
        console.warn(`No layout defined for node ${node.nodeNumber}`);
        positions[node.nodeNumber] = { column: 5, row: 0 };
      }
    }
    return positions;
  }

  /**
   * 드래그 스크롤 등록 (지도 방식)
   */
  _setupDragScroll(container) {
    if (this.currentScrollContainer) {
      this.dragManager.unregisterDraggable(this.currentScrollContainer);
    }
    this.currentScrollContainer = container;

    let scrollStartX = 0;
    let scrollStartY = 0;
    let isDragging = false;
    let velocity = { x: 0, y: 0 };
    let lastDragTime = 0;
    let animationFrame = null;

    this.dragManager.registerDraggable(container, {
      onDragStart: () => {
        isDragging = true;
        scrollStartX = container.scrollLeft;
        scrollStartY = container.scrollTop;
        lastDragTime = Date.now();
        velocity = { x: 0, y: 0 };
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
        container.style.cursor = 'grabbing';
      },

      onDrag: (e) => {
        if (!isDragging) return;
        container.scrollLeft = scrollStartX - e.totalDeltaX;
        container.scrollTop = scrollStartY - e.totalDeltaY;

        const now = Date.now();
        const dt = (now - lastDragTime) / 1000;
        if (dt > 0) {
          velocity.x = e.deltaX / dt;
          velocity.y = e.deltaY / dt;
        }
        lastDragTime = now;
      },

      onDragEnd: () => {
        isDragging = false;
        container.style.cursor = 'grab';
        const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
        if (speed > 100) {
          this._applyInertiaScroll(container, velocity);
        }
      }
    });

    container.style.cursor = 'grab';
  }

  /**
   * 관성 스크롤 적용
   */
  _applyInertiaScroll(container, velocity) {
    const friction = 0.95;
    const minVelocity = 10;

    const animate = () => {
      velocity.x *= friction;
      velocity.y *= friction;
      container.scrollLeft -= velocity.x * 0.016;
      container.scrollTop -= velocity.y * 0.016;

      if (Math.sqrt(velocity.x ** 2 + velocity.y ** 2) > minVelocity) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  /**
   * 선행 조건 배열을 표시 텍스트로 변환
   * @param {Array} prerequisites
   * @returns {string}
   */
  formatPrerequisites(prerequisites) {
    if (!prerequisites || prerequisites.length === 0) return '';

    const isNestedArray = Array.isArray(prerequisites[0]);
    if (!isNestedArray) return prerequisites.join(' 또는 ');

    return prerequisites
      .map(andGroup => andGroup.length === 1 ? andGroup[0] : andGroup.join(' + '))
      .join(' 또는 ');
  }
}
