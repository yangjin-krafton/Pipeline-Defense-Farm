/**
 * Audio System for procedural chiptune-style BGM mixing
 * Mixes per-instrument bar loops in real time with Web Audio API.
 */

export class AudioSystem {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.masterCompressor = null;
    this.instrumentGains = new Map();
    this.instrumentBuffers = new Map(); // key: "instrument_variant"
    this.activeSources = new Set();

    this.structure = null;
    this.barDuration = 3.2;
    this.totalBars = 0;
    this.currentBar = 0;
    this.nextBarTime = 0;
    this.schedulerId = null;

    this.isPlaying = false;
    this.volume = 0.5;
    this.startTime = 0;
    this.playheadSeconds = 0;
    this.loop = true;

    this.basePath = './assets/bgm';
    this.instruments = ['melody', 'harmony', 'bass', 'pad', 'drums', 'arpeggio'];
    this.variants = ['A', 'B', 'C'];
    this.surroundAmount = 0;
    this.panJitter = 0;
    this.gainRandomRange = 0.04;
    this.sectionDynamicsDepth = 0.25;
    this.fillBoostRange = 0.08;
    this.lowBandMonoAmount = 1;

    // Variation controls
    this.reverseChance = 0.18;
    this.fillChance = 0.22;
    this.densityBySection = {
      intro: 0.42,
      build: 0.6,
      verse: 0.72,
      chorus: 0.9,
      bridge: 0.48,
      chorus2: 0.94,
      outro: 0.5,
      default: 0.68
    };
  }

  /**
   * Initialize audio context (must be called after user interaction)
   */
  async init() {
    if (this.audioContext) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterCompressor = this.audioContext.createDynamicsCompressor();
      this.masterCompressor.threshold.value = -18;
      this.masterCompressor.knee.value = 16;
      this.masterCompressor.ratio.value = 2.5;
      this.masterCompressor.attack.value = 0.01;
      this.masterCompressor.release.value = 0.2;
      this.masterGain.connect(this.masterCompressor);
      this.masterCompressor.connect(this.audioContext.destination);
      this.masterGain.gain.value = this.volume;

      // Per-instrument channels to allow mixer-style balancing.
      for (const instrument of this.instruments) {
        const chain = this._createSpatialChain(instrument);
        this.instrumentGains.set(instrument, chain.inputGain);
      }

      // Dedicated drum-fill channel.
      const drumFillChain = this._createSpatialChain('drums', {
        baseGainScale: 0.58
      });
      this.instrumentGains.set('drums_fill', drumFillChain.inputGain);

      console.log('AudioSystem initialized');
    } catch (error) {
      console.error('Failed to initialize AudioSystem:', error);
    }
  }

  /**
   * Load structure + per-instrument samples.
   * Backward compatible: accepts previous wav path and resolves base folder.
   * @param {string} url - Base BGM asset hint (e.g. ./assets/bgm/game_theme.wav)
   */
  async loadBGM(url) {
    if (!this.audioContext) {
      await this.init();
    }

    try {
      this.basePath = this._resolveBasePath(url);
      await this._loadStructure(`${this.basePath}/game_theme_structure.json`);
      await this._loadInstrumentBuffers(`${this.basePath}/instruments`);
      console.log('Procedural BGM assets loaded');
    } catch (error) {
      console.error('Failed to load BGM:', error);
    }
  }

  /**
   * Play procedural BGM
   */
  play() {
    if (!this.audioContext || this.instrumentBuffers.size === 0) {
      console.warn('AudioSystem not initialized or instrument buffers not loaded');
      return;
    }

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    if (this.isPlaying) return;

    // Continue from paused playhead at nearest bar index.
    this.currentBar = Math.floor(this.playheadSeconds / this.barDuration);
    this.nextBarTime = this.audioContext.currentTime + 0.05;
    this.startTime = this.audioContext.currentTime - this.playheadSeconds;
    this.isPlaying = true;
    this._startScheduler();

    console.log('Procedural BGM playing');
  }

  /**
   * Pause BGM
   */
  pause() {
    if (!this.isPlaying) return;

    this.playheadSeconds = Math.max(0, this.audioContext.currentTime - this.startTime);
    this._stopScheduler();
    this._stopActiveSources();
    this.isPlaying = false;

    console.log('Procedural BGM paused');
  }

  /**
   * Stop BGM
   */
  stop() {
    this._stopScheduler();
    this._stopActiveSources();
    this.isPlaying = false;
    this.playheadSeconds = 0;
    this.currentBar = 0;
    this.nextBarTime = 0;
    this.startTime = 0;

    console.log('Procedural BGM stopped');
  }

  /**
   * Toggle play/pause
   */
  toggle() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Set volume (0.0 - 1.0)
   * @param {number} value - Volume level
   */
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  /**
   * Get current volume
   * @returns {number} Current volume
   */
  getVolume() {
    return this.volume;
  }

  /**
   * Fade in
   * @param {number} duration - Fade duration in seconds
   */
  fadeIn(duration = 2.0) {
    if (!this.masterGain) return;

    const currentTime = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(currentTime);
    this.masterGain.gain.setValueAtTime(0, currentTime);
    this.masterGain.gain.linearRampToValueAtTime(this.volume, currentTime + duration);

    console.log(`BGM fading in (${duration}s)`);
  }

  /**
   * Fade out
   * @param {number} duration - Fade duration in seconds
   */
  fadeOut(duration = 2.0) {
    if (!this.masterGain) return;

    const currentTime = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(currentTime);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0, currentTime + duration);

    setTimeout(() => {
      this.pause();
      this.masterGain.gain.value = this.volume;
    }, duration * 1000);

    console.log(`BGM fading out (${duration}s)`);
  }

  /**
   * Set loop mode
   * @param {boolean} enabled - Loop enabled
   */
  setLoop(enabled) {
    this.loop = enabled;
  }

  /**
   * Configure spatial sound stage.
   * @param {Object} options
   */
  setSpatialOptions(options = {}) {
    // Surround processing disabled for stable loudness.
    this.surroundAmount = 0;
    this.panJitter = 0;
    this.lowBandMonoAmount = 1;
  }

  /**
   * Configure procedural variation intensity.
   * @param {Object} options
   */
  setVariationOptions(options = {}) {
    if (typeof options.reverseChance === 'number') {
      this.reverseChance = Math.max(0, Math.min(1, options.reverseChance));
    }
    if (typeof options.fillChance === 'number') {
      this.fillChance = Math.max(0, Math.min(1, options.fillChance));
    }
    if (options.densityBySection && typeof options.densityBySection === 'object') {
      this.densityBySection = { ...this.densityBySection, ...options.densityBySection };
    }
    if (typeof options.gainRandomRange === 'number') {
      this.gainRandomRange = Math.max(0, Math.min(0.2, options.gainRandomRange));
    }
    if (typeof options.sectionDynamicsDepth === 'number') {
      this.sectionDynamicsDepth = Math.max(0, Math.min(1, options.sectionDynamicsDepth));
    }
    if (typeof options.fillBoostRange === 'number') {
      this.fillBoostRange = Math.max(0, Math.min(0.4, options.fillBoostRange));
    }
  }

  /**
   * Get playback state
   * @returns {Object} State object
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      volume: this.volume,
      loop: this.loop,
      currentTime: this.isPlaying
        ? Math.max(0, this.audioContext.currentTime - this.startTime)
        : this.playheadSeconds,
      duration: this.totalBars > 0 ? this.totalBars * this.barDuration : 0
    };
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.masterGain = null;
    this.masterCompressor = null;
    this.instrumentGains.clear();
    this.instrumentBuffers.clear();
    this.activeSources.clear();
    this.structure = null;
  }

  _resolveBasePath(url) {
    if (!url) return this.basePath;
    if (url.endsWith('.wav') || url.endsWith('.json')) {
      return url.slice(0, url.lastIndexOf('/'));
    }
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  async _loadStructure(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load structure: ${url}`);
    }

    this.structure = await response.json();
    const bpm = Number(this.structure?.bpm || 150);
    const beatsPerBar = Number(this.structure?.beats_per_bar || 8);
    this.barDuration = (60 / bpm) * beatsPerBar;
    this.totalBars = Number(this.structure?.total_bars || 0);
  }

  async _loadInstrumentBuffers(instrumentsPath) {
    const jobs = [];

    for (const instrument of this.instruments) {
      for (const variant of this.variants) {
        const key = `${instrument}_${variant}`;
        const file = `${instrumentsPath}/${key}.wav`;
        jobs.push(this._loadSample(file).then((buffer) => {
          this.instrumentBuffers.set(key, buffer);
        }));
      }
    }

    await Promise.all(jobs);
  }

  async _loadSample(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch sample: ${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return this.audioContext.decodeAudioData(arrayBuffer);
  }

  _defaultInstrumentGain(instrument) {
    switch (instrument) {
      case 'drums': return 0.75;
      case 'bass': return 0.68;
      case 'pad': return 0.5;
      case 'harmony': return 0.52;
      case 'arpeggio': return 0.48;
      case 'melody':
      default: return 0.62;
    }
  }

  _createSpatialChain(instrument, options = {}) {
    const inputGain = this.audioContext.createGain();
    inputGain.gain.value = this._defaultInstrumentGain(instrument) * (options.baseGainScale ?? 1);
    inputGain.connect(this.masterGain);
    return { inputGain };
  }

  _refreshSpatialProfiles() {
    // Surround processing disabled.
  }

  _getSpatialProfile(instrument, options = {}) {
    const profiles = {
      melody: { crossover: 1400, lowBandGain: 0.28, highBandGain: 0.95, width: 0.82, bias: 0.12, lowWidth: 0.12 },
      harmony: { crossover: 1150, lowBandGain: 0.4, highBandGain: 0.82, width: 0.68, bias: -0.12, lowWidth: 0.14 },
      bass: { crossover: 280, lowBandGain: 1.0, highBandGain: 0.2, width: 0.42, bias: 0.0, lowWidth: 0.02, lockLowPan: true },
      pad: { crossover: 900, lowBandGain: 0.62, highBandGain: 0.8, width: 0.9, bias: 0.0, lowWidth: 0.1 },
      drums: { crossover: 1900, lowBandGain: 0.72, highBandGain: 0.96, width: 1.0, bias: 0.04, lowWidth: 0.03, lockLowPan: true },
      arpeggio: { crossover: 2200, lowBandGain: 0.22, highBandGain: 1.0, width: 1.0, bias: 0.2, lowWidth: 0.1 }
    };
    const normalizedInstrument = instrument === 'drums_fill' ? 'drums' : instrument;
    const p = profiles[normalizedInstrument] || profiles.melody;
    const width = p.width * this.surroundAmount;
    const monoPull = this.lowBandMonoAmount;
    const lowWidth = (p.lowWidth ?? 0.1) * (1 - monoPull);
    const panBias = options.panBias ?? 0;
    return {
      crossover: p.crossover,
      lowBandGain: p.lowBandGain,
      highBandGain: p.highBandGain,
      lowPan: this._clampPan((p.bias + panBias) - (width * lowWidth)),
      highPan: this._clampPan((p.bias + panBias) + (width * 0.72)),
      lockLowPan: p.lockLowPan === true
    };
  }

  _clampPan(value) {
    return Math.max(-1, Math.min(1, value));
  }

  _startScheduler() {
    if (this.schedulerId) return;
    this.schedulerId = setInterval(() => this._scheduleAhead(), 100);
    this._scheduleAhead();
  }

  _stopScheduler() {
    if (!this.schedulerId) return;
    clearInterval(this.schedulerId);
    this.schedulerId = null;
  }

  _scheduleAhead() {
    if (!this.isPlaying || !this.audioContext) return;
    const scheduleAheadSeconds = 0.45;
    while (this.nextBarTime < this.audioContext.currentTime + scheduleAheadSeconds) {
      const scheduled = this._scheduleBar(this.currentBar, this.nextBarTime);
      if (!scheduled) break;
      this.currentBar += 1;
      this.nextBarTime += this.barDuration;
    }
  }

  _scheduleBar(barIndex, startTime) {
    const normalizedBar = this.totalBars > 0 ? (barIndex % this.totalBars) : barIndex;

    if (!this.loop && this.totalBars > 0 && barIndex >= this.totalBars) {
      this.pause();
      return false;
    }

    const reverseEnabled = this.totalBars > 1 && Math.random() < this.reverseChance;
    const sourceBarIndex = reverseEnabled
      ? (this.totalBars - 1 - normalizedBar)
      : normalizedBar;
    const barInfo = this.structure?.bars?.[sourceBarIndex] || this.structure?.bars?.[normalizedBar] || {};
    const sectionGain = Number(barInfo.gain ?? 1);
    const sectionMixGain = 1 + ((sectionGain - 1) * this.sectionDynamicsDepth);
    const selected = this._selectBarInstruments(barInfo);
    const mixCompensation = this._computeMixCompensation(selected, sectionMixGain);

    for (const instrument of selected) {
      const variant = this._pickVariant(barInfo, instrument);
      const key = `${instrument}_${variant}`;
      const buffer = this.instrumentBuffers.get(key);
      const gainNode = this.instrumentGains.get(instrument);
      if (!buffer || !gainNode) continue;

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      source.start(startTime);
      source.stop(startTime + this.barDuration);
      source.onended = () => this.activeSources.delete(source);
      this.activeSources.add(source);

      // Section dynamics + small random movement for less repetitive playback.
      const variation = 1 - this.gainRandomRange + (Math.random() * this.gainRandomRange * 2);
      const targetGain = this._defaultInstrumentGain(instrument) * sectionMixGain * mixCompensation * variation;
      gainNode.gain.setValueAtTime(Math.max(0.02, Math.min(1.2, targetGain)), startTime);
      this._animateSpatialForBar(instrument, startTime);
    }

    if (Math.random() < this.fillChance) {
      this._scheduleDrumFill(startTime, sectionMixGain, mixCompensation);
    }

    this.playheadSeconds = Math.max(0, normalizedBar * this.barDuration);
    return true;
  }

  _selectBarInstruments(barInfo) {
    const section = String(barInfo?.section || 'default');
    const density = this._getSectionDensity(section);
    const base = this.instruments.filter((inst) => barInfo?.instruments?.[inst]);
    const fallback = base.length > 0 ? base : ['drums', 'bass', 'pad'];

    // Keep groove stable with drums+bass most of the time.
    const selected = new Set();
    const drumsChance = Math.min(1, 0.45 + density * 0.6);
    const bassChance = Math.min(1, 0.4 + density * 0.6);
    if (fallback.includes('drums') && Math.random() < drumsChance) selected.add('drums');
    if (fallback.includes('bass') && Math.random() < bassChance) selected.add('bass');

    for (const instrument of fallback) {
      if (selected.has(instrument)) continue;
      if (Math.random() < density) selected.add(instrument);
    }

    if (selected.size === 0) {
      selected.add(fallback[Math.floor(Math.random() * fallback.length)]);
    }

    return Array.from(selected);
  }

  _pickVariant(barInfo, instrument) {
    const original = barInfo?.instruments?.[instrument]?.variant;
    // 65% follows score, 35% random variant for live-like variation.
    if (original && Math.random() < 0.65) {
      return original;
    }
    return this.variants[Math.floor(Math.random() * this.variants.length)];
  }

  _stopActiveSources() {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch (error) {
        // Source may already be stopped; ignore.
      }
    }
    this.activeSources.clear();
  }

  _getSectionDensity(section) {
    const value = this.densityBySection[section];
    if (typeof value === 'number') {
      return Math.max(0.1, Math.min(1, value));
    }
    return Math.max(0.1, Math.min(1, this.densityBySection.default ?? 0.68));
  }

  _scheduleDrumFill(startTime, sectionGain, mixCompensation = 1) {
    const gainNode = this.instrumentGains.get('drums_fill') || this.instrumentGains.get('drums');
    if (!gainNode) return;

    const variant = this.variants[Math.floor(Math.random() * this.variants.length)];
    const buffer = this.instrumentBuffers.get(`drums_${variant}`);
    if (!buffer) return;

    const fillStart = startTime + this.barDuration * (0.72 + Math.random() * 0.16);
    const fillDuration = Math.max(0.08, this.barDuration * (0.14 + Math.random() * 0.08));
    const maxOffset = Math.max(0, buffer.duration - fillDuration);
    const offset = maxOffset > 0 ? Math.random() * maxOffset : 0;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    source.start(fillStart, offset, fillDuration);
    source.stop(fillStart + fillDuration);
    source.onended = () => this.activeSources.delete(source);
    this.activeSources.add(source);

    const fillGain = (this._defaultInstrumentGain('drums') * sectionGain * mixCompensation) * (1 + Math.random() * this.fillBoostRange);
    gainNode.gain.setValueAtTime(Math.max(0.02, Math.min(1.2, fillGain)), fillStart);
    this._animateSpatialForBar('drums_fill', fillStart, fillDuration);
  }

  _computeMixCompensation(selected, sectionMixGain) {
    if (!selected || selected.length === 0) return 1;

    let sum = 0;
    for (const instrument of selected) {
      sum += this._defaultInstrumentGain(instrument);
    }

    const target = 2.1;
    const raw = target / Math.max(0.3, sum * Math.max(0.5, sectionMixGain));
    return Math.max(0.78, Math.min(1.2, raw));
  }

  _animateSpatialForBar(instrument, startTime, duration = this.barDuration) {
    // Surround processing disabled.
  }
}
