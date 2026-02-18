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
import { PathEditor } from './editor/PathEditor.js';

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

      pathEditor = new PathEditor(canvas, PATH_POINTS, (newPoints) => {
        // Update path in real-time
        updatePathVisuals(newPoints, webglRenderer, staticMeshes);
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

      // Show editor UI
      showEditorUI();
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
      hideEditorUI();
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
}

/**
 * Update path visuals with new points
 */
function updatePathVisuals(points, webglRenderer, staticMeshes) {
  // Rebuild track meshes with new points
  staticMeshes.trackShadow = webglRenderer.createMesh(buildPolylineMesh(points, 42, 2, 3));
  staticMeshes.trackMain = webglRenderer.createMesh(buildPolylineMesh(points, 34, 0, 0));
  staticMeshes.trackEdge = webglRenderer.createMesh(buildPolylineMesh(points, 5, 0, 0));
}

/**
 * Show editor UI overlay
 */
function showEditorUI() {
  let overlay = document.getElementById('editor-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'editor-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 20px;
      border-radius: 12px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
      border: 2px solid #4ECDC4;
      min-width: 280px;
    `;
    overlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 15px; color: #4ECDC4; font-size: 14px;">
        🎨 PATH EDITOR ACTIVE
      </div>

      <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #444;">
        <div style="margin-bottom: 5px;"><strong>Controls:</strong></div>
        <div>• Ctrl+Shift+E: Toggle Editor</div>
        <div>• G: Toggle Grid Snap</div>
        <div>• E: Copy to Clipboard</div>
        <div style="color: #FFD700;">• S: Save to config.js ⭐</div>
      </div>

      <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #444;">
        <div style="margin-bottom: 5px;"><strong>Mouse:</strong></div>
        <div>• Left Click: Add/Drag Point</div>
        <div>• Right Click: Delete Point</div>
        <div>• Delete Key: Remove Point</div>
      </div>

      <div style="text-align: center; margin-top: 15px;">
        <button id="saveConfigBtn" style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          font-family: monospace;
          font-size: 12px;
          font-weight: bold;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: all 0.2s;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
          💾 Save to config.js
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    // Add click handler for save button
    const saveBtn = document.getElementById('saveConfigBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const pathEditor = window.getPathEditor();
        if (pathEditor) {
          pathEditor.saveToConfigFile();
        }
      });
    }
  }
  overlay.style.display = 'block';
}

/**
 * Hide editor UI overlay
 */
function hideEditorUI() {
  const overlay = document.getElementById('editor-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

/**
 * Setup canvas click handler for tower slots
 */
function setupTowerSlotClicks(container, uiController, scaleManager) {
  container.addEventListener('click', (e) => {
    // Ignore clicks when path editor is active
    if (window.isPathEditorActive && window.isPathEditorActive()) {
      return;
    }

    console.log('Container clicked');

    // Get container rect
    const rect = container.getBoundingClientRect();

    // Get click position relative to container
    const containerX = e.clientX - rect.left;
    const containerY = e.clientY - rect.top;

    console.log('Container relative:', containerX, containerY);

    // Calculate canvas dimensions and offset (same logic as fitCanvas)
    const gameAreaWidth = 640;
    const gameAreaHeight = 1063;
    const scale = Math.min(gameAreaWidth / VIRTUAL_W, gameAreaHeight / VIRTUAL_H);
    const cssW = Math.round(VIRTUAL_W * scale);
    const cssH = Math.round(VIRTUAL_H * scale);
    const offsetX = (gameAreaWidth - cssW) / 2;
    const offsetY = (gameAreaHeight - cssH) / 2;

    // Adjust for canvas offset
    const canvasX = containerX - offsetX;
    const canvasY = containerY - offsetY;

    console.log('Canvas offset:', offsetX, offsetY);
    console.log('Canvas relative:', canvasX, canvasY);

    // Check if click is within canvas bounds
    if (canvasX < 0 || canvasX > cssW || canvasY < 0 || canvasY > cssH) {
      console.log('Click outside canvas bounds');
      return;
    }

    // Convert to virtual coordinates (360x640)
    const virtualX = (canvasX / cssW) * VIRTUAL_W;
    const virtualY = (canvasY / cssH) * VIRTUAL_H;

    console.log('Virtual coords:', virtualX, virtualY);

    // Check if click is on a tower slot
    const slot = checkTowerSlotClick(virtualX, virtualY);
    if (slot) {
      console.log('Tower slot clicked!', slot);
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

  // Setup tower slot click detection on container (canvas may not receive events properly)
  const canvasContainer = document.querySelector('.canvas-container');
  setupTowerSlotClicks(canvasContainer, uiController, scaleManager);

  // Setup path editor (dev mode)
  setupPathEditor(emojiCanvas, gameLoop, webglRenderer, staticMeshes);

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
