/**
 * UpgradeNodeCard.js
 * 업그레이드 트리 노드 카드 생성 모듈
 * 각인(imprint) 비용 계산 및 효과 텍스트 생성 포함
 */

import { formatTagText } from '../utils/TagFormatter.js';

export class UpgradeNodeCard {
  constructor(uiController) {
    this.ui = uiController;
  }

  /**
   * 업그레이드 노드 카드 DOM 생성 (_createUpgradeNodeCard)
   * @param {Object} node - 업그레이드 노드
   * @param {Object} tree - 업그레이드 트리
   * @param {Object} tower - 타워 인스턴스
   * @param {Object} economySystem - 경제 시스템
   * @returns {HTMLElement}
   */
  create(node, tree, tower, economySystem) {
    const card = document.createElement('div');
    const isActive = tree.activeNodes.includes(node);

    const imprintCount = tower.imprintCounts.get(node.nodeNumber) || 0;
    const imprintSuffix = imprintCount > 0
      ? `<span style="background:#ffd700;color:#1a1a2e;font-weight:900;padding:2px 7px;border-radius:8px;border:2px solid #1a1a2e;box-shadow:0 2px 0 #1a1a2e;white-space:nowrap;">+${imprintCount}</span>`
      : '';

    const towerBaseCost = tower.definition.cost;
    const imprintCostMultiplier = this._getImprintCostMultiplier(imprintCount);
    const ncCost = Math.floor(towerBaseCost * node.ncCostMultiplier * imprintCostMultiplier);
    const canAffordNC = economySystem.canAffordNC(ncCost);
    const canAffordPoints = tree.usedPoints + node.cost <= tree.availablePoints;
    const canActivate = node.canActivate(tree.activeNodes) && canAffordPoints && canAffordNC;

    card.className = 'upgrade-node-card splatoon-node';

    const bgColor = isActive
      ? 'linear-gradient(135deg, #00d9ff 0%, #0fb9b1 100%)'
      : canActivate ? '#fff' : '#e0e0e0';
    const borderColor = isActive ? '#00d9ff' : canActivate ? '#e94560' : '#999';

    card.style.cssText = `
      padding: 10px 12px;
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
      justify-content: flex-start;
      pointer-events: none;
    `;

    const enhancedEffect = this._getEnhancedEffectText(node, imprintCount);
    const nameFontSize = node.name.length > 10 ? '13px' : node.name.length > 7 ? '14px' : '15px';
    const effectFontSize = enhancedEffect.length > 60 ? '15px'
      : enhancedEffect.length > 45 ? '16px'
      : enhancedEffect.length > 30 ? '17px' : '18px';

    content.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
        <div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;">
          <span style="
            background: linear-gradient(90deg, #00d9ff, #0fb9b1);
            color: #fff;
            min-width: 60px;
            height: 28px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 900;
            border: 3px solid #1a1a2e;
            box-shadow: 0 3px 0 #1a1a2e;
            flex-shrink: 0;
            padding: 0 8px;
            opacity: ${canAffordNC ? '1' : '0.5'};
          ">🍎 ${ncCost}</span>
          <strong style="
            color: ${isActive ? '#fff' : '#1a1a2e'};
            font-size: ${nameFontSize};
            font-weight: 900;
            text-shadow: ${isActive ? '2px 2px 0 rgba(0,0,0,0.3)' : 'none'};
            line-height: 1.2;
            word-break: keep-all;
            overflow-wrap: break-word;
            min-width: 0;
          ">${node.name} ${imprintSuffix}</strong>
        </div>
        ${isActive ? '<span style="color: #ffd700; font-size: 20px; filter: drop-shadow(2px 2px 0 rgba(0,0,0,0.3)); flex-shrink: 0;">✓</span>' : ''}
      </div>
      <p style="
        color: ${isActive ? '#fff' : '#1a1a2e'};
        font-size: ${effectFontSize};
        line-height: 1.4;
        margin: auto 0 0 0;
        padding-top: 4px;
        font-weight: ${isActive ? '700' : '600'};
        text-shadow: ${isActive ? '1px 1px 0 rgba(0,0,0,0.2)' : 'none'};
        word-break: keep-all;
        overflow-wrap: break-word;
        overflow: visible;
      ">${enhancedEffect}</p>
    `;
    card.appendChild(content);

    if (canActivate && !isActive) {
      card.style.cursor = 'pointer';

      let touchStartTime = 0;
      let touchMoved = false;

      const handlePointerDown = () => {
        touchStartTime = Date.now();
        touchMoved = false;
        card.style.transform = 'translateY(3px) rotate(0deg) scale(0.98)';
        card.style.boxShadow = `
          0 0 0 3px ${borderColor},
          0 3px 0 #1a1a2e,
          0 5px 10px rgba(0, 0, 0, 0.3)
        `;
      };

      const handlePointerMove = () => { touchMoved = true; };

      const handlePointerUp = (e) => {
        const touchDuration = Date.now() - touchStartTime;

        if (!touchMoved && touchDuration < 300) {
          e.stopPropagation();
          e.preventDefault();

          if (!canAffordNC) {
            this.ui._showToast(`비용 부족: 🍎 ${ncCost} NC 필요`, 'error');
            return;
          }

          if (!canAffordPoints) {
            this.ui._showToast('업그레이드 포인트 부족', 'error');
            return;
          }

          if (tree.activateNode(node.nodeNumber, economySystem, towerBaseCost)) {
            console.log(`Activated upgrade node ${node.nodeNumber}: ${node.name} (Cost: ${ncCost} NC, ${node.cost} Points)`);
            this._createInkSplash(card, '#00d9ff');
            this.ui._playUISfx('tower_upgrade', { volume: 0.75 });
            this.ui._showToast(`노드 활성화: -🍎 ${ncCost} NC`, 'success');
            this.ui.updateNutritionDisplay(economySystem.getState());
            this.ui._triggerSave();

            // NC 소비 낙하 연출
            if (this.ui.resourceAbsorptionSystem && ncCost > 0) {
              this.ui.resourceAbsorptionSystem.emitDrop('nc', ncCost);
            }

            setTimeout(() => {
              this.ui._showUpgradeTree(tower);
              this.ui._refreshTowerStats(tower);
            }, 200);
          }
        }

        card.style.transform = 'translateY(0) rotate(0deg) scale(1)';
        card.style.boxShadow = `
          0 0 0 3px ${borderColor},
          0 6px 0 #1a1a2e,
          0 8px 20px rgba(0, 0, 0, 0.3)
        `;
      };

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

      card.addEventListener('touchstart', handlePointerDown, { passive: true });
      card.addEventListener('touchmove', handlePointerMove, { passive: true });
      card.addEventListener('touchend', handlePointerUp, { passive: false });
      card.addEventListener('mousedown', handlePointerDown);
      card.addEventListener('mousemove', handlePointerMove);
      card.addEventListener('mouseup', handlePointerUp);
    } else if (isActive) {
      card.style.animation = 'splat-glow-subtle 3s ease-in-out infinite';
    }

    return card;
  }

  /**
   * 요소 중앙에 잉크 스플래시 애니메이션 생성 (노드 전용)
   * @param {HTMLElement} element
   * @param {string} color
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

    splash.animate([
      { transform: 'translate(-50%, -50%) scale(0) rotate(0deg)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(8) rotate(180deg)', opacity: 0 }
    ], { duration: 600, easing: 'ease-out' });

    setTimeout(() => splash.remove(), 600);
  }

  /**
   * 각인 횟수에 따른 NC 비용 배율 계산
   * 공식: 1.0 + (count ^ 1.4) * 0.5
   * 예: 0→1.0, 1→1.5, 2→2.2, 3→3.2, 4→4.5 ...
   * @param {number} imprintCount
   * @returns {number}
   */
  _getImprintCostMultiplier(imprintCount) {
    if (imprintCount === 0) return 1.0;
    return 1.0 + Math.pow(imprintCount, 1.4) * 0.5;
  }

  /**
   * 각인 보너스가 반영된 효과 텍스트 생성
   * @param {Object} node - 업그레이드 노드
   * @param {number} imprintCount - 각인 횟수
   * @returns {string} HTML 텍스트
   */
  _getEnhancedEffectText(node, imprintCount) {
    if (imprintCount === 0) {
      return formatTagText(node.effect);
    }

    let enhancedText = node.effect;

    const patterns = [
      // 기본 피해 +N% (곱연산)
      {
        regex: /기본 피해 \+(\d+)%/g,
        calc: (base) => {
          const stacked = Math.pow(1 + base / 100, imprintCount);
          return (stacked - 1) * 100;
        },
        isMultiplicative: true
      },
      // 추가 피해 +N% (가산)
      {
        regex: /추가 피해 \+(\d+)%/g,
        calc: (base) => base * imprintCount,
        isMultiplicative: false
      },
      // 공격속도 +N% (곱연산)
      {
        regex: /공격속도 \+(\d+)%/g,
        calc: (base) => {
          const stacked = Math.pow(1 + base / 100, imprintCount);
          return (stacked - 1) * 100;
        },
        isMultiplicative: true
      },
      // 치명타 확률 +N%p (가산)
      {
        regex: /치명타 확률 \+(\d+)%p/g,
        calc: (base) => base * imprintCount,
        isMultiplicative: false
      },
      // 치명타 +N%p (가산)
      {
        regex: /치명타 \+(\d+)%p/g,
        calc: (base) => base * imprintCount,
        isMultiplicative: false
      },
      // 치명타 배율 +N.N (가산)
      {
        regex: /치명타 배율 \+(\d+\.?\d*)/g,
        calc: (base) => base * imprintCount,
        isMultiplicative: false,
        isDecimal: true
      }
    ];

    for (const pattern of patterns) {
      let match;
      const matches = [];

      while ((match = pattern.regex.exec(enhancedText)) !== null) {
        matches.push({
          fullMatch: match[0],
          value: pattern.isDecimal ? parseFloat(match[1]) : parseInt(match[1]),
          index: match.index
        });
      }

      // 역순 교체 (인덱스 유지)
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        const totalBonus = pattern.calc(m.value);
        const bonusText = pattern.isDecimal
          ? `(+${totalBonus.toFixed(1)})`
          : `(+${totalBonus.toFixed(1)}%)${pattern.regex.source.includes('%p') ? 'p' : ''}`;

        const replacement = `${m.fullMatch} <span style="background:#ffd700;color:#1a1a2e;font-weight:900;padding:1px 5px;border-radius:5px;border:2px solid #1a1a2e;">${bonusText}</span>`;
        enhancedText = enhancedText.substring(0, m.index)
          + replacement
          + enhancedText.substring(m.index + m.fullMatch.length);
      }
    }

    return formatTagText(enhancedText);
  }
}
