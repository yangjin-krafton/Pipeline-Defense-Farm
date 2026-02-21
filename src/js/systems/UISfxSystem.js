/**
 * UI SFX playback system.
 * Loads generated wav files from src/assets/sfx via manifest and plays event-based variants.
 */
export class UISfxSystem {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.enabled = true;
    this.volume = 0.55;
    this.buffersByEvent = new Map();
  }

  async init(audioContext = null) {
    if (audioContext) {
      this.audioContext = audioContext;
    } else if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (!this.masterGain) {
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.audioContext.destination);
    }
  }

  async loadFromManifest(manifestUrl = './assets/sfx/sfx_manifest.json', basePath = './assets/sfx') {
    if (!this.audioContext) {
      await this.init();
    }

    const response = await fetch(manifestUrl);
    if (!response.ok) {
      throw new Error(`Failed to load SFX manifest: ${manifestUrl}`);
    }

    const manifest = await response.json();
    const events = manifest?.events || {};
    const jobs = [];

    for (const [eventName, files] of Object.entries(events)) {
      if (!Array.isArray(files) || files.length === 0) continue;
      jobs.push(this._loadEventBuffers(eventName, files, basePath));
    }

    await Promise.all(jobs);
  }

  setEnabled(value) {
    this.enabled = !!value;
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  play(eventName, options = {}) {
    if (!this.enabled || !this.audioContext || !this.masterGain) return;

    const buffers = this.buffersByEvent.get(eventName);
    if (!buffers || buffers.length === 0) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const index = Math.floor(Math.random() * buffers.length);
    const buffer = buffers[index];
    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.audioContext.createGain();
    const volume = options.volume ?? 1.0;
    gainNode.gain.value = Math.max(0, Math.min(2, volume));

    source.connect(gainNode);
    gainNode.connect(this.masterGain);
    source.start();
  }

  async _loadEventBuffers(eventName, files, basePath) {
    const jobs = files.map(async (fileName) => {
      const url = `${basePath}/${fileName}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load SFX file: ${url}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return this.audioContext.decodeAudioData(arrayBuffer);
    });

    const buffers = await Promise.all(jobs);
    this.buffersByEvent.set(eventName, buffers);
  }
}
