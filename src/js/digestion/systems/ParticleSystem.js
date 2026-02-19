/**
 * ParticleSystem - 파티클 관리 시스템
 *
 * 파티클 생성, 물리 시뮬레이션, 생명 주기 관리를 담당합니다.
 */
export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 2000;
  }

  /**
   * 파티클을 생성합니다.
   * @param {number} x - 중심 X
   * @param {number} y - 중심 Y
   * @param {number} count - 파티클 개수
   * @param {number[]} color - 기본 색상 [r, g, b, a]
   * @param {number} speed - 초기 속도 (픽셀/초)
   * @param {number} lifetime - 생명 시간 (초)
   * @param {Object} options - 추가 옵션
   */
  emit(x, y, count, color, speed = 100, lifetime = 1.0, options = {}) {
    const {
      spread = Math.PI * 2,       // 방사 각도 범위
      gravity = 200,              // 중력 (픽셀/초^2)
      sizeMin = 2,                // 최소 크기
      sizeMax = 6,                // 최대 크기
      fadeOut = true,             // 페이드 아웃 여부
      colorVariation = 0.2        // 색상 변화량
    } = options;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const angle = Math.random() * spread - spread / 2;
      const particleSpeed = speed * (0.7 + Math.random() * 0.6);
      const size = sizeMin + Math.random() * (sizeMax - sizeMin);

      // 색상 변화
      const particleColor = [
        Math.max(0, Math.min(1, color[0] + (Math.random() - 0.5) * colorVariation)),
        Math.max(0, Math.min(1, color[1] + (Math.random() - 0.5) * colorVariation)),
        Math.max(0, Math.min(1, color[2] + (Math.random() - 0.5) * colorVariation)),
        color[3]
      ];

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * particleSpeed,
        vy: Math.sin(angle) * particleSpeed,
        size,
        color: particleColor,
        baseAlpha: color[3],
        life: lifetime,
        maxLife: lifetime,
        gravity,
        fadeOut
      });
    }
  }

  /**
   * 모든 파티클을 업데이트합니다.
   * @param {number} dt - Delta time (초)
   */
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // 위치 업데이트
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // 중력 적용
      p.vy += p.gravity * dt;

      // 생명 감소
      p.life -= dt;

      // 페이드 아웃
      if (p.fadeOut) {
        p.color[3] = p.baseAlpha * (p.life / p.maxLife);
      }

      // 사망 파티클 제거
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * 모든 파티클을 가져옵니다.
   * @returns {Object[]}
   */
  getParticles() {
    return this.particles;
  }

  /**
   * 모든 파티클을 제거합니다.
   */
  clear() {
    this.particles = [];
  }

  /**
   * 파티클 개수를 반환합니다.
   * @returns {number}
   */
  getCount() {
    return this.particles.length;
  }

  /**
   * 피격 효과를 생성합니다.
   * @param {number} x
   * @param {number} y
   * @param {number[]} color
   * @param {number} damage - 데미지 크기
   */
  emitHitEffect(x, y, color, damage) {
    const count = Math.min(Math.max(Math.floor(damage / 5), 3), 20);
    this.emit(x, y, count, color, 100, 0.6, {
      spread: Math.PI * 2,
      gravity: 300,
      sizeMin: 2,
      sizeMax: 5
    });
  }

  /**
   * 사망 효과를 생성합니다.
   * @param {number} x
   * @param {number} y
   * @param {number[]} color
   */
  emitDeathEffect(x, y, color) {
    this.emit(x, y, 30, color, 150, 1.2, {
      spread: Math.PI * 2,
      gravity: 250,
      sizeMin: 3,
      sizeMax: 8
    });
  }

  /**
   * 타워 공격 효과를 생성합니다 (총알 발사 시).
   * @param {number} x
   * @param {number} y
   * @param {number[]} color
   */
  emitTowerAttackEffect(x, y, color) {
    this.emit(x, y, 5, color, 50, 0.3, {
      spread: Math.PI / 2,
      gravity: 100,
      sizeMin: 2,
      sizeMax: 4
    });
  }
}
