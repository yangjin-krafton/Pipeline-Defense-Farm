import { VIRTUAL_W } from '../config.js';

/**
 * StatusEffectRenderer - Canvas overlay renderer for enemy HP bars and status emojis.
 * Draws after enemy emojis so overlays stay readable.
 */
export class StatusEffectRenderer {
  constructor(ctx) {
    this.ctx = ctx;

    this.statusIcons = {
      expose: { emoji: '\uD83C\uDFAF', color: '#FF8C00' },
      corrode: { emoji: '\uD83E\uDDEA', color: '#32CD32' },
      shock: { emoji: '\u26A1', color: '#FFD700' },
      mark: { emoji: '\uD83D\uDC89', color: '#cf0448' },
      clustered: { emoji: '\uD83D\uDC65', color: '#9370DB' },
      stun: { emoji: '\uD83D\uDE35', color: '#808080' },
      slow: { emoji: '\uD83D\uDC0C', color: '#4682B4' }
    };

    // HP bar: horizontal length -30%, vertical size +30%
    this.hpBarWidth = 21;
    this.hpBarHeight = 5.2;
    this.hpBarYOffset = -15;

    // Status icons above HP bar: 2x size
    this.iconSize = 18;
    this.iconSpacing = 10;
    this.iconYOffset = 14;
  }

  render(foods, multiPathSystem, currentTime) {
    if (!foods || foods.length === 0) return;

    const ctx = this.ctx;
    const scale = ctx.canvas.width / VIRTUAL_W;
    ctx.save();

    for (const food of foods) {
      const pos = multiPathSystem.samplePath(food.currentPath, food.d);
      if (!pos) continue;

      const hpPercent = Math.max(0, Math.min(1, food.hp / (food.maxHp || 1)));
      const barX = pos.x;
      const barY = pos.y + this.hpBarYOffset;

      this._renderHpBar(barX, barY, hpPercent, food, scale);

      const activeEffects = this._getActiveEffects(food.statusEffects || [], currentTime);
      if (activeEffects.length > 0) {
        const uniqueEffects = this._getUniqueEffects(activeEffects);
        this._renderStatusIcons(barX, barY - this.iconYOffset, uniqueEffects, scale);
      }
    }

    ctx.restore();
  }

  _renderHpBar(centerX, centerY, hpPercent, food, scale) {
    const ctx = this.ctx;
    const cx = centerX * scale;
    const cy = centerY * scale;
    const barW = this.hpBarWidth * scale;
    const barH = this.hpBarHeight * scale;
    const halfW = barW / 2;

    ctx.fillStyle = 'rgba(77, 0, 0, 0.82)';
    ctx.fillRect(cx - halfW, cy - barH / 2, barW, barH);

    const fgWidth = barW * hpPercent;
    const fgColor = this._getBarColor(food);
    ctx.fillStyle = fgColor;
    ctx.fillRect(cx - halfW, cy - barH / 2, fgWidth, barH);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - halfW, cy - barH / 2, barW, barH);
  }

  _getBarColor(food) {
    const activeEffects = this._getActiveEffects(food.statusEffects || [], Date.now() / 1000);
    for (const effect of activeEffects) {
      switch (effect.type) {
        case 'corrode': return '#55FF55';
        case 'shock': return '#FFEE44';
        case 'expose': return '#FFA238';
        case 'mark': return '#bb0038';
        case 'clustered': return '#58CCFF';
        case 'stun': return '#A0A0A0';
        default: break;
      }
    }
    return '#FF5959';
  }

  _getActiveEffects(statusEffects, currentTimeSec) {
    return statusEffects.filter(effect => {
      if (!effect.appliedTime || !effect.duration) return false;
      const appliedSec = effect.appliedTime / 1000;
      const elapsed = currentTimeSec - appliedSec;
      return elapsed < effect.duration;
    });
  }

  _getUniqueEffects(effects) {
    const map = new Map();
    for (const effect of effects) {
      if (!map.has(effect.type)) map.set(effect.type, effect);
    }
    return Array.from(map.values());
  }

  _renderStatusIcons(centerX, y, effects, scale) {
    const ctx = this.ctx;
    const visible = effects.slice(0, 4);
    const iconSpacing = this.iconSpacing * scale;
    const iconRadius = (this.iconSize * scale) / 2;
    const totalWidth = (visible.length - 1) * iconSpacing;
    let x = centerX * scale - totalWidth / 2;
    const drawY = y * scale;

    for (const effect of visible) {
      const icon = this.statusIcons[effect.type];
      if (!icon) continue;

      ctx.beginPath();
      ctx.arc(x, drawY, iconRadius, 0, Math.PI * 2);
      ctx.fillStyle = icon.color;
      ctx.fill();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = `${Math.max(16, Math.round(16 * scale))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(icon.emoji, x, drawY + 0.2 * scale);

      x += iconSpacing;
    }
  }
}
