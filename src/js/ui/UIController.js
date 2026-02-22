/**
 * UIController.js
 * UI 오케스트레이터 (Splatoon Style)
 *
 * 각 UI 모듈을 초기화·위임하는 얇은 셸.
 * 외부 코드(main.js 등)는 이 클래스의 public API만 사용한다.
 */

import { dragManager } from '../core/DragManager.js';
import { StarUpgradeManager } from './StarUpgradeManager.js';
import { UIUtils } from './UIUtils.js';
import { BottomSheetController } from './BottomSheetController.js';
import { TowerDetailPanel } from './TowerDetailPanel.js';
import { UpgradeTreeUI } from './UpgradeTreeUI.js';
import { UpgradeNodeCard } from './UpgradeNodeCard.js';
import { SpeedControlUI } from './SpeedControlUI.js';
import { ResourceDisplayUI } from './ResourceDisplayUI.js';

export class UIController {
  constructor() {
    // 시트 상태
    this.bottomSheet = null;
    this.sheetHandle = null;
    this.isExpanded = false;
    this.selectedTowerSlot = null;
    this.onSheetOpenCallback = null;
    this.onSheetCloseCallback = null;

    // 시스템 참조
    this.gameLoop = null;
    this.selectedSlot = null;
    this.saveCallback = null;
    this.dragManager = dragManager;
    this.previousTimeScale = 1.0;
    this.starUpgradeManager = null;
    this.uiSfxSystem = null;

    // DOM 참조 (init에서 채워짐)
    this.towerDetailContent = null;
    this.towerBuildContent = null;

    // 서브 모듈 (init에서 생성)
    this.bottomSheetController = null;
    this.towerDetailPanel = null;
    this.upgradeTreeUI = null;
    this.upgradeNodeCard = null;
    this.speedControlUI = null;
    this.resourceDisplayUI = null;

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

    // 서브 모듈 초기화 (의존성 순서 준수)
    this.upgradeNodeCard = new UpgradeNodeCard(this);
    this.upgradeTreeUI = new UpgradeTreeUI(this, this.upgradeNodeCard);
    this.towerDetailPanel = new TowerDetailPanel(this);
    this.speedControlUI = new SpeedControlUI(this);
    this.resourceDisplayUI = new ResourceDisplayUI(this);
    this.bottomSheetController = new BottomSheetController(this);

    // 이벤트 등록
    this.bottomSheetController.setup();
    this.speedControlUI.setup();
    this.resourceDisplayUI.setupHourlyClaimButton();
    this.resourceDisplayUI.setupSixHourClaimButton();
  }

  // ─── 시트 열기/닫기 (Core 상태 관리) ──────────────────────────────────

  openSheet() {
    if (!this.selectedTowerSlot && !this.selectedSlot) {
      console.warn('[UIController] Cannot open sheet: No tower selected');
      return;
    }

    if (!this.isExpanded) {
      this._playUISfx('ui_click', { volume: 0.55 });
      this.isExpanded = true;
      this.bottomSheet.classList.add('expanded');

      if (this.gameLoop) {
        this.previousTimeScale = this.gameLoop.getTargetTimeScale();
        this.gameLoop.setTimeScale(0.5);
        this.speedControlUI.updateDisplay(0.5);
      }

      if (this.onSheetOpenCallback) {
        setTimeout(() => {
          this.onSheetOpenCallback(this.selectedTowerSlot);
        }, 350);
      }
    }
  }

  closeSheet() {
    if (this.starUpgradeManager && this.starUpgradeManager.isCurrentlyUpgrading()) {
      this.starUpgradeManager.dismissUpgradeUI();
    }

    if (this.isExpanded) {
      this._playUISfx('ui_click', { volume: 0.5 });
      this.isExpanded = false;
      this.bottomSheet.classList.remove('expanded');
      this.selectedTowerSlot = null;
      this.selectedSlot = null;

      if (this.gameLoop) {
        const speedBoostSystem = this.gameLoop.getSpeedBoostSystem();
        const activeBoost = speedBoostSystem?.getActiveBoost();

        if (activeBoost) {
          this.gameLoop.setTimeScale(activeBoost.speed);
          this.speedControlUI.updateDisplay(activeBoost.speed);
        } else {
          this.gameLoop.setTimeScale(1.0);
          this.speedControlUI.updateDisplay(1.0);
        }
      }

      const supplyBtn = document.getElementById('supplyBtn');
      if (supplyBtn) supplyBtn.remove();

      if (this.towerDetailContent) this.towerDetailContent.classList.add('hidden');
      if (this.towerBuildContent) this.towerBuildContent.classList.add('hidden');

      if (this.onSheetCloseCallback) this.onSheetCloseCallback();
    }
  }

  selectTowerSlot(slotData) {
    this._playUISfx('ui_click', { volume: 0.65 });
    this.selectedTowerSlot = slotData;
    this.selectedSlot = slotData;

    if (!this.gameLoop) {
      console.warn('GameLoop not set in UIController');
      return;
    }

    const towerManager = this.gameLoop.getTowerManager();
    const existingTower = towerManager.getTowerAtSlot(slotData);

    if (existingTower) {
      if (existingTower.pendingUpgrade && this.starUpgradeManager) {
        this.openSheet();
        this.starUpgradeManager.showStarUpgradeUI(existingTower, existingTower.pendingUpgrade);
        return;
      }
      this.towerDetailPanel.showDetail(existingTower);
    } else {
      this.towerDetailPanel.showBuild();
    }

    this.openSheet();
  }

  // ─── 콜백 / 시스템 주입 ────────────────────────────────────────────────

  setOnSheetOpen(callback) { this.onSheetOpenCallback = callback; }
  setOnSheetClose(callback) { this.onSheetCloseCallback = callback; }

  setUISfxSystem(uiSfxSystem) {
    this.uiSfxSystem = uiSfxSystem || null;
  }

  /** @param {import('./ResourceAbsorptionSystem.js').ResourceAbsorptionSystem} system */
  setResourceAbsorptionSystem(system) {
    this.resourceAbsorptionSystem = system;
  }

  setGameLoop(gameLoop) {
    this.gameLoop = gameLoop;

    this.starUpgradeManager = new StarUpgradeManager(gameLoop, this);

    const speedBoostSystem = gameLoop.getSpeedBoostSystem();
    if (speedBoostSystem) {
      speedBoostSystem.onBoostActivated = () => {
        const speedControls = document.querySelector('.speed-controls');
        if (speedControls) speedControls.style.display = 'none';
        console.log('[UIController] Speed controls hidden - Boost active');
      };
      speedBoostSystem.onBoostExpired = () => {
        const speedControls = document.querySelector('.speed-controls');
        if (speedControls) speedControls.style.display = 'flex';
        console.log('[UIController] Speed controls restored - Boost expired');
      };
    }
  }

  // ─── 내부 헬퍼 ─────────────────────────────────────────────────────────

  _playUISfx(eventName, options = {}) {
    if (!this.uiSfxSystem) return;
    this.uiSfxSystem.play(eventName, options);
  }

  _triggerSave() {
    if (this.saveCallback) this.saveCallback();
  }

  // ─── 내부 위임 (서브 모듈 호출 단일 진입점) ────────────────────────────

  _showToast(message, type = 'info') {
    UIUtils.showToast(message, type, (name, opts) => this._playUISfx(name, opts));
  }

  _showConfirmDialog(options) {
    UIUtils.showConfirmDialog(options, (name, opts) => this._playUISfx(name, opts));
  }

  /** 업그레이드 트리 렌더링 위임 */
  _showUpgradeTree(tower) {
    this.upgradeTreeUI.show(tower);
  }

  /** 타워 판매 위임 */
  _handleSellTower() {
    this.towerDetailPanel._handleSellTower();
  }

  // ─── Public API (외부 호환 래퍼) ──────────────────────────────────────

  /** 타워 정보 DOM 업데이트 */
  updateTowerInfo(towerData) {
    this.towerDetailPanel.updateTowerInfo(towerData);
  }

  /** NC/SC 재화 표시 업데이트 */
  updateNutritionDisplay(economyState) {
    this.resourceDisplayUI.updateNutrition(economyState);
  }

  /** AP 표시 업데이트 (Deprecated) */
  updateAPDisplay(current, max) {
    this.resourceDisplayUI.updateAPDisplay(current, max);
  }

  /** 트러블 표시 업데이트 (Deprecated) */
  updateTroubleDisplay(congestion, acidity) {
    this.resourceDisplayUI.updateTroubleDisplay(congestion, acidity);
  }

  /** 부스트 타이머/버튼 갱신 */
  updateBoostDisplay() {
    this.speedControlUI.updateBoostDisplay();
  }

  /** 속도 버튼 활성 상태 갱신 */
  updateSpeedButtonDisplay(speed) {
    this.speedControlUI.updateDisplay(speed);
  }

  /** 부스트 오류 표시 */
  showBoostError(reason) {
    this.speedControlUI.showBoostError(reason);
  }

  /** 부스트 활성 시 버튼 상태 갱신 */
  updateSpeedButtonsForBoost(activeSpeed) {
    this.speedControlUI.updateButtonsForBoost(activeSpeed);
  }

  /** SC 보유량 기반 버튼 활성화 갱신 */
  updateSpeedButtonAffordability() {
    this.speedControlUI.updateButtonAffordability();
  }

  /** 1시간 보상 버튼 표시 갱신 */
  updateHourlyClaimDisplay() {
    this.resourceDisplayUI.updateHourlyClaimDisplay();
  }

  /** 6시간 보상 버튼 표시 갱신 */
  updateSixHourClaimDisplay() {
    this.resourceDisplayUI.updateSixHourClaimDisplay();
  }

  // 레거시 유틸 (UIUtils 위임)
  createInkSplash(event, color) { UIUtils.createInkSplash(event, color); }
  getRandomColor() { return UIUtils.getRandomColor(); }
  updateResource(type, value) { UIUtils.updateResource(type, value); }

  formatPrerequisites(prerequisites) {
    return this.upgradeTreeUI.formatPrerequisites(prerequisites);
  }
}
