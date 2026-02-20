/**
 * ScaleManager.js
 * 게임 화면 비율 유지 스케일링 관리
 */

export class ScaleManager {
  constructor() {
    this.DESIGN_WIDTH = 640;
    this.DESIGN_HEIGHT = 1138;
    this.gameScreen = null;
    this.scaleContainer = null;

    this.init();
  }

  init() {
    this.gameScreen = document.getElementById('game-screen');
    this.scaleContainer = document.getElementById('scale-container');

    if (!this.gameScreen || !this.scaleContainer) {
      console.error('game-screen or scale-container not found');
      return;
    }

    // 초기 스케일 조정
    this.adjustScale();

    // 창 크기 변경 시 재조정
    window.addEventListener('resize', () => this.adjustScale());
  }

  /**
   * 화면 크기에 맞춰 비율 유지하며 스케일 조정
   * 가로/세로 모두 반응형으로 작동
   */
  adjustScale() {
    const containerWidth = this.scaleContainer.clientWidth;
    const containerHeight = this.scaleContainer.clientHeight;

    // 현재 창 크기에서 디자인 크기가 차지할 수 있는 최대 비율 계산
    const scaleX = containerWidth / this.DESIGN_WIDTH;
    const scaleY = containerHeight / this.DESIGN_HEIGHT;

    // 비율을 유지하면서 화면에 맞추기 (작은 쪽 기준)
    // 가로로 넓어져도, 세로로 길어져도 자동 스케일
    const scale = Math.min(scaleX, scaleY);

    // 최소 스케일 보장 (너무 작아지지 않도록)
    const finalScale = Math.max(scale, 0.3);

    // 스케일 적용
    this.gameScreen.style.transform = `scale(${finalScale})`;
  }

  /**
   * 현재 스케일 값 반환
   */
  getScale() {
    const containerWidth = this.scaleContainer.clientWidth;
    const containerHeight = this.scaleContainer.clientHeight;
    const scaleX = containerWidth / this.DESIGN_WIDTH;
    const scaleY = containerHeight / this.DESIGN_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    return Math.max(scale, 0.3); // 최소 스케일 보장
  }

  /**
   * 디자인 좌표를 실제 화면 좌표로 변환
   */
  designToScreen(x, y) {
    const scale = this.getScale();
    const rect = this.gameScreen.getBoundingClientRect();

    return {
      x: rect.left + x * scale,
      y: rect.top + y * scale
    };
  }

  /**
   * 실제 화면 좌표를 디자인 좌표로 변환
   */
  screenToDesign(screenX, screenY) {
    const scale = this.getScale();
    const rect = this.gameScreen.getBoundingClientRect();

    return {
      x: (screenX - rect.left) / scale,
      y: (screenY - rect.top) / scale
    };
  }
}
