/**
 * Main entry point for Digestive Run game
 */
import { VIRTUAL_W, VIRTUAL_H, PATH_POINTS } from './config.js';
import { PathFollowerSystem } from './utils/PathFollowerSystem.js';
import { WebGLRenderer } from './renderer/WebGLRenderer.js';
import { EmojiRenderer } from './renderer/EmojiRenderer.js';
import { FlowSystem } from './systems/FlowSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { GameLoop } from './game/GameLoop.js';
import { UIController } from './ui/UIController.js';
import { ScaleManager } from './ui/ScaleManager.js';
import { appendCircle, buildPolylineMesh } from './utils/geometry.js';

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
 * Fit canvas to game area (fixed 640x1063 space)
 * Game uses 360x640 virtual coordinates
 */
function fitCanvas(pathCanvas, emojiCanvas, container, gl) {
  // Fixed game area dimensions (set in CSS)
  const gameAreaWidth = 640;
  const gameAreaHeight = 1063;

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

  // Create tower slot (test position)
  const towerSlot = [];
  const slotX = 100;
  const slotY = 200;

  // Outer ring
  appendCircle(towerSlot, slotX, slotY, 30, 24);

  // Inner circle (will be drawn in different color for ring effect)
  const innerSlot = [];
  appendCircle(innerSlot, slotX, slotY, 25, 24);

  return {
    bgWarm: renderer.createMesh(bgWarm),
    bgCool: renderer.createMesh(bgCool),
    trackShadow: renderer.createMesh(buildPolylineMesh(PATH_POINTS, 42, 2, 3)),
    trackMain: renderer.createMesh(buildPolylineMesh(PATH_POINTS, 34, 0, 0)),
    trackEdge: renderer.createMesh(buildPolylineMesh(PATH_POINTS, 5, 0, 0)),
    towerSlotOuter: renderer.createMesh(towerSlot),
    towerSlotInner: renderer.createMesh(innerSlot)
  };
}

/**
 * Tower slot positions (for click detection)
 */
const TOWER_SLOTS = [
  { x: 100, y: 200, radius: 30 }
];

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
 * Setup canvas click handler for tower slots
 */
function setupTowerSlotClicks(canvas, uiController) {
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();

    // Get click position relative to canvas
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Convert to virtual coordinates (360x640)
    const virtualX = (canvasX / rect.width) * VIRTUAL_W;
    const virtualY = (canvasY / rect.height) * VIRTUAL_H;

    // Check if click is on a tower slot
    const slot = checkTowerSlotClick(virtualX, virtualY);
    if (slot) {
      console.log('Tower slot clicked:', slot);
      uiController.openSheet();
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
  const pathSystem = new PathFollowerSystem(PATH_POINTS);
  const webglRenderer = new WebGLRenderer(gl);
  const emojiRenderer = new EmojiRenderer(emojiCanvas);
  const staticMeshes = createStaticMeshes(webglRenderer);
  const flowSystem = new FlowSystem(pathSystem);

  // Initialize audio system
  const audioSystem = new AudioSystem();
  await audioSystem.init();
  await audioSystem.loadBGM('./assets/bgm/game_theme.wav');
  audioSystem.setVolume(0.4); // 40% volume
  audioSystem.setLoop(true);

  // Create and start game loop
  const gameLoop = new GameLoop(
    pathSystem,
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

  // Initialize Scale Manager
  const scaleManager = new ScaleManager();

  // Setup tower slot click detection
  setupTowerSlotClicks(emojiCanvas, uiController);

  // Expose for debugging
  window.gameLoop = gameLoop;
  window.audioSystem = audioSystem;
  window.uiController = uiController;
  window.scaleManager = scaleManager;
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
