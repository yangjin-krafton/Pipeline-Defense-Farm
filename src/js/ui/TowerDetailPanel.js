/**
 * TowerDetailPanel.js
 * 타워 상세 정보 패널 및 타워 설치 UI 패널 모듈
 */

import { TOWER_DEFINITIONS } from '../digestion/data/towerDefinitions.js';
import { formatTagText } from '../utils/TagFormatter.js';

// 태그별 라벨/색상 메타
const TAG_META = {
  protein: { label: '단백질',   color: '#059669', bg: 'rgba(16,185,129,0.12)', border: '#10b981' },
  fat:     { label: '지방',     color: '#b45309', bg: 'rgba(245,158,11,0.12)', border: '#f59e0b' },
  carb:    { label: '탄수화물', color: '#1d4ed8', bg: 'rgba(59,130,246,0.12)', border: '#3b82f6' },
  sugar:   { label: '당',       color: '#c2410c', bg: 'rgba(249,115,22,0.12)', border: '#f97316' },
  fiber:   { label: '식이섬유', color: '#6d28d9', bg: 'rgba(139,92,246,0.12)', border: '#8b5cf6' },
  vitamin: { label: '비타민',   color: '#0e7490', bg: 'rgba(6,182,212,0.12)',  border: '#06b6d4' },
};

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

    const stats = this._computeStatsForUI(tower);

    this.updateTowerInfo({
      icon: tower.definition.emoji,
      name: tower.definition.name,
      level: tower.level || 1,
      description: tower.definition.description,
      stats,
    });

    this._renderTagBonuses(tower);
    this._updateTowerActionButtons(tower);
    this._showTowerImprints(tower);
    this.ui._showUpgradeTree(tower);
  }

  /**
   * 잠긴 슬롯 언락 패널 표시
   * @param {Object} slot - TOWER_SLOTS 슬롯 객체 (unlockCost 포함)
   */
  showUnlock(slot) {
    if (this.ui.starUpgradeManager?.isCurrentlyUpgrading()) {
      this.ui.starUpgradeManager.dismissUpgradeUI();
    }

    const starUpgradeUI = document.getElementById('tower-star-upgrade');
    if (starUpgradeUI) starUpgradeUI.classList.add('hidden');
    if (this.ui.towerDetailContent) this.ui.towerDetailContent.classList.add('hidden');
    if (this.ui.towerBuildContent) this.ui.towerBuildContent.classList.add('hidden');
    if (this.ui.towerUnlockContent) this.ui.towerUnlockContent.classList.remove('hidden');

    // 비용 표시
    const costEl = document.getElementById('unlockCostAmount');
    if (costEl) costEl.textContent = `🍎 ${slot.unlockCost.toLocaleString()}`;

    // 언락 확인 버튼 (비용 표시)
    const confirmBtn = document.getElementById('confirmUnlockBtn');
    if (confirmBtn) {
      confirmBtn.textContent = `🔓 언락  🍎 ${slot.unlockCost.toLocaleString()}`;
      confirmBtn.onclick = (e) => {
        e.stopPropagation();
        const economySystem = this.ui.gameLoop?.getEconomySystem();
        const towerManager = this.ui.gameLoop?.getTowerManager();
        if (!economySystem || !towerManager) return;

        if (!economySystem.canAffordNC(slot.unlockCost)) {
          this.ui._playUISfx('ui_error', { volume: 0.78 });
          this.ui._showToast(`NC 부족 (필요: 🍎 ${slot.unlockCost.toLocaleString()})`, 'error');
          return;
        }

        economySystem.spendNC(slot.unlockCost);
        towerManager.unlockSlot(slot);
        this.ui.updateNutritionDisplay(economySystem.getState());

        if (this.ui.resourceAbsorptionSystem) {
          this.ui.resourceAbsorptionSystem.emitDrop('nc', slot.unlockCost);
        }

        this.ui._playUISfx('tower_place', { volume: 0.85 });
        this.ui._showToast('슬롯 언락!', 'success');
        this.ui._triggerSave();
        this.ui.closeSheet();
      };
    }

    // 닫기 버튼
    const closeBtn = document.getElementById('closeUnlockBtn');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.ui.closeSheet();
      };
    }
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
    }
    if (this.ui.towerBuildContent) {
      this.ui.towerBuildContent.classList.remove('hidden');
    }

    this._setupTowerBuildButtons();
  }

  /**
   * 공통 5개 스탯 + 음식 태그 보너스 계산
   * @param {Object} tower
   * @returns {Object} stats object
   */
  _computeStatsForUI(tower) {
    const modules = tower.upgradeTree ? tower.upgradeTree.getAllActiveModules() : [];

    // ── 1. 공격력 ───────────────────────────────────────────
    const damage = tower.damage * tower.starBonuses.damageMultiplier;

    // ── 2. 공격속도 / 충전속도 ──────────────────────────────
    const isEnzymeCharge = tower.type === 'enzymeCharge';
    let speedLabel, speedValue;

    if (isEnzymeCharge) {
      // 충전 속도: chargeRate × (1 + chargeRateBonus 합산)
      let chargeRateMultiplier = 1.0;
      for (const m of modules) {
        if (m.chargeRateBonus > 0) chargeRateMultiplier += m.chargeRateBonus;
      }
      const effectiveChargeRate = (tower.chargeRate ?? 25) * chargeRateMultiplier;
      speedLabel = '충전속도';
      speedValue = `${effectiveChargeRate.toFixed(1)}/초`;
    } else {
      // 공격 쿨다운: 1 / (attackSpeed × starMult × moduleSpeedMult)
      let attackSpeedMult = 1.0;
      for (const m of modules) {
        if (m.attackSpeedMultiplier && m.attackSpeedMultiplier !== 1.0) {
          attackSpeedMult *= m.attackSpeedMultiplier;
        }
      }
      const effectiveSpeed =
        tower.attackSpeed * tower.starBonuses.attackSpeedMultiplier * attackSpeedMult;
      const cooldown = 1 / effectiveSpeed;
      speedLabel = '공격속도';
      speedValue = `${cooldown.toFixed(2)}초`;
    }

    // ── 3. 사거리 ────────────────────────────────────────────
    let rangeModMult = 1.0;
    for (const m of modules) {
      if (m.rangeMultiplier && m.rangeMultiplier !== 1.0) rangeModMult *= m.rangeMultiplier;
    }
    const range = Math.floor(
      tower.range * tower.starBonuses.rangeMultiplier * rangeModMult
    );

    // ── 4. 치명타 확률 (star 기반 + 모듈 합산) ──────────────
    let critChance = tower.starBonuses.critChance || 0;
    for (const m of modules) {
      if (m.critChance > 0)      critChance += m.critChance;
      if (m.critChanceBonus > 0) critChance += m.critChanceBonus;
    }
    const critChancePct = Math.round(critChance * 100);

    // ── 5. 치명타 배율 (star 기반 + 모듈 합산) ──────────────
    let critMultBonus = tower.starBonuses.critMultBonus || 0;
    for (const m of modules) {
      critMultBonus += m.critMultiplierBonus ?? 0;
      critMultBonus += m.critDamageBonus ?? 0;
    }
    const critMult = 2.0 + critMultBonus;

    return {
      attack:    { value: damage.toFixed(1) },
      speed:     { value: speedValue, label: speedLabel },
      range:     { value: range.toString() },
      critChance:{ value: critChancePct > 0 ? `${critChancePct}%` : '0%' },
      critMult:  { value: `×${critMult.toFixed(1)}` },
    };
  }

  /**
   * 음식 태그 추가 피해 칩 렌더링
   * @param {Object} tower
   */
  _renderTagBonuses(tower) {
    const container = document.getElementById('towerTagBonuses');
    if (!container) return;

    // 타워 기본 태그 보너스 + TagBonusModule 추가 보너스 수집
    const merged = { ...(tower.tagBonuses || {}) };
    if (tower.upgradeTree) {
      for (const m of tower.upgradeTree.getAllActiveModules()) {
        if (m.tagBonuses && typeof m.tagBonuses === 'object') {
          for (const [tag, mult] of Object.entries(m.tagBonuses)) {
            // 각인/노드 태그 보너스는 곱연산 누적
            merged[tag] = (merged[tag] ?? 1.0) * mult;
          }
        }
      }
    }

    const entries = Object.entries(merged).filter(([, v]) => v && v !== 1.0);

    if (entries.length === 0) {
      container.hidden = true;
      return;
    }

    container.hidden = false;
    container.innerHTML = entries
      .map(([tag, mult]) => {
        const meta = TAG_META[tag] ?? { label: tag, color: '#555', bg: 'rgba(0,0,0,0.06)', border: '#aaa' };
        const pct = Math.round((mult - 1) * 100);
        return `<span class="tag-bonus-chip" style="color:${meta.color};background:${meta.bg};border-color:${meta.border}">
          ${meta.label} <strong>+${pct}%</strong>
        </span>`;
      })
      .join('');
  }

  /**
   * 스킬트리 노드 활성/비활성 후 스탯·태그 보너스만 갱신
   * @param {Object} tower
   */
  refreshStats(tower) {
    const stats = this._computeStatsForUI(tower);
    this.updateTowerInfo({ stats });
    this._renderTagBonuses(tower);
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
      const s = towerData.stats;

      const set = (dataStat, stat) => {
        const el = detailSection.querySelector(`[data-stat="${dataStat}"]`);
        if (el && stat) el.textContent = stat.value;
      };

      set('attack',    s.attack);
      set('speed',     s.speed);
      set('range',     s.range);
      set('critChance',s.critChance);
      set('critMult',  s.critMult);

      // 공격속도/충전속도 레이블 동적 교체
      if (s.speed?.label) {
        const labelEl = document.getElementById('towerSpeedLabel');
        if (labelEl) labelEl.textContent = s.speed.label;
      }
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
      sellBtn.textContent = `🍎${refundAmount} 판매`;

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
          this.ui.tooltipManager?.show(card, [
            '🍎 NC 부족!',
            `필요: 🍎 ${definition.cost}`,
            '획득 방법:',
            '• 적 처치 시 자동 획득',
            '• 웨이브 클리어 보상',
            '• 6시간 주기 보상 수령',
          ], 3000);
          return;
        }

        if (economySystem.spend(definition.cost)) {
          towerManager.buildTower(towerType, this.ui.selectedSlot);
          this.ui._playUISfx('tower_place', { volume: 0.85 });
          this.ui.closeSheet();
          this.ui.updateNutritionDisplay(economySystem.getState());

          // NC 소비 낙하 연출
          if (this.ui.resourceAbsorptionSystem) {
            this.ui.resourceAbsorptionSystem.emitDrop('nc', definition.cost);
          }
        }
      };
    });
  }

  /**
   * 타워 판매 처리 (시트 닫기 포함)
   *
   * 순서:
   *   1. 환급금 계산 (타워는 아직 게임에 존재)
   *   2. 시트 닫기 → 카메라 리셋 애니메이션 시작
   *   3. 카메라 정착 완료 후:
   *      a. 타워 실제 제거 + NC 지급
   *      b. 타워 위치에서 NC 토큰 폭발 → NC 바로 흡수
   */
  _handleSellTower() {
    if (!this.ui.gameLoop || !this.ui.selectedSlot) return;

    const towerManager  = this.ui.gameLoop.getTowerManager();
    const tower         = towerManager.getTowerAtSlot(this.ui.selectedSlot);

    if (!tower) {
      console.warn('No tower to sell');
      return;
    }

    // closeSheet()가 selectedSlot을 null로 초기화하기 전에 캡처
    const sellSlot = this.ui.selectedSlot;

    // 환급금 미리 계산 (타워는 아직 게임에 남아있음)
    const refund = towerManager.calculateSellValue(tower);

    // 시트 닫기 (카메라 리셋 시작)
    this.ui.closeSheet();

    // ─── 판매 실행 함수 (중복 방지 플래그 포함) ────────────────────────────
    let _executed = false;
    const doSell = () => {
      if (_executed) return;
      _executed = true;

      towerManager.sellTower(tower);

      const economySystem = this.ui.gameLoop.getEconomySystem();
      economySystem.earnNC(refund);
      this.ui.updateNutritionDisplay(economySystem.getState());

      if (this.ui.resourceAbsorptionSystem && sellSlot && refund > 0) {
        this.ui.resourceAbsorptionSystem.emitFromGamePos(
          sellSlot.x, sellSlot.y, 'nc', refund, 10
        );
      }
    };

    // ─── 트리거: 카메라 정착 AND 최소 420ms 경과 — 둘 다 충족 시 실행 ────
    //   · 카메라가 이미 정지해 있어도 420ms가 gate 역할 → 즉시 사라짐 방지
    //   · 카메라 이동이 420ms 초과 시 카메라 완료가 추가 gate 역할
    let _cameraOk = false;
    let _timerOk  = false;
    const tryFire = () => { if (_cameraOk && _timerOk) doSell(); };

    if (this.ui.cameraController) {
      this.ui.cameraController._onResetComplete = () => { _cameraOk = true; tryFire(); };
    } else {
      _cameraOk = true;
    }

    setTimeout(() => { _timerOk = true; tryFire(); }, 420);
  }
}
