/**
 * UIController.js
 * UI 인터랙션 관리 (Splatoon Style)
 */

import { TOWER_DEFINITIONS } from '../digestion/data/towerDefinitions.js';

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

    // 스탯 업데이트
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
  }

  /**
   * Setup supply button for existing tower
   */
  _setupSupplyButton(tower) {
    // Add supply button to action buttons section (in tower-detail)
    const actionButtons = document.querySelector('#tower-detail .action-buttons');
    if (!actionButtons) return;

    // Check if supply button already exists
    let supplyBtn = document.getElementById('supplyBtn');
    if (!supplyBtn) {
      supplyBtn = document.createElement('button');
      supplyBtn.id = 'supplyBtn';
      supplyBtn.className = 'action-btn primary';
      actionButtons.insertBefore(supplyBtn, actionButtons.firstChild);
    }

    const supplySystem = this.gameLoop.getSupplySystem();
    const apState = supplySystem.getAPState();
    supplyBtn.textContent = `⚡ 영양 보급 (AP: ${apState.current}/${apState.max})`;
    supplyBtn.disabled = !supplySystem.canSupply();

    supplyBtn.onclick = (e) => {
      e.stopPropagation();
      if (supplySystem.supplyTower(tower, this.gameLoop.currentTime)) {
        console.log('Tower supplied successfully');
        // Refresh display
        this.selectTowerSlot(this.selectedSlot);
      }
    };
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

    // Update tower info
    this.updateTowerInfo({
      icon: tower.definition.emoji,
      name: tower.definition.name,
      level: 1,
      description: tower.definition.description,
      stats: {
        attack: {
          percentage: (tower.damage / 30) * 100,
          value: tower.damage.toFixed(1)
        },
        speed: {
          percentage: (tower.attackSpeed / 2) * 100,
          value: tower.attackSpeed.toFixed(2) + '초'
        },
        range: {
          percentage: (tower.range / 200) * 100,
          value: tower.range
        },
        special: {
          percentage: tower.getEfficiencyMultiplier() * 50,
          value: tower.efficiencyState
        }
      }
    });

    // Show supply button
    this._setupSupplyButton(tower);
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
    this.updateNutritionDisplay(economySystem.getBalance());

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
          this.updateNutritionDisplay(economySystem.getBalance());
        }
      };
    });
  }

  /**
   * Update nutrition display in resource bar
   */
  updateNutritionDisplay(balance) {
    const resources = document.querySelectorAll('.resource');
    if (resources[0]) {
      resources[0].textContent = `🍎 ${balance}`;
    }
  }

  /**
   * Update AP display in resource bar
   */
  updateAPDisplay(current, max) {
    const resources = document.querySelectorAll('.resource');
    if (resources[1]) {
      resources[1].textContent = `⚡ ${current}/${max}`;
    }
  }

  /**
   * Update trouble display in resource bar
   */
  updateTroubleDisplay(congestion, acidity) {
    const resources = document.querySelectorAll('.resource');
    if (resources[2]) {
      resources[2].textContent = `🦠 ${Math.round(congestion)}/${Math.round(acidity)}`;
    }
  }
}
