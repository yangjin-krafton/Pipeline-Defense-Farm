/**
 * Bullet - 타워가 발사하는 총알
 *
 * 총알은 타겟을 추적하거나 직진하며, 충돌 시 데미지를 적용합니다.
 */
export class Bullet {
  /**
   * @param {number} x - 시작 X 좌표
   * @param {number} y - 시작 Y 좌표
   * @param {Object} target - 타겟 음식 객체
   * @param {number} damage - 데미지
   * @param {number[]} color - RGBA 색상 [r, g, b, a]
   * @param {number} speed - 이동 속도 (픽셀/초)
   * @param {number} size - 총알 크기
   * @param {boolean} homing - 추적 여부
   */
  constructor(x, y, target, damage, color, speed = 300, size = 5, homing = true) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.color = color;
    this.speed = speed;
    this.size = size;
    this.homing = homing;
    this.alive = true;

    // 직진 모드일 경우 초기 방향 저장
    if (!homing && target) {
      const dx = target.x - x;
      const dy = target.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      this.dirX = dx / dist;
      this.dirY = dy / dist;
    } else {
      this.dirX = 0;
      this.dirY = 0;
    }

    // 시각 효과
    this.rotation = 0;
    this.lifetime = 0;
    this.maxLifetime = 5.0; // 5초 후 자동 소멸
  }

  /**
   * 총알을 업데이트합니다.
   * @param {number} dt - Delta time (초)
   * @param {Object} multiPathSystem - 경로 시스템 (타겟 위치 가져오기)
   * @returns {boolean} - 충돌 여부
   */
  update(dt, multiPathSystem) {
    this.lifetime += dt;

    // 수명 초과 시 소멸
    if (this.lifetime > this.maxLifetime) {
      this.alive = false;
      return false;
    }

    // 타겟이 사망했거나 없으면 소멸
    if (!this.target || this.target.hp <= 0) {
      this.alive = false;
      return false;
    }

    // 타겟 위치 가져오기
    const targetPos = multiPathSystem.samplePath(this.target.currentPath, this.target.d);
    if (!targetPos) {
      this.alive = false;
      return false;
    }

    // 타겟까지의 거리 계산
    const dx = targetPos.x - this.x;
    const dy = targetPos.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 충돌 판정 (타겟 크기 + 총알 크기)
    const collisionDist = (this.target.size || 24) / 2 + this.size;
    if (dist < collisionDist) {
      this.alive = false;
      return true; // 충돌!
    }

    // 이동
    if (this.homing) {
      // 추적 모드: 항상 타겟을 향함
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
      this.rotation = Math.atan2(dy, dx);
    } else {
      // 직진 모드: 초기 방향으로 계속 이동
      this.x += this.dirX * this.speed * dt;
      this.y += this.dirY * this.speed * dt;
      this.rotation = Math.atan2(this.dirY, this.dirX);

      // 너무 멀어지면 소멸
      if (dist > 500) {
        this.alive = false;
      }
    }

    return false;
  }

  /**
   * 데미지를 적용합니다.
   * @param {Object} target - 타겟 음식
   * @param {Object} particleSystem - 파티클 시스템 (피격 효과)
   */
  applyDamage(target, particleSystem) {
    if (!target || target.hp <= 0) return;

    target.hp -= this.damage;

    // 피격 파티클 효과 생성 (있으면)
    if (particleSystem && particleSystem.emitHitEffect) {
      particleSystem.emitHitEffect(this.x, this.y, this.color, this.damage);
    }
  }
}
