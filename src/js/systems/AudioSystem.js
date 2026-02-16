/**
 * Audio System for BGM and Sound Effects
 * Uses Web Audio API for high-quality audio playback
 */

export class AudioSystem {
  constructor() {
    this.audioContext = null;
    this.bgmBuffer = null;
    this.bgmSource = null;
    this.gainNode = null;
    this.isPlaying = false;
    this.volume = 0.5;
    this.startTime = 0;
    this.pauseTime = 0;
    this.loop = true;
  }

  /**
   * Initialize audio context (must be called after user interaction)
   */
  async init() {
    if (this.audioContext) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = this.volume;
      console.log('AudioSystem initialized');
    } catch (error) {
      console.error('Failed to initialize AudioSystem:', error);
    }
  }

  /**
   * Load BGM from URL
   * @param {string} url - URL to audio file
   */
  async loadBGM(url) {
    if (!this.audioContext) {
      await this.init();
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.bgmBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log(`BGM loaded: ${url} (${this.bgmBuffer.duration.toFixed(1)}s)`);
    } catch (error) {
      console.error('Failed to load BGM:', error);
    }
  }

  /**
   * Play BGM
   */
  play() {
    if (!this.audioContext || !this.bgmBuffer) {
      console.warn('AudioSystem not initialized or BGM not loaded');
      return;
    }

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // Stop current source if playing
    if (this.bgmSource) {
      this.bgmSource.stop();
    }

    // Create new source
    this.bgmSource = this.audioContext.createBufferSource();
    this.bgmSource.buffer = this.bgmBuffer;
    this.bgmSource.loop = this.loop;
    this.bgmSource.connect(this.gainNode);

    // Start playback
    const offset = this.pauseTime % this.bgmBuffer.duration;
    this.bgmSource.start(0, offset);
    this.startTime = this.audioContext.currentTime - offset;
    this.isPlaying = true;

    console.log('BGM playing');
  }

  /**
   * Pause BGM
   */
  pause() {
    if (!this.isPlaying || !this.bgmSource) return;

    const elapsed = this.audioContext.currentTime - this.startTime;
    this.pauseTime = elapsed;
    this.bgmSource.stop();
    this.bgmSource = null;
    this.isPlaying = false;

    console.log('BGM paused');
  }

  /**
   * Stop BGM
   */
  stop() {
    if (this.bgmSource) {
      this.bgmSource.stop();
      this.bgmSource = null;
    }
    this.isPlaying = false;
    this.pauseTime = 0;
    this.startTime = 0;

    console.log('BGM stopped');
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
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
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
    if (!this.gainNode) return;

    const currentTime = this.audioContext.currentTime;
    this.gainNode.gain.cancelScheduledValues(currentTime);
    this.gainNode.gain.setValueAtTime(0, currentTime);
    this.gainNode.gain.linearRampToValueAtTime(this.volume, currentTime + duration);

    console.log(`BGM fading in (${duration}s)`);
  }

  /**
   * Fade out
   * @param {number} duration - Fade duration in seconds
   */
  fadeOut(duration = 2.0) {
    if (!this.gainNode) return;

    const currentTime = this.audioContext.currentTime;
    this.gainNode.gain.cancelScheduledValues(currentTime);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, currentTime);
    this.gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

    setTimeout(() => {
      this.pause();
      this.gainNode.gain.value = this.volume;
    }, duration * 1000);

    console.log(`BGM fading out (${duration}s)`);
  }

  /**
   * Set loop mode
   * @param {boolean} enabled - Loop enabled
   */
  setLoop(enabled) {
    this.loop = enabled;
    if (this.bgmSource) {
      this.bgmSource.loop = enabled;
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
        ? this.audioContext.currentTime - this.startTime
        : this.pauseTime,
      duration: this.bgmBuffer ? this.bgmBuffer.duration : 0
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
    this.bgmBuffer = null;
    this.gainNode = null;
  }
}
