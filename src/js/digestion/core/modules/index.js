/**
 * 모듈 시스템 통합 export
 */
export { BaseModule } from './BaseModule.js';
export { TargetingModule } from './TargetingModule.js';
export { DamageModule } from './DamageModule.js';
export { ProjectileModule } from './ProjectileModule.js';
export { TagBonusModule } from './TagBonusModule.js';
export { StatusModule, createMultiStatusModule } from './StatusModule.js';
export { TriggerModule, TriggerEffects } from './TriggerModule.js';
export { ResourceModule } from './ResourceModule.js';
export { SafetyModule } from './SafetyModule.js';
export { AuraModule } from './AuraModule.js';
export { UnitModule } from './UnitModule.js';

/**
 * 모듈 코드 매핑
 */
export const MODULE_CODES = {
  TM: 'TargetingModule',
  PM: 'ProjectileModule',
  DM: 'DamageModule',
  TB: 'TagBonusModule',
  SM: 'StatusModule',
  TR: 'TriggerModule',
  RM: 'ResourceModule',
  SF: 'SafetyModule',
  AM: 'AuraModule',
  UM: 'UnitModule'
};
