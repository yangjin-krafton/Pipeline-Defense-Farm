# 업그레이드 트리 레이아웃 정검 완료

## 전체 구조

```
#bottom-sheet (750px height, 88vh max)
  └─ .sheet-content (flex: 1, overflow-y: auto)
      └─ #tower-detail
          ├─ .tower-info-block (타워 정보)
          ├─ .upgrade-block ⭐
          │   ├─ .upgrade-block::before (상단 그라데이션 바)
          │   ├─ .upgrade-header
          │   │   └─ h3 (24px, Splatoon 스타일)
          │   └─ .upgrade-content (340-500px)
          │       ├─ .upgrade-points (포인트 표시, sticky)
          │       └─ .upgrade-tree-scroll (스크롤 컨테이너)
          │           └─ treeWrapper (SVG + 노드들)
          │               ├─ svg (연결선)
          │               └─ .upgrade-node-card × N
          └─ .action-buttons
```

## 주요 치수

### Bottom Sheet
- **높이**: 750px (max-height: 88vh)
- **폭**: 640px
- **테두리**: 6px solid white
- **섀도우**: 3단계 (핑크 아웃라인 + 그림자 + 글로우)

### Upgrade Block
- **Padding**: 18px
- **Border**: 6px solid #1a1a2e
- **Border Radius**: 22px
- **Box Shadow**: 4단계 (금색 아웃라인 + 돌출 + 외부 그림자 + 내부 그림자)
- **Background**: 스트라이프 패턴 + 반투명 다크

### Upgrade Content
- **Min Height**: 340px
- **Max Height**: 500px
- **Overflow**: visible (자식이 스크롤 처리)

### Scroll Container
- **Padding**: 20px 15px
- **Border**: 5px solid #1a1a2e
- **Border Radius**: 15px
- **Min Height**: 340px
- **Max Height**: 470px
- **Overflow**: auto (양방향 스크롤)
- **Background**: 스트라이프 패턴 + 반투명 밝은 그라데이션
- **Shadow**: 내부 그림자 + 외부 핑크 글로우

### 노드 카드
- **Size**: 200px × 140px
- **Padding**: 16px
- **Border**: 5px solid #1a1a2e
- **Border Radius**: 18px
- **Gap**: 120px (가로), 40px (세로)

## 스플래툰 스타일 요소

### 1. 업그레이드 블록
- ✅ 굵은 테두리 (6px)
- ✅ 다층 섀도우 (금색 아웃라인)
- ✅ 스트라이프 배경 패턴
- ✅ 상단 그라데이션 애니메이션 바
- ✅ 내부 그림자

### 2. 헤더
- ✅ 큰 글자 (24px)
- ✅ 다중 텍스트 섀도우 (핑크 + 청록)
- ✅ 글로우 효과
- ✅ 기울기 변형 (skewX)
- ✅ 배경 그라데이션

### 3. 포인트 디스플레이
- ✅ 그라데이션 배경 (핑크 → 로즈)
- ✅ 금색 아웃라인
- ✅ 큰 글자 (18-22px)
- ✅ 텍스트 섀도우
- ✅ sticky 위치

### 4. 스크롤 컨테이너
- ✅ 스트라이프 패턴 배경
- ✅ 반투명 그라데이션
- ✅ 굵은 테두리
- ✅ 내부/외부 섀도우
- ✅ 핑크 글로우 아웃라인

### 5. 스크롤바
- ✅ 무지개 그라데이션
- ✅ 애니메이션 (ink-flow)
- ✅ 굵은 테두리
- ✅ 12px 높이

## 개선 사항

### 1. 공간 최적화
- Bottom sheet 높이: 700px → 750px
- Max height: 85vh → 88vh
- Scroll container: 320-450px → 340-470px
- Upgrade content: 280-450px → 340-500px

### 2. 스타일 강화
- 업그레이드 블록 테두리: 5px → 6px
- 패딩: 15px → 18px
- 헤더 폰트: 22px → 24px
- 상단 그라데이션 바 추가
- 내부 그림자 추가

### 3. 시각적 계층
- 배경 패턴 opacity 증가 (0.05 → 0.08)
- 외부 그림자 추가 (핑크 글로우)
- 내부 그림자로 깊이감 추가
- 스크롤 컨테이너 아웃라인 추가

## 반응형 고려사항

- Max height를 vh 단위로 설정하여 작은 화면 대응
- 스크롤 컨테이너가 자동으로 조정
- 노드 크기는 고정 (200×140px)
- 가로 스크롤로 많은 노드 처리

## 성능 최적화

- SVG를 한 번만 렌더링
- 노드 카드는 절대 위치로 배치
- 애니메이션은 transform 사용 (GPU 가속)
- 스크롤바 애니메이션은 부드러운 linear

## 접근성

- 충분한 글자 크기 (14-24px)
- 명확한 색상 대비
- 호버/포커스 상태 명확
- 키보드 네비게이션 가능 (클릭 이벤트)
