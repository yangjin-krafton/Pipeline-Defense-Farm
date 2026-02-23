/**
 * Layer A — Enemy Stat Table
 *
 * 각 emoji 적의 고유 스탯. 스케일링 없는 순수 베이스 값.
 * - hp      : 기본 체력
 * - armor   : 방어구 (DifficultyEngine 스케일링 후 → BaseTower 에서 1 - armor*0.01 감소)
 * - speed   : 이동 속도 (px/s)
 * - types[] : 타워 태그보너스 연결, 상태이상 저항 계산에 사용
 * - tier    : 'normal' | 'strong' | 'elite'
 * - size    : 렌더 크기 (px)
 * - reward  : 처치 시 지급 SC
 *
 * 제거된 필드: threat, digestionNeed, mass, category, strengthTier, resist
 * → tier 로 통합 / DifficultyEngine 이 스케일 처리
 */

export const ENEMY_STATS = {
  rice_stomach: [
    // ── normal ─────────────────────────────────────────────────────────
    { id: 'rice_cracker',     emoji: '🍘', name: '쌀과자',    hp: 104, armor: 3,  speed: 113, types: ['carb','dry'],              tier: 'normal', size: 26, reward: 10 },
    { id: 'rice_ball',        emoji: '🍙', name: '주먹밥',    hp: 116, armor: 4,  speed: 109, types: ['carb','light'],             tier: 'normal', size: 28, reward: 11 },
    { id: 'cooked_rice',      emoji: '🍚', name: '밥',        hp: 114, armor: 4,  speed: 110, types: ['carb','plain'],             tier: 'normal', size: 28, reward: 11 },
    { id: 'fortune_cookie',   emoji: '🥠', name: '포춘쿠키',  hp: 102, armor: 3,  speed: 115, types: ['carb','sweet'],             tier: 'normal', size: 26, reward: 10 },
    { id: 'sushi',            emoji: '🍣', name: '초밥',      hp: 112, armor: 4,  speed: 110, types: ['protein','light'],          tier: 'normal', size: 27, reward: 11 },
    { id: 'fried_egg',        emoji: '🍳', name: '계란후라이', hp: 122, armor: 5, speed: 104, types: ['protein','fat'],            tier: 'normal', size: 29, reward: 12 },
    { id: 'taco',             emoji: '🌮', name: '타코',      hp: 126, armor: 5,  speed: 106, types: ['carb','protein','spicy'],   tier: 'normal', size: 29, reward: 12 },
    // ── strong ─────────────────────────────────────────────────────────
    { id: 'ramen',            emoji: '🍜', name: '라면',      hp: 140, armor: 6,  speed: 98,  types: ['carb','sodium'],            tier: 'strong', size: 31, reward: 14 },
    { id: 'spaghetti',        emoji: '🍝', name: '파스타',    hp: 152, armor: 7,  speed: 92,  types: ['carb','fat'],               tier: 'strong', size: 32, reward: 15 },
    { id: 'sandwich',         emoji: '🥪', name: '샌드위치',  hp: 136, armor: 6,  speed: 97,  types: ['carb','protein'],           tier: 'strong', size: 30, reward: 13 },
    { id: 'fried_shrimp',     emoji: '🍤', name: '새우튀김',  hp: 128, armor: 6,  speed: 103, types: ['protein','fried'],          tier: 'strong', size: 29, reward: 13 },
    { id: 'dumpling',         emoji: '🥟', name: '만두',      hp: 142, armor: 7,  speed: 96,  types: ['carb','protein','steamed'], tier: 'strong', size: 31, reward: 14 },
    { id: 'fries',            emoji: '🍟', name: '감자튀김',  hp: 130, armor: 8,  speed: 102, types: ['fat','carb','fried'],       tier: 'strong', size: 30, reward: 13 },
    { id: 'bacon',            emoji: '🥓', name: '베이컨',    hp: 132, armor: 8,  speed: 101, types: ['fat','protein','salty'],    tier: 'strong', size: 30, reward: 13 },
    { id: 'stew',             emoji: '🍲', name: '스튜',      hp: 154, armor: 7,  speed: 94,  types: ['protein','veggie','soup'],  tier: 'strong', size: 32, reward: 15 },
    { id: 'bento',            emoji: '🍱', name: '도시락',    hp: 160, armor: 9,  speed: 90,  types: ['carb','protein','veggie'],  tier: 'strong', size: 33, reward: 16 },
    { id: 'curry_rice',       emoji: '🍛', name: '카레라이스', hp: 162, armor: 8, speed: 91,  types: ['carb','spicy','sauce'],     tier: 'strong', size: 33, reward: 16 },
    { id: 'takeout_box',      emoji: '🥡', name: '테이크아웃', hp: 158, armor: 8, speed: 93,  types: ['carb','oil'],               tier: 'strong', size: 32, reward: 15 },
    { id: 'tamale',           emoji: '🫔', name: '타말레',    hp: 148, armor: 7,  speed: 95,  types: ['carb','protein','corn'],    tier: 'strong', size: 31, reward: 14 },
    { id: 'stuffed_flatbread',emoji: '🥙', name: '팔라펠랩',  hp: 144, armor: 6,  speed: 97,  types: ['carb','veggie','protein'],  tier: 'strong', size: 31, reward: 14 },
    // ── elite ──────────────────────────────────────────────────────────
    { id: 'burger',           emoji: '🍔', name: '버거',      hp: 178, armor: 14, speed: 84,  types: ['fat','protein','carb'],     tier: 'elite',  size: 35, reward: 18 },
    { id: 'pizza',            emoji: '🍕', name: '피자',      hp: 168, armor: 11, speed: 87,  types: ['fat','carb','dairy'],       tier: 'elite',  size: 34, reward: 17 },
    { id: 'burrito',          emoji: '🌯', name: '부리또',    hp: 172, armor: 10, speed: 86,  types: ['carb','fat','protein'],     tier: 'elite',  size: 34, reward: 18 },
    { id: 'cut_of_meat',      emoji: '🥩', name: '스테이크',  hp: 182, armor: 13, speed: 82,  types: ['protein','heavy'],          tier: 'elite',  size: 36, reward: 19 },
    { id: 'meat_on_bone',     emoji: '🍖', name: '고기',      hp: 176, armor: 12, speed: 85,  types: ['protein','fat'],            tier: 'elite',  size: 35, reward: 18 },
    { id: 'paella',           emoji: '🥘', name: '빠에야',    hp: 166, armor: 9,  speed: 89,  types: ['carb','protein','seafood'], tier: 'elite',  size: 34, reward: 17 },
    { id: 'poultry_leg',      emoji: '🍗', name: '치킨다리',  hp: 164, armor: 10, speed: 88,  types: ['protein','fat'],            tier: 'elite',  size: 34, reward: 17 },
  ],

  dessert_stomach: [
    // ── normal ─────────────────────────────────────────────────────────
    { id: 'candy',            emoji: '🍬', name: '사탕',      hp: 90,  armor: 1,  speed: 121, types: ['sugar','hard'],             tier: 'normal', size: 24, reward: 8  },
    { id: 'lollipop',         emoji: '🍭', name: '막대사탕',  hp: 94,  armor: 1,  speed: 120, types: ['sugar','hard'],             tier: 'normal', size: 25, reward: 8  },
    { id: 'shaved_ice',       emoji: '🍧', name: '빙수',      hp: 92,  armor: 0,  speed: 119, types: ['sugar','cold'],             tier: 'normal', size: 25, reward: 8  },
    { id: 'pudding',          emoji: '🍮', name: '푸딩',      hp: 102, armor: 2,  speed: 108, types: ['sugar','soft'],             tier: 'normal', size: 27, reward: 10 },
    { id: 'icecream',         emoji: '🍦', name: '아이스크림', hp: 95, armor: 1,  speed: 116, types: ['sugar','cold','dairy'],     tier: 'normal', size: 26, reward: 9  },
    { id: 'gelato',           emoji: '🍨', name: '젤라또',    hp: 100, armor: 1,  speed: 114, types: ['sugar','cold','dairy'],     tier: 'normal', size: 26, reward: 9  },
    { id: 'cookie',           emoji: '🍪', name: '쿠키',      hp: 98,  armor: 4,  speed: 114, types: ['sugar','dry'],              tier: 'normal', size: 26, reward: 9  },
    { id: 'dango',            emoji: '🍡', name: '경단',      hp: 112, armor: 3,  speed: 108, types: ['sugar','rice'],             tier: 'normal', size: 28, reward: 10 },
    { id: 'milkshake',        emoji: '🥤', name: '밀크셰이크', hp: 122, armor: 4, speed: 107, types: ['sugar','cold','dairy'],     tier: 'normal', size: 29, reward: 12 },
    // ── strong ─────────────────────────────────────────────────────────
    { id: 'cake',             emoji: '🍰', name: '케이크',    hp: 118, armor: 3,  speed: 103, types: ['sugar','dairy'],            tier: 'strong', size: 30, reward: 11 },
    { id: 'donut',            emoji: '🍩', name: '도넛',      hp: 124, armor: 5,  speed: 107, types: ['sugar','fried'],            tier: 'strong', size: 29, reward: 12 },
    { id: 'cupcake',          emoji: '🧁', name: '컵케이크',  hp: 106, armor: 2,  speed: 112, types: ['sugar','cream'],            tier: 'strong', size: 27, reward: 10 },
    { id: 'chocolate_bar',    emoji: '🍫', name: '초콜릿',    hp: 110, armor: 4,  speed: 111, types: ['sugar','cocoa'],            tier: 'strong', size: 27, reward: 10 },
    { id: 'boba_dessert',     emoji: '🧋', name: '디저트버블티',hp:128, armor: 5,  speed: 106, types: ['sugar','topping'],          tier: 'strong', size: 29, reward: 12 },
    { id: 'croissant',        emoji: '🥐', name: '크루아상',  hp: 132, armor: 6,  speed: 102, types: ['carb','fat','baked'],       tier: 'strong', size: 31, reward: 13 },
    { id: 'bagel',            emoji: '🥯', name: '베이글',    hp: 140, armor: 7,  speed: 98,  types: ['carb','dense'],             tier: 'strong', size: 32, reward: 14 },
    { id: 'pretzel',          emoji: '🥨', name: '프레첼',    hp: 134, armor: 5,  speed: 103, types: ['carb','salty'],             tier: 'strong', size: 30, reward: 12 },
    // ── elite ──────────────────────────────────────────────────────────
    { id: 'birthday_cake',    emoji: '🎂', name: '생일케이크', hp: 146, armor: 6, speed: 97,  types: ['sugar','cream','heavy'],    tier: 'elite',  size: 33, reward: 15 },
    { id: 'moon_cake',        emoji: '🥮', name: '월병',      hp: 148, armor: 8,  speed: 95,  types: ['sugar','dense'],            tier: 'elite',  size: 33, reward: 15 },
    { id: 'pie',              emoji: '🥧', name: '파이',      hp: 138, armor: 7,  speed: 100, types: ['sugar','fat','baked'],      tier: 'elite',  size: 32, reward: 14 },
    { id: 'waffle',           emoji: '🧇', name: '와플',      hp: 130, armor: 5,  speed: 104, types: ['sugar','baked'],            tier: 'elite',  size: 30, reward: 12 },
    { id: 'pancakes',         emoji: '🥞', name: '팬케이크',  hp: 136, armor: 6,  speed: 101, types: ['sugar','baked'],            tier: 'elite',  size: 31, reward: 13 },
    { id: 'honey_pot',        emoji: '🍯', name: '꿀',        hp: 126, armor: 6,  speed: 101, types: ['sugar','sticky'],           tier: 'elite',  size: 30, reward: 12 },
  ],

  alcohol_stomach: [
    // ── normal ─────────────────────────────────────────────────────────
    { id: 'juice',            emoji: '🧃', name: '주스',      hp: 88,  armor: 1,  speed: 120, types: ['fruit','sugar'],            tier: 'normal', size: 25, reward: 8  },
    { id: 'lemon_tea',        emoji: '🍋', name: '레몬티',    hp: 100, armor: 2,  speed: 117, types: ['acidic','citrus'],          tier: 'normal', size: 25, reward: 9  },
    { id: 'hot_coffee',       emoji: '☕',  name: '커피',      hp: 92,  armor: 2,  speed: 122, types: ['caffeine','hot'],           tier: 'normal', size: 25, reward: 9  },
    { id: 'cocktail',         emoji: '🍸', name: '칵테일',    hp: 110, armor: 3,  speed: 111, types: ['alcohol','sugar'],          tier: 'normal', size: 27, reward: 11 },
    // ── strong ─────────────────────────────────────────────────────────
    { id: 'beer',             emoji: '🍺', name: '맥주',      hp: 104, armor: 3,  speed: 106, types: ['alcohol','soda'],           tier: 'strong', size: 28, reward: 11 },
    { id: 'wine',             emoji: '🍷', name: '와인',      hp: 114, armor: 4,  speed: 108, types: ['alcohol','acidic'],         tier: 'strong', size: 28, reward: 12 },
    { id: 'tropical_cocktail',emoji: '🍹', name: '트로피컬',  hp: 112, armor: 3,  speed: 110, types: ['alcohol','sugar','fruit'],  tier: 'strong', size: 27, reward: 11 },
    { id: 'sake',             emoji: '🍶', name: '사케',      hp: 118, armor: 5,  speed: 106, types: ['alcohol','fermented'],      tier: 'strong', size: 28, reward: 12 },
    { id: 'mate',             emoji: '🧉', name: '마테',      hp: 108, armor: 4,  speed: 110, types: ['herbal','fermented'],       tier: 'strong', size: 27, reward: 10 },
    { id: 'coconut_drink',    emoji: '🥥', name: '코코넛음료', hp: 124, armor: 6, speed: 103, types: ['fruit','fat'],              tier: 'strong', size: 29, reward: 12 },
    // ── elite ──────────────────────────────────────────────────────────
    { id: 'whisky',           emoji: '🥃', name: '위스키',    hp: 146, armor: 10, speed: 96,  types: ['alcohol','high-proof'],     tier: 'elite',  size: 31, reward: 16 },
    { id: 'champagne',        emoji: '🍾', name: '샴페인',    hp: 128, armor: 7,  speed: 101, types: ['alcohol','soda'],           tier: 'elite',  size: 30, reward: 14 },
    { id: 'clink_beers',      emoji: '🍻', name: '폭탄주',    hp: 126, armor: 6,  speed: 103, types: ['alcohol','combo'],          tier: 'elite',  size: 30, reward: 13 },
    { id: 'clinking_glasses', emoji: '🥂', name: '건배',      hp: 134, armor: 7,  speed: 100, types: ['alcohol','soda','combo'],   tier: 'elite',  size: 30, reward: 14 },
  ],
};

/** 경로별 emoji 목록 (렌더/UI용) */
export const ENEMY_EMOJIS_BY_PATH = Object.fromEntries(
  Object.entries(ENEMY_STATS).map(([path, list]) => [path, list.map(e => e.emoji)])
);

/** 전체 플랫 목록 */
export const ENEMY_STATS_LIST = Object.values(ENEMY_STATS).flat();

/** id → stat 빠른 룩업 */
export const ENEMY_STATS_BY_ID = Object.fromEntries(
  ENEMY_STATS_LIST.map(e => [e.id, e])
);
