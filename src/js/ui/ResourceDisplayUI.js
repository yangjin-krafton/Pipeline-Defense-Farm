/**
 * ResourceDisplayUI.js
 * 경제 표시 (NC/SC 재화) 및 보상 버튼 UI 모듈
 */

export class ResourceDisplayUI {
  constructor(uiController) {
    this.ui = uiController;
  }

  /**
   * NC/SC 재화 표시 업데이트 (updateNutritionDisplay)
   * @param {number|Object} economyState - 숫자(레거시) 또는 {nc, sc, scMax, scFractional}
   */
  updateNutrition(economyState) {
    // NC (영양 크레딧)
    const ncAmount = document.getElementById('ncAmount');
    if (ncAmount) {
      if (typeof economyState === 'number') {
        const newAmount = Math.floor(economyState);
        this._animateNumberChange(ncAmount, parseInt(ncAmount.textContent) || 0, newAmount);
      } else {
        const newAmount = Math.floor(economyState.nc);
        this._animateNumberChange(ncAmount, parseInt(ncAmount.textContent) || 0, newAmount);
      }
    }

    // SC (보급 차지) — 게이지 바 형태
    if (typeof economyState === 'object') {
      const scBarProgress = document.getElementById('scBarProgress');
      const scText = document.getElementById('scText');
      const scResource = document.querySelector('.sc-resource');

      const currentSC = Math.floor(economyState.sc);
      const maxSC = economyState.scMax;
      const scFractional = economyState.scFractional || 0;

      const progressPercent = scFractional * 100;

      const prevSC = scBarProgress?.dataset.prevSc ? parseInt(scBarProgress.dataset.prevSc) : currentSC;
      const isInitialized = scBarProgress?.dataset.initialized === 'true';

      if (scBarProgress) {
        scBarProgress.style.width = `${Math.min(progressPercent, 100)}%`;

        if (!isInitialized) {
          scBarProgress.dataset.initialized = 'true';
          scBarProgress.dataset.prevSc = currentSC;
        }

        if (isInitialized && currentSC > prevSC) {
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
        if (isInitialized && currentSC > prevSC) {
          scText.classList.add('increase');
          setTimeout(() => scText.classList.remove('increase'), 400);
        }
      }

      if (scResource && isInitialized && currentSC > prevSC) {
        scResource.classList.add('show-particle');
        setTimeout(() => scResource.classList.remove('show-particle'), 800);
      }
    }
  }

  /**
   * 숫자 카운트업 애니메이션
   */
  _animateNumberChange(element, from, to) {
    if (from === to) {
      element.textContent = to;
      return;
    }

    const duration = 300;
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
   * AP 표시 업데이트 (Deprecated — updateNutritionDisplay 사용 권장)
   */
  updateAPDisplay(current, max) {
    const resources = document.querySelectorAll('.resource');
    if (resources[1]) {
      resources[1].textContent = `⚡ ${current}/${max}`;
    }
  }

  /**
   * 트러블 표시 업데이트 (Deprecated — Trouble System 제거됨)
   */
  updateTroubleDisplay(congestion, acidity) {
    // Trouble System 제거됨 — 하위 호환 stub
  }

  /**
   * 1시간 보상 버튼 이벤트 등록
   */
  setupHourlyClaimButton() {
    const claimBtn = document.getElementById('hourlyClaimBtn');
    if (!claimBtn) {
      console.warn('Hourly claim button not found');
      return;
    }

    claimBtn.addEventListener('click', () => {
      this.ui._playUISfx('ui_click', { volume: 0.62 });
      if (!this.ui.gameLoop) return;

      const timeTrackingSystem = this.ui.gameLoop.getTimeTrackingSystem();
      const economySystem = this.ui.gameLoop.getEconomySystem();

      const result = timeTrackingSystem.claimHourlyReward(economySystem);

      if (result.success) {
        this.ui._playUISfx('wave_clear', { volume: 0.86 });
        this.ui._showToast(`1시간 보상 수령! +${result.sc} SC`, 'success');
        this.updateNutrition(economySystem.getState());
        claimBtn.style.display = 'none';

        // SC 토큰 흡수 연출
        if (this.ui.resourceAbsorptionSystem && result.sc > 0) {
          this.ui.resourceAbsorptionSystem.emitFromElement(claimBtn, 'sc', result.sc);
        }
      } else {
        this.ui._showToast(result.reason || '보상을 수령할 수 없습니다', 'error');
      }
    });

    console.log('[ResourceDisplayUI] Hourly claim button initialized');
  }

  /**
   * 6시간 보상 버튼 이벤트 등록
   */
  setupSixHourClaimButton() {
    const claimBtn = document.getElementById('sixHourClaimBtn');
    if (!claimBtn) {
      console.warn('Six hour claim button not found');
      return;
    }

    claimBtn.addEventListener('click', () => {
      this.ui._playUISfx('ui_click', { volume: 0.62 });
      if (!this.ui.gameLoop) return;

      const timeTrackingSystem = this.ui.gameLoop.getTimeTrackingSystem();
      const economySystem = this.ui.gameLoop.getEconomySystem();

      const result = timeTrackingSystem.claimSixHourReward(economySystem);

      if (result.success) {
        this.ui._playUISfx('wave_clear', { volume: 0.9 });
        this.ui._showToast(`${result.timeSlot} 보상 수령! +${result.nc} NC, +${result.sc} SC`, 'success');
        this.updateNutrition(economySystem.getState());
        claimBtn.style.display = 'none';

        // NC·SC 토큰 흡수 연출 (약간 시차를 두어 순서 구분)
        if (this.ui.resourceAbsorptionSystem) {
          if (result.sc > 0) {
            this.ui.resourceAbsorptionSystem.emitFromElement(claimBtn, 'sc', result.sc);
          }
          if (result.nc > 0) {
            setTimeout(() => {
              this.ui.resourceAbsorptionSystem.emitFromElement(claimBtn, 'nc', result.nc);
            }, 200);
          }
        }
      } else {
        this.ui._showToast(result.reason || '보상을 수령할 수 없습니다', 'error');
      }
    });

    console.log('[ResourceDisplayUI] Six hour claim button initialized');
  }

  /**
   * 1시간 보상 버튼 표시 상태 갱신
   * main.js updateUIDisplays 루프에서 호출
   */
  updateHourlyClaimDisplay() {
    const timeTrackingSystem = this.ui.gameLoop?.getTimeTrackingSystem();
    if (!timeTrackingSystem) return;

    const claimBtn = document.getElementById('hourlyClaimBtn');
    if (!claimBtn) return;

    const canClaim = timeTrackingSystem.canClaimHourlyReward();
    claimBtn.style.display = canClaim ? 'flex' : 'none';
  }

  /**
   * 6시간 보상 버튼 표시 상태 및 레이블 갱신
   * main.js updateUIDisplays 루프에서 호출
   */
  updateSixHourClaimDisplay() {
    const timeTrackingSystem = this.ui.gameLoop?.getTimeTrackingSystem();
    if (!timeTrackingSystem) return;

    const claimBtn = document.getElementById('sixHourClaimBtn');
    const claimText = document.getElementById('sixHourClaimText');
    if (!claimBtn || !claimText) return;

    const available = timeTrackingSystem.getAvailableSixHourReward();

    if (available) {
      claimBtn.style.display = 'flex';
      claimText.textContent = `${available.timeSlot} 보상`;
      claimBtn.title = `${available.timeSlot} 보상: +${available.nc} NC, +${available.sc} SC`;
    } else {
      claimBtn.style.display = 'none';
    }
  }
}
