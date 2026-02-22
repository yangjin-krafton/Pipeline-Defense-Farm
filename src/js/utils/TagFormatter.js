/**
 * TagFormatter.js
 * 코드 내 영문 태그 식별자를 UI 표시 시 한국어 명사로 변환하는 모듈
 *
 * 사용처: 업그레이드 노드 설명, 각인 카드, 별 승급 패널 등 모든 설명 텍스트 렌더링
 */

/**
 * 태그 → 한국어 레이블 + 표시 색상 매핑
 *
 * 음식 태그 (Food tags): 적 유닛의 속성 분류
 * 시너지 태그 (Synergy/Status tags): 상태이상·시너지 효과 분류
 */
const TAG_LABELS = {
  // ── 음식 태그 (Food tags) ─────────────────────────────────────
  carb:       { label: '탄수화물',  color: '#b08000' },  // dark amber
  fat:        { label: '지방',      color: '#cc6600' },  // deep orange
  protein:    { label: '단백질',    color: '#228b22' },  // forest green
  dairy:      { label: '유제품',    color: '#0080aa' },  // deep sky blue
  spicy:      { label: '매운맛',    color: '#cc2200' },  // deep red
  soda:       { label: '탄산음료',  color: '#0095aa' },  // deep cyan
  fermented:  { label: '발효식품',  color: '#8830b0' },  // deep purple
  sugar:      { label: '당분',      color: '#cc2266' },  // deep rose
  alcohol:    { label: '알코올',    color: '#8b6914' },  // dark gold

  // ── 시너지/상태이상 태그 (Synergy tags) ──────────────────────
  expose:     { label: '노출',      color: '#cc5500' },  // deep amber-orange
  corrode:    { label: '부식',      color: '#5a8800' },  // olive green
  shock:      { label: '감전',      color: '#0077aa' },  // deep blue
  mark:       { label: '표식',      color: '#aa00aa' },  // deep magenta
  clustered:  { label: '군집',      color: '#aa8800' },  // dark yellow
};

/**
 * 효과 텍스트 안의 영문 태그를 한국어 스타일 스팬으로 변환
 *
 * @param {string} text - 원본 효과 텍스트 (예: "fat 관통 시 방어 -10%")
 * @returns {string} HTML이 포함된 변환 텍스트 (예: "<span ...>[지방]</span> 관통 시 방어 -10%")
 */
export function formatTagText(text) {
  if (!text) return text;

  let result = text;

  for (const [tag, { label, color }] of Object.entries(TAG_LABELS)) {
    // 앞뒤가 영문자·숫자가 아닐 때만 매칭 (단어 경계)
    const regex = new RegExp(`(?<![a-zA-Z0-9])${tag}(?![a-zA-Z0-9])`, 'g');
    result = result.replace(
      regex,
      `<span style="background:${color};color:#fff;font-weight:900;padding:1px 5px;border-radius:4px;font-size:0.88em;white-space:nowrap;border:1.5px solid rgba(0,0,0,0.2);">[${label}]</span>`
    );
  }

  return result;
}

/**
 * 태그의 한국어 레이블만 반환 (스타일 없이 순수 텍스트 필요할 때)
 *
 * @param {string} tag - 영문 태그 식별자
 * @returns {string} 한국어 레이블, 없으면 원본 태그 그대로
 */
export function getTagLabel(tag) {
  return TAG_LABELS[tag]?.label ?? tag;
}

/**
 * TAG_LABELS 전체 맵 (외부 참조용)
 */
export { TAG_LABELS };
