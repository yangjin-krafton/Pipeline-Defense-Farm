import { Bullet } from '../core/Bullet.js';

/**
 * BulletSystem
 * Handles bullet creation, updates, collision processing, and combat SFX triggers.
 */
export class BulletSystem {
  constructor() {
    this.bullets = [];
    this.particleSystem = null;
    this.uiSfxSystem = null;

    // Local clock + throttle windows for dense firefights.
    this.elapsedTime = 0;
    this.lastShotSfxTime = -999;
    this.lastHitSfxTime = -999;
    this.lastCritSfxTime = -999;
  }

  setParticleSystem(particleSystem) {
    this.particleSystem = particleSystem;
  }

  setUISfxSystem(uiSfxSystem) {
    this.uiSfxSystem = uiSfxSystem || null;
  }

  addBullet(bullet) {
    this.bullets.push(bullet);
  }

  createBullet(x, y, target, damage, color, speed = 300, size = 5, homing = true, pierceOptions = null) {
    const bullet = new Bullet(x, y, target, damage, color, speed, size, homing, pierceOptions);
    this.addBullet(bullet);

    if (this.uiSfxSystem && this.elapsedTime - this.lastShotSfxTime >= 0.04) {
      this.uiSfxSystem.play('shot', { volume: 0.38 });
      this.lastShotSfxTime = this.elapsedTime;
    }

    return bullet;
  }

  update(dt, multiPathSystem, foodList = null) {
    this.elapsedTime += dt;

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      // 파티클 시스템을 전달하여 트레일 효과 활성화
      const hit = bullet.update(dt, multiPathSystem, this.particleSystem);

      if (hit) {
        const hpBeforeHit = bullet.target?.hp ?? 0;
        const lethalHit = hpBeforeHit > 0 && (hpBeforeHit - bullet.damage <= 0);
        const heavyHit = bullet.damage >= Math.max(18, hpBeforeHit * 0.34);

        bullet.applyDamage(bullet.target, this.particleSystem);

        if (this.uiSfxSystem && this.elapsedTime - this.lastHitSfxTime >= 0.025) {
          this.uiSfxSystem.play('hit', { volume: 0.42 });
          this.lastHitSfxTime = this.elapsedTime;
        }

        if (this.uiSfxSystem && (heavyHit || lethalHit) && this.elapsedTime - this.lastCritSfxTime >= 0.09) {
          this.uiSfxSystem.play('crit', { volume: 0.46 });
          this.lastCritSfxTime = this.elapsedTime;
        }

        // 관통 처리: 남은 횟수가 있으면 다음 타겟으로 계속 진행
        let pierced = false;
        if (bullet.pierceCount > 0 && foodList) {
          const hitTarget = bullet.target;

          // 적중/처치 트리거 발동 (노드12 스택 적립 등)
          if (bullet.tower) {
            bullet.tower.firePierceHit(hitTarget, bullet.damage);
          }

          bullet.hitTargets.add(hitTarget);
          bullet.pierceCount--;
          bullet.pierceIndex++;
          bullet.damage = bullet.baseDamage * Math.pow(1 - bullet.pierceDamageFalloff, bullet.pierceIndex);

          const nextTarget = this._findPierceTarget(bullet, foodList, multiPathSystem);
          if (nextTarget) {
            // 곡선 구간 관통 손실: 이전 진행 방향과 다음 타겟 방향의 차이에 비례
            if (bullet.curveCompensation < 1.0 && (bullet.lastDirX !== 0 || bullet.lastDirY !== 0)) {
              const nextPos = multiPathSystem.samplePath(nextTarget.currentPath, nextTarget.d);
              if (nextPos) {
                const ndx = nextPos.x - bullet.x;
                const ndy = nextPos.y - bullet.y;
                const ndist = Math.sqrt(ndx * ndx + ndy * ndy);
                if (ndist > 0) {
                  const dot = (ndx / ndist) * bullet.lastDirX + (ndy / ndist) * bullet.lastDirY;
                  // dot: 1=직선, -1=역방향. 방향 변화량을 [0,1] 스케일로 변환
                  const curveFactor = (1 - Math.max(-1, Math.min(1, dot))) / 2;
                  const effectivePenalty = curveFactor * (1 - bullet.curveCompensation);
                  bullet.damage *= (1 - effectivePenalty);
                }
              }
            }

            bullet.target = nextTarget;
            bullet.alive = true;
            pierced = true;
          }
        }

        if (!pierced) {
          this.bullets.splice(i, 1);
        }
      } else if (!bullet.alive) {
        this.bullets.splice(i, 1);
      }
    }
  }

  /**
   * 관통 탄의 다음 타겟을 찾습니다.
   * 이미 맞은 타겟을 제외하고 탄 현재 위치에서 가장 가까운 생존 적을 반환합니다.
   */
  _findPierceTarget(bullet, foodList, multiPathSystem) {
    let bestTarget = null;
    let bestDist = Infinity;
    const maxRange = 300 * (1 + (bullet.pierceDistanceBonus || 0));

    for (const food of foodList) {
      if (food.hp <= 0) continue;
      if (bullet.hitTargets.has(food)) continue;

      const pos = multiPathSystem.samplePath(food.currentPath, food.d);
      if (!pos) continue;

      const dx = pos.x - bullet.x;
      const dy = pos.y - bullet.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < maxRange && dist < bestDist) {
        bestDist = dist;
        bestTarget = food;
      }
    }
    return bestTarget;
  }

  getBullets() {
    return this.bullets;
  }

  clear() {
    this.bullets = [];
  }

  getCount() {
    return this.bullets.length;
  }
}
