/**
 * DragManager
 * 모바일용 전역 드래그/터치 조작 관리 시스템
 */
export class DragManager {
  constructor() {
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.dragTarget = null;
    this.dragHandlers = new Map(); // element -> handler

    // 드래그 가능한 영역들
    this.draggableAreas = new Set();

    // 전역 이벤트 리스너 등록
    this._setupGlobalListeners();
  }

  /**
   * 전역 터치/마우스 이벤트 리스너 설정
   */
  _setupGlobalListeners() {
    // 터치 이벤트
    document.addEventListener('touchstart', this._handleStart.bind(this), { passive: false });
    document.addEventListener('touchmove', this._handleMove.bind(this), { passive: false });
    document.addEventListener('touchend', this._handleEnd.bind(this), { passive: false });
    document.addEventListener('touchcancel', this._handleEnd.bind(this), { passive: false });

    // 마우스 이벤트 (데스크톱 테스트용)
    document.addEventListener('mousedown', this._handleStart.bind(this));
    document.addEventListener('mousemove', this._handleMove.bind(this));
    document.addEventListener('mouseup', this._handleEnd.bind(this));
    document.addEventListener('mouseleave', this._handleEnd.bind(this));
  }

  /**
   * 드래그 가능한 영역 등록
   * @param {HTMLElement} element
   * @param {Object} options { onDragStart, onDrag, onDragEnd }
   */
  registerDraggable(element, options = {}) {
    this.draggableAreas.add(element);
    this.dragHandlers.set(element, options);

    // 터치 액션 방지
    element.style.touchAction = 'none';
    element.style.userSelect = 'none';
    element.style.webkitUserSelect = 'none';

    return () => this.unregisterDraggable(element);
  }

  /**
   * 드래그 가능한 영역 해제
   */
  unregisterDraggable(element) {
    this.draggableAreas.delete(element);
    this.dragHandlers.delete(element);
  }

  /**
   * 드래그 시작 처리
   */
  _handleStart(e) {
    const point = this._getPoint(e);

    // 드래그 가능한 영역인지 확인
    const target = this._findDraggableTarget(e.target);
    if (!target) return;

    // 클릭 가능한 요소인지 체크 (버튼, 링크 등)
    if (this._isClickableElement(e.target)) {
      return; // 클릭 가능한 요소는 드래그하지 않음
    }

    // 기본 동작 방지 (스크롤, 선택 등)
    // e.preventDefault(); // 일부러 주석 처리 - 필요시 핸들러에서 처리

    this.isDragging = true;
    this.dragTarget = target;
    this.startX = point.x;
    this.startY = point.y;
    this.currentX = point.x;
    this.currentY = point.y;

    const handler = this.dragHandlers.get(target);
    if (handler && handler.onDragStart) {
      handler.onDragStart({
        startX: this.startX,
        startY: this.startY,
        target: target,
        originalEvent: e
      });
    }
  }

  /**
   * 클릭 가능한 요소인지 확인
   */
  _isClickableElement(element) {
    const tagName = element.tagName.toLowerCase();
    const clickableTags = ['button', 'a', 'input', 'select', 'textarea'];

    if (clickableTags.includes(tagName)) return true;

    // 클릭 이벤트가 있는 요소인지 확인
    if (element.onclick) return true;

    // 업그레이드 노드 카드인지 확인
    let current = element;
    while (current && current !== document.body) {
      if (current.classList.contains('upgrade-node-card')) {
        return true;
      }
      current = current.parentElement;
    }

    return false;
  }

  /**
   * 드래그 중 처리
   */
  _handleMove(e) {
    if (!this.isDragging || !this.dragTarget) return;

    e.preventDefault();

    const point = this._getPoint(e);
    const deltaX = point.x - this.currentX;
    const deltaY = point.y - this.currentY;

    this.currentX = point.x;
    this.currentY = point.y;

    const handler = this.dragHandlers.get(this.dragTarget);
    if (handler && handler.onDrag) {
      handler.onDrag({
        deltaX,
        deltaY,
        currentX: this.currentX,
        currentY: this.currentY,
        startX: this.startX,
        startY: this.startY,
        totalDeltaX: this.currentX - this.startX,
        totalDeltaY: this.currentY - this.startY,
        target: this.dragTarget,
        originalEvent: e
      });
    }
  }

  /**
   * 드래그 종료 처리
   */
  _handleEnd(e) {
    if (!this.isDragging || !this.dragTarget) return;

    const handler = this.dragHandlers.get(this.dragTarget);
    if (handler && handler.onDragEnd) {
      handler.onDragEnd({
        startX: this.startX,
        startY: this.startY,
        endX: this.currentX,
        endY: this.currentY,
        totalDeltaX: this.currentX - this.startX,
        totalDeltaY: this.currentY - this.startY,
        target: this.dragTarget,
        originalEvent: e
      });
    }

    this.isDragging = false;
    this.dragTarget = null;
  }

  /**
   * 터치/마우스 포인트 추출
   */
  _getPoint(e) {
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      return {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY
      };
    } else {
      return {
        x: e.clientX,
        y: e.clientY
      };
    }
  }

  /**
   * 드래그 가능한 타겟 찾기
   */
  _findDraggableTarget(element) {
    let current = element;
    while (current && current !== document.body) {
      if (this.draggableAreas.has(current)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  /**
   * 모든 드래그 핸들러 정리
   */
  destroy() {
    this.draggableAreas.clear();
    this.dragHandlers.clear();
  }
}

// 싱글톤 인스턴스
export const dragManager = new DragManager();
