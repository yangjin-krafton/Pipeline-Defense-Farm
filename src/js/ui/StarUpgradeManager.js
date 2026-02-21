/**
 * StarUpgradeManager.js
 * 타워 승급 시스템 전용 관리 모듈
 */

export class StarUpgradeManager {
  constructor(gameLoop, uiController) {
    this.gameLoop = gameLoop;
    this.uiController = uiController;

    // Upgrade state
    this.isUpgrading = false; // Prevent sheet close during upgrade
    this.starUpgradeState = null; // Current upgrade state
  }

  /**
   * Check if currently upgrading
   * @returns {boolean}
   */
  isCurrentlyUpgrading() {
    return this.isUpgrading;
  }

  /**
   * Show star upgrade UI (승급 전용 UI 표시)
   * @param {BaseTower} tower - Tower to upgrade
   */
  showStarUpgradeUI(tower) {
    if (!this.gameLoop) return;

    const towerGrowthSystem = this.gameLoop.getTowerGrowthSystem();
    const economySystem = this.gameLoop.getEconomySystem();

    // 게임 정지
    this.gameLoop.pause();

    // 현재 타워 상태 저장 (취소 시 복원용)
    this.starUpgradeState = {
      tower: tower,
      originalStar: tower.star,
      originalStarBonuses: JSON.parse(JSON.stringify(tower.starBonuses)),
      currentStatRoll: null,
      rerollCount: 0,
      expandCount: 0,
      selectedImprint: null,
      imprintOptions: []
    };

    // 승급 비용 계산
    const upgradeCost = towerGrowthSystem.getUpgradeCost(tower.star);

    // 초기 스탯 롤
    this.starUpgradeState.currentStatRoll = towerGrowthSystem._rollStatGains();

    // 각인 옵션 생성 (1개)
    this._generateImprintOptions(tower, 1);

    // Hide other UIs, show star upgrade UI
    const towerDetailContent = document.getElementById('tower-detail');
    const towerBuildContent = document.getElementById('tower-build');
    const starUpgradeUI = document.getElementById('tower-star-upgrade');

    if (towerDetailContent) {
      towerDetailContent.classList.add('hidden');
    }
    if (towerBuildContent) {
      towerBuildContent.classList.add('hidden');
    }
    if (starUpgradeUI) {
      starUpgradeUI.classList.remove('hidden');
    }

    // Update UI
    this._updateStarUpgradeUI();

    // Prevent sheet close
    this.isUpgrading = true;

    console.log('[StarUpgradeManager] Star upgrade UI opened');
  }

  /**
   * Generate imprint options (각인 옵션 생성)
   * @param {BaseTower} tower - Tower
   * @param {number} count - Number of options to generate
   */
  _generateImprintOptions(tower, count) {
    // Get available upgrade nodes from tower's upgrade tree
    const upgradeTree = tower.upgradeTree;
    const allNodes = upgradeTree.nodes;
    const activeNodeNumbers = upgradeTree.activeNodes.map(n => n.nodeNumber);

    // Get only active nodes as imprint candidates
    const candidateNodes = allNodes.filter(node => activeNodeNumbers.includes(node.nodeNumber));

    if (candidateNodes.length === 0) {
      console.warn('[StarUpgradeManager] No active nodes for imprint');
      return;
    }

    // Generate random imprint options
    for (let i = 0; i < count; i++) {
      const randomNode = candidateNodes[Math.floor(Math.random() * candidateNodes.length)];
      this.starUpgradeState.imprintOptions.push({
        nodeNumber: randomNode.nodeNumber,
        nodeName: randomNode.name,
        nodeDescription: randomNode.description || `${randomNode.name} 효과 강화`
      });
    }
  }

  /**
   * Update star upgrade UI (승급 UI 업데이트)
   */
  _updateStarUpgradeUI() {
    const state = this.starUpgradeState;
    if (!state) return;

    const tower = state.tower;
    const towerGrowthSystem = this.gameLoop.getTowerGrowthSystem();
    const economySystem = this.gameLoop.getEconomySystem();

    // Update header
    const upgradeFromStar = document.getElementById('upgradeFromStar');
    const upgradeToStar = document.getElementById('upgradeToStar');
    if (upgradeFromStar) upgradeFromStar.textContent = `${state.originalStar}성`;
    if (upgradeToStar) upgradeToStar.textContent = `${state.originalStar + 1}성`;

    // Update stat comparison
    this._updateStatComparison(state.originalStarBonuses, state.currentStatRoll);

    // Update reroll button
    const rerollCost = this._getRerollCost(state.rerollCount);
    const rerollCostDisplay = document.getElementById('rerollCostDisplay');
    const rerollBtn = document.getElementById('rerollStatsBtn');
    const rerollCountInfo = document.getElementById('rerollCountInfo');

    if (rerollCostDisplay) rerollCostDisplay.textContent = `⚡ ${rerollCost}`;
    if (rerollCountInfo) rerollCountInfo.textContent = `리롤 횟수: ${state.rerollCount}회`;

    if (rerollBtn) {
      const canAffordReroll = economySystem.canAffordSC(rerollCost);
      rerollBtn.disabled = !canAffordReroll;
      rerollBtn.style.opacity = canAffordReroll ? '1' : '0.5';
      rerollBtn.style.cursor = canAffordReroll ? 'pointer' : 'not-allowed';

      rerollBtn.onclick = () => {
        if (!canAffordReroll) {
          this.uiController._showToast('⚡ SC 부족', 'error');
          return;
        }

        economySystem.spendSC(rerollCost);
        state.rerollCount++;

        // Re-roll stats
        state.currentStatRoll = towerGrowthSystem._rollStatGains();

        this.uiController._showToast(`스탯 리롤 (${state.rerollCount}회)`, 'success');
        this.uiController.updateNutritionDisplay(economySystem.getState());
        this._updateStarUpgradeUI();
      };
    }

    // Update imprint cards
    this._updateImprintCards();

    // Update expand choice button
    const expandCost = 30;
    const expandBtn = document.getElementById('expandChoiceBtn');
    const expandCountInfo = document.getElementById('expandCountInfo');

    if (expandCountInfo) expandCountInfo.textContent = `추가 선택지: ${state.expandCount}/2`;

    if (expandBtn) {
      const canExpand = state.expandCount < 2;
      const canAffordExpand = economySystem.canAffordSC(expandCost);
      const canUseExpand = canExpand && canAffordExpand;

      expandBtn.disabled = !canUseExpand;
      expandBtn.style.opacity = canUseExpand ? '1' : '0.5';
      expandBtn.style.cursor = canUseExpand ? 'pointer' : 'not-allowed';

      expandBtn.onclick = () => {
        if (!canUseExpand) {
          if (!canExpand) {
            this.uiController._showToast('최대 2개까지 추가 가능', 'error');
          } else {
            this.uiController._showToast('⚡ SC 부족', 'error');
          }
          return;
        }

        economySystem.spendSC(expandCost);
        state.expandCount++;

        // Generate 1 more imprint option
        this._generateImprintOptions(tower, 1);

        this.uiController._showToast(`선택지 추가 (${state.expandCount}/2)`, 'success');
        this.uiController.updateNutritionDisplay(economySystem.getState());
        this._updateStarUpgradeUI();
      };
    }

    // Update confirm button
    this._updateConfirmButton();
  }

  /**
   * Update stat comparison display (스탯 비교 표시)
   * @param {Object} oldBonuses - Original star bonuses
   * @param {Object} newGains - New stat gains from roll
   */
  _updateStatComparison(oldBonuses, newGains) {
    const statComparisonGrid = document.getElementById('statComparisonGrid');
    if (!statComparisonGrid) return;

    const stats = [
      {
        name: '공격력',
        icon: '⚔️',
        oldValue: oldBonuses.damageMultiplier,
        newGain: newGains.damageMultiplier,
        isMultiplier: true
      },
      {
        name: '공격속도',
        icon: '⚡',
        oldValue: oldBonuses.attackSpeedMultiplier,
        newGain: newGains.attackSpeedMultiplier,
        isMultiplier: true
      },
      {
        name: '사거리',
        icon: '📍',
        oldValue: oldBonuses.rangeMultiplier,
        newGain: newGains.rangeMultiplier,
        isMultiplier: true
      },
      {
        name: '상태이상 성공률',
        icon: '✨',
        oldValue: oldBonuses.statusSuccessRate,
        newGain: newGains.statusSuccessRate,
        isMultiplier: false
      }
    ];

    statComparisonGrid.innerHTML = '';

    stats.forEach(stat => {
      const oldPercent = stat.isMultiplier ? ((stat.oldValue - 1) * 100) : (stat.oldValue * 100);
      const newGainPercent = stat.isMultiplier ? (stat.newGain * 100) : (stat.newGain * 100);
      const newTotalValue = stat.isMultiplier ? (stat.oldValue * (1 + stat.newGain)) : (stat.oldValue + stat.newGain);
      const newTotalPercent = stat.isMultiplier ? ((newTotalValue - 1) * 100) : (newTotalValue * 100);

      const statRow = document.createElement('div');
      statRow.className = 'stat-comparison-row';
      statRow.innerHTML = `
        <div class="stat-comparison-name">
          <span class="stat-icon">${stat.icon}</span>
          <span>${stat.name}</span>
        </div>
        <div class="stat-comparison-values">
          <span class="old-value">+${oldPercent.toFixed(1)}%</span>
          <span class="arrow">→</span>
          <span class="new-value">+${newTotalPercent.toFixed(1)}%</span>
          <span class="gain">(+${newGainPercent.toFixed(1)}%)</span>
        </div>
      `;
      statComparisonGrid.appendChild(statRow);
    });
  }

  /**
   * Update imprint cards display (각인 카드 표시)
   */
  _updateImprintCards() {
    const imprintCardsContainer = document.getElementById('imprintCardsContainer');
    if (!imprintCardsContainer) return;

    const state = this.starUpgradeState;
    imprintCardsContainer.innerHTML = '';

    state.imprintOptions.forEach((option, index) => {
      const card = document.createElement('div');
      card.className = 'imprint-card';
      if (state.selectedImprint === index) {
        card.classList.add('selected');
      }

      card.innerHTML = `
        <div class="imprint-card-header">
          <span class="imprint-icon">✨</span>
          <span class="imprint-name">${option.nodeName}</span>
        </div>
        <div class="imprint-card-description">${option.nodeDescription}</div>
      `;

      card.addEventListener('click', () => {
        state.selectedImprint = index;
        this._updateImprintCards();
        this._updateConfirmButton();
      });

      imprintCardsContainer.appendChild(card);
    });
  }

  /**
   * Update confirm button (승급 확인 버튼 업데이트)
   */
  _updateConfirmButton() {
    const confirmBtn = document.getElementById('upgradeConfirmBtn');
    if (!confirmBtn) return;

    const state = this.starUpgradeState;
    const hasSelection = state.selectedImprint !== null;

    if (hasSelection) {
      confirmBtn.classList.remove('disabled');
      confirmBtn.innerHTML = `
        <span class="confirm-icon">⭐</span>
        <span class="confirm-text">승급 완료</span>
      `;
      confirmBtn.onclick = () => {
        this.completeStarUpgrade();
      };
    } else {
      confirmBtn.classList.add('disabled');
      confirmBtn.innerHTML = `
        <span class="confirm-icon">⚠️</span>
        <span class="confirm-text">각인을 선택해주세요</span>
      `;
      confirmBtn.onclick = null;
    }
  }

  /**
   * Complete star upgrade (승급 완료 처리)
   */
  completeStarUpgrade() {
    const state = this.starUpgradeState;
    if (!state || state.selectedImprint === null) return;

    const tower = state.tower;
    const towerGrowthSystem = this.gameLoop.getTowerGrowthSystem();
    const economySystem = this.gameLoop.getEconomySystem();

    // Pay upgrade cost
    const upgradeCost = towerGrowthSystem.getUpgradeCost(state.originalStar);
    if (!economySystem.spendBoth(upgradeCost.nc, upgradeCost.sc)) {
      this.uiController._showToast('비용 부족', 'error');
      return;
    }

    // Apply star upgrade
    tower.star++;
    tower.xp = 0;
    tower.level = 1;

    // Apply stat gains
    towerGrowthSystem._applyStatGains(tower, state.currentStatRoll);

    // Apply imprint (각인 적용 - 향후 구현)
    const selectedImprint = state.imprintOptions[state.selectedImprint];
    console.log('[StarUpgradeManager] Selected imprint:', selectedImprint);
    // TODO: Implement imprint system

    // Show success toast
    this.uiController._showToast(`⭐ ${state.originalStar}성 → ${tower.star}성 승급 완료!`, 'success');

    // Update currency display
    this.uiController.updateNutritionDisplay(economySystem.getState());

    // Resume game
    this.gameLoop.resume();
    this.isUpgrading = false;

    // Close upgrade UI and show tower detail
    const starUpgradeUI = document.getElementById('tower-star-upgrade');
    if (starUpgradeUI) {
      starUpgradeUI.classList.add('hidden');
    }

    // Refresh tower detail
    this.uiController.selectTowerSlot(this.uiController.selectedSlot);

    // Clear state
    this.starUpgradeState = null;

    console.log('[StarUpgradeManager] Star upgrade completed');
  }

  /**
   * Get reroll cost based on reroll count (리롤 비용 계산 - 횟수마다 증가)
   * @param {number} rerollCount - Current reroll count
   * @returns {number} SC cost
   */
  _getRerollCost(rerollCount) {
    // 첫 리롤: 20 SC
    // 이후 리롤: +10 SC씩 증가 (20, 30, 40, 50, ...)
    return 20 + (rerollCount * 10);
  }
}
