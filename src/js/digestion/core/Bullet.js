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
  constructor(x, y, target, damage, color, speed = 300, size = 5, homing = true, pierceOptions = null) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.color = color;
    this.speed = speed;
    this.size = size;
    this.homing = homing;
    this.alive = true;
    this.renderStyle = { stretch: 1.0, thickness: 1.0, glow: 0.3 };
    this.customHitEffect = null;
    this.arcUseDistanceProgress = false;
    this.arcProgress = 0;
    this.arcOriginX = x;
    this.arcOriginY = y;
    this.arcInitialTargetDistance = null;

    // 관통 데이터
    this.baseDamage = damage;
    this.pierceCount = pierceOptions?.pierceCount || 0;
    this.pierceDamageFalloff = pierceOptions?.pierceDamageFalloff ?? 0.15;
    this.pierceDistanceBonus = pierceOptions?.pierceDistanceBonus || 0;
    this.curveCompensation = pierceOptions?.curveCompensation || 0;
    this.pierceIndex = 0;
    this.hitTargets = new Set();

    // 발사 타워 레퍼런스 (관통 체인 트리거 발동용, BaseTower.attack에서 주입)
    this.tower = null;

    // 마지막 이동 방향 (곡선 구간 관통 손실 계산용)
    this.lastDirX = 0;
    this.lastDirY = 0;

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

    // 트레일 효과 (큰 총알만 활성화)
    this.hasTrail = size >= 8; // 크기 8 이상일 때 트레일 활성
    this.trailTimer = 0;
    this.trailInterval = 0.03; // 30ms마다 트레일 생성
  }

  /**
   * 총알을 업데이트합니다.
   * @param {number} dt - Delta time (초)
   * @param {Object} multiPathSystem - 경로 시스템 (타겟 위치 가져오기)
   * @param {Object} particleSystem - 파티클 시스템 (트레일 효과용, 옵션)
   * @returns {boolean} - 충돌 여부
   */
  update(dt, multiPathSystem, particleSystem = null) {
    this.lifetime += dt;
    this.trailTimer += dt;

    // 수명 초과 시 소멸
    if (this.lifetime > this.maxLifetime) {
      this.alive = false;
      return false;
    }

    // ── lockedTargetPos 모드 (캐논 탄) ──────────────────────────────────
    // 발사 순간 고정된 경로 위치를 향해 직진.
    // 적이 도중에 사망/이동해도 탄이 유지되며, arcFlightDuration 만료 시 강제 착탄.
    if (this.lockedTargetPos) {
      if (!this.target) {
        this.alive = false;
        return false;
      }

      // forceImpactOnLanding: 포물선 비행 시간 만료 → 강제 착탄
      if (this.forceImpactOnLanding &&
          Number.isFinite(this.arcFlightDuration) && this.arcFlightDuration > 0 &&
          this.lifetime >= this.arcFlightDuration) {
        this.alive = false;
        return this.target.hp > 0; // 대상이 살아있으면 적중 처리
      }

      const ldx = this.lockedTargetPos.x - this.x;
      const ldy = this.lockedTargetPos.y - this.y;
      const ldist = Math.sqrt(ldx * ldx + ldy * ldy);
      if (ldist > 0.5) {
        this.lastDirX = ldx / ldist;
        this.lastDirY = ldy / ldist;
        this.x += (ldx / ldist) * this.speed * dt;
        this.y += (ldy / ldist) * this.speed * dt;
        this.rotation = Math.atan2(ldy, ldx);
      }

      if (this.hasTrail && particleSystem && this.trailTimer >= this.trailInterval) {
        this.emitTrail(particleSystem);
        this.trailTimer = 0;
      }
      return false;
    }
    // ─────────────────────────────────────────────────────────────────────

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

    // 충돌 방향 추적 (관통 체인에서 곡선 손실 계산용)
    if (dist > 0) {
      this.lastDirX = dx / dist;
      this.lastDirY = dy / dist;
    }

    if (this.arcUseDistanceProgress) {
      if (!Number.isFinite(this.arcInitialTargetDistance) || this.arcInitialTargetDistance <= 0) {
        this.arcInitialTargetDistance = Math.max(1, dist);
      }
    }

    // 충돌 판정 (타겟 크기 + 총알 크기)
    const collisionDist = (this.target.size || 24) / 2 + this.size;
    if (dist < collisionDist) {
      if (this.arcUseDistanceProgress) {
        this.arcProgress = 1;
      }
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

    if (this.arcUseDistanceProgress && Number.isFinite(this.arcInitialTargetDistance) && this.arcInitialTargetDistance > 0) {
      const traveled = Math.hypot(this.x - this.arcOriginX, this.y - this.arcOriginY);
      this.arcProgress = Math.max(0, Math.min(1, traveled / this.arcInitialTargetDistance));
    }

    // 트레일 효과 생성 (큰 총알만)
    if (this.hasTrail && particleSystem && this.trailTimer >= this.trailInterval) {
      this.emitTrail(particleSystem);
      this.trailTimer = 0;
    }

    return false;
  }

  /**
   * 트레일 효과를 생성합니다.
   * @param {Object} particleSystem - 파티클 시스템
   */
  emitTrail(particleSystem) {
    if (!particleSystem || !particleSystem.emit) return;

    // 트레일 색상 (약간 어둡고 투명하게)
    const trailColor = [
      this.color[0] * 0.8,
      this.color[1] * 0.8,
      this.color[2] * 0.8,
      this.color[3] * 0.5
    ];

    const trailCount = Math.floor(this.size / 3); // 크기에 비례

    particleSystem.emit(
      this.x,
      this.y,
      trailCount,
      trailColor,
      30, // 낮은 속도
      0.25, // 짧은 수명
      {
        spread: Math.PI / 6, // 좁은 확산
        gravity: 0, // 중력 없음
        sizeMin: this.size * 0.4,
        sizeMax: this.size * 0.6,
        colorVariation: 0.1
      }
    );
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
    if (typeof this.customHitEffect === 'function') {
      this.customHitEffect(particleSystem, target);
      return;
    }

    if (particleSystem && particleSystem.emitHitEffect) {
      particleSystem.emitHitEffect(this.x, this.y, this.color, this.damage);
    }
  }
}
