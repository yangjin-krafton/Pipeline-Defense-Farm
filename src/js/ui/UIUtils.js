/**
 * UIUtils.js
 * 독립적인 UI 유틸리티 정적 메서드 모음
 * 의존성 없음 — sfxFn 파라미터로 SFX 주입
 */

export class UIUtils {
  /**
   * 잉크 스플래시 효과 생성 (이벤트 기반, 화면 좌표 기준)
   */
  static createInkSplash(event, color) {
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
   * 랜덤 Splatoon 컬러 반환
   */
  static getRandomColor() {
    const colors = ['#e94560', '#00d9ff', '#ffd700'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * 레거시 리소스 텍스트 업데이트
   */
  static updateResource(type, value) {
    const resources = document.querySelectorAll('.resource');
    resources.forEach(resource => {
      const text = resource.textContent;
      if (text.includes(type)) {
        const emoji = text.split(' ')[0];
        resource.textContent = `${emoji} ${value}`;
      }
    });
  }

  /**
   * 토스트 알림 표시
   * @param {string} message
   * @param {string} type - 'success' | 'error' | 'info' | 'warning'
   * @param {Function} [sfxFn] - (eventName, options) => void
   */
  static showToast(message, type = 'info', sfxFn = null) {
    if (sfxFn) {
      if (type === 'error') {
        sfxFn('ui_error', { volume: 0.68 });
      } else if (type === 'success') {
        sfxFn('ui_click', { volume: 0.55 });
      }
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const colors = { success: '#00d9ff', error: '#ff006e', info: '#ffd700', warning: '#ff6b00' };

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

    setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
      toast.style.opacity = '1';
    }, 10);

    setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(-100px)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /**
   * 확인 다이얼로그 표시
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.message
   * @param {Function} [options.onConfirm]
   * @param {Function} [options.onCancel]
   * @param {Function} [sfxFn] - (eventName, options) => void
   */
  static showConfirmDialog({ title, message, onConfirm, onCancel }, sfxFn = null) {
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
      if (sfxFn) sfxFn('ui_click', { volume: 0.62 });
      overlay.remove();
      if (onConfirm) onConfirm();
    });

    cancelBtn.addEventListener('click', () => {
      if (sfxFn) sfxFn('ui_click', { volume: 0.58 });
      overlay.remove();
      if (onCancel) onCancel();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (sfxFn) sfxFn('ui_click', { volume: 0.52 });
        overlay.remove();
        if (onCancel) onCancel();
      }
    });
  }
}
