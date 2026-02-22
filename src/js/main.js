/**
 * Main entry point for Digestive Run game
 */
import { VIRTUAL_W, VIRTUAL_H, PATH_POINTS, PATHS, TOWER_SLOTS } from './config.js';
import { MultiPathFollowerSystem } from './utils/MultiPathFollowerSystem.js';
import { WebGLRenderer } from './renderer/WebGLRenderer.js';
import { EmojiRenderer } from './renderer/EmojiRenderer.js';
import { FlowSystem } from './systems/FlowSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { UISfxSystem } from './systems/UISfxSystem.js';
import { SaveSystem } from './digestion/systems/SaveSystem.js';
import { GameLoop } from './game/GameLoop.js';
import { UIController } from './ui/UIController.js';
import { AudioSettingsPanel } from './ui/AudioSettingsPanel.js';
import { ScaleManager } from './ui/ScaleManager.js';
import { CameraController } from './ui/CameraController.js';
import { appendCircle, buildPolylineMesh, hexToRgba } from './utils/geometry.js';
import { PathEditor } from './editor/PathEditor.js';
import { TowerSlotEditor } from './editor/TowerSlotEditor.js';
import { ResourceAbsorptionSystem } from './ui/ResourceAbsorptionSystem.js';

/**
 * Initialize canvas and context
 */
function initCanvas() {
  const pathCanvas = document.getElementById("pathCanvas");
  const emojiCanvas = document.getElementById("emojiCanvas");
  const container = document.querySelector(".canvas-container");

  // WebGL2 setup
  const gl = pathCanvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance"
  });

  if (!gl) {
    const badge = document.querySelector(".badge");
    badge.textContent = "WebGL2 unavailable";
    console.error("WebGL2 is required for this demo.");
    throw new Error("WebGL2 not supported");
  }

  return { pathCanvas, emojiCanvas, container, gl };
}

/**
 * Fit canvas to game area (responsive to container size)
 * Game uses 360x640 virtual coordinates
 * Scales dynamically based on actual container dimensions
 */
function fitCanvas(pathCanvas, emojiCanvas, container, gl) {
  // Get actual game area dimensions (respects CSS and ScaleManager)
  const gameAreaWidth = container.clientWidth || 640;
  const gameAreaHeight = container.clientHeight || 1063;

  // Calculate scale to fit virtual dimensions in game area
  const scale = Math.min(gameAreaWidth / VIRTUAL_W, gameAreaHeight / VIRTUAL_H);
  const cssW = Math.max(1, Math.round(VIRTUAL_W * scale));
  const cssH = Math.max(1, Math.round(VIRTUAL_H * scale));
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  // Center canvas in game area
  const offsetX = (gameAreaWidth - cssW) / 2;
  const offsetY = (gameAreaHeight - cssH) / 2;

  pathCanvas.style.width = `${cssW}px`;
  pathCanvas.style.height = `${cssH}px`;
  pathCanvas.style.left = `${offsetX}px`;
  pathCanvas.style.top = `${offsetY}px`;
  pathCanvas.width = Math.max(1, Math.round(cssW * dpr));
  pathCanvas.height = Math.max(1, Math.round(cssH * dpr));

  emojiCanvas.style.width = `${cssW}px`;
  emojiCanvas.style.height = `${cssH}px`;
  emojiCanvas.style.left = `${offsetX}px`;
  emojiCanvas.style.top = `${offsetY}px`;
  emojiCanvas.width = cssW;
  emojiCanvas.height = cssH;

  if (gl) {
    gl.viewport(0, 0, pathCanvas.width, pathCanvas.height);
  }
}

/**
 * Create static meshes for background and track
 */
function createStaticMeshes(renderer) {
  const bgWarm = [];
  const bgCool = [];
  for (let i = 0; i < 18; i += 1) {
    const x = (i * 43 + 17) % VIRTUAL_W;
    const y = (i * 71 + 93) % VIRTUAL_H;
    const r = 6 + (i % 4);
    if (i % 2) {
      appendCircle(bgCool, x, y, r, 12);
    } else {
      appendCircle(bgWarm, x, y, r, 12);
    }
  }

  // Create tower slots from config
  const towerSlotOuter = [];
  const towerSlotInner = [];

  for (const slot of TOWER_SLOTS) {
    // Outer ring
    appendCircle(towerSlotOuter, slot.x, slot.y, slot.radius, 24);
    // Inner circle (will be drawn in different color for ring effect)
    appendCircle(towerSlotInner, slot.x, slot.y, slot.radius - 5, 24);
  }

  // Create meshes for each path individually
  const pathMeshes = {};

  for (const [key, pathData] of Object.entries(PATHS)) {
    const points = pathData.points;
    pathMeshes[key] = {
      shadow: renderer.createMesh(buildPolylineMesh(points, 42, 2, 3)),
      main: renderer.createMesh(buildPolylineMesh(points, 34, 0, 0)),
      edge: renderer.createMesh(buildPolylineMesh(points, 5, 0, 0)),
      color: pathData.color
    };
  }

  return {
    bgWarm: renderer.createMesh(bgWarm),
    bgCool: renderer.createMesh(bgCool),
    paths: pathMeshes,
    towerSlotOuter: renderer.createMesh(towerSlotOuter),
    towerSlotInner: renderer.createMesh(towerSlotInner)
  };
}

/**
 * Tower slot positions imported from config.js
 * Can be edited with Ctrl+Shift+T in dev mode
 */

/**
 * Check if click is on a tower slot
 */
function checkTowerSlotClick(virtualX, virtualY) {
  for (const slot of TOWER_SLOTS) {
    const dx = virtualX - slot.x;
    const dy = virtualY - slot.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= slot.radius) {
      return slot;
    }
  }
  return null;
}

/**
 * Setup path editor for development
 */
function setupPathEditor(canvas, gameLoop, webglRenderer, staticMeshes) {
  let pathEditor = null;
  let isEditorActive = false;
  let editorAnimationFrame = null;

  const toggleEditor = () => {
    isEditorActive = !isEditorActive;

    if (isEditorActive) {
      // Create editor and pause game
      console.log('Path Editor: ENABLED');
      gameLoop.pause();

      // Enable pointer events on emoji canvas
      canvas.style.pointerEvents = 'auto';
      canvas.style.zIndex = '1000';

      pathEditor = new PathEditor(canvas, PATHS, (newPaths) => {
        // Update paths in real-time
        updatePathVisuals(newPaths, webglRenderer, staticMeshes);
      });

      // Start editor render loop
      const ctx = canvas.getContext('2d');
      const renderEditor = () => {
        if (isEditorActive && pathEditor) {
          pathEditor.render(ctx);
          editorAnimationFrame = requestAnimationFrame(renderEditor);
        }
      };
      renderEditor();
    } else {
      // Disable editor and resume game
      console.log('Path Editor: DISABLED');

      if (pathEditor) {
        pathEditor.removeEventListeners();
        pathEditor = null;
      }

      if (editorAnimationFrame) {
        cancelAnimationFrame(editorAnimationFrame);
        editorAnimationFrame = null;
      }

      // Restore pointer events
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '';

      // Clear canvas
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      gameLoop.resume();
    }
  };

  // Toggle editor with Ctrl+Shift+E
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      toggleEditor();
    }
  });

  // Expose for debugging
  window.togglePathEditor = toggleEditor;
  window.getPathEditor = () => pathEditor;
  window.isPathEditorActive = () => isEditorActive;

  console.log('Path Editor: Press Ctrl+Shift+E to toggle editor mode');

  // Return toggle function for menu
  return toggleEditor;
}

/**
 * Setup tower slot editor for development
 */
function setupTowerSlotEditor(canvas, gameLoop, webglRenderer, staticMeshes) {
  let slotEditor = null;
  let isEditorActive = false;
  let editorAnimationFrame = null;

  const toggleEditor = () => {
    isEditorActive = !isEditorActive;

    if (isEditorActive) {
      // Create editor and pause game
      console.log('Tower Slot Editor: ENABLED');
      gameLoop.pause();

      // Enable pointer events on emoji canvas
      canvas.style.pointerEvents = 'auto';
      canvas.style.zIndex = '1000';

      slotEditor = new TowerSlotEditor(canvas, TOWER_SLOTS, (newSlots) => {
        // Update tower slots in real-time
        updateTowerSlotVisuals(newSlots, webglRenderer, staticMeshes);
      });

      // Start editor render loop
      const ctx = canvas.getContext('2d');
      const renderEditor = () => {
        if (isEditorActive && slotEditor) {
          slotEditor.render(ctx);
          editorAnimationFrame = requestAnimationFrame(renderEditor);
        }
      };
      renderEditor();
    } else {
      // Disable editor and resume game
      console.log('Tower Slot Editor: DISABLED');

      if (slotEditor) {
        slotEditor.removeEventListeners();
        slotEditor = null;
      }

      if (editorAnimationFrame) {
        cancelAnimationFrame(editorAnimationFrame);
        editorAnimationFrame = null;
      }

      // Restore pointer events
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '';

      // Clear canvas
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      gameLoop.resume();
    }
  };

  // Expose for debugging
  window.toggleTowerSlotEditor = toggleEditor;
  window.getTowerSlotEditor = () => slotEditor;
  window.isTowerSlotEditorActive = () => isEditorActive;

  console.log('Tower Slot Editor: Available in developer menu');

  // Return toggle function for menu
  return toggleEditor;
}

/**
 * Update path visuals with new paths
 */
function updatePathVisuals(paths, webglRenderer, staticMeshes) {
  // Recreate meshes for each path individually
  for (const [key, pathData] of Object.entries(paths)) {
    const points = pathData.points;

    if (!staticMeshes.paths[key]) {
      staticMeshes.paths[key] = {};
    }

    staticMeshes.paths[key].shadow = webglRenderer.createMesh(buildPolylineMesh(points, 42, 2, 3));
    staticMeshes.paths[key].main = webglRenderer.createMesh(buildPolylineMesh(points, 34, 0, 0));
    staticMeshes.paths[key].edge = webglRenderer.createMesh(buildPolylineMesh(points, 5, 0, 0));
    staticMeshes.paths[key].color = pathData.color;
  }
}

/**
 * Update tower slot visuals with new slots
 */
function updateTowerSlotVisuals(slots, webglRenderer, staticMeshes) {
  // Rebuild tower slot meshes with new slots
  const outerMesh = [];
  const innerMesh = [];

  for (const slot of slots) {
    appendCircle(outerMesh, slot.x, slot.y, slot.radius, 24);
    appendCircle(innerMesh, slot.x, slot.y, slot.radius - 5, 24);
  }

  staticMeshes.towerSlotOuter = webglRenderer.createMesh(outerMesh);
  staticMeshes.towerSlotInner = webglRenderer.createMesh(innerMesh);
}

/**
 * Setup developer menu UI
 */
function setupDeveloperMenu(pathEditorToggle, towerSlotEditorToggle) {
  const menuToggle = document.getElementById('dev-menu-toggle');
  const menuPanel = document.getElementById('dev-menu-panel');
  const pathEditorBtn = document.getElementById('dev-path-editor');
  const towerEditorBtn = document.getElementById('dev-tower-editor');

  if (!menuToggle || !menuPanel || !pathEditorBtn || !towerEditorBtn) {
    console.warn('Developer menu elements not found');
    return;
  }

  // Toggle menu panel
  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = menuPanel.style.display !== 'none';
    menuPanel.style.display = isVisible ? 'none' : 'block';
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!menuPanel.contains(e.target) && e.target !== menuToggle) {
      menuPanel.style.display = 'none';
    }
  });

  // Path Editor button
  pathEditorBtn.addEventListener('click', () => {
    pathEditorToggle();
    menuPanel.style.display = 'none';
  });

  // Tower Slot Editor button
  towerEditorBtn.addEventListener('click', () => {
    towerSlotEditorToggle();
    menuPanel.style.display = 'none';
  });

  console.log('Developer menu initialized');
}


/**
 * Setup canvas click handler for tower slots
 */
function setupTowerSlotClicks(pathCanvas, uiController, scaleManager, cameraController, uiSfxSystem = null) {
  pathCanvas.addEventListener('click', (e) => {
    // Ignore clicks when path editor is active
    if (window.isPathEditorActive && window.isPathEditorActive()) {
      return;
    }

    // Get canvas rect
    const rect = pathCanvas.getBoundingClientRect();

    // Get click position relative to canvas
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Get canvas CSS dimensions
    const cssW = rect.width;
    const cssH = rect.height;

    // Convert to virtual coordinates (360x640)
    const virtualX = (canvasX / cssW) * VIRTUAL_W;
    const virtualY = (canvasY / cssH) * VIRTUAL_H;

    // Check if click is on a tower slot
    const slot = checkTowerSlotClick(virtualX, virtualY);
    if (slot) {
      if (uiSfxSystem) {
        uiSfxSystem.play('ui_click', { volume: 0.75 });
      }
      // Normal tower selection
      uiController.selectTowerSlot(slot);
    }
  });
}

function setupResourceLoadingOverlay() {
  return {
    overlay: document.getElementById('resourceLoadingOverlay'),
    message: document.getElementById('resourceLoadingMessage'),
    progressBar: document.getElementById('resourceLoadingProgressBar'),
    percent: document.getElementById('resourceLoadingPercent')
  };
}

function updateResourceLoadingStatus(loadingUI, progress, message) {
  if (!loadingUI?.overlay) {
    return;
  }

  const clamped = Math.max(0, Math.min(100, Math.round(progress)));

  if (loadingUI.progressBar) {
    loadingUI.progressBar.style.width = `${clamped}%`;
    const progressWrap = loadingUI.progressBar.parentElement;
    progressWrap?.setAttribute('aria-valuenow', String(clamped));
  }
  if (loadingUI.percent) {
    loadingUI.percent.textContent = `${clamped}%`;
  }
  if (loadingUI.message && message) {
    loadingUI.message.textContent = message;
  }
}

function hideResourceLoadingOverlay(loadingUI) {
  if (!loadingUI?.overlay) {
    return;
  }

  loadingUI.overlay.classList.add('hidden');
  setTimeout(() => {
    loadingUI.overlay.remove();
  }, 300);
}

function showResourceLoadingError(loadingUI) {
  if (!loadingUI?.overlay) {
    return;
  }

  updateResourceLoadingStatus(
    loadingUI,
    100,
    '리소스 로딩 중 오류가 발생했습니다. 새로고침 후 다시 시도해주세요.'
  );
  loadingUI.overlay.classList.remove('hidden');
}

/**
 * Main initialization function
 */
async function init() {
  const loadingUI = setupResourceLoadingOverlay();
  const setLoading = (progress, message) => {
    updateResourceLoadingStatus(loadingUI, progress, message);
  };

  try {
    setLoading(8, '렌더 캔버스를 준비하는 중...');

  // Initialize canvas
  const { pathCanvas, emojiCanvas, container, gl } = initCanvas();

  // Fit canvas to fixed game area (only needs to run once)
  fitCanvas(pathCanvas, emojiCanvas, container, gl);
  setLoading(18, '렌더러와 경로 시스템을 구성하는 중...');

  // Initialize systems
  const multiPathSystem = new MultiPathFollowerSystem(PATHS);
  const webglRenderer = new WebGLRenderer(gl);
  const emojiRenderer = new EmojiRenderer(emojiCanvas);
  const staticMeshes = createStaticMeshes(webglRenderer);

  // Use first path for flow system (backward compatibility)
  const flowSystem = new FlowSystem(multiPathSystem.getPathSystem('rice_stomach'));

  // Initialize audio system
  setLoading(30, '오디오 엔진 초기화 중...');
  const audioSystem = new AudioSystem();
  await audioSystem.init();
  setLoading(42, '배경음 리소스를 로드하는 중...');
  await audioSystem.loadBGM('./assets/bgm/game_theme.wav');
  audioSystem.setVolume(0.4); // 40% volume
  audioSystem.setLoop(true);
  audioSystem.setVariationOptions({ gainRandomRange: 0.03, sectionDynamicsDepth: 0.2, fillBoostRange: 0.06 });

  // Initialize UI SFX system (non-blocking fallback)
  setLoading(56, 'UI 사운드 리소스를 연결하는 중...');
  const uiSfxSystem = new UISfxSystem();
  try {
    await uiSfxSystem.init(audioSystem.audioContext);
    setLoading(66, '효과음 매니페스트를 로드하는 중...');
    await uiSfxSystem.loadFromManifest('./assets/sfx/sfx_manifest.json', './assets/sfx');
    uiSfxSystem.setVolume(0.52);
  } catch (error) {
    console.warn('UI SFX loading failed:', error);
  }

  // Initialize SaveSystem
  const saveSystem = new SaveSystem();

  // Create and start game loop
  const gameLoop = new GameLoop(
    multiPathSystem,
    webglRenderer,
    emojiRenderer,
    staticMeshes,
    flowSystem,
    audioSystem,
    uiSfxSystem
  );

  // Load saved game if exists
  setLoading(76, '저장 데이터를 확인하는 중...');
  const savedGame = saveSystem.loadGame();
  if (savedGame) {
    console.log('[Main] Loading saved game...');

    // 오프라인 보상 계산
    const currentTime = Date.now();
    const offlineRewards = saveSystem.calculateOfflineRewards(
      savedGame.timestamp,
      currentTime,
      savedGame.towers.length
    );

    console.log('[Main] Offline rewards:', offlineRewards);

    // 게임 상태 복원
    gameLoop.loadGameState(savedGame, offlineRewards);

    // 오프라인 보상 UI 표시
    if (offlineRewards.offlineHours > 0.1) {
      setTimeout(() => {
        showOfflineRewardsModal(offlineRewards);
      }, 1000);
    }
  }

  gameLoop.start();
  setLoading(86, 'UI 레이어를 동기화하는 중...');

  // Setup music controls
  const audioSettingsPanel = new AudioSettingsPanel(audioSystem, uiSfxSystem);
  audioSettingsPanel.applyStoredSettings();
  setupMusicControls(audioSettingsPanel);

  // Setup start overlay
  setupStartOverlay(audioSystem, gameLoop, uiSfxSystem);

  // Initialize UI Controller
  const uiController = new UIController();
  uiController.setUISfxSystem(uiSfxSystem);
  uiController.setGameLoop(gameLoop); // NEW: Connect UI to game systems

  // 유저 액션 시 즉시 저장하는 콜백 연결
  uiController.saveCallback = () => {
    const gameState = saveSystem.extractGameState(gameLoop);
    saveSystem.saveGame(gameState);
    console.log('[Main] Action save triggered');
  };

  // Initialize Scale Manager
  const scaleManager = new ScaleManager();

  // Initialize Resource Absorption System (재화 흡수 연출 모듈)
  const gameScreen = document.getElementById('game-screen');
  const resourceAbsorptionSystem = new ResourceAbsorptionSystem();
  resourceAbsorptionSystem.init(gameScreen, pathCanvas, scaleManager);
  gameLoop.setResourceAbsorptionSystem(resourceAbsorptionSystem);
  uiController.setResourceAbsorptionSystem(resourceAbsorptionSystem);

  // Re-fit canvas on window resize for responsive scaling
  window.addEventListener('resize', () => {
    fitCanvas(pathCanvas, emojiCanvas, container, gl);
  });

  // Initialize Camera Controller
  const canvasContainer = document.querySelector('.canvas-container');
  const cameraController = new CameraController(canvasContainer);
  uiController.setCameraController(cameraController);

  // Set up camera callbacks for UI sheet
  uiController.setOnSheetOpen((slot) => {
    if (slot) {
      cameraController.focusOnTowerSlot(slot);
    }
  });

  uiController.setOnSheetClose(() => {
    cameraController.reset();
  });

  // Update camera every frame
  const updateCamera = () => {
    cameraController.update();
    requestAnimationFrame(updateCamera);
  };
  updateCamera();

  // Setup auto-save (30초마다)
  setInterval(() => {
    if (!gameLoop.isPaused) {
      const gameState = saveSystem.extractGameState(gameLoop);
      saveSystem.saveGame(gameState);
      console.log('[Main] Auto-save completed');
    }
  }, saveSystem.autoSaveInterval);

  // Save on page unload
  window.addEventListener('beforeunload', () => {
    const gameState = saveSystem.extractGameState(gameLoop);
    saveSystem.saveGame(gameState);
    console.log('[Main] Game saved before unload');
  });

  // NEW: Update UI displays every frame
  const updateUIDisplays = () => {
    const economySystem = gameLoop.getEconomySystem();

    // Update NC/SC display
    uiController.updateNutritionDisplay(economySystem.getState());

    // Update boost display (timer and button states)
    uiController.updateBoostDisplay();

    // Update hourly claim button visibility
    uiController.updateHourlyClaimDisplay();

    // Update six hour claim button visibility
    uiController.updateSixHourClaimDisplay();

    requestAnimationFrame(updateUIDisplays);
  };
  updateUIDisplays();

  // Setup tower slot click detection on pathCanvas
  setupTowerSlotClicks(pathCanvas, uiController, scaleManager, cameraController, uiSfxSystem);

  // Setup path editor (dev mode)
  const pathEditorToggle = setupPathEditor(emojiCanvas, gameLoop, webglRenderer, staticMeshes);

  // Setup tower slot editor (dev mode)
  const towerSlotEditorToggle = setupTowerSlotEditor(emojiCanvas, gameLoop, webglRenderer, staticMeshes);

  // Setup developer menu
  setupDeveloperMenu(pathEditorToggle, towerSlotEditorToggle);

  // Expose for debugging
  window.gameLoop = gameLoop;
  window.audioSystem = audioSystem;
  window.uiSfxSystem = uiSfxSystem;
  window.uiController = uiController;
  window.scaleManager = scaleManager;
  window.cameraController = cameraController;
  window.multiPathSystem = multiPathSystem;

  // Development console commands
  setupDevCommands(gameLoop, uiController);
  setLoading(100, '준비 완료. 접속을 마무리하는 중...');
  hideResourceLoadingOverlay(loadingUI);
  } catch (error) {
    showResourceLoadingError(loadingUI);
    console.error('[Main] Initialization failed:', error);
    throw error;
  }
}

/**
 * Setup development console commands
 */
function setupDevCommands(gameLoop, uiController) {
  /**
   * Add XP to currently selected tower
   * @param {number} amount - XP amount to add
   */
  window.addXP = (amount = 100) => {
    const selectedSlot = uiController.selectedSlot;
    if (!selectedSlot) {
      console.warn('[devCommand] No tower selected. Click on a tower first!');
      return;
    }

    const towerManager = gameLoop.getTowerManager();
    const tower = towerManager.getTowerAtSlot(selectedSlot);

    if (!tower) {
      console.warn('[devCommand] No tower found at selected slot');
      return;
    }

    const growthSystem = gameLoop.getTowerGrowthSystem();
    const beforeLevel = tower.level;
    const beforeXP = Math.floor(tower.xp);

    growthSystem.addXP(tower, amount);

    const afterLevel = tower.level;
    const afterXP = Math.floor(tower.xp);

    console.log(`[devCommand] Added ${amount} XP to ${tower.definition.name}`);
    console.log(`  Before: Lv${beforeLevel} (${beforeXP} XP)`);
    console.log(`  After: Lv${afterLevel} (${afterXP} XP)`);

    if (beforeLevel !== afterLevel) {
      console.log(`  🎉 Level up! ${beforeLevel} → ${afterLevel}`);
    }

    // Refresh UI if tower detail is open
    uiController.selectTowerSlot(selectedSlot);
  };

  /**
   * Level up currently selected tower to max level (instant)
   */
  window.maxLevel = () => {
    const selectedSlot = uiController.selectedSlot;
    if (!selectedSlot) {
      console.warn('[devCommand] No tower selected. Click on a tower first!');
      return;
    }

    const towerManager = gameLoop.getTowerManager();
    const tower = towerManager.getTowerAtSlot(selectedSlot);

    if (!tower) {
      console.warn('[devCommand] No tower found at selected slot');
      return;
    }

    const growthSystem = gameLoop.getTowerGrowthSystem();
    const maxLevel = growthSystem.calculateMaxLevel(tower.star);
    const xpReqs = growthSystem._getXPRequirements(tower.star);
    const requiredXP = xpReqs[maxLevel - 1] || 0;

    const xpNeeded = Math.max(0, requiredXP - tower.xp);
    growthSystem.addXP(tower, xpNeeded);

    console.log(`[devCommand] ${tower.definition.name} maxed to Lv${tower.level} (${tower.star}★)`);

    // Refresh UI if tower detail is open
    uiController.selectTowerSlot(selectedSlot);
  };

  /**
   * Show current tower info
   */
  window.towerInfo = () => {
    const selectedSlot = uiController.selectedSlot;
    if (!selectedSlot) {
      console.warn('[devCommand] No tower selected. Click on a tower first!');
      return;
    }

    const towerManager = gameLoop.getTowerManager();
    const tower = towerManager.getTowerAtSlot(selectedSlot);

    if (!tower) {
      console.warn('[devCommand] No tower found at selected slot');
      return;
    }

    const growthSystem = gameLoop.getTowerGrowthSystem();
    const maxLevel = growthSystem.calculateMaxLevel(tower.star);
    const nextLevelXP = growthSystem.getXPRequiredForNextLevel(tower);

    console.log(`📊 Tower Info: ${tower.definition.name}`);
    console.log(`  Star: ${tower.star}★`);
    console.log(`  Level: ${tower.level} / ${maxLevel}`);
    console.log(`  XP: ${Math.floor(tower.xp)} / ${nextLevelXP || 'MAX'}`);
    console.log(`  Upgrade Points: ${tower.upgradePoints}`);
    console.log(`  Can Upgrade Star: ${growthSystem.canUpgradeStar(tower)}`);
  };

  /**
   * Add NC (Nutrition Credit)
   * @param {number} amount - NC amount to add
   */
  window.addNC = (amount = 1000) => {
    const economySystem = gameLoop.getEconomySystem();
    const beforeNC = economySystem.getState().nc;

    economySystem.earnNC(amount);

    const afterNC = economySystem.getState().nc;

    console.log(`[devCommand] Added ${amount} NC`);
    console.log(`  Before: 🍎 ${beforeNC}`);
    console.log(`  After: 🍎 ${afterNC}`);

    // Update UI
    uiController.updateNutritionDisplay(economySystem.getState());
  };

  /**
   * Add SC (Supply Charge)
   * @param {number} amount - SC amount to add
   */
  window.addSC = (amount = 50) => {
    const economySystem = gameLoop.getEconomySystem();
    const beforeSC = economySystem.getState().sc;

    economySystem.earnSC(amount);

    const afterSC = economySystem.getState().sc;

    console.log(`[devCommand] Added ${amount} SC`);
    console.log(`  Before: ⚡ ${beforeSC}`);
    console.log(`  After: ⚡ ${afterSC}`);

    // Update UI
    uiController.updateNutritionDisplay(economySystem.getState());
  };

  /**
   * Show current currency (재화 확인)
   */
  window.currency = () => {
    const economySystem = gameLoop.getEconomySystem();
    const state = economySystem.getState();

    console.log('💰 Current Currency:');
    console.log(`  🍎 NC (Nutrition Credit): ${state.nc}`);
    console.log(`  ⚡ SC (Supply Charge): ${state.sc} / ${state.scMax}`);
    console.log(`  SC Usage: ${((state.sc / state.scMax) * 100).toFixed(1)}%`);
  };

  /**
   * Max out currency (재화 최대치)
   */
  window.maxCurrency = () => {
    const economySystem = gameLoop.getEconomySystem();

    economySystem.earnNC(100000);
    economySystem.earnSC(1000);

    console.log('[devCommand] Currency maxed out!');
    console.log('  🍎 NC: 100,000+');
    console.log('  ⚡ SC: 80 (max)');

    // Update UI
    uiController.updateNutritionDisplay(economySystem.getState());
  };

  console.log('💡 Dev Commands Available:');
  console.log('');
  console.log('🏗️ Tower Commands:');
  console.log('  addXP(amount) - Add XP to selected tower (default: 100)');
  console.log('  maxLevel() - Max out selected tower level');
  console.log('  towerInfo() - Show selected tower info');
  console.log('');
  console.log('💰 Currency Commands:');
  console.log('  addNC(amount) - Add NC (default: 1000)');
  console.log('  addSC(amount) - Add SC (default: 50)');
  console.log('  currency() - Show current currency');
  console.log('  maxCurrency() - Max out all currency');
  console.log('');
  console.log('📝 Examples:');
  console.log('  addXP(500) - Add 500 XP to selected tower');
  console.log('  addNC(5000) - Add 5000 NC');
  console.log('  addSC(100) - Add 100 SC');
}

/**
 * Setup start overlay
 */
function setupStartOverlay(audioSystem, gameLoop, uiSfxSystem = null) {
  const overlay        = document.getElementById('startOverlay');
  const startBtn       = document.getElementById('startBtn');
  const tutToggle      = document.getElementById('tutorialToggle');
  const tutOverlay     = document.getElementById('tutorialOverlay');
  const tutPrevBtn     = document.getElementById('tutPrevBtn');
  const tutNextBtn     = document.getElementById('tutNextBtn');
  const tutStartBtn    = document.getElementById('tutStartBtn');
  const tutSkipBtn     = document.getElementById('tutSkipBtn');
  const tutSteps       = document.querySelectorAll('.tutorial-step');
  const tutPages       = document.querySelectorAll('.tutorial-page');
  const TOTAL_TUT_PAGES = tutPages.length;

  // ── Food emoji particle rain ──────────────────────────────
  const FOOD_EMOJIS = [
    '🍜','🍕','🍔','🍣','🍱','🥩','🍗','🍖','🥟','🍢',
    '🍛','🍝','🍲','🥘','🌮','🌯','🍿','🥞','🍩','🍪',
    '🎂','🍰','🧁','🍫','🍬','🍭','🍤','🌽','🍉','🍇',
    '🍎','🥐','🍦','🥗','🍞','🧆','🧇','🥚','🧀','🍮',
  ];

  const rainContainer = document.getElementById('foodRainContainer');
  let rainIntervalId = null;

  function spawnFoodParticle() {
    if (!rainContainer) return;
    const el = document.createElement('span');
    el.className = 'food-emoji-particle';
    el.textContent = FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)];

    const size     = 18 + Math.random() * 28;
    const opacity  = 0.25 + Math.random() * 0.45;
    const duration = 4.5 + Math.random() * 5;
    const drift    = (Math.random() - 0.5) * 80;
    const rot      = (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360);

    el.style.cssText = `
      left: ${Math.random() * 105 - 2.5}%;
      font-size: ${size}px;
      --p-opacity: ${opacity};
      --p-drift: ${drift}px;
      --p-rot: ${rot}deg;
      animation-duration: ${duration}s;
    `;

    rainContainer.appendChild(el);
    setTimeout(() => el.remove(), (duration + 0.5) * 1000);
  }

  if (rainContainer) {
    for (let i = 0; i < 12; i++) setTimeout(spawnFoodParticle, i * 120);
    rainIntervalId = setInterval(spawnFoodParticle, 280);
  }
  // ─────────────────────────────────────────────────────────

  // ── 타이틀 화면 동안 게임 루프 일시정지 ──────────────────
  gameLoop.pause();
  // ─────────────────────────────────────────────────────────

  // ── BGM 즉시 재생 시도 (브라우저 정책 대응) ───────────────
  // AudioContext는 사용자 제스처 전까지 suspended 상태일 수 있음.
  // 1) 바로 play() 시도 → 성공하면 바로 재생
  // 2) 실패/막히면 오버레이 첫 클릭 시 재시도 (one-time)
  function tryStartBGM() {
    if (audioSystem.isPlaying) return;
    audioSystem.play();
    audioSystem.fadeIn(1.5);
    updateMusicButton(true);
  }

  tryStartBGM();

  // 브라우저 정책으로 막혔을 경우 첫 상호작용 시 재시도
  if (!audioSystem.isPlaying && overlay) {
    const onFirstInteraction = () => {
      tryStartBGM();
      overlay.removeEventListener('click',      onFirstInteraction);
      overlay.removeEventListener('touchstart', onFirstInteraction);
    };
    overlay.addEventListener('click',      onFirstInteraction, { once: true });
    overlay.addEventListener('touchstart', onFirstInteraction, { once: true });
  }
  // ─────────────────────────────────────────────────────────

  // ── 타이틀 미니게임 공통 데이터 ──────────────────────────
  const MINIGAME_FOODS = [
    '🍕','🍔','🍜','🍣','🍱','🥩','🍗','🥟','🍢',
    '🍛','🍝','🍲','🥘','🌮','🌯','🍿','🍩','🍪',
    '🎂','🍰','🧁','🍫','🍬','🍭','🍤','🌽','🍉',
    '🍇','🍎','🥐','🍦','🥗','🍞','🧆','🥞','🥚',
    '🧀','🍮','🍖','🥑','🍊','🍓','🍡','🥮','🍙',
  ];

  const MINIGAME_RESPONSES = [
    '역시! 위장에 비상이 걸렸어요 😅 타워 긴급 배치!',
    '맛있었죠? 소화 파이프라인 가동! 🔬',
    '그거 드셨어요? 효소 타워가 필요합니다 💉',
    '많이 드셨죠? 지금 바로 소화 디펜스! ⚔️',
    '그 음식 때문에 파이프가 막혔어요! 🚨',
    '오… 과식하셨군요! 소화 작전 개시 🚀',
    '명절 음식이 제일 위험해요! 타워 세우세요 🎯',
    '소화 효소를 아직 안 뽑으셨어요?! 😱',
    '위장이 SOS를 보내고 있어요! 🆘',
    '그거 드셨으면… 효소가 3개는 필요해요 🧪',
  ];
  // ─────────────────────────────────────────────────────────

  // ── 미니게임 1: 음식 선택 3×3 그리드 ────────────────────
  (function setupPickMinigame() {
    const mgGrid    = document.getElementById('minigameGrid');
    const mgResult  = document.getElementById('minigameResult');
    const mgShuffle = document.getElementById('minigameShuffleBtn');
    if (!mgGrid) return;

    function shuffle9() {
      const pool = [...MINIGAME_FOODS].sort(() => Math.random() - 0.5).slice(0, 9);
      mgGrid.innerHTML = '';
      mgResult.classList.add('hidden');
      mgResult.textContent = '';
      pool.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'minigame-cell';
        btn.textContent = emoji;
        btn.type = 'button';
        btn.setAttribute('aria-label', emoji);
        btn.addEventListener('click', () => {
          mgGrid.querySelectorAll('.minigame-cell').forEach(c => c.classList.remove('selected'));
          btn.classList.add('selected');
          const msg = MINIGAME_RESPONSES[Math.floor(Math.random() * MINIGAME_RESPONSES.length)];
          mgResult.textContent = `${emoji} ${msg}`;
          mgResult.classList.remove('hidden');
          if (uiSfxSystem) uiSfxSystem.play('ui_click', { volume: 0.5 });
        });
        mgGrid.appendChild(btn);
      });
    }

    shuffle9();
    if (mgShuffle) mgShuffle.addEventListener('click', () => {
      if (uiSfxSystem) uiSfxSystem.play('ui_click', { volume: 0.45 });
      shuffle9();
    });
  })();

  // ── 미니게임 2: 음식 방어 (얼굴을 음식으로부터 지켜라!) ──
  let defenseStop = null; // 나중에 cleanup 용

  (function setupDefenseMinigame() {
    const arena       = document.getElementById('defenseArena');
    const faceEl      = document.getElementById('defenseFace');
    const absorbedEl  = document.getElementById('defenseAbsorbed');
    const blockedEl   = document.getElementById('defenseBlocked');
    const restartBtn  = document.getElementById('defenseRestartBtn');
    if (!arena || !faceEl) return;

    // 표정 단계: [임계값, 이모지]
    const FACES = [
      [0,  '😐'],
      [1,  '😋'],
      [3,  '😄'],
      [5,  '😅'],
      [7,  '😰'],
      [9,  '😩'],
      [11, '🤢'],
    ];

    // 웨이브 정의: { 총 스폰 수, 스폰 간격(ms), 한 번에 나오는 수, 이동 속도 }
    const WAVES = [
      { count:  5, ms: 1800, burst: 1, speed: 0.28 },  // Wave 1 — 여유롭게
      { count:  8, ms: 1200, burst: 1, speed: 0.36 },  // Wave 2 — 빨라짐
      { count: 12, ms:  800, burst: 2, speed: 0.45 },  // Wave 3 — 쏟아진다
      { count: 16, ms:  500, burst: 3, speed: 0.55 },  // Wave 4 — 화면 가득!
      { count: 22, ms:  320, burst: 4, speed: 0.65 },  // Wave 5 — 대혼란 💥
    ];

    const ABSORB_R        = 28;    // 흡수 반경 (px)
    const RECOVER_DELAY   = 3200;  // 마지막 흡수 후 회복 시작까지 대기 (ms)
    const RECOVER_STEP_MS = 1400;  // 회복 1단계 간격 (ms)

    let absorbed = 0, blocked = 0;
    let lastAbsorbTime  = 0;
    let lastRecoverTime = 0;
    let activeFood = [];
    let spawnTimerId = null;
    let rafId = null;
    let running = false;
    let currentSpeed  = WAVES[0].speed;
    let currentWaveIdx = 0;

    const waveEl = document.getElementById('defenseWave');

    function getFaceEmoji() {
      let emoji = FACES[0][1];
      for (const [thresh, em] of FACES) {
        if (absorbed >= thresh) emoji = em;
      }
      return emoji;
    }

    function updateFace() {
      const next = getFaceEmoji();
      if (faceEl.textContent !== next) {
        faceEl.textContent = next;
        faceEl.classList.remove('face-change');
        void faceEl.offsetWidth; // reflow to restart animation
        faceEl.classList.add('face-change');
      }
      absorbedEl.textContent = absorbed;
    }

    function showWaveAnnounce(text) {
      const el = document.createElement('div');
      el.className = 'defense-wave-announce';
      el.textContent = text;
      arena.appendChild(el);
      setTimeout(() => el.remove(), 1600);
    }

    function spawnOne(intense = false) {
      if (!running) return;
      const W = arena.offsetWidth;
      const H = arena.offsetHeight;
      const side = Math.floor(Math.random() * 4);
      let x, y;
      if      (side === 0) { x = Math.random() * W; y = -14; }
      else if (side === 1) { x = W + 14;             y = Math.random() * H; }
      else if (side === 2) { x = Math.random() * W; y = H + 14; }
      else                 { x = -14;                y = Math.random() * H; }

      const el = document.createElement('button');
      el.className = intense ? 'defense-food intense' : 'defense-food';
      el.type = 'button';
      el.textContent = MINIGAME_FOODS[Math.floor(Math.random() * MINIGAME_FOODS.length)];
      el.style.left = x + 'px';
      el.style.top  = y + 'px';

      const item = { el, x, y };

      el.addEventListener('click', () => {
        if (el.classList.contains('popping')) return;
        el.classList.add('popping');
        blocked++;
        blockedEl.textContent = blocked;
        activeFood = activeFood.filter(f => f !== item);
        if (uiSfxSystem) uiSfxSystem.play('ui_click', { volume: 0.4 });
        setTimeout(() => el.remove(), 300);
      });

      arena.appendChild(el);
      activeFood.push(item);
    }

    function startWave(waveIdx) {
      if (!running) return;
      const w = WAVES[Math.min(waveIdx, WAVES.length - 1)];
      currentWaveIdx = waveIdx;
      currentSpeed   = w.speed;
      const intense  = waveIdx >= 3;
      let spawnsLeft = w.count;

      if (waveEl) waveEl.textContent = Math.min(waveIdx + 1, WAVES.length);

      if (spawnTimerId) { clearInterval(spawnTimerId); spawnTimerId = null; }

      spawnTimerId = setInterval(() => {
        if (!running) return;
        for (let i = 0; i < w.burst && spawnsLeft > 0; i++) {
          spawnOne(intense);
          spawnsLeft--;
        }
        if (spawnsLeft <= 0) {
          clearInterval(spawnTimerId);
          spawnTimerId = null;
          // 다음 웨이브 예약 — 현재 음식이 정리될 시간(2s) 후 알림 표시
          setTimeout(() => {
            if (!running) return;
            const nextIdx  = waveIdx + 1;
            const isMaxWave = nextIdx >= WAVES.length;
            const label = isMaxWave
              ? '🔥 MAX WAVE!'
              : `WAVE ${Math.min(nextIdx + 1, WAVES.length)} ▶`;
            showWaveAnnounce(label);
            setTimeout(() => { if (running) startWave(nextIdx); }, 1500);
          }, 2000);
        }
      }, w.ms);
    }

    function frame() {
      if (!running) return;
      const W  = arena.offsetWidth;
      const H  = arena.offsetHeight;
      const cx = W / 2;
      const cy = H / 2;
      const toRemove = [];

      for (const item of activeFood) {
        const dx   = cx - item.x;
        const dy   = cy - item.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < ABSORB_R) {
          item.el.remove();
          absorbed++;
          lastAbsorbTime  = Date.now();
          lastRecoverTime = lastAbsorbTime; // 흡수 직후엔 회복 타이머 리셋
          toRemove.push(item);
          updateFace();
        } else {
          item.x += (dx / dist) * currentSpeed;
          item.y += (dy / dist) * currentSpeed;
          item.el.style.left = item.x + 'px';
          item.el.style.top  = item.y + 'px';
        }
      }
      if (toRemove.length) activeFood = activeFood.filter(f => !toRemove.includes(f));

      // ── 회복 로직: 일정 시간 음식을 안 먹으면 표정이 한 단계씩 회복 ──
      if (absorbed > 0) {
        const now = Date.now();
        if ((now - lastAbsorbTime) > RECOVER_DELAY &&
            (now - lastRecoverTime) > RECOVER_STEP_MS) {
          absorbed--;
          lastRecoverTime = now;
          updateFace();
        }
      }

      rafId = requestAnimationFrame(frame);
    }

    function start() {
      absorbed        = 0;
      blocked         = 0;
      lastAbsorbTime  = Date.now();
      lastRecoverTime = Date.now();
      running         = true;
      activeFood.forEach(f => f.el.remove());
      activeFood = [];
      faceEl.textContent = '😐';
      absorbedEl.textContent = '0';
      blockedEl.textContent  = '0';
      if (spawnTimerId) { clearInterval(spawnTimerId); spawnTimerId = null; }
      if (rafId) cancelAnimationFrame(rafId);
      currentSpeed   = WAVES[0].speed;
      currentWaveIdx = 0;
      if (waveEl) waveEl.textContent = '1';
      showWaveAnnounce('WAVE 1 ▶');
      setTimeout(() => { if (running) startWave(0); }, 1200);
      rafId = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (spawnTimerId) { clearInterval(spawnTimerId); spawnTimerId = null; }
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      activeFood.forEach(f => f.el.remove());
      activeFood = [];
    }

    defenseStop = stop;
    if (restartBtn) restartBtn.addEventListener('click', () => {
      if (uiSfxSystem) uiSfxSystem.play('ui_click', { volume: 0.45 });
      start();
    });

    // 미니게임2가 표시될 때만 실행 — 나중에 showGame()에서 호출
    arena._start = start;
    arena._stop  = stop;
  })();

  // ── 랜덤 미니게임 선택 & 전환 ─────────────────────────────
  (function setupMinigameSwitcher() {
    const g1 = document.getElementById('minigame1');
    const g2 = document.getElementById('minigame2');
    const arena = document.getElementById('defenseArena');
    if (!g1 || !g2) return;

    function showGame(id) {
      if (id === 1) {
        g1.classList.remove('hidden');
        g2.classList.add('hidden');
        if (arena && arena._stop) arena._stop();
      } else {
        g1.classList.add('hidden');
        g2.classList.remove('hidden');
        if (arena && arena._start) arena._start();
      }
    }

    // 페이지 접속 시 랜덤 선택 (버튼 없이 자동)
    showGame(Math.random() < 0.5 ? 1 : 2);
  })();
  // ─────────────────────────────────────────────────────────

  // ── Tutorial page navigation ──────────────────────────────
  let currentPage = 0;

  function showTutPage(page) {
    currentPage = page;

    tutPages.forEach((el, i) => el.classList.toggle('active', i === page));

    tutSteps.forEach((el, i) => {
      el.classList.toggle('active', i === page);
      el.classList.toggle('done',   i < page);
    });

    const isLast = page === TOTAL_TUT_PAGES - 1;
    tutPrevBtn.classList.toggle('hidden', page === 0);
    tutNextBtn.classList.toggle('hidden', isLast);
    tutStartBtn.classList.toggle('hidden', !isLast);
  }

  function openTutorial() {
    tutOverlay.classList.remove('hidden');
    showTutPage(0);
  }
  // ─────────────────────────────────────────────────────────

  // ── Final game-start sequence ─────────────────────────────
  function launchGame() {
    if (rainIntervalId !== null) {
      clearInterval(rainIntervalId);
      rainIntervalId = null;
    }
    // 디펜스 게임 정리
    if (defenseStop) { defenseStop(); defenseStop = null; }

    overlay.classList.add('hidden');

    setTimeout(() => {
      if (uiSfxSystem) uiSfxSystem.play('wave_start', { volume: 0.8 });
      // BGM은 이미 startBtn 클릭 시점에 시작됨 — 여기서는 게임 루프만 재개
      gameLoop.resume();
    }, 300);

    setTimeout(() => overlay.remove(), 800);
  }
  // ─────────────────────────────────────────────────────────

  // ── Start button ──────────────────────────────────────────
  if (startBtn && overlay) {
    startBtn.addEventListener('click', () => {
      if (uiSfxSystem) uiSfxSystem.play('ui_click', { volume: 0.85 });

      // BGM이 아직 안 시작됐으면 여기서 시작 (사용자 제스처 보장)
      tryStartBGM();

      const showTutorial = tutToggle ? tutToggle.checked : false;
      if (showTutorial && tutOverlay) {
        openTutorial();
      } else {
        launchGame();
      }
    });
  }

  // ── Tutorial button events ────────────────────────────────
  if (tutNextBtn) {
    tutNextBtn.addEventListener('click', () => {
      if (currentPage < TOTAL_TUT_PAGES - 1) showTutPage(currentPage + 1);
    });
  }

  if (tutPrevBtn) {
    tutPrevBtn.addEventListener('click', () => {
      if (currentPage > 0) showTutPage(currentPage - 1);
    });
  }

  if (tutStartBtn) {
    tutStartBtn.addEventListener('click', () => {
      if (uiSfxSystem) uiSfxSystem.play('ui_click', { volume: 0.85 });
      tutOverlay.classList.add('hidden');
      launchGame();
    });
  }

  if (tutSkipBtn) {
    tutSkipBtn.addEventListener('click', () => {
      tutOverlay.classList.add('hidden');
      launchGame();
    });
  }
}

/**
 * Setup music control UI — opens AudioSettingsPanel on click.
 */
function setupMusicControls(audioSettingsPanel) {
  const toggleBtn = document.getElementById('musicToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      audioSettingsPanel.toggle();
    });
  }
}

/**
 * Update music button icon
 */
function updateMusicButton(isPlaying) {
  const toggleBtn = document.getElementById('musicToggle');
  if (toggleBtn) {
    toggleBtn.textContent = isPlaying ? '🔊' : '🔇';
    toggleBtn.title = isPlaying ? 'Pause Music' : 'Play Music';
  }
}

/**
 * Show offline rewards modal
 */
function showOfflineRewardsModal(rewards) {
  const modal = document.createElement('div');
  modal.className = 'offline-rewards-modal';
  modal.innerHTML = `
    <div class="offline-rewards-content">
      <h2>🎁 오프라인 보상</h2>
      <div class="offline-time">
        <p>오프라인 시간: <strong>${rewards.offlineHours.toFixed(1)}시간</strong></p>
      </div>
      <div class="offline-rewards-list">
        ${rewards.xpGained > 0 ? `<div class="reward-item">💎 XP: +${rewards.xpGained}</div>` : ''}
        ${rewards.ncGained > 0 ? `<div class="reward-item">💰 NC: +${rewards.ncGained}</div>` : ''}
      </div>
      <p class="offline-efficiency">오프라인 효율: ${(rewards.efficiency * 100).toFixed(0)}%</p>
      <button class="claim-offline-btn">확인</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Close modal on button click
  const claimBtn = modal.querySelector('.claim-offline-btn');
  claimBtn.addEventListener('click', () => {
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 300);
  });

  // Fade in
  setTimeout(() => {
    modal.style.opacity = '1';
  }, 10);
}

// Store as global for other modules
window.updateMusicButton = updateMusicButton;

function boot() {
  init().catch((error) => {
    console.error('[Main] Boot failed:', error);
  });
}

// Start the game when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
