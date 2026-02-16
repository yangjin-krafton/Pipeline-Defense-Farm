# 🎨 Styles - Modular CSS Architecture

Splatoon 스타일 테마를 적용한 모듈화된 CSS 구조입니다.

## 📁 디렉토리 구조

```
src/styles/
├── main.css                    # 메인 진입점 (모든 스타일 import)
├── themes/
│   └── splatoon.css           # Splatoon 테마 (변수, 유틸리티)
└── components/
    ├── badge.css              # 배지 & FPS 카운터
    ├── music-controls.css     # 음악 컨트롤
    ├── start-overlay.css      # 시작 화면 오버레이
    ├── canvas-container.css   # 게임 캔버스 컨테이너
    ├── status-bar.css         # 상단 상태바 (리소스, 건강)
    ├── tower-system.css       # 타워 시스템 (타워, 빈 타일)
    └── bottom-sheet.css       # 하단 슬라이드업 메뉴
```

## 🎮 Splatoon 테마 특징

### 컬러 팔레트
- **핑크**: `#e94560` (메인 액센트)
- **시안**: `#00d9ff` (보조 액센트)
- **옐로우**: `#ffd700` (하이라이트)
- **다크**: `#1a1a2e` (배경/텍스트)

### 디자인 요소
- ✨ **네온 컬러**: 밝고 선명한 색상
- 💥 **다중 테두리**: 레이어드 룩 (3-4겹)
- 🌀 **대각선 패턴**: 스트라이프 배경
- ⚡ **볼드 폰트**: Arial Black (900 weight)
- 🎯 **애니메이션**: 바운스, 펄스, 글로우 효과

## 🎮 게임 UI 컴포넌트

### Status Bar (상단 상태바)
- **위치**: 화면 상단 고정
- **기능**: 리소스 표시 (🍎 에너지, ⚡ 전력, 🦠 유산균)
- **건강 상태**: 소화기관 3개 (🟡 위, 🟢 장, 🔴 간)
- **스타일**: 스트라이프 배경, 스큐 효과

### Tower System (타워 시스템)
- **타워**: 클릭 가능, 호버 시 공격 범위 표시
- **빈 타일**: 타워 설치 가능한 슬롯
- **잉크 스플래시**: 클릭 시 컬러 효과
- **레벨 표시**: 타워 레벨 배지

### Bottom Sheet (하단 메뉴)
- **접기/펼치기**: 핸들 또는 헤더 클릭
- **드래그**: 상하 드래그로 열기/닫기
- **타워 상세**: 스탯, 업그레이드 정보
- **타워 그리드**: 설치 가능한 타워 목록

## 🔧 사용 방법

### 테마 변수 사용
```css
.my-element {
  background: var(--splat-cyan);
  border: var(--border-dark);
  box-shadow: var(--shadow-glow-cyan);
}
```

### 유틸리티 클래스
```html
<!-- 텍스트 효과 -->
<h1 class="splat-text-effect">Title</h1>

<!-- 버튼 -->
<button class="splat-btn splat-btn-primary">Click</button>

<!-- 카드 -->
<div class="splat-card">Content</div>

<!-- 애니메이션 -->
<div class="splat-gradient-animated">Gradient</div>
```

## 🎨 컴포넌트 커스터마이징

각 컴포넌트는 독립적으로 커스터마이징할 수 있습니다:

### Badge 커스터마이징
```css
/* components/badge.css */
.badge {
  /* 위치, 색상, 크기 변경 가능 */
}
```

### Music Controls 커스터마이징
```css
/* components/music-controls.css */
.music-controls {
  /* 레이아웃, 스타일 변경 가능 */
}
```

## 🌈 새로운 테마 추가하기

1. `themes/` 폴더에 새 테마 파일 생성:
```css
/* themes/zelda.css */
:root {
  --zelda-gold: #d4af37;
  --zelda-green: #52b788;
  /* ... */
}
```

2. `main.css`에서 테마 import 변경:
```css
/* @import './themes/splatoon.css'; */
@import './themes/zelda.css';
```

## 📱 반응형 디자인

3가지 브레이크포인트:
- **Desktop**: > 768px (기본)
- **Tablet**: ≤ 768px
- **Mobile**: ≤ 480px

```css
/* main.css에 정의됨 */
@media (max-width: 768px) { /* 태블릿 */ }
@media (max-width: 480px) { /* 모바일 */ }
```

## 🎯 애니메이션

### 제공되는 애니메이션
- `splat-bounce`: 위아래 바운스
- `splat-pulse`: 크기/회전 펄스
- `splat-glow`: 글로우 효과
- `splat-dash`: 대시 선 애니메이션
- `shine`: 반짝임 효과
- `gradient-slide`: 그라디언트 슬라이드

### 사용 예시
```css
.my-element {
  animation: splat-bounce 2s infinite;
}
```

## 🚀 성능 최적화

- **@import 사용**: 브라우저가 병렬로 로드
- **컴포넌트 분리**: 필요한 부분만 수정 가능
- **CSS 변수**: 런타임 테마 변경 가능
- **모듈화**: 재사용성 & 유지보수성 ↑

## 📝 개발 가이드

### 새 컴포넌트 추가
1. `components/` 폴더에 파일 생성
2. `main.css`에 import 추가
3. 테마 변수 활용

### 스타일 우선순위
1. 테마 변수 (splatoon.css)
2. 컴포넌트 기본 스타일
3. 상태별 스타일 (:hover, :active)
4. 반응형 스타일 (@media)

## 🎨 디자인 토큰

### 간격
- 작은 간격: `8px`, `10px`
- 중간 간격: `15px`, `20px`
- 큰 간격: `30px`, `40px`

### 둥근 모서리
- 작은 요소: `15px`, `20px`
- 큰 요소: `25px`, `30px`
- 원형: `50%`

### 그림자
- 기본: `0 6px 0 #1a1a2e`
- 글로우: `0 0 30px rgba(color, 0.6)`
- 깊은: `0 20px 60px rgba(0, 0, 0, 0.5)`

## 💻 JavaScript API

### UIController 사용법

```javascript
// UIController 인스턴스는 자동으로 초기화됩니다
const ui = window.uiController;

// 리소스 업데이트
ui.updateResource('🍎', 1500);

// 소화기관 건강 업데이트 (0-1 범위)
ui.updateOrganHealth(0, 0.8); // 위: 80%
ui.updateOrganHealth(1, 0.6); // 장: 60%

// 타워 정보 업데이트
ui.updateTowerInfo({
  icon: '🧪',
  name: '효소 분사기',
  level: 3,
  description: '탄수화물 분해 특화',
  stats: {
    attack: { percentage: 60, value: '45' },
    speed: { percentage: 80, value: '1.2초' },
    range: { percentage: 40, value: '2타일' },
    special: { percentage: 75, value: '+15%' }
  }
});

// 하단 시트 수동 제어
const sheet = document.getElementById('bottom-sheet');
sheet.classList.add('expanded'); // 열기
sheet.classList.remove('expanded'); // 닫기
```

### 이벤트 리스너

```javascript
// 타워 클릭 이벤트
document.querySelectorAll('.tower-on-map').forEach(tower => {
  tower.addEventListener('click', (e) => {
    console.log('Tower clicked:', tower.dataset.towerId);
  });
});

// 빈 타일 클릭 이벤트
document.querySelectorAll('.empty-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    console.log('Show tower build menu');
  });
});
```

## 🔗 참고 자료

- [CSS @import](https://developer.mozilla.org/en-US/docs/Web/CSS/@import)
- [CSS 변수](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [CSS 애니메이션](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations)
- [Touch Events API](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
