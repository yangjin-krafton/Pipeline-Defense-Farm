/**
 * Game configuration constants
 */
export const VIRTUAL_W = 360;
export const VIRTUAL_H = 640;
export const FOOD_SPAWN_MS = 800;
export const BASE_SPEED = 92;
export const EMOJI_CACHE_SIZE = 48;

/**
 * Multiple path system
 * Each path represents different digestive tract
 */
export const PATHS = {
    "rice_stomach": {
      "name": "밥위",
      "color": "#FFD700",
      "points": [
        {
          "x": 150,
          "y": 0
        },
        {
          "x": 150,
          "y": 40
        },
        {
          "x": 190,
          "y": 110
        },
        {
          "x": 160,
          "y": 130
        },
        {
          "x": 130,
          "y": 80
        },
        {
          "x": 190,
          "y": 40
        },
        {
          "x": 230,
          "y": 120
        },
        {
          "x": 200,
          "y": 170
        },
        {
          "x": 160,
          "y": 170
        },
        {
          "x": 160,
          "y": 200
        }
      ]
    },
    "dessert_stomach": {
      "name": "디저트위",
      "color": "#69ffc1",
      "points": [
        {
          "x": 270,
          "y": 0
        },
        {
          "x": 270,
          "y": 40
        },
        {
          "x": 300,
          "y": 110
        },
        {
          "x": 270,
          "y": 130
        },
        {
          "x": 250,
          "y": 80
        },
        {
          "x": 310,
          "y": 40
        },
        {
          "x": 340,
          "y": 120
        },
        {
          "x": 320,
          "y": 170
        },
        {
          "x": 280,
          "y": 170
        },
        {
          "x": 280,
          "y": 200
        }
      ]
    },
    "alcohol_stomach": {
      "name": "술위",
      "color": "#9370DB",
      "points": [
        {
          "x": 30,
          "y": 0
        },
        {
          "x": 30,
          "y": 40
        },
        {
          "x": 80,
          "y": 120
        },
        {
          "x": 50,
          "y": 140
        },
        {
          "x": 20,
          "y": 90
        },
        {
          "x": 80,
          "y": 50
        },
        {
          "x": 120,
          "y": 130
        },
        {
          "x": 100,
          "y": 170
        },
        {
          "x": 50,
          "y": 170
        },
        {
          "x": 50,
          "y": 200
        }
      ]
    },
    "small_intestine": {
      "name": "소장",
      "color": "#ff8daf",
      "points": [
        {
          "x": 280,
          "y": 200
        },
        {
          "x": 50,
          "y": 200
        },
        {
          "x": 50,
          "y": 290
        },
        {
          "x": 290,
          "y": 290
        },
        {
          "x": 290,
          "y": 330
        },
        {
          "x": 70,
          "y": 330
        },
        {
          "x": 70,
          "y": 430
        },
        {
          "x": 120,
          "y": 430
        },
        {
          "x": 120,
          "y": 370
        },
        {
          "x": 180,
          "y": 370
        },
        {
          "x": 180,
          "y": 430
        },
        {
          "x": 230,
          "y": 430
        },
        {
          "x": 230,
          "y": 370
        },
        {
          "x": 290,
          "y": 370
        },
        {
          "x": 290,
          "y": 480
        },
        {
          "x": 70,
          "y": 480
        }
      ]
    },
    "large_intestine": {
      "name": "대장",
      "color": "#ffb048",
      "points": [
        {
          "x": 70,
          "y": 480
        },
        {
          "x": 30,
          "y": 520
        },
        {
          "x": 30,
          "y": 250
        },
        {
          "x": 330,
          "y": 250
        },
        {
          "x": 330,
          "y": 530
        },
        {
          "x": 180,
          "y": 530
        },
        {
          "x": 180,
          "y": 630
        },
        {
          "x": 180,
          "y": 640
        }
      ]
    }
  };

// Backward compatibility: export first path as PATH_POINTS
export const PATH_POINTS = PATHS.rice_stomach.points;

/**
 * Path rendering settings
 */
export const PATH_RENDER_SETTINGS = {
  // Layer multipliers (brightness)
  shadowBrightness: 0.3,    // Shadow layer: 30% of base color
  mainBrightness: 1.0,      // Main layer: 100% of base color
  edgeBrightness: 0.5,      // Edge layer: 50% of base color

  // Layer alpha (transparency)
  shadowAlpha: 1.0,        // Shadow: 100% opacity
  mainAlpha: 1.0,          // Main: 100% opacity
  edgeAlpha: 1.0,           // Edge: 100% opacity

  // Rendering order (back to front)
  renderOrder: ['large_intestine', 'small_intestine', 'alcohol_stomach', 'rice_stomach', 'dessert_stomach']
};

export const TOWER_SLOTS = [
  {
    "x": 250,
    "y": 170,
    "radius": 20
  },
  {
    "x": 130,
    "y": 170,
    "radius": 20
  },
  {
    "x": 120,
    "y": 60,
    "radius": 20
  },
  {
    "x": 240,
    "y": 60,
    "radius": 20
  },
  {
    "x": 40,
    "y": 120,
    "radius": 20
  },
  {
    "x": 330,
    "y": 110,
    "radius": 20
  },
  {
    "x": 70,
    "y": 270,
    "radius": 20
  },
  {
    "x": 300,
    "y": 270,
    "radius": 20
  },
  {
    "x": 100,
    "y": 360,
    "radius": 20
  },
  {
    "x": 200,
    "y": 360,
    "radius": 20
  },
  {
    "x": 150,
    "y": 450,
    "radius": 20
  },
  {
    "x": 260,
    "y": 450,
    "radius": 20
  },
  {
    "x": 80,
    "y": 520,
    "radius": 20
  },
  {
    "x": 180,
    "y": 520,
    "radius": 20
  },
  {
    "x": 60,
    "y": 450,
    "radius": 20
  },
  {
    "x": 300,
    "y": 510,
    "radius": 20
  },
  {
    "x": 180,
    "y": 270,
    "radius": 20
  },
  {
    "x": 300,
    "y": 360,
    "radius": 20
  }
];


/**
 * Base stat table for each food (tower-defense ready data).
 * Values are the baseline used at spawn before temporary effects.
 */
export const FOOD_STAT_TABLE = {
  rice_stomach: [
    { id: "burger", name: "버거", emoji: "🍔", category: "fat", tags: ["fat", "protein", "carb"], hp: 178, armor: 14, speed: 84, size: 35, mass: 1.18, threat: 17, reward: 18, digestionNeed: 128 },
    { id: "pizza", name: "피자", emoji: "🍕", category: "fat", tags: ["fat", "carb", "dairy"], hp: 168, armor: 11, speed: 87, size: 34, mass: 1.1, threat: 15, reward: 17, digestionNeed: 122 },
    { id: "ramen", name: "라면", emoji: "🍜", category: "carb", tags: ["carb", "sodium"], hp: 140, armor: 6, speed: 98, size: 31, mass: 0.97, threat: 12, reward: 14, digestionNeed: 104 },
    { id: "fries", name: "감자튀김", emoji: "🍟", category: "fat", tags: ["fat", "carb", "fried"], hp: 130, armor: 8, speed: 102, size: 30, mass: 0.94, threat: 11, reward: 13, digestionNeed: 96 },
    { id: "spaghetti", name: "파스타", emoji: "🍝", category: "carb", tags: ["carb", "fat"], hp: 152, armor: 7, speed: 92, size: 32, mass: 1.01, threat: 13, reward: 15, digestionNeed: 111 },
    { id: "taco", name: "타코", emoji: "🌮", category: "mixed", tags: ["carb", "protein", "spice"], hp: 126, armor: 5, speed: 106, size: 29, mass: 0.88, threat: 10, reward: 12, digestionNeed: 94 },
    { id: "bento", name: "도시락", emoji: "🍱", category: "mixed", tags: ["carb", "protein", "veggie"], hp: 160, armor: 9, speed: 90, size: 33, mass: 1.08, threat: 14, reward: 16, digestionNeed: 116 },
    { id: "sushi", name: "초밥", emoji: "🍣", category: "protein", tags: ["protein", "light"], hp: 112, armor: 4, speed: 110, size: 27, mass: 0.82, threat: 9, reward: 11, digestionNeed: 86 },
    { id: "sandwich", name: "샌드위치", emoji: "🥪", category: "carb", tags: ["carb", "protein"], hp: 136, armor: 6, speed: 97, size: 30, mass: 0.96, threat: 11, reward: 13, digestionNeed: 101 },
    { id: "burrito", name: "부리또", emoji: "🌯", category: "mixed", tags: ["carb", "fat", "protein"], hp: 172, armor: 10, speed: 86, size: 34, mass: 1.13, threat: 16, reward: 18, digestionNeed: 124 },
    { id: "rice_ball", name: "주먹밥", emoji: "🍙", category: "carb", tags: ["carb", "light"], hp: 116, armor: 4, speed: 109, size: 28, mass: 0.84, threat: 9, reward: 11, digestionNeed: 88 },
    { id: "rice_cracker", name: "쌀과자", emoji: "🍘", category: "carb", tags: ["carb", "dry"], hp: 104, armor: 3, speed: 113, size: 26, mass: 0.76, threat: 8, reward: 10, digestionNeed: 79 },
    { id: "curry_rice", name: "카레라이스", emoji: "🍛", category: "mixed", tags: ["carb", "spice", "sauce"], hp: 162, armor: 8, speed: 91, size: 33, mass: 1.07, threat: 14, reward: 16, digestionNeed: 117 },
    { id: "stew", name: "스튜", emoji: "🍲", category: "mixed", tags: ["protein", "veggie", "soup"], hp: 154, armor: 7, speed: 94, size: 32, mass: 1.02, threat: 13, reward: 15, digestionNeed: 112 },
    { id: "paella", name: "빠에야", emoji: "🥘", category: "mixed", tags: ["carb", "protein", "seafood"], hp: 166, armor: 9, speed: 89, size: 34, mass: 1.1, threat: 15, reward: 17, digestionNeed: 120 },
    { id: "fried_egg", name: "계란후라이", emoji: "🍳", category: "protein", tags: ["protein", "fat"], hp: 122, armor: 5, speed: 104, size: 29, mass: 0.89, threat: 10, reward: 12, digestionNeed: 92 },
    { id: "bacon", name: "베이컨", emoji: "🥓", category: "fat", tags: ["fat", "protein", "salty"], hp: 132, armor: 8, speed: 101, size: 30, mass: 0.95, threat: 12, reward: 13, digestionNeed: 99 },
    { id: "meat_on_bone", name: "고기", emoji: "🍖", category: "protein", tags: ["protein", "fat"], hp: 176, armor: 12, speed: 85, size: 35, mass: 1.16, threat: 17, reward: 18, digestionNeed: 127 },
    { id: "poultry_leg", name: "치킨다리", emoji: "🍗", category: "protein", tags: ["protein", "fat"], hp: 164, armor: 10, speed: 88, size: 34, mass: 1.09, threat: 15, reward: 17, digestionNeed: 121 },
    { id: "cut_of_meat", name: "스테이크", emoji: "🥩", category: "protein", tags: ["protein", "heavy"], hp: 182, armor: 13, speed: 82, size: 36, mass: 1.2, threat: 18, reward: 19, digestionNeed: 132 },
    { id: "fried_shrimp", name: "새우튀김", emoji: "🍤", category: "protein", tags: ["protein", "fried"], hp: 128, armor: 6, speed: 103, size: 29, mass: 0.9, threat: 11, reward: 13, digestionNeed: 97 },
    { id: "dumpling", name: "만두", emoji: "🥟", category: "mixed", tags: ["carb", "protein", "steamed"], hp: 142, armor: 7, speed: 96, size: 31, mass: 0.98, threat: 12, reward: 14, digestionNeed: 106 },
    { id: "fortune_cookie", name: "포춘쿠키", emoji: "🥠", category: "carb", tags: ["carb", "sweet"], hp: 102, armor: 3, speed: 115, size: 26, mass: 0.75, threat: 8, reward: 10, digestionNeed: 77 },
    { id: "takeout_box", name: "테이크아웃", emoji: "🥡", category: "mixed", tags: ["carb", "oil"], hp: 158, armor: 8, speed: 93, size: 32, mass: 1.04, threat: 13, reward: 15, digestionNeed: 114 },
    { id: "tamale", name: "타말레", emoji: "🫔", category: "carb", tags: ["carb", "protein", "corn"], hp: 148, armor: 7, speed: 95, size: 31, mass: 1.0, threat: 12, reward: 14, digestionNeed: 109 },
    { id: "stuffed_flatbread", name: "팔라펠랩", emoji: "🥙", category: "mixed", tags: ["carb", "veggie", "protein"], hp: 144, armor: 6, speed: 97, size: 31, mass: 0.99, threat: 12, reward: 14, digestionNeed: 107 },
    { id: "cooked_rice", name: "밥", emoji: "🍚", category: "carb", tags: ["carb", "plain"], hp: 114, armor: 4, speed: 110, size: 28, mass: 0.83, threat: 9, reward: 11, digestionNeed: 87 }
  ],
  dessert_stomach: [
    { id: "cake", name: "케이크", emoji: "🍰", category: "sugar", tags: ["sugar", "dairy"], hp: 118, armor: 3, speed: 103, size: 30, mass: 0.9, threat: 10, reward: 11, digestionNeed: 88 },
    { id: "donut", name: "도넛", emoji: "🍩", category: "sugar", tags: ["sugar", "fried"], hp: 124, armor: 5, speed: 107, size: 29, mass: 0.92, threat: 11, reward: 12, digestionNeed: 91 },
    { id: "cupcake", name: "컵케이크", emoji: "🧁", category: "sugar", tags: ["sugar", "cream"], hp: 106, armor: 2, speed: 112, size: 27, mass: 0.8, threat: 8, reward: 10, digestionNeed: 79 },
    { id: "cookie", name: "쿠키", emoji: "🍪", category: "sugar", tags: ["sugar", "dry"], hp: 98, armor: 4, speed: 114, size: 26, mass: 0.76, threat: 8, reward: 9, digestionNeed: 74 },
    { id: "birthday_cake", name: "생일케이크", emoji: "🎂", category: "sugar", tags: ["sugar", "cream", "heavy"], hp: 146, armor: 6, speed: 97, size: 33, mass: 1.03, threat: 13, reward: 15, digestionNeed: 108 },
    { id: "pudding", name: "푸딩", emoji: "🍮", category: "sugar", tags: ["sugar", "soft"], hp: 102, armor: 2, speed: 108, size: 27, mass: 0.81, threat: 8, reward: 10, digestionNeed: 77 },
    { id: "icecream", name: "아이스크림", emoji: "🍦", category: "dairy", tags: ["sugar", "cold", "dairy"], hp: 95, armor: 1, speed: 116, size: 26, mass: 0.74, threat: 8, reward: 9, digestionNeed: 72 },
    { id: "gelato", name: "젤라또", emoji: "🍨", category: "dairy", tags: ["sugar", "cold", "dairy"], hp: 100, armor: 1, speed: 114, size: 26, mass: 0.77, threat: 8, reward: 9, digestionNeed: 75 },
    { id: "shaved_ice", name: "빙수", emoji: "🍧", category: "sugar", tags: ["sugar", "cold"], hp: 92, armor: 0, speed: 119, size: 25, mass: 0.7, threat: 7, reward: 8, digestionNeed: 69 },
    { id: "pie", name: "파이", emoji: "🥧", category: "fat", tags: ["sugar", "fat", "baked"], hp: 138, armor: 7, speed: 100, size: 32, mass: 1.0, threat: 12, reward: 14, digestionNeed: 103 },
    { id: "chocolate_bar", name: "초콜릿", emoji: "🍫", category: "sugar", tags: ["sugar", "cocoa"], hp: 110, armor: 4, speed: 111, size: 27, mass: 0.83, threat: 9, reward: 10, digestionNeed: 82 },
    { id: "candy", name: "사탕", emoji: "🍬", category: "sugar", tags: ["sugar", "hard"], hp: 90, armor: 1, speed: 121, size: 24, mass: 0.67, threat: 7, reward: 8, digestionNeed: 66 },
    { id: "lollipop", name: "막대사탕", emoji: "🍭", category: "sugar", tags: ["sugar", "hard"], hp: 94, armor: 1, speed: 120, size: 25, mass: 0.69, threat: 7, reward: 8, digestionNeed: 68 },
    { id: "dango", name: "경단", emoji: "🍡", category: "sugar", tags: ["sugar", "rice"], hp: 112, armor: 3, speed: 108, size: 28, mass: 0.85, threat: 9, reward: 10, digestionNeed: 84 },
    { id: "honey_pot", name: "꿀", emoji: "🍯", category: "sugar", tags: ["sugar", "sticky"], hp: 126, armor: 6, speed: 101, size: 30, mass: 0.94, threat: 11, reward: 12, digestionNeed: 95 },
    { id: "waffle", name: "와플", emoji: "🧇", category: "sugar", tags: ["sugar", "baked"], hp: 130, armor: 5, speed: 104, size: 30, mass: 0.96, threat: 11, reward: 12, digestionNeed: 97 },
    { id: "pancakes", name: "팬케이크", emoji: "🥞", category: "sugar", tags: ["sugar", "baked"], hp: 136, armor: 6, speed: 101, size: 31, mass: 0.99, threat: 12, reward: 13, digestionNeed: 101 },
    { id: "croissant", name: "크루아상", emoji: "🥐", category: "fat", tags: ["carb", "fat", "baked"], hp: 132, armor: 6, speed: 102, size: 31, mass: 0.97, threat: 11, reward: 13, digestionNeed: 99 },
    { id: "bagel", name: "베이글", emoji: "🥯", category: "carb", tags: ["carb", "dense"], hp: 140, armor: 7, speed: 98, size: 32, mass: 1.01, threat: 12, reward: 14, digestionNeed: 105 },
    { id: "moon_cake", name: "월병", emoji: "🥮", category: "sugar", tags: ["sugar", "dense"], hp: 148, armor: 8, speed: 95, size: 33, mass: 1.05, threat: 13, reward: 15, digestionNeed: 110 },
    { id: "pretzel", name: "프레첼", emoji: "🥨", category: "carb", tags: ["carb", "salty"], hp: 134, armor: 5, speed: 103, size: 30, mass: 0.95, threat: 11, reward: 12, digestionNeed: 98 },
    { id: "milkshake", name: "밀크셰이크", emoji: "🥤", category: "dairy", tags: ["sugar", "cold", "dairy"], hp: 122, armor: 4, speed: 107, size: 29, mass: 0.91, threat: 10, reward: 12, digestionNeed: 90 },
    { id: "boba_dessert", name: "디저트 버블티", emoji: "🧋", category: "sugar", tags: ["sugar", "topping"], hp: 128, armor: 5, speed: 106, size: 29, mass: 0.93, threat: 11, reward: 12, digestionNeed: 94 }
  ],
  alcohol_stomach: [
    { id: "beer", name: "맥주", emoji: "🍺", category: "alcohol", tags: ["alcohol", "carbonated"], hp: 104, armor: 3, speed: 106, size: 28, mass: 0.84, threat: 10, reward: 11, digestionNeed: 80 },
    { id: "clink_beers", name: "폭탄주", emoji: "🍻", category: "alcohol", tags: ["alcohol", "combo"], hp: 126, armor: 6, speed: 103, size: 30, mass: 0.93, threat: 12, reward: 13, digestionNeed: 95 },
    { id: "wine", name: "와인", emoji: "🍷", category: "alcohol", tags: ["alcohol", "acidic"], hp: 114, armor: 4, speed: 108, size: 28, mass: 0.86, threat: 11, reward: 12, digestionNeed: 86 },
    { id: "cocktail", name: "칵테일", emoji: "🍸", category: "alcohol", tags: ["alcohol", "sugar"], hp: 110, armor: 3, speed: 111, size: 27, mass: 0.82, threat: 10, reward: 11, digestionNeed: 83 },
    { id: "tropical_cocktail", name: "트로피컬", emoji: "🍹", category: "alcohol", tags: ["alcohol", "sugar", "fruit"], hp: 112, armor: 3, speed: 110, size: 27, mass: 0.83, threat: 10, reward: 11, digestionNeed: 84 },
    { id: "whisky", name: "위스키", emoji: "🥃", category: "alcohol", tags: ["alcohol", "high-proof"], hp: 146, armor: 10, speed: 96, size: 31, mass: 1.04, threat: 15, reward: 16, digestionNeed: 111 },
    { id: "champagne", name: "샴페인", emoji: "🍾", category: "alcohol", tags: ["alcohol", "sparkling"], hp: 128, armor: 7, speed: 101, size: 30, mass: 0.95, threat: 13, reward: 14, digestionNeed: 98 },
    { id: "juice", name: "주스", emoji: "🧃", category: "sugar", tags: ["fruit", "sugar"], hp: 88, armor: 1, speed: 120, size: 25, mass: 0.68, threat: 7, reward: 8, digestionNeed: 67 },
    { id: "clinking_glasses", name: "건배", emoji: "🥂", category: "alcohol", tags: ["alcohol", "sparkling", "combo"], hp: 134, armor: 7, speed: 100, size: 30, mass: 0.97, threat: 13, reward: 14, digestionNeed: 101 },
    { id: "sake", name: "사케", emoji: "🍶", category: "alcohol", tags: ["alcohol", "fermented"], hp: 118, armor: 5, speed: 106, size: 28, mass: 0.88, threat: 11, reward: 12, digestionNeed: 89 },
    { id: "mate", name: "마테", emoji: "🧉", category: "fermented", tags: ["herbal", "fermented"], hp: 108, armor: 4, speed: 110, size: 27, mass: 0.81, threat: 9, reward: 10, digestionNeed: 82 },
    { id: "hot_coffee", name: "커피", emoji: "☕", category: "caffeine", tags: ["caffeine", "hot"], hp: 92, armor: 2, speed: 122, size: 25, mass: 0.7, threat: 8, reward: 9, digestionNeed: 71 },
    { id: "coconut_drink", name: "코코넛음료", emoji: "🥥", category: "sugar", tags: ["fruit", "fat"], hp: 124, armor: 6, speed: 103, size: 29, mass: 0.93, threat: 11, reward: 12, digestionNeed: 94 },
    { id: "lemon_tea", name: "레몬티", emoji: "🍋", category: "acidic", tags: ["acidic", "citrus"], hp: 100, armor: 2, speed: 117, size: 25, mass: 0.74, threat: 8, reward: 9, digestionNeed: 76 }
  ],
  small_intestine: [],
  large_intestine: []
};

export const FOOD_BY_PATH = Object.fromEntries(
  Object.entries(FOOD_STAT_TABLE).map(([pathKey, foods]) => [
    pathKey,
    foods.map((food) => food.emoji)
  ])
);

export const FOOD_STATS_BY_PATH = FOOD_STAT_TABLE;
export const FOOD_STATS_LIST = Object.values(FOOD_STAT_TABLE).flat();

// Legacy support
export const FOOD_EMOJIS = FOOD_BY_PATH.rice_stomach;
