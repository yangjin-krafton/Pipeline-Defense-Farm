export const EfficiencyState = {
  STARVED: 'STARVED',
  NORMAL: 'NORMAL',
  BOOSTED: 'BOOSTED',
  OVERCHARGED: 'OVERCHARGED'
};

export const EFFICIENCY_MULTIPLIERS = {
  [EfficiencyState.STARVED]: 0.5,
  [EfficiencyState.NORMAL]: 1.0,
  [EfficiencyState.BOOSTED]: 2.0,
  [EfficiencyState.OVERCHARGED]: 3.0
};
