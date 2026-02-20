/**
 * BaseModule
 * 모든 타워 모듈의 베이스 클래스
 */
export class BaseModule {
  constructor(config = {}) {
    this.config = config;
    this.enabled = true;
  }

  /**
   * 모듈 효과를 적용
   * @param {Object} context - 실행 컨텍스트 (tower, food, damage 등)
   * @returns {Object} 수정된 컨텍스트 또는 추가 효과
   */
  apply(context) {
    if (!this.enabled) return context;
    return this._applyEffect(context);
  }

  /**
   * 서브클래스에서 오버라이드할 메서드
   * @protected
   */
  _applyEffect(context) {
    return context;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }
}
