/**
 * TooltipManager.js
 * 공용 말풍선 툴팁 모듈
 *
 * 사용법:
 *   tooltipManager.show(anchorEl, lines, duration?)
 *   tooltipManager.hide()
 *
 * - anchorEl 기준으로 아래(또는 위) 배치
 * - duration ms 후 자동 hide
 * - position: fixed → scale-container 영향 없음
 */

export class TooltipManager {
  constructor() {
    this._el = null;
    this._timer = null;
    this._init();
  }

  _init() {
    this._el = document.getElementById('ui-tooltip');
    if (!this._el) {
      console.warn('[TooltipManager] #ui-tooltip element not found');
    }
  }

  /**
   * 툴팁 표시
   * @param {Element|null} anchorEl - 기준 DOM 엘리먼트 (null이면 화면 중앙 상단)
   * @param {string[]} lines        - 줄 단위 텍스트 배열 (첫 줄은 title 스타일)
   * @param {number}   duration     - 자동 닫힘 ms (기본 2800)
   */
  show(anchorEl, lines, duration = 2800) {
    if (!this._el) return;

    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }

    this._el.innerHTML = lines
      .map((line, i) => `<div class="tooltip-line${i === 0 ? ' tooltip-title' : ''}">${line}</div>`)
      .join('');

    this._el.classList.remove('visible');
    // reflow 유발해서 fade-in 재실행
    void this._el.offsetWidth;

    this._position(anchorEl);
    this._el.classList.add('visible');

    this._timer = setTimeout(() => this.hide(), duration);
  }

  /** 즉시 숨김 */
  hide() {
    if (!this._el) return;
    this._el.classList.remove('visible');
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  _position(anchorEl) {
    const el = this._el;
    const PAD = 8;
    const TIP_W = 220;

    if (!anchorEl) {
      el.style.top = '80px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      return;
    }

    el.style.transform = 'none';

    const rect = anchorEl.getBoundingClientRect();
    const winH = window.innerHeight;
    const winW = window.innerWidth;

    // 좌우: 앵커 중앙 정렬, 화면 경계 보정
    let left = rect.left + rect.width / 2 - TIP_W / 2;
    if (left < PAD) left = PAD;
    if (left + TIP_W > winW - PAD) left = winW - TIP_W - PAD;

    // 아래 배치 우선, 공간 없으면 위
    const ARROW_H = 8;
    const estimatedH = 100;
    let top = rect.bottom + ARROW_H;
    if (top + estimatedH > winH - PAD) {
      top = rect.top - estimatedH - ARROW_H;
    }

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }
}
