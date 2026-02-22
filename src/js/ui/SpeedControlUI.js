/**
 * SpeedControlUI.js
 * 속도 컨트롤 버튼 및 부스트 표시 UI 모듈
 */

import { COST_RATIOS } from '../digestion/data/economyDefinitions.js';

export class SpeedControlUI {
  constructor(uiController) {
    this.ui = uiController;
  }

  /**
   * 속도 버튼 이벤트 등록 (setupSpeedControls)
   */
  setup() {
    const speedButtons = document.querySelectorAll('.speed-btn');

    speedButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.ui._playUISfx('ui_click', { volume: 0.6 });

        if (btn.disabled) return;

        // 타워 메뉴 열린 상태에서는 속도 변경 불가
        if (this.ui.isExpanded) {
          console.log('Cannot change speed while tower menu is open');
          return;
        }

        const speed = parseFloat(btn.getAttribute('data-speed'));

        // 1x는 항상 무료
        if (speed === 1) {
          if (this.ui.gameLoop) {
            this.ui.gameLoop.setTimeScale(speed);
            this.ui.previousTimeScale = speed;
          }
          this.ui._playUISfx('ui_click', { volume: 0.62 });
          this.updateDisplay(speed);
          return;
        }

        // 2x/3x는 부스트 구매 필요
        if (this.ui.gameLoop) {
          const speedBoostSystem = this.ui.gameLoop.getSpeedBoostSystem();
          const economySystem = this.ui.gameLoop.getEconomySystem();

          if (!speedBoostSystem || !economySystem) {
            console.error('[SpeedControlUI] Missing system references');
            return;
          }

          btn.disabled = true;

          const result = speedBoostSystem.activateBoost(speed, economySystem);

          if (result.success) {
            this.ui.gameLoop.setTimeScale(speed);
            this.ui.previousTimeScale = speed;
            this.ui._playUISfx('wave_start', { volume: 0.75 });
            this.updateDisplay(speed);
          } else {
            this.showBoostError(result.reason);
          }

          setTimeout(() => { btn.disabled = false; }, 300);
        }
      });
    });
  }

  /**
   * 속도 버튼 표시 상태 업데이트 (updateSpeedButtonDisplay)
   * @param {number} speed - 현재 속도 (0.5, 1, 2, 3)
   */
  updateDisplay(speed) {
    const speedButtons = document.querySelectorAll('.speed-btn');

    speedButtons.forEach(btn => {
      const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
      btn.classList.remove('active', 'slow-motion');

      const speedTextSpan = btn.querySelector('.speed-text');

      if (speed === 0.5) {
        // 슬로 모션 (시트 열린 상태)
        if (btnSpeed === 1) {
          btn.classList.add('slow-motion');
          if (speedTextSpan) speedTextSpan.textContent = '0.5x';
        }
      } else if (btnSpeed === speed) {
        btn.classList.add('active');
        if (btnSpeed === 1 && speedTextSpan) speedTextSpan.textContent = '1x';
      } else if (btnSpeed === 1) {
        if (speedTextSpan) speedTextSpan.textContent = '1x';
      }
    });
  }

  /**
   * 부스트 구매 실패 시 오류 표시 (showBoostError)
   * @param {string} reason - 'insufficient_sc' | 'active_boost_exists' | etc.
   */
  showBoostError(reason) {
    const scResource = document.querySelector('.sc-resource');
    this.ui._playUISfx('ui_error', { volume: 0.75 });

    if (reason === 'insufficient_sc') {
      if (scResource) {
        scResource.classList.add('insufficient-shake');
        setTimeout(() => scResource.classList.remove('insufficient-shake'), 500);
      }
      console.log('[SpeedControlUI] ⚡ Insufficient Supply Charge!');
    } else if (reason === 'active_boost_exists') {
      console.log('[SpeedControlUI] ⏱️ Boost already active!');
    } else {
      console.warn(`[SpeedControlUI] Boost activation failed: ${reason}`);
    }
  }

  /**
   * 부스트 타이머 및 버튼 상태 업데이트 (updateBoostDisplay)
   * main.js updateUIDisplays 루프에서 호출
   */
  updateBoostDisplay() {
    const speedBoostSystem = this.ui.gameLoop?.getSpeedBoostSystem();
    if (!speedBoostSystem) return;

    const activeBoost = speedBoostSystem.getActiveBoost();

    if (activeBoost) {
      const timerContainer = document.getElementById('boostTimerContainer');
      const timerElement = document.getElementById('boostTimer');
      const labelElement = document.getElementById('boostLabel');

      if (timerContainer && timerElement && labelElement) {
        timerElement.textContent = speedBoostSystem.getFormattedRemainingTime();
        labelElement.textContent = `${activeBoost.speed}x`;
        timerContainer.style.display = 'flex';
      }

      this.updateButtonsForBoost(activeBoost.speed);
    } else {
      const timerContainer = document.getElementById('boostTimerContainer');
      if (timerContainer) timerContainer.style.display = 'none';

      this.updateButtonAffordability();
    }
  }

  /**
   * 부스트 활성 시 버튼 상태 업데이트 (updateSpeedButtonsForBoost)
   * @param {number} activeSpeed - 현재 활성 부스트 속도
   */
  updateButtonsForBoost(activeSpeed) {
    const buttons = document.querySelectorAll('.speed-btn');
    buttons.forEach(btn => {
      const speed = parseFloat(btn.getAttribute('data-speed'));
      btn.classList.remove('active', 'boost-active', 'disabled');

      if (speed === activeSpeed) {
        btn.classList.add('boost-active');
      } else if (speed !== 1) {
        btn.classList.add('disabled');
      }
    });
  }

  /**
   * SC 보유량에 따른 버튼 활성화 여부 업데이트 (updateSpeedButtonAffordability)
   */
  updateButtonAffordability() {
    const economySystem = this.ui.gameLoop?.getEconomySystem();
    if (!economySystem) return;

    const buttons = document.querySelectorAll('.speed-btn');
    buttons.forEach(btn => {
      const speed = parseFloat(btn.getAttribute('data-speed'));

      if (speed === 1) {
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
}
