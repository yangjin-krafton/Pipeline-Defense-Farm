/**
 * Emoji Renderer with caching for optimized performance
 */
import { EMOJI_CACHE_SIZE, VIRTUAL_W } from '../config.js';

export class EmojiRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.emojiCache = new Map();
  }

  /**
   * Cache an emoji at a specific size
   * @param {string} emoji - Emoji character
   * @param {number} size - Size in pixels
   * @returns {HTMLCanvasElement} Cached emoji canvas
   */
  _cacheEmoji(emoji, size) {
    const key = `${emoji}_${size}`;
    if (this.emojiCache.has(key)) {
      return this.emojiCache.get(key);
    }

    const canvas = document.createElement('canvas');
    const s = size * 1.2; // Extra padding
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext('2d');

    ctx.font = `${size}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw shadow
    ctx.globalAlpha = 0.3;
    ctx.fillText(emoji, s/2 + 2, s/2 + 2);

    // Draw main
    ctx.globalAlpha = 1.0;
    ctx.fillText(emoji, s/2, s/2);

    this.emojiCache.set(key, canvas);
    return canvas;
  }

  /**
   * Clear the canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw an emoji at a position
   * @param {string} emoji - Emoji character
   * @param {number} x - X position (in virtual coordinates)
   * @param {number} y - Y position (in virtual coordinates)
   * @param {number} size - Size (in virtual coordinates)
   * @param {number} scale - Canvas scale factor
   */
  drawEmoji(emoji, x, y, size, scale) {
    const actualSize = Math.round(size * scale);
    const cached = this._cacheEmoji(emoji, EMOJI_CACHE_SIZE);
    const drawSize = actualSize * 1.2;

    const actualX = x * scale;
    const actualY = y * scale;

    this.ctx.drawImage(
      cached,
      actualX - drawSize/2,
      actualY - drawSize/2,
      drawSize,
      drawSize
    );
  }

  /**
   * Draw a tower at a position
   * @param {BaseTower} tower - Tower object
   * @param {number} scale - Canvas scale factor
   */
  drawTower(tower, scale) {
    const ctx = this.ctx;
    const x = tower.x * scale;
    const y = tower.y * scale;
    const size = tower.slotRadius * 2 * scale;
    const rotation = Number.isFinite(tower.visualRotation) ? tower.visualRotation : 0;

    // Draw tower emoji
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.font = `${size}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tower.definition.emoji, 0, 0);
    ctx.restore();

    // Draw tower growth info (star, level, XP gauge)
    this._drawTowerGrowthInfo(tower, x, y, size, scale);
  }

  /**
   * Draw tower growth information (star rating, level, XP bar)
   * @param {BaseTower} tower - Tower object
   * @param {number} x - X position (scaled)
   * @param {number} y - Y position (scaled)
   * @param {number} size - Tower size (scaled)
   * @param {number} scale - Canvas scale factor
   */
  _drawTowerGrowthInfo(tower, x, y, size, scale) {
    const ctx = this.ctx;

    // === 1. 타워 상단: 별 표시 (1~7성) ===
    if (tower.star && tower.star > 0) {
      const starSize = Math.max(10, size * 0.15);
      const starY = y - size * 0.7; // 타워 상단 위치

      ctx.font = `${starSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // 별 그림자 (가독성)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      for (let i = 0; i < tower.star; i++) {
        const starX = x + (i - (tower.star - 1) / 2) * starSize * 0.7;
        ctx.fillText('⭐', starX + 1, starY + 1);
      }

      // 별 메인
      ctx.fillStyle = '#FFD700';
      for (let i = 0; i < tower.star; i++) {
        const starX = x + (i - (tower.star - 1) / 2) * starSize * 0.7;
        ctx.fillText('⭐', starX, starY);
      }
    }

    // === 2. 타워 하단: 레벨 + XP 게이지 ===
    const gaugeY = y; // 타워 중심
    const gaugeRadius = size * 0.55; // 반원 반지름
    const gaugeThickness = Math.max(3, size * 0.08);

    // XP 진행률 계산
    const maxLevel = this._calculateMaxLevel(tower.star);
    const xpPercent = this._calculateXPPercent(tower, maxLevel);

    // === 2-1. 반원 게이지 배경 (어두운 회색) ===
    ctx.strokeStyle = 'rgba(50, 50, 50, 0.8)';
    ctx.lineWidth = gaugeThickness;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, gaugeY, gaugeRadius, Math.PI, Math.PI * 2); // 반원 (아래쪽, U자 모양)
    ctx.stroke();

    // === 2-2. 반원 게이지 전경 (XP 진행률) ===
    if (xpPercent > 0) {
      // XP에 따른 색상 (초록 → 노랑 → 하늘색)
      let gaugeColor;
      if (xpPercent < 0.33) {
        gaugeColor = '#4ade80'; // 초록
      } else if (xpPercent < 0.66) {
        gaugeColor = '#fbbf24'; // 노랑
      } else {
        gaugeColor = '#60a5fa'; // 하늘색
      }

      ctx.strokeStyle = gaugeColor;
      ctx.lineWidth = gaugeThickness;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const startAngle = Math.PI; // 왼쪽 (180도)
      const endAngle = Math.PI + (Math.PI * xpPercent); // 진행률만큼 그리기 (오른쪽으로)
      ctx.arc(x, gaugeY, gaugeRadius, startAngle, endAngle);
      ctx.stroke();

      // 게이지 빛나는 효과 (만랩 근처)
      if (xpPercent > 0.9) {
        ctx.shadowColor = gaugeColor;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // === 2-3. 레벨 숫자 (게이지 중앙, 타워 정 하단) ===
    const levelX = x; // 타워 중심 (게이지 중앙)
    const levelY = gaugeY + gaugeRadius + size * 0.15; // 반원 아래
    const levelFontSize = Math.max(10, size * 0.3);
    const levelText = tower.level >= maxLevel ? 'MAX' : `Lv${tower.level}`;

    // 알림 상태: 미사용 포인트(회전 pingpong) / 승급 가능(스케일 pingpong)
    const hasUnusedPoints = tower.upgradeTree &&
                            tower.upgradePoints > tower.upgradeTree.usedPoints;
    const canPromote = tower.level >= maxLevel &&
                       tower.star < 7 &&
                       (!tower.upgradeTree || tower.upgradePoints <= tower.upgradeTree.usedPoints);

    // 변환 행렬 계산 (setTransform으로 현재 캔버스 상태와 무관하게 명시적 적용)
    let rotAngle = 0;
    let scaleVal = 1;
    if (hasUnusedPoints || canPromote) {
      const now = performance.now() / 1000;
      if (hasUnusedPoints) {
        rotAngle = Math.sin(now * Math.PI * 4) * (Math.PI / 6); // ±30도, 2Hz
      }
      if (canPromote) {
        scaleVal = 1 + Math.sin(now * Math.PI * 3) * 0.25; // ±25%, 1.5Hz
      }
    }
    const cosR = Math.cos(rotAngle) * scaleVal;
    const sinR = Math.sin(rotAngle) * scaleVal;

    ctx.save();
    ctx.setTransform(cosR, sinR, -sinR, cosR, levelX, levelY);

    ctx.font = `bold ${levelFontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = tower.level >= maxLevel ? '#FFD700' : '#FFFFFF';
    ctx.fillText(levelText, 0, 0);

    ctx.restore();
  }

  /**
   * Calculate max level for star rating
   * @param {number} star - Star rating (1~7)
   * @returns {number} Max level
   */
  _calculateMaxLevel(star) {
    return 5 + star; // 1성: Lv6, 7성: Lv12
  }

  /**
   * Calculate XP percentage for current level (resets to 0 on level up)
   * @param {BaseTower} tower - Tower object
   * @param {number} maxLevel - Max level for current star
   * @returns {number} XP percent (0~1)
   */
  _calculateXPPercent(tower, maxLevel) {
    if (tower.level >= maxLevel) {
      return 1.0; // 만랩
    }

    // XP 요구량 계산 (TowerGrowthSystem과 동일 로직)
    const star = tower.star;
    const baseLevelCounts = [0, 20, 50, 100, 180, 300];
    const multiplier = 1.0 + Math.pow(star - 1, 1.4) * 0.5;

    // 현재 레벨과 다음 레벨의 누적 XP 요구량
    const currentLevelIndex = Math.min(tower.level, baseLevelCounts.length - 1);
    const prevLevelIndex = Math.max(0, currentLevelIndex - 1);

    const currentLevelXP = Math.floor(baseLevelCounts[prevLevelIndex] * multiplier); // 현재 레벨 시작 XP
    const nextLevelXP = Math.floor(baseLevelCounts[currentLevelIndex] * multiplier); // 다음 레벨 XP

    const xpForThisLevel = nextLevelXP - currentLevelXP; // 이번 레벨에 필요한 XP
    const currentXPInLevel = tower.xp - currentLevelXP; // 현재 레벨에서 획득한 XP

    if (xpForThisLevel === 0) return 0;

    return Math.min(1.0, Math.max(0, currentXPInLevel / xpForThisLevel));
  }

  /**
   * Get color for efficiency state
   * @param {string} state - Efficiency state
   * @returns {string} Color
   */
  _getEfficiencyColor(state) {
    switch(state) {
      case 'STARVED': return '#ff4444';
      case 'NORMAL': return '#44ff44';
      case 'BOOSTED': return '#ffff44';
      case 'OVERCHARGED': return '#ff44ff';
      default: return '#ffffff';
    }
  }

  /**
   * Get the canvas scale factor
   * @returns {number} Scale factor
   */
  getScale() {
    return this.canvas.width / VIRTUAL_W;
  }

  /**
   * Clear emoji cache
   */
  clearCache() {
    this.emojiCache.clear();
  }
}
