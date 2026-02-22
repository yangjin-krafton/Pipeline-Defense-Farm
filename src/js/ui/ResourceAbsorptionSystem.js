/**
 * ResourceAbsorptionSystem.js
 * 재화 획득 시 토큰이 UI 바로 흡수되는 범용 연출 모듈
 *
 * 사용법:
 *   const system = new ResourceAbsorptionSystem();
 *   system.init(gameScreen, pathCanvas, scaleManager);
 *
 *   // 적 사망 시 (WebGL2 가상 좌표)
 *   system.emitFromGamePos(virtualX, virtualY, 'nc', amount);
 *
 *   // 보상 버튼 클릭 시 (HTML 요소)
 *   system.emitFromElement(buttonElement, 'sc', amount);
 *
 * 연출 흐름:
 *   1. Burst  : 토큰들이 발생 위치에서 사방으로 폭발 (ease-out)
 *   2. Waiting: 순번 지연(stagger) 동안 가볍게 흔들림 대기
 *   3. Absorb : 곡선(베지어) 경로로 UI 바를 향해 가속 흡수
 */

const VIRTUAL_W = 360;
const VIRTUAL_H = 640;

const BURST_DUR       = 0.38;   // 폭발 지속 (초)
const WAIT_STAGGER    = 0.09;   // 토큰별 흡수 시작 시차 (초)
const ABSORB_DUR      = 0.52;   // 흡수 이동 지속 (초)
const MAX_TOKENS      = 10;     // 한 그룹 최대 토큰 수

export class ResourceAbsorptionSystem {
  constructor() {
    this.canvas        = null;
    this.ctx           = null;
    this.groups        = [];      // { tokens: Token[] }[]
    this._gameScreen   = null;
    this._pathCanvas   = null;
    this._scaleManager = null;
    this._ncTarget     = null;    // .nc-resource 요소
    this._scTarget     = null;    // .sc-resource 요소
    this.animationId   = null;
    this.lastTime      = 0;

    /** 토큰 하나가 타겟에 도달할 때마다 호출: (resourceType: 'nc'|'sc') => void */
    this.onTokenAbsorbed = null;
  }

  // ─── 초기화 ──────────────────────────────────────────────────────────────

  /**
   * @param {HTMLElement}       gameScreen   - #game-screen 요소
   * @param {HTMLCanvasElement} pathCanvas   - WebGL2 캔버스 (#pathCanvas)
   * @param {ScaleManager}      scaleManager - ScaleManager 인스턴스
   */
  init(gameScreen, pathCanvas, scaleManager) {
    this._gameScreen   = gameScreen;
    this._pathCanvas   = pathCanvas;
    this._scaleManager = scaleManager;

    // 타겟 UI 요소 캐시
    this._ncTarget = document.querySelector('.nc-resource');
    this._scTarget = document.querySelector('.sc-resource');

    // 오버레이 캔버스 생성 (#game-screen 내부, 게임+UI 위에 표시)
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      'width:100%',
      'height:100%',
      'pointer-events:none',
      'z-index:500',
    ].join(';');
    gameScreen.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this._resizeCanvas();

    window.addEventListener('resize', () => this._resizeCanvas());

    this._loop = this._loop.bind(this);
    this.animationId = requestAnimationFrame(this._loop);
    console.log('[ResourceAbsorptionSystem] Initialized');
  }

  _resizeCanvas() {
    if (!this.canvas || !this._gameScreen) return;
    // offsetWidth/Height 는 CSS transform 미적용 레이아웃 크기 (= 640×1138 디자인 크기)
    this.canvas.width  = this._gameScreen.offsetWidth;
    this.canvas.height = this._gameScreen.offsetHeight;
  }

  _loop(currentTime) {
    const dt = this.lastTime
      ? Math.min((currentTime - this.lastTime) / 1000, 0.1)
      : 0;
    this.lastTime = currentTime;
    this._update(dt);
    this._render();
    this.animationId = requestAnimationFrame(this._loop);
  }

  // ─── 좌표 변환 ───────────────────────────────────────────────────────────

  /**
   * WebGL2 가상 좌표(0-360 × 0-640) → 오버레이 디자인 좌표
   */
  virtualToDesign(vx, vy) {
    const gsRect = this._gameScreen.getBoundingClientRect();
    const pcRect = this._pathCanvas.getBoundingClientRect();
    const scale  = this._scaleManager.getScale();

    // pathCanvas 가 game-screen 내에서 차지하는 디자인 영역
    const cdX = (pcRect.left - gsRect.left) / scale;
    const cdY = (pcRect.top  - gsRect.top)  / scale;
    const cdW = pcRect.width  / scale;
    const cdH = pcRect.height / scale;

    return {
      x: cdX + (vx / VIRTUAL_W) * cdW,
      y: cdY + (vy / VIRTUAL_H) * cdH,
    };
  }

  /**
   * HTML 요소 중심 → 오버레이 디자인 좌표
   */
  elementToDesign(element) {
    const gsRect = this._gameScreen.getBoundingClientRect();
    const elRect = element.getBoundingClientRect();
    const scale  = this._scaleManager.getScale();

    return {
      x: (elRect.left - gsRect.left + elRect.width  * 0.5) / scale,
      y: (elRect.top  - gsRect.top  + elRect.height * 0.5) / scale,
    };
  }

  // ─── 공개 API ────────────────────────────────────────────────────────────

  /**
   * 인게임 위치(WebGL2 가상 좌표)에서 토큰 발생 — 적 사망 등
   * @param {number}       vx           WebGL2 가상 X
   * @param {number}       vy           WebGL2 가상 Y
   * @param {'nc'|'sc'}    resourceType
   * @param {number}       amount       획득량 (토큰 수 계산에 사용)
   */
  emitFromGamePos(vx, vy, resourceType, amount) {
    if (!this.canvas) return;
    const pos = this.virtualToDesign(vx, vy);
    this._spawnGroup(pos.x, pos.y, resourceType, amount);
  }

  /**
   * HTML 요소 위치에서 토큰 발생 — 보상 버튼 클릭 등
   * @param {HTMLElement}  element
   * @param {'nc'|'sc'}    resourceType
   * @param {number}       amount
   */
  emitFromElement(element, resourceType, amount) {
    if (!this.canvas) return;
    const pos = this.elementToDesign(element);
    this._spawnGroup(pos.x, pos.y, resourceType, amount);
  }

  // ─── 내부: 그룹 생성 ─────────────────────────────────────────────────────

  _spawnGroup(srcX, srcY, resourceType, amount) {
    const count  = this._calcTokenCount(amount);
    const target = this._getTargetPos(resourceType);
    const tokens = [];

    for (let i = 0; i < count; i++) {
      // 균등 각도 분배 + 미세 랜덤 지터
      const baseAngle = (Math.PI * 2 * i) / count;
      const jitter    = (Math.random() - 0.5) * (Math.PI / Math.max(count, 1));
      const angle     = baseAngle + jitter;

      // 폭발 도달 위치 (srcX/Y 기준 반경 burstR)
      const burstR    = 28 + Math.random() * 32;
      const burstEndX = srcX + Math.cos(angle) * burstR;
      const burstEndY = srcY + Math.sin(angle) * burstR;

      // 흡수 베지어 제어점 (burstEnd → target 경로에 수직 곡선)
      const dx  = target.x - burstEndX;
      const dy  = target.y - burstEndY;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      // 수직 방향
      const perpX    = -dy / len;
      const perpY    =  dx / len;
      // 짝홀 인덱스로 좌우 교번
      const arcDir   = i % 2 === 0 ? 1 : -1;
      const arcAmt   = 35 + Math.random() * 30;
      const cpX = burstEndX + dx * 0.38 + perpX * arcDir * arcAmt;
      const cpY = burstEndY + dy * 0.38 + perpY * arcDir * arcAmt;

      tokens.push({
        resourceType,
        // 발생 위치 (burst 기준)
        srcX, srcY,
        x: srcX, y: srcY,
        // 폭발 목적지
        burstEndX, burstEndY,
        // 흡수 베지어 제어점·목적지
        cpX, cpY,
        targetX: target.x, targetY: target.y,
        // 흡수 시작 위치 (waiting 끝나는 순간 기록)
        absorbStartX: burstEndX,
        absorbStartY: burstEndY,
        // 상태
        phase: 'burst',    // 'burst' | 'waiting' | 'absorb' | 'done'
        timer: 0,
        // 이 토큰의 waiting 지속: 첫 토큰은 짧게, 이후 순번마다 stagger
        waitDur: 0.10 + i * WAIT_STAGGER,
        // 시각
        size:     13 + Math.random() * 4,
        alpha:    1,
        scaleVal: 1,
      });
    }

    this.groups.push({ tokens });
  }

  /** 획득량 → 토큰 수 (로그 스케일, 1~MAX_TOKENS) */
  _calcTokenCount(amount) {
    if (amount <= 0) return 1;
    return Math.min(Math.max(1, Math.ceil(Math.log2(amount + 1))), MAX_TOKENS);
  }

  /** 재화 타입에 맞는 UI 타겟 위치 반환 */
  _getTargetPos(resourceType) {
    const el = resourceType === 'nc' ? this._ncTarget : this._scTarget;
    if (!el) {
      return { x: (this.canvas?.width ?? 640) * 0.5, y: 30 };
    }
    return this.elementToDesign(el);
  }

  // ─── 내부: 업데이트 ──────────────────────────────────────────────────────

  _update(dt) {
    for (let g = this.groups.length - 1; g >= 0; g--) {
      const { tokens } = this.groups[g];
      let allDone = true;

      for (const token of tokens) {
        if (token.phase === 'done') continue;
        allDone = false;
        token.timer += dt;

        if      (token.phase === 'burst')   this._updateBurst(token);
        else if (token.phase === 'waiting') this._updateWaiting(token);
        else if (token.phase === 'absorb')  this._updateAbsorb(token);
      }

      if (allDone) this.groups.splice(g, 1);
    }
  }

  /** Phase 1: 사방으로 폭발 (ease-out) */
  _updateBurst(token) {
    const t = Math.min(token.timer / BURST_DUR, 1);
    // ease-out quad
    const e = 1 - (1 - t) * (1 - t);

    token.x        = token.srcX + (token.burstEndX - token.srcX) * e;
    token.y        = token.srcY + (token.burstEndY - token.srcY) * e;
    // 살짝 부풀었다가 원래 크기로 복귀
    token.scaleVal = 1 + Math.sin(t * Math.PI) * 0.35;
    token.alpha    = 1;

    if (t >= 1) {
      token.phase = 'waiting';
      token.timer = 0;
    }
  }

  /** Phase 2: stagger 대기 — 가벼운 상하 흔들림 */
  _updateWaiting(token) {
    token.x        = token.burstEndX;
    token.y        = token.burstEndY + Math.sin(token.timer * 9) * 2.5;
    token.scaleVal = 1;
    token.alpha    = 1;

    if (token.timer >= token.waitDur) {
      // 흡수 시작 위치를 현재 위치로 고정
      token.absorbStartX = token.x;
      token.absorbStartY = token.y;
      token.phase = 'absorb';
      token.timer = 0;
    }
  }

  /** Phase 3: 베지어 곡선으로 가속 흡수 (ease-in cubic) */
  _updateAbsorb(token) {
    const t = Math.min(token.timer / ABSORB_DUR, 1);
    // ease-in cubic — 타겟에 가까워질수록 가속
    const e = t * t * t;
    const u = 1 - e;

    // 2차 베지어: absorbStart → cp → target
    token.x = u * u * token.absorbStartX
            + 2 * u * e * token.cpX
            + e * e * token.targetX;
    token.y = u * u * token.absorbStartY
            + 2 * u * e * token.cpY
            + e * e * token.targetY;

    // 타겟 접근할수록 축소
    token.scaleVal = 1 - e * 0.55;
    // 마지막 15% 구간에서 페이드아웃
    token.alpha = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;

    if (t >= 1) {
      token.phase = 'done';
      if (this.onTokenAbsorbed) this.onTokenAbsorbed(token.resourceType);
    }
  }

  // ─── 내부: 렌더링 ────────────────────────────────────────────────────────

  _render() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const { tokens } of this.groups) {
      for (const token of tokens) {
        if (token.phase === 'done') continue;
        this._drawToken(token);
      }
    }
  }

  _drawToken(token) {
    const { ctx } = this;
    const emoji   = token.resourceType === 'nc' ? '🍎' : '⚡';
    const size    = token.size;

    ctx.save();
    ctx.globalAlpha = token.alpha;
    ctx.translate(token.x, token.y);
    ctx.scale(token.scaleVal, token.scaleVal);

    // 드롭 섀도로 가시성 강화
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur  = 5;
    ctx.font        = `${size}px serif`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 0, 0);

    ctx.restore();
  }

  // ─── 정리 ────────────────────────────────────────────────────────────────

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.canvas?.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx    = null;
    this.groups = [];
    console.log('[ResourceAbsorptionSystem] Destroyed');
  }
}
