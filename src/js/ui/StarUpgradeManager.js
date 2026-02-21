/**
 * StarUpgradeManager.js
 * 타워 승급 시스템 전용 관리 모듈
 */

import { StatRollingAnimation } from './StatRollingAnimation.js';
import { UIParticleSystem } from './UIParticleSystem.js';
import { UpgradeCelebration } from './UpgradeCelebration.js';

export class StarUpgradeManager {
  constructor(gameLoop, uiController) {
    this.gameLoop = gameLoop;
    this.uiController = uiController;

    // Upgrade state
    this.isUpgrading = false; // Prevent sheet close during upgrade
    this.starUpgradeState = null; // Current upgrade state

    // Animation systems
    this.rollingAnimation = new StatRollingAnimation();
    this.uiParticleSystem = new UIParticleSystem();
    this.upgradeCelebration = null; // Lazy initialization
  }

  /**
   * Check if currently upgrading
   * @returns {boolean}
   */
  isCurrentlyUpgrading() {
    return this.isUpgrading;
  }

  _playUpgradeSfx(eventName, volume = 0.7) {
    if (!this.uiController || typeof this.uiController._playUISfx !== 'function') return;
    this.uiController._playUISfx(eventName, { volume });
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
    this._playUpgradeSfx('tower_upgrade', 0.72);

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

    // 초기 스탯 롤 (등급 정보 포함)
    this.starUpgradeState.currentStatRoll = towerGrowthSystem._rollStatGainsWithGrades();

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

      // Initialize particle system
      this.uiParticleSystem.init(starUpgradeUI);
    }

    // Update UI
    this._updateStarUpgradeUI();

    // Initial stat rolling animation (처음 열 때 스탯 롤링)
    setTimeout(() => {
      this._playUpgradeSfx('shot', 0.5);
      const statElements = document.querySelectorAll('.stat-comparison-values .new-value');
      const stats = [
        { element: statElements[0], value: this.starUpgradeState.currentStatRoll.damageMultiplier, min: 0.07, max: 0.11, grade: this.starUpgradeState.currentStatRoll.damageGrade },
        { element: statElements[1], value: this.starUpgradeState.currentStatRoll.attackSpeedMultiplier, min: 0.02, max: 0.04, grade: this.starUpgradeState.currentStatRoll.attackSpeedGrade },
        { element: statElements[2], value: this.starUpgradeState.currentStatRoll.rangeMultiplier, min: 0.01, max: 0.03, grade: this.starUpgradeState.currentStatRoll.rangeGrade },
        { element: statElements[3], value: this.starUpgradeState.currentStatRoll.statusSuccessRate, min: 0.015, max: 0.03, grade: this.starUpgradeState.currentStatRoll.statusGrade }
      ];

      this.rollingAnimation.startRolling(stats, () => {
        this._playUpgradeSfx('crit', 0.54);
        console.log('[StarUpgradeManager] Initial stat rolling complete');
      });
    }, 100);

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
    // Get active nodes from tower's upgrade tree
    const upgradeTree = tower.upgradeTree;
    const activeNodes = upgradeTree.activeNodes;

    if (activeNodes.length === 0) {
      console.warn('[StarUpgradeManager] No active nodes for imprint');
      return;
    }

    // Get already selected node numbers to avoid duplicates
    const selectedNodeNumbers = this.starUpgradeState.imprintOptions.map(opt => opt.nodeNumber);

    // Filter out already selected nodes
    const availableNodes = activeNodes.filter(node => !selectedNodeNumbers.includes(node.nodeNumber));

    if (availableNodes.length === 0) {
      console.warn('[StarUpgradeManager] No more unique nodes available for imprint');
      return;
    }

    // Generate random imprint options from active nodes (no duplicates)
    for (let i = 0; i < count && availableNodes.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * availableNodes.length);
      const randomNode = availableNodes[randomIndex];

      // Remove from available to prevent duplicates in this batch
      availableNodes.splice(randomIndex, 1);

      // Store complete node information for permanent effect
      this.starUpgradeState.imprintOptions.push({
        nodeNumber: randomNode.nodeNumber,
        nodeName: randomNode.name,
        nodeDescription: randomNode.effect || `${randomNode.name} 효과`,
        // Store original node reference for permanent effect
        imprintedNode: randomNode
      });
    }

    console.log(`[StarUpgradeManager] Generated ${count} imprint option(s) from ${activeNodes.length} active nodes`);
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
    if (rerollCountInfo) rerollCountInfo.textContent = `${state.rerollCount}회`;

    if (rerollBtn) {
      const canAffordReroll = economySystem.canAffordSC(rerollCost);
      rerollBtn.disabled = !canAffordReroll;
      rerollBtn.style.opacity = canAffordReroll ? '1' : '0.5';
      rerollBtn.style.cursor = canAffordReroll ? 'pointer' : 'not-allowed';

      rerollBtn.onclick = async () => {
        this._playUpgradeSfx('ui_click', 0.62);
        if (!canAffordReroll) {
          this.uiController._showToast('⚡ SC 부족', 'error');
          return;
        }

        // 롤링 중에는 버튼 비활성화
        if (this.rollingAnimation.isRolling) return;

        economySystem.spendSC(rerollCost);
        state.rerollCount++;
        this._playUpgradeSfx('tower_upgrade', 0.66);

        // Re-roll stats (등급 정보 포함)
        state.currentStatRoll = towerGrowthSystem._rollStatGainsWithGrades();

        this.uiController._showToast(`스탯 리롤 (${state.rerollCount}회)`, 'success');
        this.uiController.updateNutritionDisplay(economySystem.getState());

        // Particle effect on reroll
        const btnRect = rerollBtn.getBoundingClientRect();
        const containerRect = document.getElementById('tower-star-upgrade').getBoundingClientRect();
        this.uiParticleSystem.emitBurst(
          btnRect.left + btnRect.width / 2 - containerRect.left,
          btnRect.top + btnRect.height / 2 - containerRect.top,
          '#ff006e',
          30
        );

        // 스탯 롤링 애니메이션 시작
        const statElements = document.querySelectorAll('.stat-comparison-values .new-value');
        const stats = [
          { element: statElements[0], value: state.currentStatRoll.damageMultiplier, min: 0.07, max: 0.11, grade: state.currentStatRoll.damageGrade },
          { element: statElements[1], value: state.currentStatRoll.attackSpeedMultiplier, min: 0.02, max: 0.04, grade: state.currentStatRoll.attackSpeedGrade },
          { element: statElements[2], value: state.currentStatRoll.rangeMultiplier, min: 0.01, max: 0.03, grade: state.currentStatRoll.rangeGrade },
          { element: statElements[3], value: state.currentStatRoll.statusSuccessRate, min: 0.015, max: 0.03, grade: state.currentStatRoll.statusGrade }
        ];

        this._playUpgradeSfx('shot', 0.52);
        await this.rollingAnimation.startRolling(stats, () => {
          // 롤링 완료 후 UI 업데이트
          this._playUpgradeSfx('crit', 0.58);
          this._updateStarUpgradeUI();
        });
      };
    }

    // Update imprint cards
    this._updateImprintCards();

    // Update expand choice button
    const expandCost = 30;
    const expandBtn = document.getElementById('expandChoiceBtn');
    const expandCountInfo = document.getElementById('expandCountInfo');

    if (expandCountInfo) expandCountInfo.textContent = `${state.expandCount}/2`;

    if (expandBtn) {
      const canExpand = state.expandCount < 2;
      const canAffordExpand = economySystem.canAffordSC(expandCost);
      const canUseExpand = canExpand && canAffordExpand;

      expandBtn.disabled = !canUseExpand;
      expandBtn.style.opacity = canUseExpand ? '1' : '0.5';
      expandBtn.style.cursor = canUseExpand ? 'pointer' : 'not-allowed';

      expandBtn.onclick = () => {
        this._playUpgradeSfx('ui_click', 0.6);
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
        this._playUpgradeSfx('tower_upgrade', 0.62);

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
        newGrade: newGains.damageGrade,
        isMultiplier: true
      },
      {
        name: '공격속도',
        icon: '⚡',
        oldValue: oldBonuses.attackSpeedMultiplier,
        newGain: newGains.attackSpeedMultiplier,
        newGrade: newGains.attackSpeedGrade,
        isMultiplier: true
      },
      {
        name: '사거리',
        icon: '📍',
        oldValue: oldBonuses.rangeMultiplier,
        newGain: newGains.rangeMultiplier,
        newGrade: newGains.rangeGrade,
        isMultiplier: true
      },
      {
        name: '상태이상 성공률',
        icon: '✨',
        oldValue: oldBonuses.statusSuccessRate,
        newGain: newGains.statusSuccessRate,
        newGrade: newGains.statusGrade,
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
          <div class="stat-grade-badge" style="background: ${stat.newGrade.color}">
            <span class="grade-emoji">${stat.newGrade.emoji}</span>
            <span class="grade-text">${stat.newGrade.grade}</span>
          </div>
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

      // 카드 입장 애니메이션 (순차 등장)
      card.classList.add('appearing');
      card.style.animationDelay = `${index * 100}ms`;

      card.innerHTML = `
        <div class="imprint-card-inner">
          <div class="imprint-card-header">
            <span class="imprint-icon">✨</span>
            <span class="imprint-name">${option.nodeName}</span>
          </div>
          <div class="imprint-card-content">
            <p class="imprint-card-description">${option.nodeDescription}</p>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        this._playUpgradeSfx('ui_click', 0.64);
        // 선택 애니메이션
        card.classList.add('selecting');
        setTimeout(() => card.classList.remove('selecting'), 500);

        state.selectedImprint = index;

        // Particle effect on card click
        const rect = card.getBoundingClientRect();
        const containerRect = document.getElementById('tower-star-upgrade').getBoundingClientRect();
        this.uiParticleSystem.emitSparkles(
          rect.left + rect.width / 2 - containerRect.left,
          rect.top + rect.height / 2 - containerRect.top,
          '#00d9ff',
          20
        );

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
        this._playUpgradeSfx('tower_upgrade', 0.74);
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
  async completeStarUpgrade() {
    const state = this.starUpgradeState;
    if (!state || state.selectedImprint === null) return;

    const tower = state.tower;
    const towerGrowthSystem = this.gameLoop.getTowerGrowthSystem();
    const economySystem = this.gameLoop.getEconomySystem();

    // 비용은 이미 upgrade-points 클릭 시 차감되었음

    // Apply star upgrade
    tower.star++;
    tower.xp = 0;
    tower.level = 1;

    // Reset upgrade tree
    if (tower.upgradeTree) {
      tower.upgradeTree.reset();
    }

    // Reset upgrade points to 1 (starting points for Lv1)
    tower.upgradePoints = 1;

    // Apply stat gains
    towerGrowthSystem._applyStatGains(tower, state.currentStatRoll);

    // Apply imprint (각인 저장 - 노드 전체 정보 포함)
    const selectedImprint = state.imprintOptions[state.selectedImprint];

    // Get original node from upgrade tree
    const originalNode = state.tower.upgradeTree.nodes.find(n => n.nodeNumber === selectedImprint.nodeNumber);

    // Increase imprint count for this node
    const currentCount = tower.imprintCounts.get(selectedImprint.nodeNumber) || 0;
    tower.imprintCounts.set(selectedImprint.nodeNumber, currentCount + 1);

    tower.imprints.push({
      nodeNumber: selectedImprint.nodeNumber,
      nodeName: selectedImprint.nodeName,
      nodeDescription: selectedImprint.nodeDescription,
      acquiredStar: tower.star,  // 몇 성에서 획득했는지 기록
      statGains: JSON.parse(JSON.stringify(state.currentStatRoll)),  // 해당 승급 시 스탯 보너스 기록
      imprintCount: currentCount + 1,  // 이 노드의 각인 횟수 (1, 2, 3, ...)
      // 노드 전체 정보 저장 (영구 효과 적용용)
      imprintedNode: originalNode  // UpgradeNode 참조 저장
    });

    console.log('[StarUpgradeManager] Selected imprint:', selectedImprint.nodeName);
    console.log('[StarUpgradeManager] Imprint count for node', selectedImprint.nodeNumber, ':', currentCount + 1);
    console.log('[StarUpgradeManager] Total imprints:', tower.imprints.length);

    // Update currency display
    this.uiController.updateNutritionDisplay(economySystem.getState());

    // 축하 연출 실행
    if (!this.upgradeCelebration) {
      this.upgradeCelebration = new UpgradeCelebration(
        this.uiParticleSystem,
        (eventName, volume) => this._playUpgradeSfx(eventName, volume)
      );
    }

    this._playUpgradeSfx('wave_start', 0.8);
    await this.upgradeCelebration.celebrate(
      state.originalStar,
      tower.star,
      selectedImprint.nodeName,
      () => {
        // 축하 연출 완료 후 처리
        console.log('[StarUpgradeManager] Celebration complete');
      }
    );
    this._playUpgradeSfx('wave_clear', 0.88);

    // Show success toast
    this.uiController._showToast(`⭐ ${state.originalStar}성 → ${tower.star}성 승급 완료!`, 'success');

    // Resume game
    this.gameLoop.resume();
    this.isUpgrading = false;

    // Destroy particle system
    this.uiParticleSystem.destroy();

    // Close upgrade UI and show tower detail
    const starUpgradeUI = document.getElementById('tower-star-upgrade');
    if (starUpgradeUI) {
      starUpgradeUI.classList.add('hidden');
    }

    // Refresh tower detail
    this.uiController.selectTowerSlot(this.uiController.selectedSlot);

    // Clear state
    this.starUpgradeState = null;

    console.log('[StarUpgradeManager] Star upgrade completed - Level reset to 1, Points reset to 1, Tree reset');
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
