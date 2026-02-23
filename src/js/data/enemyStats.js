/**
 * Layer A — Enemy Stat Table  (lv1 ~ lv100)
 *
 * ── 설계 기준 ─────────────────────────────────────────────────────────────
 *  lv100 기준 최대 전력 산출:
 *    타워 7성 + 12포인트 완전체 × 5개 집중 = 약 2,750 DPS
 *    lv100 실효 HP 목표 = 20,000  →  TTK ≈ 7.3초 (간당간당)
 *
 *  스탯 공식:
 *    hp     = round(80  × 100^((lv-1)/99))  → lv1=80  / lv50=782  / lv100=8,000
 *    armor  = round((lv-1) × 60/99)          → lv1=0   / lv50=30   / lv100=60
 *    speed  = round(130 − (lv-1) × 65/99)   → lv1=130 / lv50=97   / lv100=65
 *    size   = round(20  + (lv-1) × 16/99)   → lv1=20  / lv50=28   / lv100=36
 *    reward = round(5   + (lv-1) × 45/99)   → lv1=5   / lv50=27   / lv100=50
 *
 *  실효 HP = hp / (1 - armor × 0.01)
 *    lv50  : 782 / 0.70 ≈ 1,117
 *    lv75  : 2,499 / 0.55 ≈ 4,544
 *    lv100 : 8,000 / 0.40 = 20,000  ✓
 *
 *  tier : 경로(path) 내 상대 강도 분류  →  wave pattern 선택에 사용
 *  level: 전역 절대 강도 (1~100)        →  HP/armor/speed 실제 계산에 사용
 *
 * ── 레벨 배정 방식 ────────────────────────────────────────────────────────
 *  64개 emoji 를 원본 위협도(threat×10 + digestionNeed) 순으로 정렬,
 *  lv1 ~ lv100 에 고르게 배분 (간격 ≈ 1.57).
 *  tier 는 경로별 절대 상대 분할 (경로마다 하위/중간/상위 3분류).
 */

// ── 공식 함수 ──────────────────────────────────────────────────────────────

/** lv → 기본 HP */
export function hpFromLevel(lv) {
  return Math.round(80 * Math.pow(100, (lv - 1) / 99));
}

/** lv → 아머 (0 ~ 60) */
export function armorFromLevel(lv) {
  return Math.round((lv - 1) * 60 / 99);
}

/** lv → 이동 속도 (130 ~ 65 px/s) */
export function speedFromLevel(lv) {
  return Math.round(130 - (lv - 1) * 65 / 99);
}

/** lv → 렌더 크기 (20 ~ 36 px) */
export function sizeFromLevel(lv) {
  return Math.round(20 + (lv - 1) * 16 / 99);
}

/** lv → 처치 SC 보상 */
export function rewardFromLevel(lv) {
  return Math.round(5 + (lv - 1) * 45 / 99);
}

/** 공통 스탯 주입 헬퍼 */
function e(id, emoji, name, level, types, tier) {
  const hp = hpFromLevel(level);
  return {
    id, emoji, name, level, types, tier,
    hp,
    maxHp:  hp,
    armor:  armorFromLevel(level),
    speed:  speedFromLevel(level),
    size:   sizeFromLevel(level),
    reward: rewardFromLevel(level),
  };
}

// ── 경로별 스탯 테이블 ─────────────────────────────────────────────────────
//
//  rice_stomach    : 27 emoji  (normal 9 / strong 9 / elite 9)
//  dessert_stomach : 23 emoji  (normal 8 / strong 8 / elite 7)
//  alcohol_stomach : 14 emoji  (normal 5 / strong 5 / elite 4)
//
//  lv 범위 참고:
//    normal : rice lv15~54  / dessert lv1~18  / alcohol lv3~31
//    strong : rice lv59~84  / dessert lv21~53 / alcohol lv32~48
//    elite  : rice lv86~100 / dessert lv56~80 / alcohol lv61~89

export const ENEMY_STATS = {

  // ══════════════════════════════════════════════════════════════════════
  rice_stomach: [
    // ── normal (lv15 ~ lv54) ──────────────────────────────────────────
    e('fortune_cookie',    '🥠', '포춘쿠키',  15, ['carb','sweet'],              'normal'),
    e('rice_cracker',      '🍘', '쌀과자',    20, ['carb','dry'],                'normal'),
    e('sushi',             '🍣', '초밥',      26, ['protein','light'],           'normal'),
    e('cooked_rice',       '🍚', '밥',        28, ['carb','plain'],              'normal'),
    e('rice_ball',         '🍙', '주먹밥',    29, ['carb','light'],              'normal'),
    e('fried_egg',         '🍳', '계란후라이', 39, ['protein','fat'],            'normal'),
    e('taco',              '🌮', '타코',      40, ['carb','protein','spicy'],    'normal'),
    e('fries',             '🍟', '감자튀김',  51, ['fat','carb','fried'],        'normal'),
    e('fried_shrimp',      '🍤', '새우튀김',  54, ['protein','fried'],           'normal'),

    // ── strong (lv59 ~ lv84) ──────────────────────────────────────────
    e('sandwich',          '🥪', '샌드위치',  59, ['carb','protein'],            'strong'),
    e('bacon',             '🥓', '베이컨',    62, ['fat','protein','salty'],     'strong'),
    e('ramen',             '🍜', '라면',      67, ['carb','sodium'],             'strong'),
    e('dumpling',          '🥟', '만두',      70, ['carb','protein','steamed'],  'strong'),
    e('stuffed_flatbread', '🥙', '팔라펠랩',  72, ['carb','veggie','protein'],   'strong'),
    e('tamale',            '🫔', '타말레',    75, ['carb','protein','corn'],     'strong'),
    e('spaghetti',         '🍝', '파스타',    81, ['carb','fat'],                'strong'),
    e('stew',              '🍲', '스튜',      83, ['protein','veggie','soup'],   'strong'),
    e('takeout_box',       '🥡', '테이크아웃', 84, ['carb','oil'],               'strong'),

    // ── elite (lv86 ~ lv100) ─────────────────────────────────────────
    e('bento',             '🍱', '도시락',    86, ['carb','protein','veggie'],   'elite'),
    e('curry_rice',        '🍛', '카레라이스', 87, ['carb','spicy','sauce'],     'elite'),
    e('paella',            '🥘', '빠에야',    91, ['carb','protein','seafood'], 'elite'),
    e('poultry_leg',       '🍗', '치킨다리',  92, ['protein','fat'],            'elite'),
    e('pizza',             '🍕', '피자',      94, ['fat','carb','dairy'],       'elite'),
    e('burrito',           '🌯', '부리또',    95, ['carb','fat','protein'],     'elite'),
    e('meat_on_bone',      '🍖', '고기',      97, ['protein','fat'],            'elite'),
    e('burger',            '🍔', '버거',      98, ['fat','protein','carb'],     'elite'),
    e('cut_of_meat',       '🥩', '스테이크', 100, ['protein','heavy'],          'elite'),
  ],

  // ══════════════════════════════════════════════════════════════════════
  dessert_stomach: [
    // ── normal (lv1 ~ lv18) ───────────────────────────────────────────
    e('candy',             '🍬', '사탕',       1, ['sugar','hard'],             'normal'),
    e('lollipop',          '🍭', '막대사탕',   4, ['sugar','hard'],             'normal'),
    e('shaved_ice',        '🍧', '빙수',       6, ['sugar','cold'],             'normal'),
    e('icecream',          '🍦', '아이스크림', 9, ['sugar','cold','dairy'],     'normal'),
    e('cookie',            '🍪', '쿠키',      10, ['sugar','dry'],              'normal'),
    e('gelato',            '🍨', '젤라또',    12, ['sugar','cold','dairy'],     'normal'),
    e('pudding',           '🍮', '푸딩',      17, ['sugar','soft'],             'normal'),
    e('cupcake',           '🧁', '컵케이크',  18, ['sugar','cream'],            'normal'),

    // ── strong (lv21 ~ lv53) ─────────────────────────────────────────
    e('chocolate_bar',     '🍫', '초콜릿',    21, ['sugar','cocoa'],            'strong'),
    e('dango',             '🍡', '경단',      25, ['sugar','rice'],             'strong'),
    e('cake',              '🍰', '케이크',    36, ['sugar','dairy'],            'strong'),
    e('milkshake',         '🥤', '밀크셰이크', 37, ['sugar','cold','dairy'],    'strong'),
    e('donut',             '🍩', '도넛',      45, ['sugar','fried'],            'strong'),
    e('boba_dessert',      '🧋', '버블티',    47, ['sugar','topping'],          'strong'),
    e('honey_pot',         '🍯', '꿀',        50, ['sugar','sticky'],           'strong'),
    e('waffle',            '🧇', '와플',      53, ['sugar','baked'],            'strong'),

    // ── elite (lv56 ~ lv80) ──────────────────────────────────────────
    e('pretzel',           '🥨', '프레첼',    56, ['carb','salty'],             'elite'),
    e('croissant',         '🥐', '크루아상',  58, ['carb','fat','baked'],       'elite'),
    e('pancakes',          '🥞', '팬케이크',  64, ['sugar','baked'],            'elite'),
    e('pie',               '🥧', '파이',      65, ['sugar','fat','baked'],      'elite'),
    e('bagel',             '🥯', '베이글',    69, ['carb','dense'],             'elite'),
    e('birthday_cake',     '🎂', '생일케이크', 78, ['sugar','cream','heavy'],   'elite'),
    e('moon_cake',         '🥮', '월병',      80, ['sugar','dense'],            'elite'),
  ],

  // ══════════════════════════════════════════════════════════════════════
  alcohol_stomach: [
    // ── normal (lv3 ~ lv31) ──────────────────────────────────────────
    e('juice',             '🧃', '주스',       3, ['fruit','sugar'],            'normal'),
    e('hot_coffee',        '☕',  '커피',       7, ['caffeine','hot'],           'normal'),
    e('lemon_tea',         '🍋', '레몬티',     14, ['acidic','citrus'],          'normal'),
    e('mate',              '🧉', '마테',       23, ['herbal','fermented'],       'normal'),
    e('beer',              '🍺', '맥주',       31, ['alcohol','soda'],           'normal'),

    // ── strong (lv32 ~ lv48) ─────────────────────────────────────────
    e('cocktail',          '🍸', '칵테일',    32, ['alcohol','sugar'],          'strong'),
    e('tropical_cocktail', '🍹', '트로피컬',  34, ['alcohol','sugar','fruit'],  'strong'),
    e('wine',              '🍷', '와인',      42, ['alcohol','acidic'],         'strong'),
    e('sake',              '🍶', '사케',      43, ['alcohol','fermented'],      'strong'),
    e('coconut_drink',     '🥥', '코코넛음료', 48, ['fruit','fat'],             'strong'),

    // ── elite (lv61 ~ lv89) ──────────────────────────────────────────
    e('clink_beers',       '🍻', '폭탄주',    61, ['alcohol','combo'],          'elite'),
    e('champagne',         '🍾', '샴페인',    73, ['alcohol','soda'],           'elite'),
    e('clinking_glasses',  '🥂', '건배',      76, ['alcohol','soda','combo'],   'elite'),
    e('whisky',            '🥃', '위스키',    89, ['alcohol','high-proof'],     'elite'),
  ],
};

// ── 편의 export ────────────────────────────────────────────────────────────

/** 경로별 emoji 목록 (UI용) */
export const ENEMY_EMOJIS_BY_PATH = Object.fromEntries(
  Object.entries(ENEMY_STATS).map(([path, list]) => [path, list.map(e => e.emoji)])
);

/** 전체 플랫 목록 */
export const ENEMY_STATS_LIST = Object.values(ENEMY_STATS).flat();

/** id → stat 빠른 룩업 */
export const ENEMY_STATS_BY_ID = Object.fromEntries(
  ENEMY_STATS_LIST.map(e => [e.id, e])
);
