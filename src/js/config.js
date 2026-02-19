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
 * Food emojis for each path
 */
export const FOOD_BY_PATH = {
  rice_stomach: ["🍔", "🍕", "🍜", "🍟", "🍝", "🌮", "🍱", "🍣", "🥪", "🌯"],
  dessert_stomach: ["🍰", "🍩", "🧁", "🍪", "🎂", "🍮", "🍦", "🍨", "🍧", "🥧"],
  alcohol_stomach: ["🍺", "🍻", "🍷", "🍸", "🍹", "🥃", "🍾", "🧃", "🥤", "🧋"],
  small_intestine: [], // Will receive food from stomachs
  large_intestine: [] // Will receive from small intestine
};

// Legacy support
export const FOOD_EMOJIS = FOOD_BY_PATH.rice_stomach;
