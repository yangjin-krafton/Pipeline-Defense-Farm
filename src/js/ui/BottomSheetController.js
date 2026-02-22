/**
 * BottomSheetController.js
 * 하단 시트 열기/닫기 및 드래그 제어 모듈
 */

export class BottomSheetController {
  constructor(uiController) {
    this.ui = uiController;
  }

  /**
   * 시트 관련 이벤트 등록 (setupBottomSheet + setupDrag)
   */
  setup() {
    const toggleSheet = () => {
      if (this.ui.isExpanded) {
        this.ui.closeSheet();
      } else {
        if (!this.ui.selectedTowerSlot && !this.ui.selectedSlot) {
          console.log('[BottomSheetController] No tower selected, cannot open sheet');
          return;
        }
        this.ui.openSheet();
      }
    };

    // 핸들 클릭
    this.ui.sheetHandle.addEventListener('click', toggleSheet);

    // 닫기 버튼 (타워 상세)
    const closeBtn = document.getElementById('closeBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.ui.closeSheet();
      });
    }

    // 닫기 버튼 (타워 설치)
    const closeBuildBtn = document.getElementById('closeBuildBtn');
    if (closeBuildBtn) {
      closeBuildBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.ui.closeSheet();
      });
    }

    // 판매 버튼
    const sellBtn = document.getElementById('sellBtn');
    if (sellBtn) {
      sellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.ui._handleSellTower();
      });
    }

    this._setupDrag();
  }

  /**
   * 드래그로 시트 열기/닫기 (setupDrag)
   */
  _setupDrag() {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const handleStart = (e) => {
      isDragging = true;
      startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    };

    const handleMove = (e) => {
      if (!isDragging) return;

      currentY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
      const deltaY = currentY - startY;

      if (Math.abs(deltaY) > 50) {
        if (deltaY > 0 && this.ui.isExpanded) {
          this.ui.closeSheet();
        } else if (deltaY < 0 && !this.ui.isExpanded) {
          if (!this.ui.selectedTowerSlot && !this.ui.selectedSlot) {
            console.log('[BottomSheetController] No tower selected, cannot open sheet via drag');
            isDragging = false;
            return;
          }
          this.ui.openSheet();
        }
        isDragging = false;
      }
    };

    const handleEnd = () => { isDragging = false; };

    this.ui.sheetHandle.addEventListener('mousedown', handleStart);
    this.ui.sheetHandle.addEventListener('touchstart', handleStart, { passive: true });

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove, { passive: true });

    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);
  }
}
