/**
 * TowerDetailPanel.js
 * 타워 상세 정보 패널 및 타워 설치 UI 패널 모듈
 */

import { TOWER_DEFINITIONS } from '../digestion/data/towerDefinitions.js';
import { formatTagText } from '../utils/TagFormatter.js';

export class TowerDetailPanel {
  constructor(uiController) {
    this.ui = uiController;
  }

  /**
   * 기존 타워 상세 패널 표시 (_showTowerDetail)
   * @param {Object} tower - 타워 인스턴스
   */
  showDetail(tower) {
    console.log('TowerDetailPanel: Showing tower detail');

    if (this.ui.starUpgradeManager?.isCurrentlyUpgrading()) {
      this.ui.starUpgradeManager.dismissUpgradeUI();
    }

    const starUpgradeUI = document.getElementById('tower-star-upgrade');
    if (starUpgradeUI) starUpgradeUI.classList.add('hidden');

    if (this.ui.towerBuildContent) {
      this.ui.towerBuildContent.classList.add('hidden');
      console.log('TowerDetailPanel: Hidden tower-build');
    }
    if (this.ui.towerDetailContent) {
      this.ui.towerDetailContent.classList.remove('hidden');
      console.log('TowerDetailPanel: Showing tower-detail');
    }

    this._updateTowerGrowthInfo(tower);

    // 별 보너스 반영 스탯 계산
    const effectiveDamage = tower.definition.stats.damage * tower.starBonuses.damageMultiplier;
    const effectiveAttackSpeed = tower.definition.stats.attackSpeed * tower.starBonuses.attackSpeedMultiplier;
    const effectiveRange = tower.definition.stats.range * tower.starBonuses.rangeMultiplier;

    this.updateTowerInfo({
      icon: tower.definition.emoji,
      name: tower.definition.name,
      level: tower.level || 1,
      description: tower.definition.description,
      stats: {
        attack:  { value: effectiveDamage.toFixed(1) },
        speed:   { value: effectiveAttackSpeed.toFixed(2) + '초' },
        range:   { value: Math.floor(effectiveRange).toString() },
        special: {
          value: tower.starBonuses.statusSuccessRate > 0
            ? `+${(tower.starBonuses.statusSuccessRate * 100).toFixed(1)}%`
            : '-'
        }
      }
    });

    this._updateTowerActionButtons(tower);
    this._showTowerImprints(tower);
    this.ui._showUpgradeTree(tower);
  }

  /**
   * 빈 슬롯 타워 설치 패널 표시 (_showTowerBuild)
   */
  showBuild() {
    console.log('TowerDetailPanel: Showing tower build');

    if (this.ui.starUpgradeManager?.isCurrentlyUpgrading()) {
      this.ui.starUpgradeManager.dismissUpgradeUI();
    }

    const starUpgradeUI = document.getElementById('tower-star-upgrade');
    if (starUpgradeUI) starUpgradeUI.classList.add('hidden');

    if (this.ui.towerDetailContent) {
      this.ui.towerDetailContent.classList.add('hidden');
      console.log('TowerDetailPanel: Hidden tower-detail');
    }
    if (this.ui.towerBuildContent) {
      this.ui.towerBuildContent.classList.remove('hidden');
      console.log('TowerDetailPanel: Showing tower-build');
    }

    this._setupTowerBuildButtons();
  }

  /**
   * 타워 스탯 정보 DOM 업데이트 (updateTowerInfo)
   */
  updateTowerInfo(towerData) {
    const detailSection = document.getElementById('tower-detail');
    if (!detailSection) return;

    const iconLarge = detailSection.querySelector('.tower-icon-large');
    if (iconLarge) iconLarge.textContent = towerData.icon;

    const titleElement = detailSection.querySelector('.tower-title h2');
    if (titleElement) titleElement.textContent = towerData.name;

    const subtitleElement = detailSection.querySelector('.tower-subtitle');
    if (subtitleElement) {
      subtitleElement.textContent = `Lv ${towerData.level} • ${towerData.description}`;
    }

    if (towerData.stats) {
      const attackStat = detailSection.querySelector('[data-stat="attack"]');
      if (attackStat && towerData.stats.attack) attackStat.textContent = towerData.stats.attack.value;

      const speedStat = detailSection.querySelector('[data-stat="speed"]');
      if (speedStat && towerData.stats.speed) speedStat.textContent = towerData.stats.speed.value;

      const rangeStat = detailSection.querySelector('[data-stat="range"]');
      if (rangeStat && towerData.stats.range) rangeStat.textContent = towerData.stats.range.value;

      const specialStat = detailSection.querySelector('[data-stat="special"]');
      if (specialStat && towerData.stats.special) specialStat.textContent = towerData.stats.special.value;
    }
  }

  /**
   * 타워 XP/별 성장 정보 업데이트
   */
  _updateTowerGrowthInfo(tower) {
    const starDisplay = document.getElementById('towerStarDisplay');
    if (starDisplay) {
      const star = tower.star || 1;
      starDisplay.textContent = `${'⭐'.repeat(Math.min(star, 5))} ${star}성`;
    }

    const towerGrowthSystem = this.ui.gameLoop?.getTowerGrowthSystem();
    if (towerGrowthSystem) {
      const xpRequired = towerGrowthSystem.getXPRequiredForNextLevel(tower);
      const currentXP = tower.xp || 0;
      const xpPercent = xpRequired > 0 ? (currentXP / xpRequired) * 100 : 100;

      const xpBar = document.getElementById('towerXPBar');
      const xpText = document.getElementById('towerXPText');

      if (xpBar) xpBar.style.width = `${Math.min(xpPercent, 100)}%`;

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
   * 판매 버튼 갱신 (팔 때 실제 환급액 표시 + 클릭 핸들러)
   */
  _updateTowerActionButtons(tower) {
    const economySystem = this.ui.gameLoop?.getEconomySystem();
    const towerManager = this.ui.gameLoop?.getTowerManager();
    if (!economySystem || !towerManager) return;

    const sellBtn = document.getElementById('sellBtn');
    if (sellBtn) {
      const refundAmount = towerManager.calculateSellValue(tower);
      sellBtn.textContent = `💰 판매 (+🍎 ${refundAmount})`;

      sellBtn.onclick = (e) => {
        e.stopPropagation();
        const refund = towerManager.sellTower(tower);
        economySystem.earnNC(refund);
        this.ui._showToast(`타워 판매: +🍎 ${refund}`, 'success');
        this.ui.updateNutritionDisplay(economySystem.getState());
        this.ui._triggerSave();
        this.ui.closeSheet();
      };
    }
  }

  /**
   * 각인(imprint) 블록 표시
   */
  _showTowerImprints(tower) {
    const imprintBlock = document.getElementById('towerImprintBlock');
    const imprintList = document.getElementById('towerImprintList');
    const imprintCount = document.getElementById('imprintCount');

    if (!imprintBlock || !imprintList || !imprintCount) return;

    if (!tower.imprints || tower.imprints.length === 0) {
      imprintBlock.classList.add('hidden');
      return;
    }

    imprintBlock.classList.remove('hidden');
    imprintCount.textContent = `${tower.imprints.length}개`;
    imprintList.innerHTML = '';

    tower.imprints.forEach((imprint) => {
      const card = document.createElement('div');
      card.className = 'tower-imprint-card';
      card.innerHTML = `
        <div class="imprint-card-top">
          <span class="imprint-star-badge">${imprint.acquiredStar}★</span>
          <span class="imprint-card-title">✨ ${imprint.nodeName}</span>
        </div>
        <div class="imprint-card-description">${formatTagText(imprint.nodeDescription)}</div>
      `;
      imprintList.appendChild(card);
    });
  }

  /**
   * 타워 설치 버튼 이벤트 등록
   */
  _setupTowerBuildButtons() {
    const towerGrid = document.querySelector('#tower-build .tower-grid');
    if (!towerGrid) return;

    const towerCards = towerGrid.querySelectorAll('.tower-card:not(.locked)');
    const economySystem = this.ui.gameLoop.getEconomySystem();
    const towerManager = this.ui.gameLoop.getTowerManager();

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
          this.ui._playUISfx('ui_error', { volume: 0.78 });
          console.warn('Not enough nutrition to build tower');
          return;
        }

        if (economySystem.spend(definition.cost)) {
          towerManager.buildTower(towerType, this.ui.selectedSlot);
          this.ui._playUISfx('tower_place', { volume: 0.85 });
          this.ui.closeSheet();
          this.ui.updateNutritionDisplay(economySystem.getState());
        }
      };
    });
  }

  /**
   * 타워 판매 처리 (시트 닫기 포함)
   */
  _handleSellTower() {
    if (!this.ui.gameLoop || !this.ui.selectedSlot) return;

    const towerManager = this.ui.gameLoop.getTowerManager();
    const tower = towerManager.getTowerAtSlot(this.ui.selectedSlot);

    if (!tower) {
      console.warn('No tower to sell');
      return;
    }

    const refund = towerManager.sellTower(tower);
    const economySystem = this.ui.gameLoop.getEconomySystem();
    economySystem.earn(refund);

    console.log(`Tower sold for ${refund} nutrition`);
    this.ui.updateNutritionDisplay(economySystem.getState());
    this.ui.closeSheet();
  }
}
