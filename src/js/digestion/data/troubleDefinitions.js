export const TROUBLE_TYPES = {
  CONGESTION: 'congestion',
  ACIDITY: 'acidity'
};

export const CONGESTION_CONFIG = {
  increasePerFood: 1,              // Per food entity alive
  decreasePerSecond: 2,            // Natural decay
  thresholds: {
    WARNING: 50,
    DANGER: 100,
    CRITICAL: 150
  }
};

export const ACIDITY_CONFIG = {
  stomachPaths: ['rice_stomach', 'dessert_stomach', 'alcohol_stomach'],
  increasePerSecond: 1.5,          // While food in stomach
  decreasePerSecond: 3,            // When stomach empty
  thresholds: {
    WARNING: 30,
    DANGER: 60,
    CRITICAL: 90
  }
};
