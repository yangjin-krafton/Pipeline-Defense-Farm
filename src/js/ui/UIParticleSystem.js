/**
 * UIParticleSystem.js
 * HTML UI 위에 오버레이되는 Canvas 기반 파티클 시스템
 */
export class UIParticleSystem {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.maxParticles = 500;
    this.animationId = null;
    this.lastTime = 0;
  }

  /**
   * 파티클 시스템 초기화
   * @param {HTMLElement} container - 파티클 Canvas를 추가할 컨테이너
   */
  init(container) {
    if (this.canvas) {
      // 이미 초기화되어 있으면 기존 Canvas 재사용
      return;
    }

    // Canvas 생성
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none'; // 클릭 이벤트 통과
    this.canvas.style.zIndex = '9999';

    // 컨테이너에 추가
    container.appendChild(this.canvas);

    // Context 가져오기
    this.ctx = this.canvas.getContext('2d');

    // Canvas 크기 설정
    this._resizeCanvas();

    // 렌더 루프 시작
    this.startRenderLoop();

    console.log('[UIParticleSystem] Initialized');
  }

  /**
   * Canvas 크기 조정
   */
  _resizeCanvas() {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  /**
   * 반짝임 파티클 발생 (Sparkles)
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {string} color - CSS 색상
   * @param {number} count - 파티클 수
   */
  emitSparkles(x, y, color, count = 20) {
    const colorRGB = this._parseColor(color);

    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100; // 50~150 픽셀/초

      this.particles.push({
        type: 'sparkle',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        color: colorRGB,
        alpha: 1.0,
        life: 0.5 + Math.random() * 0.3, // 0.5~0.8초
        maxLife: 0.8
      });
    }
  }

  /**
   * 컨페티 파티클 발생 (Confetti)
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {number} count - 파티클 수
   */
  emitConfetti(x, y, count = 100) {
    const colors = [
      [255, 107, 157], // 분홍
      [255, 215, 0],   // 금색
      [0, 217, 255],   // 하늘색
      [76, 175, 80],   // 녹색
      [255, 152, 0]    // 주황
    ];

    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      const color = colors[Math.floor(Math.random() * colors.length)];

      this.particles.push({
        type: 'confetti',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100, // 위로 튀어오름
        width: 5 + Math.random() * 5,
        height: 10 + Math.random() * 10,
        color,
        alpha: 1.0,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 300, // 중력
        life: 2.0 + Math.random() * 1.0,
        maxLife: 3.0
      });
    }
  }

  /**
   * 빛나는 글로우 효과 (Glow)
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {number} radius - 반지름
   * @param {string} color - CSS 색상
   */
  emitGlow(x, y, radius, color) {
    const colorRGB = this._parseColor(color);

    this.particles.push({
      type: 'glow',
      x,
      y,
      radius: 0,
      maxRadius: radius,
      color: colorRGB,
      alpha: 1.0,
      life: 1.0,
      maxLife: 1.0
    });
  }

  /**
   * 폭발 효과 (Burst)
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {string} color - CSS 색상
   * @param {number} count - 파티클 수
   */
  emitBurst(x, y, color, count = 30) {
    const colorRGB = this._parseColor(color);

    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 150 + Math.random() * 100;

      this.particles.push({
        type: 'burst',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        color: colorRGB,
        alpha: 1.0,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0
      });
    }
  }

  /**
   * 파티클 업데이트
   * @param {number} dt - Delta time (초)
   */
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // 위치 업데이트
      if (p.vx !== undefined) p.x += p.vx * dt;
      if (p.vy !== undefined) p.y += p.vy * dt;

      // 중력 적용
      if (p.gravity) p.vy += p.gravity * dt;

      // 회전 업데이트
      if (p.rotationSpeed) p.rotation += p.rotationSpeed * dt;

      // 글로우 확장
      if (p.type === 'glow' && p.radius < p.maxRadius) {
        p.radius += (p.maxRadius / p.maxLife) * dt;
      }

      // 생명 감소
      p.life -= dt;

      // 알파 계산 (페이드아웃)
      p.alpha = Math.max(0, p.life / p.maxLife);

      // 사망 파티클 제거
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * 파티클 렌더링
   */
  render() {
    if (!this.ctx) return;

    // Canvas 클리어
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 파티클 렌더링
    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;

      if (p.type === 'sparkle' || p.type === 'burst') {
        // 원형 파티클
        this.ctx.fillStyle = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${p.alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (p.type === 'confetti') {
        // 사각형 파티클 (회전)
        this.ctx.fillStyle = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${p.alpha})`;
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation);
        this.ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
      } else if (p.type === 'glow') {
        // 글로우 (그래디언트)
        const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        gradient.addColorStop(0, `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${p.alpha})`);
        gradient.addColorStop(1, `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, 0)`);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
      }

      this.ctx.restore();
    }
  }

  /**
   * 렌더 루프 시작
   */
  startRenderLoop() {
    const loop = (currentTime) => {
      const dt = this.lastTime ? (currentTime - this.lastTime) / 1000 : 0;
      this.lastTime = currentTime;

      this.update(dt);
      this.render();

      this.animationId = requestAnimationFrame(loop);
    };

    this.animationId = requestAnimationFrame(loop);
  }

  /**
   * 렌더 루프 중지
   */
  stopRenderLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 파티클 시스템 정리
   */
  destroy() {
    this.stopRenderLoop();

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.canvas = null;
    this.ctx = null;
    this.particles = [];

    console.log('[UIParticleSystem] Destroyed');
  }

  /**
   * CSS 색상을 RGB 배열로 변환
   * @param {string} color - CSS 색상 (#rrggbb 형식)
   * @returns {number[]} [r, g, b]
   */
  _parseColor(color) {
    // #rrggbb 형식 파싱
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      return [
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16)
      ];
    }

    // 기본값 (흰색)
    return [255, 255, 255];
  }
}
