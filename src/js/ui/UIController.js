/**
 * UIController.js
 * UI 인터랙션 관리 (Splatoon Style)
 */

import { TOWER_DEFINITIONS } from '../digestion/data/towerDefinitions.js';
import { COST_RATIOS } from '../digestion/data/economyDefinitions.js';
import { dragManager } from '../core/DragManager.js';

export class UIController {
  constructor() {
    this.bottomSheet = null;
    this.sheetHandle = null;
    this.isExpanded = false;
    this.selectedTowerSlot = null;
    this.onSheetOpenCallback = null;
    this.onSheetCloseCallback = null;

    this.gameLoop = null; // Will be set by main.js
    this.selectedSlot = null;

    // Drag manager
    this.dragManager = dragManager;
    this.currentScrollContainer = null;

    // Speed control state
    this.previousTimeScale = 1.0; // Store previous speed before slow motion

    this.init();
  }

  init() {
    this.bottomSheet = document.getElementById('bottom-sheet');
    this.sheetHandle = document.getElementById('sheetHandle');
    this.towerDetailContent = document.getElementById('tower-detail');
    this.towerBuildContent = document.getElementById('tower-build');

    console.log('UIController init:', {
      bottomSheet: !!this.bottomSheet,
      sheetHandle: !!this.sheetHandle,
      towerDetail: !!this.towerDetailContent,
      towerBuild: !!this.towerBuildContent
    });

    if (!this.bottomSheet || !this.sheetHandle) {
      console.warn('Bottom sheet elements not found');
      return;
    }

    if (!this.towerDetailContent || !this.towerBuildContent) {
      console.warn('Tower content elements not found');
      return;
    }

    this.setupBottomSheet();
    this.setupSpeedControls();
    // Note: Tower interactions will be handled via WebGL2 rendering, not DOM events
  }

  /**
   * 하단 시트 접기/펼치기
   */
  setupBottomSheet() {
    const toggleSheet = () => {
      if (this.isExpanded) {
        this.closeSheet();
      } else {
        this.openSheet();
      }
    };

    // 핸들 클릭
    this.sheetHandle.addEventListener('click', toggleSheet);

    // 닫기 버튼 (타워 상세)
    const closeBtn = document.getElementById('closeBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeSheet();
      });
    }

    // 닫기 버튼 (타워 설치)
    const closeBuildBtn = document.getElementById('closeBuildBtn');
    if (closeBuildBtn) {
      closeBuildBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeSheet();
      });
    }

    // 판매 버튼 (판매 후 창 닫기)
    const sellBtn = document.getElementById('sellBtn');
    if (sellBtn) {
      sellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._handleSellTower();
      });
    }

    // 드래그로 열고 닫기
    this.setupDrag();
  }

  /**
   * 드래그로 시트 열고 닫기
   */
  setupDrag() {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const handleStart = (e) => {
      isDragging = true;
      startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    };

    const handleMove = (e) => {
      if (!isDragging) return;

      currentY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
      const deltaY = currentY - startY;

      // 드래그 방향에 따라 열기/닫기
      if (Math.abs(deltaY) > 50) {
        if (deltaY > 0 && this.isExpanded) {
          // 아래로 드래그 -> 닫기
          this.closeSheet();
        } else if (deltaY < 0 && !this.isExpanded) {
          // 위로 드래그 -> 열기
          this.openSheet();
        }
        isDragging = false;
      }
    };

    const handleEnd = () => {
      isDragging = false;
    };

    this.sheetHandle.addEventListener('mousedown', handleStart);
    this.sheetHandle.addEventListener('touchstart', handleStart, { passive: true });

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove, { passive: true });

    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);
  }

  /**
   * Open bottom sheet (can be called from external tower system)
   */
  openSheet() {
    if (!this.isExpanded) {
      this.isExpanded = true;
      this.bottomSheet.classList.add('expanded');

      // Slow down game when sheet opens (0.5x speed)
      if (this.gameLoop) {
        this.previousTimeScale = this.gameLoop.getTargetTimeScale();
        this.gameLoop.setTimeScale(0.5);
        this.updateSpeedButtonDisplay(0.5);
      }

      // Trigger callback after sheet animation completes (0.3s transition)
      if (this.onSheetOpenCallback) {
        setTimeout(() => {
          this.onSheetOpenCallback(this.selectedTowerSlot);
        }, 350); // Slightly longer than 0.3s transition
      }
    }
  }

  /**
   * Close bottom sheet
   */
  closeSheet() {
    if (this.isExpanded) {
      this.isExpanded = false;
      this.bottomSheet.classList.remove('expanded');
      this.selectedTowerSlot = null;

      // Restore previous game speed
      if (this.gameLoop) {
        const speedBoostSystem = this.gameLoop.getSpeedBoostSystem();
        const activeBoost = speedBoostSystem?.getActiveBoost();

        if (activeBoost) {
          // Restore boost speed if boost is active
          this.gameLoop.setTimeScale(activeBoost.speed);
          this.updateSpeedButtonDisplay(activeBoost.speed);
        } else {
          // No boost active, restore to 1x (default)
          this.gameLoop.setTimeScale(1.0);
          this.updateSpeedButtonDisplay(1.0);
        }
      }

      // Remove supply button if it exists
      const supplyBtn = document.getElementById('supplyBtn');
      if (supplyBtn) {
        supplyBtn.remove();
      }

      // Hide both content sections
      if (this.towerDetailContent) this.towerDetailContent.classList.add('hidden');
      if (this.towerBuildContent) this.towerBuildContent.classList.add('hidden');

      // Trigger callback when sheet closes
      if (this.onSheetCloseCallback) {
        this.onSheetCloseCallback();
      }
    }
  }

  /**
   * Select a tower slot and open the sheet
   */
  selectTowerSlot(slotData) {
    this.selectedTowerSlot = slotData;
    this.selectedSlot = slotData; // Store for supply actions

    if (!this.gameLoop) {
      console.warn('GameLoop not set in UIController');
      return;
    }

    const towerManager = this.gameLoop.getTowerManager();
    const existingTower = towerManager.getTowerAtSlot(slotData);

    if (existingTower) {
      // 타워가 설치되어 있음 - 상세 정보 표시
      this._showTowerDetail(existingTower);
    } else {
      // 빈 슬롯 - 타워 설치 UI 표시
      this._showTowerBuild();
    }

    this.openSheet();
  }

  /**
   * Set callback for when sheet opens
   */
  setOnSheetOpen(callback) {
    this.onSheetOpenCallback = callback;
  }

  /**
   * Set callback for when sheet closes
   */
  setOnSheetClose(callback) {
    this.onSheetCloseCallback = callback;
  }

  /* REMOVED: Tower interactions moved to WebGL2 rendering
   * When implementing WebGL2 tower clicks, use:
   * - uiController.openSheet() to show tower menu
   * - uiController.updateTowerInfo(data) to display tower details
   */

  /**
   * 잉크 스플래시 효과 생성
   */
  createInkSplash(event, color) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    for (let i = 0; i < 3; i++) {
      const splash = document.createElement('div');
      splash.className = 'ink-splash';
      splash.style.background = `radial-gradient(circle, ${color}, transparent)`;
      splash.style.left = x + (Math.random() - 0.5) * 60 + 'px';
      splash.style.top = y + (Math.random() - 0.5) * 60 + 'px';
      document.body.appendChild(splash);

      setTimeout(() => splash.remove(), 1000);
    }
  }

  /**
   * 랜덤 Splatoon 컬러
   */
  getRandomColor() {
    const colors = ['#e94560', '#00d9ff', '#ffd700'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * 리소스 업데이트
   */
  updateResource(type, value) {
    const resources = document.querySelectorAll('.resource');
    resources.forEach(resource => {
      const text = resource.textContent;
      if (text.includes(type)) {
        const emoji = text.split(' ')[0];
        resource.textContent = `${emoji} ${value}`;
      }
    });
  }

  /* REMOVED: Organ health UI has been removed from status bar
   * If health tracking is needed later, implement it differently
   */

  /**
   * 타워 정보 업데이트 (tower-detail 안에서만)
   */
  updateTowerInfo(towerData) {
    const detailSection = document.getElementById('tower-detail');
    if (!detailSection) return;

    // 타워 아이콘
    const iconLarge = detailSection.querySelector('.tower-icon-large');
    if (iconLarge) iconLarge.textContent = towerData.icon;

    // 타워 이름
    const titleElement = detailSection.querySelector('.tower-title h2');
    if (titleElement) titleElement.textContent = towerData.name;

    // 타워 서브타이틀
    const subtitleElement = detailSection.querySelector('.tower-subtitle');
    if (subtitleElement) {
      subtitleElement.textContent = `Lv ${towerData.level} • ${towerData.description}`;
    }

    // 스탯 업데이트 (새로운 구조 우선, 레거시 구조도 지원)
    const statFills = detailSection.querySelectorAll('.stat-fill');
    const statNumbers = detailSection.querySelectorAll('.stat-number');

    if (towerData.stats) {
      Object.keys(towerData.stats).forEach((key, index) => {
        if (statFills[index]) {
          statFills[index].style.width = towerData.stats[key].percentage + '%';
        }
        if (statNumbers[index]) {
          statNumbers[index].textContent = towerData.stats[key].value;
        }
      });
    }
  }

  /**
   * Set game loop reference
   */
  setGameLoop(gameLoop) {
    this.gameLoop = gameLoop;

    // Setup boost system callbacks
    const speedBoostSystem = gameLoop.getSpeedBoostSystem();
    if (speedBoostSystem) {
      speedBoostSystem.onBoostActivated = (speed) => {
        // Hide speed controls when boost starts
        const speedControls = document.querySelector('.speed-controls');
        if (speedControls) {
          speedControls.style.display = 'none';
        }
        console.log('[UIController] Speed controls hidden - Boost active');
      };

      speedBoostSystem.onBoostExpired = (speed) => {
        // Show speed controls when boost expires
        const speedControls = document.querySelector('.speed-controls');
        if (speedControls) {
          speedControls.style.display = 'flex';
        }
        console.log('[UIController] Speed controls restored - Boost expired');
      };
    }
  }

  /**
   * Setup supply button for existing tower
   */
  _setupSupplyButton(tower) {
    // DEPRECATED: SupplySystem has been removed in favor of NC/SC currency system
    // This method is kept as a stub for compatibility but does nothing
    return;
  }

  /**
   * Update tower growth info (XP, star)
   */
  _updateTowerGrowthInfo(tower) {
    // Star display
    const starDisplay = document.getElementById('towerStarDisplay');
    if (starDisplay) {
      const star = tower.star || 1;
      const starEmoji = '⭐'.repeat(Math.min(star, 5)); // Max 5 visual stars
      starDisplay.textContent = `${starEmoji} ${star}성`;
    }

    // XP bar
    const towerGrowthSystem = this.gameLoop?.getTowerGrowthSystem();
    if (towerGrowthSystem) {
      const xpRequired = towerGrowthSystem.getXPRequiredForNextLevel(tower);
      const currentXP = tower.xp || 0;
      const xpPercent = xpRequired > 0 ? (currentXP / xpRequired) * 100 : 100;

      const xpBar = document.getElementById('towerXPBar');
      const xpText = document.getElementById('towerXPText');

      if (xpBar) {
        xpBar.style.width = `${Math.min(xpPercent, 100)}%`;
      }

      if (xpText) {
        if (tower.level >= towerGrowthSystem.calculateMaxLevel(tower.star)) {
          xpText.textContent = '만렙';
        } else {
          xpText.textContent = `${Math.floor(currentXP)} / ${xpRequired}`;
        }
      }
    }
  }

  /**
   * Update tower action buttons (upgrade star, reroll stats)
   */
  _updateTowerActionButtons(tower) {
    const economySystem = this.gameLoop?.getEconomySystem();
    const towerGrowthSystem = this.gameLoop?.getTowerGrowthSystem();
    const towerManager = this.gameLoop?.getTowerManager();

    if (!economySystem || !towerGrowthSystem || !towerManager) return;

    const towerBaseCost = tower.definition.cost;

    // Upgrade star button
    const upgradeStarBtn = document.getElementById('upgradeStarBtn');
    if (upgradeStarBtn) {
      const canUpgrade = towerGrowthSystem.canUpgradeStar(tower);

      if (canUpgrade) {
        const cost = towerGrowthSystem.getUpgradeCost(tower.star);
        upgradeStarBtn.textContent = `⬆️ 승급 (NC ${cost.nc}, SC ${cost.sc})`;
        upgradeStarBtn.classList.remove('hidden');
        upgradeStarBtn.disabled = !economySystem.canAffordBoth(cost.nc, cost.sc);

        upgradeStarBtn.onclick = (e) => {
          e.stopPropagation();
          if (towerGrowthSystem.upgradeStar(tower, economySystem)) {
            console.log('Tower upgraded to star', tower.star);
            this.selectTowerSlot(this.selectedSlot); // Refresh UI
          }
        };
      } else {
        upgradeStarBtn.classList.add('hidden');
      }
    }

    // Add relocate button if it doesn't exist
    let relocateBtn = document.getElementById('relocateBtn');
    if (!relocateBtn) {
      const actionButtons = document.querySelector('.action-buttons');
      const sellBtn = document.getElementById('sellBtn');

      if (actionButtons && sellBtn) {
        relocateBtn = document.createElement('button');
        relocateBtn.id = 'relocateBtn';
        relocateBtn.className = 'action-btn primary';
        actionButtons.insertBefore(relocateBtn, sellBtn);
      }
    }

    // Relocate button
    if (relocateBtn) {
      const relocateNCCost = Math.floor(towerBaseCost * 0.20);
      const relocateSCCost = 8;
      const canAffordRelocate = economySystem.canAffordBoth(relocateNCCost, relocateSCCost);

      relocateBtn.textContent = `📍 재배치 (🍎 ${relocateNCCost}, ⚡ ${relocateSCCost})`;
      relocateBtn.disabled = !canAffordRelocate;

      relocateBtn.onclick = (e) => {
        e.stopPropagation();
        this._startTowerRelocation(tower, false);
      };
    }

    // Sell button
    const sellBtn = document.getElementById('sellBtn');
    if (sellBtn) {
      const refundAmount = Math.floor(towerBaseCost * 0.6);

      sellBtn.textContent = `💰 판매 (+🍎 ${refundAmount})`;

      sellBtn.onclick = (e) => {
        e.stopPropagation();

        this._showConfirmDialog({
          title: '타워 판매',
          message: `이 타워를 판매하여 🍎 ${refundAmount} NC를 받습니다.`,
          onConfirm: () => {
            const refund = towerManager.sellTower(tower, 0.6);
            economySystem.earnNC(refund);
            this._showToast(`타워 판매: +🍎 ${refund}`, 'success');
            this.updateNutritionDisplay(economySystem.getState());
            this.closeSheet();
          }
        });
      };
    }
  }

  /**
   * Start tower relocation mode
   * @param {Tower} tower - Tower to relocate
   * @param {boolean} isEmergency - Emergency relocation flag
   */
  _startTowerRelocation(tower, isEmergency) {
    const economySystem = this.gameLoop?.getEconomySystem();
    if (!economySystem) return;

    const towerBaseCost = tower.definition.cost;
    const ncCost = Math.floor(towerBaseCost * (isEmergency ? 0.35 : 0.20));
    const scCost = isEmergency ? 12 : 8;

    // Check affordability
    if (!economySystem.canAffordBoth(ncCost, scCost)) {
      this._showToast('비용 부족', 'error');
      return;
    }

    // Activate relocation mode
    this.relocatingTower = tower;
    this.relocationIsEmergency = isEmergency;
    this.relocationCosts = { nc: ncCost, sc: scCost };

    this.closeSheet();
    this._showToast('새 위치를 선택하세요', 'info');

    // TODO: Highlight empty slots (will be implemented in rendering code)
  }

  /**
   * Show tower detail UI (for existing tower)
   */
  _showTowerDetail(tower) {
    console.log('UIController: Showing tower detail');
    // Hide build UI, show detail UI
    if (this.towerBuildContent) {
      this.towerBuildContent.classList.add('hidden');
      console.log('UIController: Hidden tower-build');
    }
    if (this.towerDetailContent) {
      this.towerDetailContent.classList.remove('hidden');
      console.log('UIController: Showing tower-detail');
    }

    // Update tower growth info (XP, star)
    this._updateTowerGrowthInfo(tower);

    // Calculate effective stats with star bonuses
    const baseDamage = tower.definition.stats.damage;
    const baseAttackSpeed = tower.definition.stats.attackSpeed;
    const baseRange = tower.definition.stats.range;

    const effectiveDamage = baseDamage * tower.starBonuses.damageMultiplier;
    const effectiveAttackSpeed = baseAttackSpeed * tower.starBonuses.attackSpeedMultiplier;
    const effectiveRange = baseRange * tower.starBonuses.rangeMultiplier;

    const damageBonus = ((tower.starBonuses.damageMultiplier - 1) * 100);
    const speedBonus = ((tower.starBonuses.attackSpeedMultiplier - 1) * 100);
    const rangeBonus = ((tower.starBonuses.rangeMultiplier - 1) * 100);

    // Update tower info
    this.updateTowerInfo({
      icon: tower.definition.emoji,
      name: tower.definition.name,
      level: tower.level || 1,
      description: tower.definition.description,
      stats: {
        attack: {
          percentage: (effectiveDamage / 100) * 100,
          value: damageBonus > 0
            ? `${baseDamage.toFixed(1)} → ${effectiveDamage.toFixed(1)} (+${damageBonus.toFixed(0)}%)`
            : baseDamage.toFixed(1)
        },
        speed: {
          percentage: (effectiveAttackSpeed / 3) * 100,
          value: speedBonus > 0
            ? `${baseAttackSpeed.toFixed(2)} → ${effectiveAttackSpeed.toFixed(2)} (+${speedBonus.toFixed(0)}%)`
            : baseAttackSpeed.toFixed(2) + '초'
        },
        range: {
          percentage: (effectiveRange / 300) * 100,
          value: rangeBonus > 0
            ? `${baseRange} → ${Math.floor(effectiveRange)} (+${rangeBonus.toFixed(0)}%)`
            : baseRange.toString()
        },
        special: {
          percentage: (tower.starBonuses.statusSuccessRate / 0.5) * 100,
          value: tower.starBonuses.statusSuccessRate > 0
            ? `상태성공률 +${(tower.starBonuses.statusSuccessRate * 100).toFixed(1)}%`
            : '없음'
        }
      }
    });

    // Update action buttons (upgrade star, reroll stats)
    this._updateTowerActionButtons(tower);

    // Show upgrade tree
    this._showUpgradeTree(tower);
  }

  /**
   * Show upgrade tree for tower (Civilization-style horizontal scroll)
   */
  _showUpgradeTree(tower) {
    const upgradeContent = document.querySelector('.upgrade-content');
    if (!upgradeContent) return;

    // Clear existing content
    upgradeContent.innerHTML = '';

    // Check if tower has upgrade tree
    if (!tower.upgradeTree || !tower.upgradeTree.nodes || tower.upgradeTree.nodes.length === 0) {
      upgradeContent.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">이 타워는 아직 업그레이드를 지원하지 않습니다.</p>';
      return;
    }

    const tree = tower.upgradeTree;
    const economySystem = this.gameLoop?.getEconomySystem();
    if (!economySystem) return;

    // Create upgrade tree header with points display and reset button
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

    // Create upgrade points display (Splatoon style)
    const pointsDisplay = document.createElement('div');
    pointsDisplay.className = 'upgrade-points';
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

    // Create reset button
    const resetButton = document.createElement('button');
    resetButton.className = 'upgrade-reset-button';

    const towerBaseCost = tower.definition.cost;
    const resetNCCost = Math.floor(towerBaseCost * 0.35);
    const resetSCCost = 12;

    const canAffordReset = economySystem.canAffordBoth(resetNCCost, resetSCCost);
    const hasActiveNodes = tree.activeNodes.length > 0;

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
      if (!canAffordReset) {
        this._showToast('비용 부족', 'error');
        return;
      }

      if (!hasActiveNodes) {
        this._showToast('활성화된 노드가 없습니다', 'error');
        return;
      }

      // Show confirmation dialog
      this._showConfirmDialog({
        title: '스킬트리 리셋',
        message: `🍎 ${resetNCCost} NC와 ⚡ ${resetSCCost} SC를 소비하여 모든 노드를 비활성화합니다.`,
        onConfirm: () => {
          economySystem.spendBoth(resetNCCost, resetSCCost);
          tower.upgradeTree.reset();
          this._showToast('스킬트리 리셋 완료', 'success');
          this.updateNutritionDisplay(economySystem.getState());
          this._showUpgradeTree(tower);
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
    upgradeContent.appendChild(headerContainer);

    // Create horizontal scroll container (Splatoon style)
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

    // Create tree canvas (SVG for connections + nodes)
    const treeWrapper = document.createElement('div');
    treeWrapper.style.cssText = 'position: relative; min-width: max-content; min-height: 250px;';

    // Calculate node positions (column-based layout)
    const nodePositions = this._calculateNodePositions(tree.nodes);
    const maxColumn = Math.max(...Object.values(nodePositions).map(p => p.column));
    const maxRow = Math.max(...Object.values(nodePositions).map(p => p.row));

    const nodeWidth = 200; // Increased from 180
    const nodeHeight = 140; // Increased from 120
    const columnGap = 120; // Increased from 100
    const rowGap = 40; // Increased from 30 for better spacing

    const totalWidth = (maxColumn + 1) * (nodeWidth + columnGap);
    const totalHeight = Math.max((maxRow + 1) * (nodeHeight + rowGap), 320); // Ensure minimum height (increased from 250)

    // Set wrapper height
    treeWrapper.style.height = `${totalHeight}px`;
    treeWrapper.style.minHeight = '320px';

    // Create SVG for connection lines
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', totalWidth);
    svg.setAttribute('height', totalHeight);
    svg.style.cssText = 'position: absolute; top: 0; left: 0; pointer-events: none; z-index: 0;';

    // Draw connection lines
    for (const node of tree.nodes) {
      const nodePos = nodePositions[node.nodeNumber];
      const nodeX = nodePos.column * (nodeWidth + columnGap) + nodeWidth / 2;
      const nodeY = nodePos.row * (nodeHeight + rowGap) + nodeHeight / 2;

      // Draw lines to prerequisites
      for (const prereqNum of node.prerequisites) {
        const prereqPos = nodePositions[prereqNum];
        if (!prereqPos) continue;

        const prereqX = prereqPos.column * (nodeWidth + columnGap) + nodeWidth / 2;
        const prereqY = prereqPos.row * (nodeHeight + rowGap) + nodeHeight / 2;

        // Splatoon-style connection lines
        const isPrereqActive = tree.activeNodes.some(n => n.nodeNumber === prereqNum);
        const isBothActive = isPrereqActive && tree.activeNodes.some(n => n.nodeNumber === node.nodeNumber);

        // Create outer glow line
        const glowLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midX = (prereqX + nodeX) / 2;
        const d = `M ${prereqX} ${prereqY} C ${midX} ${prereqY}, ${midX} ${nodeY}, ${nodeX} ${nodeY}`;

        glowLine.setAttribute('d', d);
        glowLine.setAttribute('stroke', isBothActive ? '#00d9ff' : isPrereqActive ? '#ffd700' : 'rgba(26, 26, 46, 0.3)');
        glowLine.setAttribute('stroke-width', isBothActive ? '10' : '8');
        glowLine.setAttribute('fill', 'none');
        glowLine.setAttribute('opacity', isBothActive ? '0.4' : '0.2');
        glowLine.setAttribute('stroke-linecap', 'round');
        svg.appendChild(glowLine);

        // Create main line
        const mainLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        mainLine.setAttribute('d', d);
        mainLine.setAttribute('stroke', isBothActive ? '#00d9ff' : isPrereqActive ? '#ffd700' : '#999');
        mainLine.setAttribute('stroke-width', isBothActive ? '6' : '5');
        mainLine.setAttribute('fill', 'none');
        mainLine.setAttribute('stroke-dasharray', isBothActive ? '0' : isPrereqActive ? '12,8' : '8,6');
        mainLine.setAttribute('stroke-linecap', 'round');

        if (!isBothActive && isPrereqActive) {
          // Animated dashing for available paths
          const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
          animate.setAttribute('attributeName', 'stroke-dashoffset');
          animate.setAttribute('from', '0');
          animate.setAttribute('to', '20');
          animate.setAttribute('dur', '1s');
          animate.setAttribute('repeatCount', 'indefinite');
          mainLine.appendChild(animate);
        }

        svg.appendChild(mainLine);

        // Add border to main line
        const borderLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        borderLine.setAttribute('d', d);
        borderLine.setAttribute('stroke', '#1a1a2e');
        borderLine.setAttribute('stroke-width', isBothActive ? '8' : '7');
        borderLine.setAttribute('fill', 'none');
        borderLine.setAttribute('stroke-dasharray', isBothActive ? '0' : isPrereqActive ? '12,8' : '8,6');
        borderLine.setAttribute('stroke-linecap', 'round');
        borderLine.setAttribute('opacity', '0.5');
        svg.insertBefore(borderLine, glowLine);
      }
    }

    treeWrapper.appendChild(svg);

    // Create nodes
    for (const node of tree.nodes) {
      const nodePos = nodePositions[node.nodeNumber];
      const nodeCard = this._createUpgradeNodeCard(node, tree, tower, economySystem);

      nodeCard.style.position = 'absolute';
      nodeCard.style.left = `${nodePos.column * (nodeWidth + columnGap)}px`;
      nodeCard.style.top = `${nodePos.row * (nodeHeight + rowGap)}px`;
      nodeCard.style.width = `${nodeWidth}px`;
      nodeCard.style.height = `${nodeHeight}px`;
      nodeCard.style.display = 'flex';
      nodeCard.style.flexDirection = 'column';
      nodeCard.style.justifyContent = 'space-between';
      nodeCard.style.zIndex = '1';
      nodeCard.style.pointerEvents = 'auto'; // 노드는 클릭 가능

      treeWrapper.appendChild(nodeCard);
    }

    // SVG는 클릭 불가
    svg.style.pointerEvents = 'none';

    scrollContainer.appendChild(treeWrapper);
    upgradeContent.appendChild(scrollContainer);

    // 드래그 스크롤 등록
    this._setupDragScroll(scrollContainer);
  }

  /**
   * 드래그 스크롤 설정 (모바일 지도 방식)
   */
  _setupDragScroll(container) {
    // 이전 등록 해제
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
      onDragStart: (e) => {
        isDragging = true;
        scrollStartX = container.scrollLeft;
        scrollStartY = container.scrollTop;
        lastDragTime = Date.now();
        velocity = { x: 0, y: 0 };

        // 관성 애니메이션 중지
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }

        // 커서 변경
        container.style.cursor = 'grabbing';
      },

      onDrag: (e) => {
        if (!isDragging) return;

        // 드래그 방향 반대로 스크롤 (지도처럼)
        container.scrollLeft = scrollStartX - e.totalDeltaX;
        container.scrollTop = scrollStartY - e.totalDeltaY;

        // 속도 계산 (관성 스크롤용)
        const now = Date.now();
        const dt = (now - lastDragTime) / 1000;
        if (dt > 0) {
          velocity.x = e.deltaX / dt;
          velocity.y = e.deltaY / dt;
        }
        lastDragTime = now;
      },

      onDragEnd: (e) => {
        isDragging = false;
        container.style.cursor = 'grab';

        // 관성 스크롤 시작
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        if (speed > 100) { // 최소 속도 임계값
          this._applyInertiaScroll(container, velocity);
        }
      }
    });

    // 초기 커서 설정
    container.style.cursor = 'grab';
  }

  /**
   * 관성 스크롤 적용
   */
  _applyInertiaScroll(container, velocity) {
    const friction = 0.95; // 마찰 계수
    const minVelocity = 10; // 최소 속도

    const animate = () => {
      // 속도 감소
      velocity.x *= friction;
      velocity.y *= friction;

      // 스크롤 적용 (방향 반대)
      container.scrollLeft -= velocity.x * 0.016; // 약 60fps
      container.scrollTop -= velocity.y * 0.016;

      // 속도가 임계값 이하면 중지
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      if (speed > minVelocity) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Calculate node positions in a column-based layout
   */
  _calculateNodePositions(nodes) {
    const positions = {};
    const columnMap = {}; // Track which nodes are in which column

    // Sort nodes by nodeNumber
    const sortedNodes = [...nodes].sort((a, b) => a.nodeNumber - b.nodeNumber);

    // Assign columns based on prerequisites
    for (const node of sortedNodes) {
      if (node.prerequisites.length === 0) {
        // Root nodes go in column 0
        positions[node.nodeNumber] = { column: 0, row: 0 };
      } else {
        // Find the max column of prerequisites and place this node one column after
        const maxPrereqColumn = Math.max(...node.prerequisites.map(prereq =>
          positions[prereq]?.column ?? -1
        ));
        positions[node.nodeNumber] = { column: maxPrereqColumn + 1, row: 0 };
      }
    }

    // Assign rows to avoid overlaps in the same column
    for (const node of sortedNodes) {
      const pos = positions[node.nodeNumber];
      const column = pos.column;

      if (!columnMap[column]) {
        columnMap[column] = [];
      }

      columnMap[column].push(node.nodeNumber);
    }

    // Distribute rows within each column
    for (const [column, nodeNumbers] of Object.entries(columnMap)) {
      nodeNumbers.forEach((nodeNum, index) => {
        positions[nodeNum].row = index;
      });
    }

    return positions;
  }

  /**
   * Create upgrade node card (Splatoon style)
   */
  _createUpgradeNodeCard(node, tree, tower, economySystem) {
    const self = this; // Store this reference for event handlers
    const card = document.createElement('div');
    const isActive = tree.activeNodes.includes(node);

    // NC 비용 계산 (설치비의 12%)
    const towerBaseCost = tower.definition.cost;
    const ncCost = Math.floor(towerBaseCost * 0.12);
    const canAffordNC = economySystem.canAffordNC(ncCost);
    const canAffordPoints = tree.usedPoints + node.cost <= tree.availablePoints;
    const canActivate = node.canActivate(tree.activeNodes) && canAffordPoints && canAffordNC;

    card.className = 'upgrade-node-card splatoon-node';

    // Splatoon-style colors
    const bgColor = isActive
      ? 'linear-gradient(135deg, #00d9ff 0%, #0fb9b1 100%)'
      : canActivate
        ? '#fff'
        : '#e0e0e0';

    const borderColor = isActive ? '#00d9ff' : canActivate ? '#e94560' : '#999';
    const shadowColor = isActive ? '#00d9ff' : canActivate ? '#e94560' : '#666';

    card.style.cssText = `
      padding: 16px;
      background: ${bgColor};
      border: 5px solid #1a1a2e;
      border-radius: 18px;
      cursor: ${canActivate && !isActive ? 'pointer' : 'default'};
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      opacity: ${isActive || canActivate ? '1' : '0.6'};
      box-shadow:
        0 0 0 3px ${borderColor},
        0 6px 0 #1a1a2e,
        0 8px 20px rgba(0, 0, 0, 0.3);
      position: relative;
      overflow: visible;
      pointer-events: auto;
      touch-action: auto;
      transform-origin: center;
      box-sizing: border-box;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      position: relative;
      z-index: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      pointer-events: none;
    `;
    content.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="
            background: ${isActive ? '#ffd700' : canActivate ? '#e94560' : '#999'};
            color: #1a1a2e;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 900;
            border: 4px solid #1a1a2e;
            box-shadow: 0 4px 0 #1a1a2e;
            flex-shrink: 0;
          ">${node.nodeNumber}</span>
          <strong style="
            color: ${isActive ? '#fff' : '#1a1a2e'};
            font-size: 16px;
            font-weight: 900;
            text-shadow: ${isActive ? '2px 2px 0 rgba(0,0,0,0.3)' : 'none'};
            line-height: 1.2;
          ">${node.name}</strong>
        </div>
        ${isActive ? '<span style="color: #ffd700; font-size: 32px; filter: drop-shadow(2px 2px 0 rgba(0,0,0,0.3)); flex-shrink: 0;">✓</span>' : ''}
      </div>
      <p style="
        color: ${isActive ? '#fff' : '#1a1a2e'};
        font-size: 14px;
        line-height: 1.4;
        flex: 1;
        display: flex;
        align-items: center;
        margin: 8px 0;
        font-weight: ${isActive ? '700' : '600'};
        text-shadow: ${isActive ? '1px 1px 0 rgba(0,0,0,0.2)' : 'none'};
      ">${node.effect}</p>
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 8px;
        border-top: 3px solid ${isActive ? 'rgba(255,255,255,0.3)' : '#1a1a2e'};
      ">
        <div style="display: flex; gap: 6px; align-items: center;">
          <span style="
            color: #fff;
            background: linear-gradient(90deg, #e94560, #ff6b9d);
            font-size: 14px;
            font-weight: 900;
            padding: 6px 12px;
            border-radius: 15px;
            border: 3px solid #1a1a2e;
            box-shadow: 0 3px 0 #1a1a2e;
          ">💎 ${node.cost}P</span>
          <span style="
            color: #fff;
            background: linear-gradient(90deg, #00d9ff, #0fb9b1);
            font-size: 14px;
            font-weight: 900;
            padding: 6px 12px;
            border-radius: 15px;
            border: 3px solid #1a1a2e;
            box-shadow: 0 3px 0 #1a1a2e;
            opacity: ${canAffordNC ? '1' : '0.5'};
          ">🍎 ${ncCost}</span>
        </div>
        ${node.prerequisites.length > 0
          ? `<span style="
              color: ${isActive ? '#fff' : '#666'};
              font-size: 12px;
              font-weight: 700;
              background: rgba(0,0,0,0.1);
              padding: 5px 10px;
              border-radius: 10px;
            ">← ${node.prerequisites.join(', ')}</span>`
          : `<span style="
              color: #ffd700;
              font-size: 13px;
              font-weight: 900;
              text-shadow: 2px 2px 0 rgba(0,0,0,0.2);
            ">🌟 시작</span>`}
      </div>
    `;
    card.appendChild(content);

    // Add hover and click handlers (Splatoon style)
    if (canActivate && !isActive) {
      card.style.cursor = 'pointer';

      let touchStartTime = 0;
      let touchMoved = false;

      // 터치/마우스 시작
      const handlePointerDown = (e) => {
        touchStartTime = Date.now();
        touchMoved = false;
        card.style.transform = 'translateY(3px) rotate(0deg) scale(0.98)';
        card.style.boxShadow = `
          0 0 0 3px ${borderColor},
          0 3px 0 #1a1a2e,
          0 5px 10px rgba(0, 0, 0, 0.3)
        `;
      };

      // 터치/마우스 이동 (드래그 감지)
      const handlePointerMove = (e) => {
        touchMoved = true;
      };

      // 터치/마우스 종료
      const handlePointerUp = (e) => {
        const touchDuration = Date.now() - touchStartTime;

        // 드래그가 아니고 빠른 탭/클릭인 경우만 활성화
        if (!touchMoved && touchDuration < 300) {
          e.stopPropagation();
          e.preventDefault();

          // NC 비용 체크
          if (!canAffordNC) {
            self._showToast(`비용 부족: 🍎 ${ncCost} NC 필요`, 'error');
            return;
          }

          if (!canAffordPoints) {
            self._showToast(`업그레이드 포인트 부족`, 'error');
            return;
          }

          if (tree.activateNode(node.nodeNumber, economySystem, towerBaseCost)) {
            console.log(`Activated upgrade node ${node.nodeNumber}: ${node.name} (Cost: ${ncCost} NC, ${node.cost} Points)`);

            // Ink splash effect
            self._createInkSplash(card, '#00d9ff');

            // Show toast with cost
            self._showToast(`노드 활성화: -🍎 ${ncCost} NC`, 'success');

            // Update currency display
            self.updateNutritionDisplay(economySystem.getState());

            setTimeout(() => {
              self._showUpgradeTree(tower); // Refresh UI
            }, 200);
          }
        }

        // 원래 상태로 복구
        card.style.transform = 'translateY(0) rotate(0deg) scale(1)';
        card.style.boxShadow = `
          0 0 0 3px ${borderColor},
          0 6px 0 #1a1a2e,
          0 8px 20px rgba(0, 0, 0, 0.3)
        `;
      };

      // 데스크톱 호버 (터치 디바이스가 아닌 경우만)
      if (!('ontouchstart' in window)) {
        card.onmouseenter = () => {
          card.style.transform = 'translateY(-6px) rotate(-2deg) scale(1.05)';
          card.style.boxShadow = `
            0 0 0 3px #ff6b81,
            0 10px 0 #1a1a2e,
            0 12px 30px rgba(233, 69, 96, 0.6)
          `;
        };
        card.onmouseleave = () => {
          card.style.transform = 'translateY(0) rotate(0deg) scale(1)';
          card.style.boxShadow = `
            0 0 0 3px ${borderColor},
            0 6px 0 #1a1a2e,
            0 8px 20px rgba(0, 0, 0, 0.3)
          `;
        };
      }

      // 이벤트 리스너 등록
      card.addEventListener('touchstart', handlePointerDown, { passive: true });
      card.addEventListener('touchmove', handlePointerMove, { passive: true });
      card.addEventListener('touchend', handlePointerUp, { passive: false });
      card.addEventListener('mousedown', handlePointerDown);
      card.addEventListener('mousemove', handlePointerMove);
      card.addEventListener('mouseup', handlePointerUp);

    } else if (isActive) {
      // Gentle pulsing animation for active nodes
      card.style.animation = 'splat-glow-subtle 3s ease-in-out infinite';
    }

    return card;
  }

  /**
   * Create ink splash effect (Splatoon style)
   */
  _createInkSplash(element, color) {
    const splash = document.createElement('div');
    splash.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 20px;
      height: 20px;
      background: ${color};
      border-radius: 50%;
      pointer-events: none;
      z-index: 1000;
    `;
    element.appendChild(splash);

    // Animate splash
    splash.animate([
      { transform: 'translate(-50%, -50%) scale(0) rotate(0deg)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(8) rotate(180deg)', opacity: 0 }
    ], {
      duration: 600,
      easing: 'ease-out'
    });

    setTimeout(() => splash.remove(), 600);
  }

  /**
   * Show tower build UI (for empty slot)
   */
  _showTowerBuild() {
    console.log('UIController: Showing tower build');
    // Hide detail UI, show build UI
    if (this.towerDetailContent) {
      this.towerDetailContent.classList.add('hidden');
      console.log('UIController: Hidden tower-detail');
    }
    if (this.towerBuildContent) {
      this.towerBuildContent.classList.remove('hidden');
      console.log('UIController: Showing tower-build');
    }

    // Setup tower build buttons
    this._setupTowerBuildButtons();
  }

  /**
   * Handle sell tower action
   */
  _handleSellTower() {
    if (!this.gameLoop || !this.selectedSlot) return;

    const towerManager = this.gameLoop.getTowerManager();
    const tower = towerManager.getTowerAtSlot(this.selectedSlot);

    if (!tower) {
      console.warn('No tower to sell');
      return;
    }

    const refund = towerManager.sellTower(tower);
    const economySystem = this.gameLoop.getEconomySystem();
    economySystem.earn(refund);

    console.log(`Tower sold for ${refund} nutrition`);

    // Update nutrition display
    this.updateNutritionDisplay(economySystem.getState());

    // Close sheet
    this.closeSheet();
  }

  /**
   * Setup tower build buttons
   */
  _setupTowerBuildButtons() {
    const towerGrid = document.querySelector('#tower-build .tower-grid');
    if (!towerGrid) return;

    const towerCards = towerGrid.querySelectorAll('.tower-card:not(.locked)');
    const economySystem = this.gameLoop.getEconomySystem();
    const towerManager = this.gameLoop.getTowerManager();

    towerCards.forEach((card) => {
      const towerType = card.getAttribute('data-tower-type');
      if (!towerType) return;

      const definition = TOWER_DEFINITIONS[towerType];

      card.onclick = (e) => {
        e.stopPropagation();

        if (card.classList.contains('locked')) {
          console.warn('Tower type is locked');
          return;
        }

        if (!economySystem.canAfford(definition.cost)) {
          console.warn('Not enough nutrition to build tower');
          return;
        }

        if (economySystem.spend(definition.cost)) {
          towerManager.buildTower(towerType, this.selectedSlot);
          this.closeSheet();
          // Update nutrition display
          this.updateNutritionDisplay(economySystem.getState());
        }
      };
    });
  }

  /**
   * Update nutrition display in resource bar (NC/SC 2종 재화)
   */
  updateNutritionDisplay(economyState) {
    // NC (영양 크레딧)
    const ncAmount = document.getElementById('ncAmount');
    if (ncAmount) {
      if (typeof economyState === 'number') {
        // 레거시 호환: 숫자가 전달되면 NC로 간주
        const newAmount = Math.floor(economyState);
        this._animateNumberChange(ncAmount, parseInt(ncAmount.textContent) || 0, newAmount);
      } else {
        // 새 형식: economyState 객체
        const newAmount = Math.floor(economyState.nc);
        this._animateNumberChange(ncAmount, parseInt(ncAmount.textContent) || 0, newAmount);
      }
    }

    // SC (보급 차지) - 게이지 바 형태
    if (typeof economyState === 'object') {
      const scBarProgress = document.getElementById('scBarProgress');
      const scText = document.getElementById('scText');
      const scResource = document.querySelector('.sc-resource');

      const currentSC = Math.floor(economyState.sc);
      const maxSC = economyState.scMax;
      const scFractional = economyState.scFractional || 0;

      // Progress bar: 다음 1 SC까지의 진행도 (0~100%)
      const progressPercent = scFractional * 100;

      // Store previous SC for animation trigger
      const prevSC = scBarProgress?.dataset.prevSc ? parseInt(scBarProgress.dataset.prevSc) : currentSC;
      const isInitialized = scBarProgress?.dataset.initialized === 'true';

      if (scBarProgress) {
        scBarProgress.style.width = `${Math.min(progressPercent, 100)}%`;

        // Mark as initialized
        if (!isInitialized) {
          scBarProgress.dataset.initialized = 'true';
          scBarProgress.dataset.prevSc = currentSC;
        }

        // SC가 1 증가했을 때 (진행도가 100%에 도달하여 리셋됨)
        if (isInitialized && currentSC > prevSC) {
          // Full effect (100% 도달)
          scBarProgress.classList.add('full');
          scBarProgress.classList.add('pulse');

          setTimeout(() => {
            scBarProgress.classList.remove('full');
            scBarProgress.classList.remove('pulse');
          }, 500);

          scBarProgress.dataset.prevSc = currentSC;
        }
      }

      if (scText) {
        scText.textContent = `${currentSC}/${maxSC}`;

        // Add increase animation if SC increased (only after initialization)
        if (isInitialized && currentSC > prevSC) {
          scText.classList.add('increase');
          setTimeout(() => scText.classList.remove('increase'), 400);
        }
      }

      // Add particle effect if SC increased
      if (scResource && isInitialized && currentSC > prevSC) {
        scResource.classList.add('show-particle');
        setTimeout(() => scResource.classList.remove('show-particle'), 800);
      }
    }
  }

  /**
   * Animate number change with count-up effect
   */
  _animateNumberChange(element, from, to) {
    if (from === to) {
      element.textContent = to;
      return;
    }

    const duration = 300; // ms
    const steps = 10;
    const stepValue = (to - from) / steps;
    const stepDuration = duration / steps;

    let current = from;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      current += stepValue;

      if (step >= steps) {
        element.textContent = to;
        clearInterval(interval);
      } else {
        element.textContent = Math.floor(current);
      }
    }, stepDuration);
  }

  /**
   * Update AP display in resource bar (Deprecated - use updateNutritionDisplay with economyState instead)
   */
  updateAPDisplay(current, max) {
    const resources = document.querySelectorAll('.resource');
    if (resources[1]) {
      resources[1].textContent = `⚡ ${current}/${max}`;
    }
  }

  /**
   * Update trouble display in resource bar (DEPRECATED - Trouble System removed)
   */
  updateTroubleDisplay(congestion, acidity) {
    // Trouble System has been removed from the game design
    // This method is kept for backward compatibility but does nothing
  }

  /**
   * Setup speed control buttons
   */
  setupSpeedControls() {
    const speedButtons = document.querySelectorAll('.speed-btn');

    speedButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();

        // Prevent rapid clicking
        if (btn.disabled) {
          return;
        }

        // Don't allow manual speed change when sheet is open (slow motion mode)
        if (this.isExpanded) {
          console.log('Cannot change speed while tower menu is open');
          return;
        }

        const speed = parseFloat(btn.getAttribute('data-speed'));

        // 1x is always free
        if (speed === 1) {
          if (this.gameLoop) {
            this.gameLoop.setTimeScale(speed);
            this.previousTimeScale = speed;
          }
          this.updateSpeedButtonDisplay(speed);
          return;
        }

        // 2x/3x require payment
        if (this.gameLoop) {
          const speedBoostSystem = this.gameLoop.getSpeedBoostSystem();
          const economySystem = this.gameLoop.getEconomySystem();

          if (!speedBoostSystem || !economySystem) {
            console.error('[UIController] Missing system references');
            return;
          }

          // Disable button during transaction
          btn.disabled = true;

          // Try to activate boost
          const result = speedBoostSystem.activateBoost(speed, economySystem);

          if (result.success) {
            // Boost activated successfully
            this.gameLoop.setTimeScale(speed);
            this.previousTimeScale = speed;
            this.updateSpeedButtonDisplay(speed);
          } else {
            // Show error feedback
            this.showBoostError(result.reason);
          }

          // Re-enable button
          setTimeout(() => {
            btn.disabled = false;
          }, 300);
        }
      });
    });
  }

  /**
   * Update speed button display
   * @param {number} speed - Current speed (0.5, 1, 2, 3)
   */
  updateSpeedButtonDisplay(speed) {
    const speedButtons = document.querySelectorAll('.speed-btn');

    speedButtons.forEach(btn => {
      const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
      btn.classList.remove('active', 'slow-motion');

      // Find speed-text span
      const speedTextSpan = btn.querySelector('.speed-text');

      if (speed === 0.5) {
        // Slow motion mode (when sheet is open)
        if (btnSpeed === 1) {
          btn.classList.add('slow-motion');
          if (speedTextSpan) speedTextSpan.textContent = '0.5x';
        }
      } else if (btnSpeed === speed) {
        btn.classList.add('active');
        // Reset text to normal
        if (btnSpeed === 1 && speedTextSpan) speedTextSpan.textContent = '1x';
      } else if (btnSpeed === 1) {
        // Reset 1x button text
        if (speedTextSpan) speedTextSpan.textContent = '1x';
      }
    });
  }

  /**
   * Show error feedback when boost purchase fails
   * @param {string} reason - Error reason ('insufficient_sc', 'active_boost_exists', etc.)
   */
  showBoostError(reason) {
    const scResource = document.querySelector('.sc-resource');

    if (reason === 'insufficient_sc') {
      // Shake animation on SC display
      if (scResource) {
        scResource.classList.add('insufficient-shake');
        setTimeout(() => scResource.classList.remove('insufficient-shake'), 500);
      }

      console.log('[UIController] ⚡ Insufficient Supply Charge!');
    } else if (reason === 'active_boost_exists') {
      console.log('[UIController] ⏱️ Boost already active!');
    } else {
      console.warn(`[UIController] Boost activation failed: ${reason}`);
    }
  }

  /**
   * Update boost display (timer and button states)
   * Called from main.js updateUIDisplays loop
   */
  updateBoostDisplay() {
    const speedBoostSystem = this.gameLoop?.getSpeedBoostSystem();
    if (!speedBoostSystem) return;

    const activeBoost = speedBoostSystem.getActiveBoost();

    if (activeBoost) {
      // Update timer display
      const timerContainer = document.getElementById('boostTimerContainer');
      const timerElement = document.getElementById('boostTimer');
      const labelElement = document.getElementById('boostLabel');

      if (timerContainer && timerElement && labelElement) {
        const timerText = speedBoostSystem.getFormattedRemainingTime();
        timerElement.textContent = timerText;
        labelElement.textContent = `${activeBoost.speed}x`;
        timerContainer.style.display = 'flex';
      }

      // Update button states for active boost
      this.updateSpeedButtonsForBoost(activeBoost.speed);
    } else {
      // No active boost - hide timer
      const timerContainer = document.getElementById('boostTimerContainer');
      if (timerContainer) {
        timerContainer.style.display = 'none';
      }

      // Update button affordability
      this.updateSpeedButtonAffordability();
    }
  }

  /**
   * Update button states when boost is active
   * @param {number} activeSpeed - Currently active boost speed (2 or 3)
   */
  updateSpeedButtonsForBoost(activeSpeed) {
    const buttons = document.querySelectorAll('.speed-btn');
    buttons.forEach(btn => {
      const speed = parseFloat(btn.getAttribute('data-speed'));

      btn.classList.remove('active', 'boost-active', 'disabled');

      if (speed === activeSpeed) {
        btn.classList.add('boost-active');
      } else if (speed !== 1) {
        btn.classList.add('disabled'); // Can't buy another boost
      } else if (speed === 1) {
        // 1x is available but not active
        btn.classList.remove('active');
      }
    });
  }

  /**
   * Update button states based on SC affordability
   */
  updateSpeedButtonAffordability() {
    const economySystem = this.gameLoop?.getEconomySystem();
    if (!economySystem) return;

    const buttons = document.querySelectorAll('.speed-btn');
    buttons.forEach(btn => {
      const speed = parseFloat(btn.getAttribute('data-speed'));

      if (speed === 1) {
        // 1x always available
        btn.classList.remove('disabled');
        return;
      }

      const costKey = speed === 2 ? 'speed2x10m' : 'speed3x10m';
      const cost = COST_RATIOS[costKey];

      if (economySystem.canAffordSC(cost)) {
        btn.classList.remove('disabled');
      } else {
        btn.classList.add('disabled');
      }
    });
  }

  /**
   * Show toast notification
   * @param {string} message - Toast message
   * @param {string} type - Toast type ('success', 'error', 'info', 'warning')
   */
  _showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠'
    };

    const colors = {
      success: '#00d9ff',
      error: '#ff006e',
      info: '#ffd700',
      warning: '#ff6b00'
    };

    toast.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%) translateY(-100px);
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 12px;
      border: 3px solid ${colors[type]};
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), 0 0 12px ${colors[type]}80;
      font-weight: bold;
      font-size: 14px;
      z-index: 10001;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    toast.innerHTML = `
      <span style="font-size: 18px;">${icons[type]}</span>
      <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
      toast.style.opacity = '1';
    }, 10);

    // Animate out and remove
    setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(-100px)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /**
   * Show confirmation dialog
   * @param {Object} options - Dialog options
   * @param {string} options.title - Dialog title
   * @param {string} options.message - Dialog message
   * @param {Function} options.onConfirm - Callback when confirmed
   * @param {Function} options.onCancel - Callback when cancelled
   */
  _showConfirmDialog({ title, message, onConfirm, onCancel }) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';

    dialog.innerHTML = `
      <div class="dialog-title">${title}</div>
      <div class="dialog-message">${message}</div>
      <div class="dialog-buttons">
        <button class="dialog-button cancel">취소</button>
        <button class="dialog-button confirm">확인</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const confirmBtn = dialog.querySelector('.confirm');
    const cancelBtn = dialog.querySelector('.cancel');

    confirmBtn.addEventListener('click', () => {
      overlay.remove();
      if (onConfirm) onConfirm();
    });

    cancelBtn.addEventListener('click', () => {
      overlay.remove();
      if (onCancel) onCancel();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        if (onCancel) onCancel();
      }
    });
  }
}
