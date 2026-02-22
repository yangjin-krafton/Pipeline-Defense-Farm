/**
 * StarUpgradeManager.js
 * 타워 승급 시스템 전용 관리 모듈
 */

import { StatRollingAnimation } from './StatRollingAnimation.js';
import { UIParticleSystem } from './UIParticleSystem.js';
import { UpgradeCelebration } from './UpgradeCelebration.js';
import { formatTagText } from '../utils/TagFormatter.js';

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

  /**
   * 승급 UI를 숨기고 상태를 초기화 (tower.pendingUpgrade는 유지)
   * 다른 타워 선택 또는 시트 닫기 시 호출
   */
  dismissUpgradeUI() {
    const starUpgradeUI = document.getElementById('tower-star-upgrade');
    if (starUpgradeUI) starUpgradeUI.classList.add('hidden');
    this.uiParticleSystem.destroy();
    this.isUpgrading = false;
    this.starUpgradeState = null;
  }

  _playUpgradeSfx(eventName, volume = 0.7) {
    if (!this.uiController || typeof this.uiController._playUISfx !== 'function') return;
    this.uiController._playUISfx(eventName, { volume });
  }

  /**
   * 현재 승급 상태를 저장 가능한 형태로 직렬화
   * @returns {Object|null}
   */
  _buildPendingUpgradeData() {
    const state = this.starUpgradeState;
    if (!state) return null;
    return {
      statRoll: JSON.parse(JSON.stringify(state.currentStatRoll)),
      imprintOptions: state.imprintOptions.map(opt => ({
        nodeNumber: opt.nodeNumber,
        nodeName: opt.nodeName,
        nodeDescription: opt.nodeDescription
      })),
      rerollCount: state.rerollCount,
      expandCount: state.expandCount,
      selectedImprint: state.selectedImprint
    };
  }

  /**
   * Show star upgrade UI (승급 전용 UI 표시)
   * @param {BaseTower} tower - Tower to upgrade
   * @param {Object|null} restoredState - 재접속 시 복원할 pending 상태 (null이면 새로 시작)
   */
  showStarUpgradeUI(tower, restoredState = null) {
    if (!this.gameLoop) return;

    const towerGrowthSystem = this.gameLoop.getTowerGrowthSystem();
    const economySystem = this.gameLoop.getEconomySystem();

    // 게임은 0.5배속 유지 (시트 오픈 시 이미 설정됨), 일시정지 없음
    this._playUpgradeSfx('tower_upgrade', 0.72);

    if (restoredState) {
      // 재접속 복원: 저장된 상태 그대로 사용 (비용은 이미 차감됨)
      const restoredOptions = restoredState.imprintOptions.map(opt => ({
        nodeNumber: opt.nodeNumber,
        nodeName: opt.nodeName,
        nodeDescription: opt.nodeDescription,
        imprintedNode: tower.upgradeTree?.nodes.find(n => n.nodeNumber === opt.nodeNumber) || null
      }));

      this.starUpgradeState = {
        tower: tower,
        originalStar: tower.star,
        originalStarBonuses: JSON.parse(JSON.stringify(tower.starBonuses)),
        currentStatRoll: restoredState.statRoll,
        rerollCount: restoredState.rerollCount,
        expandCount: restoredState.expandCount,
        selectedImprint: restoredState.selectedImprint,
        imprintOptions: restoredOptions
      };
      console.log('[StarUpgradeManager] Restored pending upgrade state');
    } else {
      // 새 승급: 상태 초기화 후 스탯 롤
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

      this.starUpgradeState.currentStatRoll = towerGrowthSystem._rollStatGainsWithGrades();
      this._generateImprintOptions(tower, 1);

      // 타워에 승급 대기 상태 기록
      tower.pendingUpgrade = this._buildPendingUpgradeData();
    }

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

    // 스탯 롤링 애니메이션 (재접속 복원 시에는 애니메이션 없이 즉시 표시)
    if (!restoredState) {
      setTimeout(() => {
        this._playUpgradeSfx('shot', 0.5);
        const statElements = document.querySelectorAll('.stat-comparison-values .new-value');
        const roll = this.starUpgradeState.currentStatRoll;
        const stats = [
          { element: statElements[0], value: roll.damageMultiplier,      min: 0.07, max: 0.11, grade: roll.damageGrade },
          { element: statElements[1], value: roll.attackSpeedMultiplier, min: 0.02, max: 0.04, grade: roll.attackSpeedGrade },
          { element: statElements[2], value: roll.rangeMultiplier,        min: 0.01, max: 0.03, grade: roll.rangeGrade },
          { element: statElements[3], value: roll.critChance,             min: 0.01, max: 0.04, grade: roll.critGrade },
          { element: statElements[4], value: roll.critMultBonus,          min: 0.10, max: 0.40, grade: roll.critMultGrade }
        ];

        this.rollingAnimation.startRolling(stats, () => {
          this._playUpgradeSfx('crit', 0.54);
          console.log('[StarUpgradeManager] Initial stat rolling complete');
        }, (event, volume) => this._playUpgradeSfx(event, volume));
      }, 100);
    }

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

        // SC 소비 낙하 연출
        if (this.uiController.resourceAbsorptionSystem) {
          this.uiController.resourceAbsorptionSystem.emitDrop('sc', rerollCost);
        }

        // Re-roll stats (등급 정보 포함)
        state.currentStatRoll = towerGrowthSystem._rollStatGainsWithGrades();

        // 승급 대기 상태 갱신 후 저장
        state.tower.pendingUpgrade = this._buildPendingUpgradeData();
        this.uiController._triggerSave();

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
        const roll = state.currentStatRoll;
        const stats = [
          { element: statElements[0], value: roll.damageMultiplier,      min: 0.07, max: 0.11, grade: roll.damageGrade },
          { element: statElements[1], value: roll.attackSpeedMultiplier, min: 0.02, max: 0.04, grade: roll.attackSpeedGrade },
          { element: statElements[2], value: roll.rangeMultiplier,        min: 0.01, max: 0.03, grade: roll.rangeGrade },
          { element: statElements[3], value: roll.critChance,             min: 0.01, max: 0.04, grade: roll.critGrade },
          { element: statElements[4], value: roll.critMultBonus,          min: 0.10, max: 0.40, grade: roll.critMultGrade }
        ];

        this._playUpgradeSfx('shot', 0.52);
        await this.rollingAnimation.startRolling(stats, () => {
          // 롤링 완료 후 UI 업데이트
          this._playUpgradeSfx('crit', 0.58);
          this._updateStarUpgradeUI();
        }, (event, volume) => this._playUpgradeSfx(event, volume));
      };
    }

    // Update imprint cards
    this._updateImprintCards();

    // Update expand choice button (횟수 제한 없음, 비용 2배씩 증가)
    const expandCost = this._getExpandCost(state.expandCount);
    const expandBtn = document.getElementById('expandChoiceBtn');
    const expandCountInfo = document.getElementById('expandCountInfo');
    const expandCostDisplay = document.getElementById('expandCostDisplay');

    if (expandCountInfo) expandCountInfo.textContent = `${state.expandCount}회`;
    if (expandCostDisplay) expandCostDisplay.textContent = `⚡ ${expandCost}`;

    if (expandBtn) {
      const canAffordExpand = economySystem.canAffordSC(expandCost);

      expandBtn.disabled = !canAffordExpand;
      expandBtn.style.opacity = canAffordExpand ? '1' : '0.5';
      expandBtn.style.cursor = canAffordExpand ? 'pointer' : 'not-allowed';

      expandBtn.onclick = () => {
        this._playUpgradeSfx('ui_click', 0.6);
        if (!canAffordExpand) {
          this.uiController._showToast('⚡ SC 부족', 'error');
          return;
        }

        economySystem.spendSC(expandCost);
        state.expandCount++;
        this._playUpgradeSfx('tower_upgrade', 0.62);

        // SC 소비 낙하 연출
        if (this.uiController.resourceAbsorptionSystem) {
          this.uiController.resourceAbsorptionSystem.emitDrop('sc', expandCost);
        }

        // Generate 1 more imprint option
        this._generateImprintOptions(tower, 1);

        // 승급 대기 상태 갱신 후 저장
        state.tower.pendingUpgrade = this._buildPendingUpgradeData();
        this.uiController._triggerSave();

        this.uiController._showToast(`선택지 추가 (${state.expandCount}/2)`, 'success');
        this.uiController.updateNutritionDisplay(economySystem.getState());
        this._updateStarUpgradeUI();
      };
    }

    // Update confirm button
    this._updateConfirmButton();
  }

  /**
   * Update stat comparison display — 5-column card grid (tower-stats 스타일)
   * @param {Object} oldBonuses - Original star bonuses
   * @param {Object} newGains   - New stat gains from roll
   */
  _updateStatComparison(oldBonuses, newGains) {
    const statComparisonGrid = document.getElementById('statComparisonGrid');
    if (!statComparisonGrid) return;

    // 포맷 헬퍼: 승수형(×) vs 가산형(+%p)
    const fmtMult = (oldV, gain) => {
      const oldPct  = ((oldV - 1) * 100).toFixed(1);
      const total   = oldV * (1 + gain);
      const totPct  = ((total - 1) * 100).toFixed(1);
      const gainPct = (gain * 100).toFixed(1);
      return { old: `+${oldPct}%`, new: `+${totPct}%`, gain: `+${gainPct}%` };
    };
    const fmtAdd = (oldV, gain) => {
      const oldPct  = (oldV * 100).toFixed(1);
      const totPct  = ((oldV + gain) * 100).toFixed(1);
      const gainPct = (gain * 100).toFixed(1);
      return { old: `+${oldPct}%`, new: `+${totPct}%`, gain: `+${gainPct}%` };
    };
    const fmtCritMult = (oldV, gain) => {
      const base = 2.0;
      return {
        old:  `×${(base + oldV).toFixed(2)}`,
        new:  `×${(base + oldV + gain).toFixed(2)}`,
        gain: `+${gain.toFixed(2)}`
      };
    };

    const stats = [
      { icon: '⚔️', name: '공격력',   fmt: fmtMult,     oldV: oldBonuses.damageMultiplier,      gain: newGains.damageMultiplier,      grade: newGains.damageGrade },
      { icon: '⏱️', name: '공격속도', fmt: fmtMult,     oldV: oldBonuses.attackSpeedMultiplier, gain: newGains.attackSpeedMultiplier, grade: newGains.attackSpeedGrade },
      { icon: '📍', name: '사거리',   fmt: fmtMult,     oldV: oldBonuses.rangeMultiplier,       gain: newGains.rangeMultiplier,       grade: newGains.rangeGrade },
      { icon: '🎲', name: '치명타율', fmt: fmtAdd,      oldV: oldBonuses.critChance || 0,       gain: newGains.critChance,            grade: newGains.critGrade },
      { icon: '💥', name: '치명배율', fmt: fmtCritMult, oldV: oldBonuses.critMultBonus || 0,    gain: newGains.critMultBonus,         grade: newGains.critMultGrade }
    ];

    statComparisonGrid.innerHTML = '';

    stats.forEach(stat => {
      const f = stat.fmt(stat.oldV, stat.gain);
      const card = document.createElement('div');
      // stat-comparison-row 유지 → StatRollingAnimation의 flash 효과 호환
      card.className = 'stat-comp-card stat-comparison-row';
      card.innerHTML = `
        <span class="stat-comp-icon">${stat.icon}</span>
        <span class="stat-comp-old">${f.old}</span>
        <div class="stat-comparison-values">
          <span class="new-value stat-comp-new">${f.new}</span>
        </div>
        <div class="stat-grade-badge" style="background:${stat.grade.color}">
          <span class="grade-emoji">${stat.grade.emoji}</span>
          <span class="grade-text">${stat.grade.grade}</span>
        </div>
      `;
      statComparisonGrid.appendChild(card);
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
            <p class="imprint-card-description">${formatTagText(option.nodeDescription)}</p>
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

    // 게임 속도는 시트 닫을 때 복원됨 (여기서는 건드리지 않음)
    this.isUpgrading = false;

    // 승급 대기 상태 해제 후 저장
    tower.pendingUpgrade = null;
    this.uiController._triggerSave();

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
   * 리롤 비용 계산: 기본 20 SC × 1.2^count (횟수 제한 없음)
   * 예: 3 → 5 → 7 → 10 → 15 → 23 ...
   */
  _getRerollCost(rerollCount) {
    return Math.max(1, Math.round(3 * Math.pow(1.5, rerollCount)));
  }

  /**
   * 선택지 추가 비용 계산: 기본 30 SC × 2^count (횟수 제한 없음)
   * 예: 10 → 20 → 40 → 80 ...
   */
  _getExpandCost(expandCount) {
    return Math.round(10 * Math.pow(2.0, expandCount));
  }
}
