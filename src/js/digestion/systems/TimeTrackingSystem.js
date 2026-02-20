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
    }
  }

  /**
   * 60분 접속 보너스 체크
   */
  _checkHourlyBonus(dt, economySystem) {
    this.hourlyBonusAccumulator += dt;

    // 60분(3600초) 경과 시
    if (this.hourlyBonusAccumulator >= 3600) {
      const bonus = SC_CONFIG.hourlyLoginBonus;
      const result = economySystem.earnSCWithOverflow(bonus);

      console.log(`[TimeTrackingSystem] Hourly bonus granted: +${bonus} SC`);
      if (result.ncFromOverflow > 0) {
        console.log(`[TimeTrackingSystem] SC overflow -> +${result.ncFromOverflow} NC`);
      }

      this.hourlyBonusAccumulator -= 3600;
      this.lastHourlyBonusTime = this.totalPlaytime;
    }
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
    const scResult = economySystem.earnSCWithOverflow(scBonus);

    this.dailyBonusClaimed = true;

    console.log(`[TimeTrackingSystem] Daily bonus claimed: +${ncBonus} NC, +${scBonus} SC`);
    if (scResult.ncFromOverflow > 0) {
      console.log(`[TimeTrackingSystem] SC overflow -> +${scResult.ncFromOverflow} NC`);
    }

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
   * 상태 조회
   */
  getState() {
    return {
      totalPlaytime: this.totalPlaytime,
      sessionPlaytime: this.sessionPlaytime,
      timeUntilNextHourlyBonus: this.getTimeUntilNextHourlyBonus(),
      canClaimDailyBonus: this.canClaimDailyBonus(),
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
}
