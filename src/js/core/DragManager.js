/**
 * DragManager
 * 모바일용 전역 드래그/터치 조작 관리 시스템
 *
 * 임계값(DRAG_THRESHOLD) 이상 이동해야 드래그로 인식.
 * 그 미만이면 클릭으로 처리되어 노드 클릭 이벤트가 정상 동작.
 */
export class DragManager {
  constructor() {
    this.isDragging = false;   // 임계값을 넘어 실제 드래그 중
    this.pendingTarget = null; // mousedown은 됐지만 아직 임계값 미달
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.dragTarget = null;
    this.dragHandlers = new Map(); // element -> handler

    // 드래그 가능한 영역들
    this.draggableAreas = new Set();

    // 드래그 인식 최소 이동 거리 (px)
    this.DRAG_THRESHOLD = 8;

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
   * 드래그 시작 처리 (pending 상태로만 진입 — 실제 드래그는 임계값 초과 후 활성화)
   */
  _handleStart(e) {
    const point = this._getPoint(e);

    // 드래그 가능한 영역인지 확인
    const target = this._findDraggableTarget(e.target);
    if (!target) return;

    // 버튼·링크 등 순수 클릭 전용 요소는 제외
    if (this._isClickableElement(e.target)) return;

    // 아직 onDragStart는 호출하지 않음 — 임계값 초과 시 활성화
    this.pendingTarget = target;
    this.isDragging = false;
    this.dragTarget = null;
    this.startX = point.x;
    this.startY = point.y;
    this.currentX = point.x;
    this.currentY = point.y;
  }

  /**
   * 클릭 전용 요소인지 확인 (드래그 차단 대상)
   * upgrade-node-card는 제외 — 거리 임계값으로 클릭/드래그 구분
   */
  _isClickableElement(element) {
    const tagName = element.tagName.toLowerCase();
    const clickableTags = ['button', 'a', 'input', 'select', 'textarea'];

    if (clickableTags.includes(tagName)) return true;
    if (element.onclick) return true;

    return false;
  }

  /**
   * 드래그 중 처리
   * - pending 상태에서 임계값 초과 시 드래그를 실제로 활성화
   * - 활성화 시점에 startX/Y를 현재 위치로 리셋 → 스크롤 점프 없음
   */
  _handleMove(e) {
    if (!this.isDragging && !this.pendingTarget) return;

    const point = this._getPoint(e);

    // ── 임계값 체크 (pending 상태일 때만) ──────────────────────
    if (!this.isDragging) {
      const dx = point.x - this.startX;
      const dy = point.y - this.startY;
      if (Math.sqrt(dx * dx + dy * dy) < this.DRAG_THRESHOLD) return;

      // 임계값 초과 → 드래그 정식 활성화
      this.isDragging = true;
      this.dragTarget = this.pendingTarget;
      // startX/Y를 현재 위치로 리셋하여 첫 onDrag에서 점프 방지
      this.startX = point.x;
      this.startY = point.y;
      this.currentX = point.x;
      this.currentY = point.y;

      const handler = this.dragHandlers.get(this.dragTarget);
      if (handler && handler.onDragStart) {
        handler.onDragStart({
          startX: this.startX,
          startY: this.startY,
          target: this.dragTarget,
          originalEvent: e
        });
      }
      return; // 이번 이벤트는 start 처리만, 다음 move부터 onDrag 호출
    }

    // ── 실제 드래그 이동 처리 ──────────────────────────────────
    e.preventDefault();

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
   * - 실제로 드래그가 활성화된 경우에만 onDragEnd 호출
   * - pending 상태(클릭)는 조용히 리셋
   */
  _handleEnd(e) {
    if (!this.isDragging && !this.pendingTarget) return;

    if (this.isDragging && this.dragTarget) {
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
    }

    this.isDragging = false;
    this.dragTarget = null;
    this.pendingTarget = null;
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
