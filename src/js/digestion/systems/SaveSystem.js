import { SC_CONFIG } from '../data/economyDefinitions.js';

/**
 * SaveSystem - 게임 상태 저장/로드 시스템
 * localStorage 기반 방치형 게임 저장 시스템
 */
export class SaveSystem {
  constructor() {
    this.saveKey = 'pipeline_defense_farm_save';
    this.autoSaveInterval = 30000; // 30초마다 자동 저장
    this.lastSaveTime = 0;

    // 게임 버전 (업데이트 시 증가)
    // 형식: MAJOR.MINOR.PATCH
    // MAJOR: 대규모 변경 (저장 데이터 호환 불가)
    // MINOR: 기능 추가 (저장 데이터 호환)
    // PATCH: 버그 수정 (저장 데이터 호환)
    this.gameVersion = '1.0.0';

    console.log(`[SaveSystem] Initialized - Version ${this.gameVersion}`);
  }

  /**
   * 게임 상태 저장
   * @param {Object} gameState - 저장할 게임 상태
   */
  saveGame(gameState) {
    try {
      const saveData = {
        version: this.gameVersion,
        timestamp: Date.now(),

        // 경제 상태
        economy: {
          nc: gameState.economy.nc,
          sc: gameState.economy.sc,
          maxSC: gameState.economy.maxSC
        },

        // 타워 상태 (extractGameState()가 이미 변환한 plain object를 그대로 사용)
        towers: gameState.towers.map(tower => ({
          slotIndex: tower.slotIndex,
          type: tower.type,
          x: tower.x,
          y: tower.y,
          xp: tower.xp,
          level: tower.level,
          star: tower.star,
          upgradePoints: tower.upgradePoints,
          starBonuses: tower.starBonuses,
          activeNodes: tower.activeNodes || [],
          imprints: tower.imprints || [],
          imprintCounts: tower.imprintCounts || [],
          pendingUpgrade: tower.pendingUpgrade || null
        })),

        // 시간 추적
        timeTracking: {
          lastPlayTime: gameState.timeTracking.lastPlayTime,
          totalPlayTime: gameState.timeTracking.totalPlayTime,
          hourlyBonusAccumulator: gameState.timeTracking.hourlyBonusAccumulator,
          lastSixHourClaimTimes: gameState.timeTracking.lastSixHourClaimTimes
        },

        // 웨이브 진행
        wave: {
          currentWave: gameState.wave.currentWave,
          waveCleared: gameState.wave.waveCleared
        }
      };

      localStorage.setItem(this.saveKey, JSON.stringify(saveData));
      this.lastSaveTime = Date.now();

      console.log('[SaveSystem] Game saved successfully', saveData);
      return true;
    } catch (error) {
      console.error('[SaveSystem] Failed to save game:', error);
      return false;
    }
  }

  /**
   * 게임 상태 로드
   * @returns {Object|null} 저장된 게임 상태 또는 null
   */
  loadGame() {
    try {
      const savedData = localStorage.getItem(this.saveKey);

      if (!savedData) {
        console.log('[SaveSystem] No saved game found');
        return null;
      }

      const saveData = JSON.parse(savedData);

      // 버전 체크
      if (!this.isVersionCompatible(saveData.version)) {
        console.warn(`[SaveSystem] Incompatible save version: ${saveData.version} (current: ${this.gameVersion})`);
        console.warn('[SaveSystem] Save data will be reset due to version mismatch');
        this.deleteSave();
        return null;
      }

      console.log('[SaveSystem] Game loaded successfully', saveData);
      return saveData;
    } catch (error) {
      console.error('[SaveSystem] Failed to load game:', error);
      return null;
    }
  }

  /**
   * 버전 호환성 체크
   * @param {string} savedVersion - 저장된 버전
   * @returns {boolean} 호환 여부
   */
  isVersionCompatible(savedVersion) {
    if (!savedVersion) return false;

    const [savedMajor, savedMinor, savedPatch] = savedVersion.split('.').map(Number);
    const [currentMajor, currentMinor, currentPatch] = this.gameVersion.split('.').map(Number);

    // MAJOR 버전이 다르면 호환 불가
    if (savedMajor !== currentMajor) {
      return false;
    }

    // MAJOR가 같으면 호환 가능
    return true;
  }

  /**
   * 저장 파일 존재 여부 확인
   * @returns {boolean}
   */
  hasSavedGame() {
    return localStorage.getItem(this.saveKey) !== null;
  }

  /**
   * 저장 파일 삭제
   */
  deleteSave() {
    try {
      localStorage.removeItem(this.saveKey);
      console.log('[SaveSystem] Save deleted');
      return true;
    } catch (error) {
      console.error('[SaveSystem] Failed to delete save:', error);
      return false;
    }
  }

  /**
   * 오프라인 보상 계산
   * @param {number} lastPlayTime - 마지막 플레이 시간 (밀리초)
   * @param {number} currentTime - 현재 시간 (밀리초)
   * @param {number} towerCount - 타워 개수
   * @returns {Object} 오프라인 보상
   */
  calculateOfflineRewards(lastPlayTime, currentTime, towerCount) {
    const offlineTime = currentTime - lastPlayTime; // 밀리초
    const offlineSeconds = offlineTime / 1000;
    const offlineHours = offlineSeconds / 3600;

    // 오프라인 효율: 온라인의 35%
    const offlineEfficiency = 0.35;

    // 최대 오프라인 시간 제한 (24시간)
    const maxOfflineHours = 24;
    const cappedHours = Math.min(offlineHours, maxOfflineHours);

    // XP 계산 (2초 틱 기반) — cappedHours 기준
    const ticksPerHour = 1800; // 3600초 / 2초
    const xpPerTick = 1.0;
    const totalTicks = Math.floor(cappedHours * ticksPerHour);
    const offlineXP = totalTicks * xpPerTick * towerCount * offlineEfficiency;

    // NC 계산 (시간당 50 NC) — cappedHours 기준
    const ncPerHour = 50;
    const offlineNC = Math.floor(cappedHours * ncPerHour * offlineEfficiency);

    // SC 회복 계산 — 온라인과 동일한 속도, 상한(80)까지만 회복
    // earnSC() 가 상한 적용하므로 여기서는 raw 회복량만 계산
    const offlineSC = Math.floor(cappedHours * SC_CONFIG.passiveRegenPerHour);

    return {
      offlineTime: offlineTime,
      offlineHours: cappedHours,
      xpGained: Math.floor(offlineXP),
      ncGained: offlineNC,
      scGained: offlineSC,
      efficiency: offlineEfficiency
    };
  }

  /**
   * 자동 저장 필요 여부 체크
   * @param {number} currentTime - 현재 시간 (밀리초)
   * @returns {boolean}
   */
  shouldAutoSave(currentTime) {
    return (currentTime - this.lastSaveTime) >= this.autoSaveInterval;
  }

  /**
   * 게임 상태 추출 (저장용)
   * @param {Object} gameLoop - GameLoop 인스턴스
   * @returns {Object} 저장할 게임 상태
   */
  extractGameState(gameLoop) {
    const towerManager = gameLoop.getTowerManager();
    const economySystem = gameLoop.getEconomySystem();
    const timeTrackingSystem = gameLoop.getTimeTrackingSystem();

    const towers = towerManager.getAllTowers().map((tower, index) => {
      // activeNodes가 Set<UpgradeNode>일 수 있으므로 nodeNumber만 추출
      let activeNodeNumbers = [];
      if (tower.upgradeTree && tower.upgradeTree.activeNodes) {
        for (const nodeOrNumber of tower.upgradeTree.activeNodes) {
          if (typeof nodeOrNumber === 'number') {
            activeNodeNumbers.push(nodeOrNumber);
          } else if (nodeOrNumber.nodeNumber !== undefined) {
            activeNodeNumbers.push(nodeOrNumber.nodeNumber);
          }
        }
      }

      return {
        slotIndex: index,
        type: tower.type,
        x: tower.x,
        y: tower.y,
        xp: tower.xp,
        level: tower.level,
        star: tower.star,
        upgradePoints: tower.upgradePoints,
        starBonuses: tower.starBonuses,
        activeNodes: activeNodeNumbers,
        // imprintedNode(UpgradeNode 참조)는 직렬화 불가 → 로드 시 upgradeTree에서 재구성
        imprints: (tower.imprints || []).map(imp => ({
          nodeNumber: imp.nodeNumber,
          nodeName: imp.nodeName,
          nodeDescription: imp.nodeDescription,
          acquiredStar: imp.acquiredStar,
          statGains: imp.statGains,
          imprintCount: imp.imprintCount
        })),
        imprintCounts: tower.imprintCounts ? Array.from(tower.imprintCounts.entries()) : [],
        pendingUpgrade: tower.pendingUpgrade || null
      };
    });

    const economyState = economySystem.getState();

    return {
      economy: {
        nc: economyState.nc,
        sc: economyState.sc,
        maxSC: economyState.scMax || economyState.maxSC
      },
      towers: towers,
      timeTracking: {
        lastPlayTime: Date.now(),
        totalPlayTime: timeTrackingSystem.getTotalPlayTime(),
        hourlyBonusAccumulator: timeTrackingSystem.hourlyBonusAccumulator,
        lastSixHourClaimTimes: timeTrackingSystem.sixHourRewards?.claimed || {}
      },
      wave: {
        currentWave: 1,
        waveCleared: 0
      }
    };
  }
}
