/**
 * StatusEffectRenderer - 음식의 상태 이상을 시각적으로 표시
 *
 * HP 바 위에 작은 아이콘으로 상태 이상을 표시합니다.
 */
export class StatusEffectRenderer {
  /**
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D 컨텍스트
   */
  constructor(ctx) {
    this.ctx = ctx;

    // 상태 이상 아이콘 설정
    this.statusIcons = {
      expose: { emoji: '🎯', color: '#FF8C00', label: '취약' },
      corrode: { emoji: '🧪', color: '#32CD32', label: '부식' },
      shock: { emoji: '⚡', color: '#FFD700', label: '감전' },
      mark: { emoji: '🔴', color: '#FF4500', label: '표식' },
      clustered: { emoji: '👥', color: '#9370DB', label: '군집' },
      stun: { emoji: '😵', color: '#808080', label: '기절' },
      slow: { emoji: '🐌', color: '#4682B4', label: '둔화' }
    };

    // 아이콘 크기
    this.iconSize = 8;
    this.iconSpacing = 10;
    this.yOffsetFromBar = 8; // HP 바 위로 얼마나 띄울지
  }

  /**
   * 상태 이상을 렌더링합니다.
   * @param {Object[]} foods - 음식 배열
   * @param {Object} multiPathSystem - 경로 시스템
   * @param {number} currentTime - 현재 시간 (밀리초)
   */
  render(foods, multiPathSystem, currentTime) {
    if (!foods || foods.length === 0) return;

    const ctx = this.ctx;
    ctx.save();

    for (const food of foods) {
      if (!food.statusEffects || food.statusEffects.length === 0) continue;

      const pos = multiPathSystem.samplePath(food.currentPath, food.d);
      if (!pos) continue;

      // HP 바 위치 계산 (HPBarRenderer와 동일한 위치)
      const hpBarY = pos.y - 15;
      const statusY = hpBarY - this.yOffsetFromBar;

      // 활성 상태 이상 필터링 (만료되지 않은 것만)
      const activeEffects = this._getActiveEffects(food.statusEffects, currentTime);

      if (activeEffects.length === 0) continue;

      // 상태 이상 중복 제거 (같은 타입은 하나만 표시)
      const uniqueEffects = this._getUniqueEffects(activeEffects);

      // 상태 이상 아이콘 렌더링
      this._renderStatusIcons(pos.x, statusY, uniqueEffects);
    }

    ctx.restore();
  }

  /**
   * 활성 상태 이상 필터링 (만료되지 않은 것만)
   * @private
   */
  _getActiveEffects(statusEffects, currentTime) {
    return statusEffects.filter(effect => {
      if (!effect.appliedTime || !effect.duration) return false;
      const elapsed = (currentTime - effect.appliedTime) / 1000; // 초 단위
      return elapsed < effect.duration;
    });
  }

  /**
   * 중복 제거 (같은 타입은 하나만)
   * @private
   */
  _getUniqueEffects(effects) {
    const uniqueMap = new Map();
    for (const effect of effects) {
      if (!uniqueMap.has(effect.type)) {
        uniqueMap.set(effect.type, effect);
      }
    }
    return Array.from(uniqueMap.values());
  }

  /**
   * 상태 이상 아이콘 렌더링
   * @private
   */
  _renderStatusIcons(x, y, effects) {
    const ctx = this.ctx;
    const totalWidth = effects.length * this.iconSpacing;
    let startX = x - totalWidth / 2;

    for (const effect of effects) {
      const iconConfig = this.statusIcons[effect.type];
      if (!iconConfig) continue;

      // 작은 원형 아이콘 그리기
      ctx.beginPath();
      ctx.arc(startX, y, this.iconSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = iconConfig.color;
      ctx.fill();

      // 테두리
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 이모지 표시 (작게)
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFF';
      ctx.fillText(iconConfig.emoji, startX, y);

      startX += this.iconSpacing;
    }
  }

  /**
   * 상태 이상 툴팁 렌더링 (호버 시)
   * @param {number} x - 마우스 X 좌표
   * @param {number} y - 마우스 Y 좌표
   * @param {Object[]} effects - 상태 이상 배열
   */
  renderTooltip(x, y, effects) {
    if (!effects || effects.length === 0) return;

    const ctx = this.ctx;
    ctx.save();

    // 툴팁 배경
    const padding = 8;
    const lineHeight = 16;
    const tooltipHeight = effects.length * lineHeight + padding * 2;
    const tooltipWidth = 120;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(x, y, tooltipWidth, tooltipHeight);

    // 테두리
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, tooltipWidth, tooltipHeight);

    // 상태 이상 텍스트
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let textY = y + padding;
    for (const effect of effects) {
      const iconConfig = this.statusIcons[effect.type];
      if (!iconConfig) continue;

      // 아이콘 색상 점
      ctx.fillStyle = iconConfig.color;
      ctx.fillRect(x + padding, textY + 4, 8, 8);

      // 상태 이름
      ctx.fillStyle = '#FFF';
      ctx.fillText(`${iconConfig.label}`, x + padding + 12, textY);

      textY += lineHeight;
    }

    ctx.restore();
  }
}
