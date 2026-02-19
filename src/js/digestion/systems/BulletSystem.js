import { Bullet } from '../core/Bullet.js';

/**
 * BulletSystem - 총알 관리 시스템
 *
 * 모든 총알의 생성, 업데이트, 충돌 처리를 담당합니다.
 */
export class BulletSystem {
  constructor() {
    this.bullets = [];
    this.particleSystem = null; // 나중에 ParticleSystem 연결
  }

  /**
   * ParticleSystem을 연결합니다.
   * @param {Object} particleSystem
   */
  setParticleSystem(particleSystem) {
    this.particleSystem = particleSystem;
  }

  /**
   * 총알을 추가합니다.
   * @param {Bullet} bullet
   */
  addBullet(bullet) {
    this.bullets.push(bullet);
  }

  /**
   * 총알을 생성하고 추가합니다.
   * @param {number} x - 시작 X
   * @param {number} y - 시작 Y
   * @param {Object} target - 타겟 음식
   * @param {number} damage - 데미지
   * @param {number[]} color - RGBA 색상
   * @param {number} speed - 속도
   * @param {number} size - 크기
   * @param {boolean} homing - 추적 여부
   * @returns {Bullet}
   */
  createBullet(x, y, target, damage, color, speed = 300, size = 5, homing = true) {
    const bullet = new Bullet(x, y, target, damage, color, speed, size, homing);
    this.addBullet(bullet);
    return bullet;
  }

  /**
   * 모든 총알을 업데이트합니다.
   * @param {number} dt - Delta time
   * @param {Object} multiPathSystem - 경로 시스템
   */
  update(dt, multiPathSystem) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];

      // 총알 업데이트 (충돌 여부 반환)
      const hit = bullet.update(dt, multiPathSystem);

      if (hit) {
        // 충돌 시 데미지 적용
        bullet.applyDamage(bullet.target, this.particleSystem);
        this.bullets.splice(i, 1);
      } else if (!bullet.alive) {
        // 사망 시 제거
        this.bullets.splice(i, 1);
      }
    }
  }

  /**
   * 모든 총알을 가져옵니다.
   * @returns {Bullet[]}
   */
  getBullets() {
    return this.bullets;
  }

  /**
   * 모든 총알을 제거합니다.
   */
  clear() {
    this.bullets = [];
  }

  /**
   * 총알 개수를 반환합니다.
   * @returns {number}
   */
  getCount() {
    return this.bullets.length;
  }
}
