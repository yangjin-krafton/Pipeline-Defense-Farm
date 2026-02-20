/**
 * Main entry point for Digestive Run game
 */
import { VIRTUAL_W, VIRTUAL_H, PATH_POINTS, PATHS, TOWER_SLOTS } from './config.js';
import { MultiPathFollowerSystem } from './utils/MultiPathFollowerSystem.js';
import { WebGLRenderer } from './renderer/WebGLRenderer.js';
import { EmojiRenderer } from './renderer/EmojiRenderer.js';
import { FlowSystem } from './systems/FlowSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { GameLoop } from './game/GameLoop.js';
import { UIController } from './ui/UIController.js';
import { ScaleManager } from './ui/ScaleManager.js';
import { CameraController } from './ui/CameraController.js';
import { appendCircle, buildPolylineMesh, hexToRgba } from './utils/geometry.js';
import { PathEditor } from './editor/PathEditor.js';
import { TowerSlotEditor } from './editor/TowerSlotEditor.js';

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
function setupTowerSlotClicks(pathCanvas, uiController, scaleManager, cameraController) {
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
      uiController.selectTowerSlot(slot);
    }
  });
}

/**
 * Main initialization function
 */
async function init() {
  // Initialize canvas
  const { pathCanvas, emojiCanvas, container, gl } = initCanvas();

  // Fit canvas to fixed game area (only needs to run once)
  fitCanvas(pathCanvas, emojiCanvas, container, gl);

  // Initialize systems
  const multiPathSystem = new MultiPathFollowerSystem(PATHS);
  const webglRenderer = new WebGLRenderer(gl);
  const emojiRenderer = new EmojiRenderer(emojiCanvas);
  const staticMeshes = createStaticMeshes(webglRenderer);

  // Use first path for flow system (backward compatibility)
  const flowSystem = new FlowSystem(multiPathSystem.getPathSystem('rice_stomach'));

  // Initialize audio system
  const audioSystem = new AudioSystem();
  await audioSystem.init();
  await audioSystem.loadBGM('./assets/bgm/game_theme.wav');
  audioSystem.setVolume(0.4); // 40% volume
  audioSystem.setLoop(true);
  audioSystem.setVariationOptions({ gainRandomRange: 0.03, sectionDynamicsDepth: 0.2, fillBoostRange: 0.06 });

  // Create and start game loop
  const gameLoop = new GameLoop(
    multiPathSystem,
    webglRenderer,
    emojiRenderer,
    staticMeshes,
    flowSystem,
    audioSystem
  );

  gameLoop.start();

  // Setup music controls
  setupMusicControls(audioSystem);

  // Setup start overlay
  setupStartOverlay(audioSystem, gameLoop);

  // Initialize UI Controller
  const uiController = new UIController();
  uiController.setGameLoop(gameLoop); // NEW: Connect UI to game systems

  // Initialize Scale Manager
  const scaleManager = new ScaleManager();

  // Re-fit canvas on window resize for responsive scaling
  window.addEventListener('resize', () => {
    fitCanvas(pathCanvas, emojiCanvas, container, gl);
  });

  // Initialize Camera Controller
  const canvasContainer = document.querySelector('.canvas-container');
  const cameraController = new CameraController(canvasContainer);

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

  // NEW: Update UI displays every frame
  const updateUIDisplays = () => {
    const economySystem = gameLoop.getEconomySystem();

    // Update NC/SC display
    uiController.updateNutritionDisplay(economySystem.getState());

    // Update boost display (timer and button states)
    uiController.updateBoostDisplay();

    requestAnimationFrame(updateUIDisplays);
  };
  updateUIDisplays();

  // Setup tower slot click detection on pathCanvas
  setupTowerSlotClicks(pathCanvas, uiController, scaleManager, cameraController);

  // Setup path editor (dev mode)
  const pathEditorToggle = setupPathEditor(emojiCanvas, gameLoop, webglRenderer, staticMeshes);

  // Setup tower slot editor (dev mode)
  const towerSlotEditorToggle = setupTowerSlotEditor(emojiCanvas, gameLoop, webglRenderer, staticMeshes);

  // Setup developer menu
  setupDeveloperMenu(pathEditorToggle, towerSlotEditorToggle);

  // Expose for debugging
  window.gameLoop = gameLoop;
  window.audioSystem = audioSystem;
  window.uiController = uiController;
  window.scaleManager = scaleManager;
  window.cameraController = cameraController;
  window.multiPathSystem = multiPathSystem;
}

/**
 * Setup start overlay
 */
function setupStartOverlay(audioSystem, gameLoop) {
  const overlay = document.getElementById('startOverlay');
  const startBtn = document.getElementById('startBtn');

  if (startBtn && overlay) {
    startBtn.addEventListener('click', () => {
      // Hide overlay
      overlay.classList.add('hidden');

      // Start music after a short delay
      setTimeout(() => {
        audioSystem.play();
        audioSystem.fadeIn(1.5);
        updateMusicButton(true);
      }, 300);

      // Remove overlay from DOM after animation
      setTimeout(() => {
        overlay.remove();
      }, 800);
    });
  }
}

/**
 * Setup music control UI
 */
function setupMusicControls(audioSystem) {
  const toggleBtn = document.getElementById('musicToggle');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      audioSystem.toggle();
      updateMusicButton(audioSystem.isPlaying);
    });
  }
}

/**
 * Update music button icon
 */
function updateMusicButton(isPlaying) {
  const toggleBtn = document.getElementById('musicToggle');
  if (toggleBtn) {
    toggleBtn.textContent = isPlaying ? '⏸️' : '▶️';
    toggleBtn.title = isPlaying ? 'Pause Music' : 'Play Music';
  }
}

// Store as global for other modules
window.updateMusicButton = updateMusicButton;

// Start the game when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
