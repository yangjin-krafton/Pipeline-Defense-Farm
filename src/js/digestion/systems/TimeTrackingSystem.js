import { NC_CONFIG, SC_CONFIG } from '../data/economyDefinitions.js';

/**
 * 시간 추적 시스템
 * - 플레이 시간 추적
 * - 일일 리셋 (00:00) 감지
 * - 60분 접속 보너스
 * - 일일 접속 보너스
 */
export class TimeTrackingSystem {
  constructor() {
    // 플레이 시간 추적
    this.totalPlaytime = 0;        // 총 플레이 시간 (초)
    this.sessionPlaytime = 0;      // 현재 세션 플레이 시간 (초)

    // 보너스 추적
    this.lastHourlyBonusTime = 0;  // 마지막 시간 보너스 시각 (초)
    this.lastDailyResetDate = this._getCurrentDate();  // 마지막 일일 리셋 날짜

    // 일일 보너스 수령 여부
    this.dailyBonusClaimed = false;

    // 시간 누적기
    this.hourlyBonusAccumulator = 0;

    // 1시간 보너스 수령 대기 여부
    this.hourlyBonusReady = false;

    // 6시간 보상 추적 (아침/점심/저녁/새벽)
    this.sixHourRewards = {
      claimed: {
        '06:00': false,  // 아침 6시
        '12:00': false,  // 점심 12시
        '18:00': false,  // 저녁 6시
        '00:00': false   // 새벽 0시
      },
      lastCheckHour: -1
    };

    console.log('[TimeTrackingSystem] Initialized');
  }

  /**
   * 현재 날짜 (YYYY-MM-DD)
   */
  _getCurrentDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /**
   * 매 프레임 호출
   * @param {number} dt - delta time (초)
   * @param {EconomySystem} economySystem - 경제 시스템 (보너스 지급용)
   */
  update(dt, economySystem) {
    // 플레이 시간 누적
    this.totalPlaytime += dt;
    this.sessionPlaytime += dt;

    // 일일 리셋 체크
    this._checkDailyReset();

    // 60분 접속 보너스 체크
    this._checkHourlyBonus(dt, economySystem);

    // 6시간 보상 체크
    this._checkSixHourRewards();
  }

  /**
   * 일일 리셋 체크 (00:00)
   */
  _checkDailyReset() {
    const currentDate = this._getCurrentDate();
    if (currentDate !== this.lastDailyResetDate) {
      console.log(`[TimeTrackingSystem] Daily reset: ${this.lastDailyResetDate} -> ${currentDate}`);
      this.lastDailyResetDate = currentDate;
      this.dailyBonusClaimed = false;  // 일일 보너스 리셋

      // 6시간 보상 리셋
      this.sixHourRewards.claimed = {
        '06:00': false,
        '12:00': false,
        '18:00': false,
        '00:00': false
      };
      console.log('[TimeTrackingSystem] 6-hour rewards reset');
    }
  }

  /**
   * 60분 접속 보너스 체크 (수동 수령 방식)
   */
  _checkHourlyBonus(dt, economySystem) {
    this.hourlyBonusAccumulator += dt;

    // 60분(3600초) 경과 시 수령 가능 상태로 변경
    if (this.hourlyBonusAccumulator >= 3600 && !this.hourlyBonusReady) {
      this.hourlyBonusReady = true;
      console.log(`[TimeTrackingSystem] Hourly bonus ready for claim (+10 SC)`);
    }
  }

  /**
   * 1시간 보너스 수령 (수동)
   * @param {EconomySystem} economySystem
   * @returns {{success: boolean, sc?: number, reason?: string}}
   */
  claimHourlyReward(economySystem) {
    if (!this.hourlyBonusReady) {
      const remaining = this.getTimeUntilNextHourlyBonus();
      const minutes = Math.ceil(remaining / 60);
      return {
        success: false,
        reason: `아직 수령할 수 없습니다 (${minutes}분 남음)`
      };
    }

    const bonus = SC_CONFIG.hourlyLoginBonus;  // 10 SC
    economySystem.earnSCBonus(bonus);  // 상한 초과 허용

    this.hourlyBonusReady = false;
    this.hourlyBonusAccumulator -= 3600;  // 1시간 차감
    this.lastHourlyBonusTime = this.totalPlaytime;

    console.log(`[TimeTrackingSystem] Hourly bonus claimed: +${bonus} SC`);

    return {
      success: true,
      sc: bonus
    };
  }

  /**
   * 일일 접속 보너스 수령
   * @param {EconomySystem} economySystem
   * @returns {boolean} 수령 성공 여부
   */
  claimDailyBonus(economySystem) {
    if (this.dailyBonusClaimed) {
      console.warn('[TimeTrackingSystem] Daily bonus already claimed today');
      return false;
    }

    const ncBonus = NC_CONFIG.dailyLoginBonus;
    const scBonus = SC_CONFIG.dailyLoginBonus;

    economySystem.earnNC(ncBonus);
    economySystem.earnSCBonus(scBonus);  // 상한 초과 허용

    this.dailyBonusClaimed = true;

    console.log(`[TimeTrackingSystem] Daily bonus claimed: +${ncBonus} NC, +${scBonus} SC`);

    return true;
  }

  /**
   * 총 플레이 시간 (초)
   */
  getTotalPlaytime() {
    return this.totalPlaytime;
  }

  /**
   * 현재 세션 플레이 시간 (초)
   */
  getSessionPlaytime() {
    return this.sessionPlaytime;
  }

  /**
   * 마지막 시간 보너스 이후 경과 시간 (초)
   */
  getTimeSinceLastHourlyBonus() {
    return this.totalPlaytime - this.lastHourlyBonusTime;
  }

  /**
   * 다음 시간 보너스까지 남은 시간 (초)
   */
  getTimeUntilNextHourlyBonus() {
    return Math.max(0, 3600 - this.hourlyBonusAccumulator);
  }

  /**
   * 일일 보너스 수령 가능 여부
   */
  canClaimDailyBonus() {
    return !this.dailyBonusClaimed;
  }

  /**
   * 1시간 보너스 수령 가능 여부
   */
  canClaimHourlyReward() {
    return this.hourlyBonusReady;
  }

  /**
   * 6시간 보상 체크 (아침/점심/저녁/새벽)
   */
  _checkSixHourRewards() {
    const now = new Date();
    const currentHour = now.getHours();

    // 시간대별 체크 (6시, 12시, 18시, 0시)
    const rewardHours = [6, 12, 18, 0];
    const rewardKeys = ['06:00', '12:00', '18:00', '00:00'];

    for (let i = 0; i < rewardHours.length; i++) {
      const hour = rewardHours[i];
      const key = rewardKeys[i];

      // 해당 시간대에 진입했고 아직 미수령인 경우
      if (currentHour === hour && !this.sixHourRewards.claimed[key] && this.sixHourRewards.lastCheckHour !== hour) {
        console.log(`[TimeTrackingSystem] 6-hour reward available: ${key} (+500 NC, +20 SC)`);
        // 수령 가능 상태로 표시 (자동 지급하지 않음)
      }
    }

    this.sixHourRewards.lastCheckHour = currentHour;
  }

  /**
   * 6시간 보상 수령 가능 여부 조회
   * @returns {{timeSlot: string, nc: number, sc: number} | null}
   */
  getAvailableSixHourReward() {
    const now = new Date();
    const currentHour = now.getHours();

    // 현재 시간대의 보상 확인
    const rewardMap = [
      { hour: 6, key: '06:00', label: '아침' },
      { hour: 12, key: '12:00', label: '점심' },
      { hour: 18, key: '18:00', label: '저녁' },
      { hour: 0, key: '00:00', label: '새벽' }
    ];

    for (const reward of rewardMap) {
      // 현재 시간대의 보상이고 아직 미수령인 경우
      if (currentHour === reward.hour && !this.sixHourRewards.claimed[reward.key]) {
        return {
          timeSlot: reward.label,
          key: reward.key,
          nc: 500,
          sc: 20
        };
      }
    }

    return null;
  }

  /**
   * 6시간 보상 수령
   * @param {EconomySystem} economySystem
   * @returns {{success: boolean, nc?: number, sc?: number, reason?: string}}
   */
  claimSixHourReward(economySystem) {
    const available = this.getAvailableSixHourReward();

    if (!available) {
      return {
        success: false,
        reason: '수령 가능한 6시간 보상이 없습니다'
      };
    }

    // NC, SC 지급 (SC는 상한 초과 허용)
    economySystem.earnNC(available.nc);
    economySystem.earnSCBonus(available.sc);

    // 수령 완료 표시
    this.sixHourRewards.claimed[available.key] = true;

    console.log(`[TimeTrackingSystem] 6-hour reward claimed (${available.timeSlot}): +${available.nc} NC, +${available.sc} SC`);

    return {
      success: true,
      nc: available.nc,
      sc: available.sc,
      timeSlot: available.timeSlot
    };
  }

  /**
   * 상태 조회
   */
  getState() {
    return {
      totalPlaytime: this.totalPlaytime,
      sessionPlaytime: this.sessionPlaytime,
      timeUntilNextHourlyBonus: this.getTimeUntilNextHourlyBonus(),
      canClaimHourlyReward: this.canClaimHourlyReward(),
      canClaimDailyBonus: this.canClaimDailyBonus(),
      availableSixHourReward: this.getAvailableSixHourReward(),
      currentDate: this._getCurrentDate()
    };
  }

  /**
   * 시간 포맷팅 (초 -> "HH:MM:SS")
   */
  static formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * 저장 데이터에서 상태 복원
   * @param {Object} saveData - 저장된 시간 추적 데이터
   */
  loadFromSave(saveData) {
    if (saveData.totalPlayTime !== undefined) {
      this.totalPlaytime = saveData.totalPlayTime;
    }

    if (saveData.hourlyBonusAccumulator !== undefined) {
      this.hourlyBonusAccumulator = saveData.hourlyBonusAccumulator;
      // 저장 시점에 이미 수령 대기 상태였으면 복원
      if (this.hourlyBonusAccumulator >= 3600) {
        this.hourlyBonusReady = true;
      }
    }

    if (saveData.lastSixHourClaimTimes !== undefined) {
      this.sixHourRewards.claimed = { ...saveData.lastSixHourClaimTimes };
    }

    // 세션 플레이타임은 0으로 시작
    this.sessionPlaytime = 0;

    console.log('[TimeTrackingSystem] State restored from save');
  }

  /**
   * 총 플레이타임 조회
   * @returns {number} 총 플레이타임 (초)
   */
  getTotalPlayTime() {
    return this.totalPlaytime;
  }
}
