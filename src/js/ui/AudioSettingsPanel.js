/**
 * Audio Settings Panel
 * Floating panel for BGM/SFX volume control, toggled from music-btn.
 * Settings are persisted to localStorage.
 */

const STORAGE_KEY = 'pdf_audio_settings';

export class AudioSettingsPanel {
  constructor(audioSystem, uiSfxSystem) {
    this.audioSystem = audioSystem;
    this.uiSfxSystem = uiSfxSystem;
    this.isOpen = false;
    this.panelEl = null;
    this._onOutsideClick = this._onOutsideClick.bind(this);
    this._build();
  }

  /**
   * Apply stored volume/enabled settings to audio systems.
   * Call once after construction, before game starts.
   */
  applyStoredSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);

      if (typeof s.bgmVolume === 'number') {
        this.audioSystem.setVolume(s.bgmVolume);
      }
      if (typeof s.sfxVolume === 'number') {
        this.uiSfxSystem.setVolume(s.sfxVolume);
      }
      if (typeof s.sfxEnabled === 'boolean') {
        this.uiSfxSystem.setEnabled(s.sfxEnabled);
      }
    } catch (_) {
      // Ignore corrupt or unavailable storage
    }
  }

  open() {
    this.isOpen = true;
    this._syncUI();
    this.panelEl.classList.add('open');
    setTimeout(() => {
      document.addEventListener('pointerdown', this._onOutsideClick);
    }, 0);
  }

  close() {
    this.isOpen = false;
    this.panelEl.classList.remove('open');
    document.removeEventListener('pointerdown', this._onOutsideClick);
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  _build() {
    this.panelEl = document.createElement('div');
    this.panelEl.className = 'audio-settings-panel';
    this.panelEl.innerHTML = `
      <div class="asp-title">🎵 음악 설정</div>

      <div class="asp-section">
        <div class="asp-label">🎼 배경음악 (BGM)</div>
        <div class="asp-row">
          <button class="asp-toggle" id="aspBgmToggle" data-active="true">켜짐</button>
          <div class="asp-slider-wrap">
            <input type="range" class="asp-slider" id="aspBgmSlider" min="0" max="100" step="1" value="40">
          </div>
          <span class="asp-pct" id="aspBgmPct">40%</span>
        </div>
      </div>

      <div class="asp-section">
        <div class="asp-label">🔊 효과음 (SFX)</div>
        <div class="asp-row">
          <button class="asp-toggle" id="aspSfxToggle" data-active="true">켜짐</button>
          <div class="asp-slider-wrap">
            <input type="range" class="asp-slider" id="aspSfxSlider" min="0" max="100" step="1" value="52">
          </div>
          <span class="asp-pct" id="aspSfxPct">52%</span>
        </div>
      </div>
    `;

    const gameScreen = document.getElementById('game-screen');
    (gameScreen ?? document.body).appendChild(this.panelEl);

    this._bindListeners();
  }

  _bindListeners() {
    const bgmToggle = this.panelEl.querySelector('#aspBgmToggle');
    const bgmSlider = this.panelEl.querySelector('#aspBgmSlider');
    const sfxToggle = this.panelEl.querySelector('#aspSfxToggle');
    const sfxSlider = this.panelEl.querySelector('#aspSfxSlider');

    bgmToggle.addEventListener('click', () => {
      this.audioSystem.toggle();
      this._updateBgmToggle(this.audioSystem.isPlaying);
      this._updateSliderFill(bgmSlider);
      this._save();
      if (typeof window.updateMusicButton === 'function') {
        window.updateMusicButton(this.audioSystem.isPlaying);
      }
    });

    bgmSlider.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      this.audioSystem.setVolume(pct / 100);
      this.panelEl.querySelector('#aspBgmPct').textContent = `${pct}%`;
      this._updateSliderFill(e.target);
      this._save();
    });

    sfxToggle.addEventListener('click', () => {
      const next = !this.uiSfxSystem.enabled;
      this.uiSfxSystem.setEnabled(next);
      this._updateSfxToggle(next);
      this._save();
    });

    sfxSlider.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      this.uiSfxSystem.setVolume(pct / 100);
      this.panelEl.querySelector('#aspSfxPct').textContent = `${pct}%`;
      this._updateSliderFill(e.target);
      this._save();
    });
  }

  _syncUI() {
    const bgmPct = Math.round(this.audioSystem.getVolume() * 100);
    const sfxPct = Math.round(this.uiSfxSystem.volume * 100);
    const bgmSlider = this.panelEl.querySelector('#aspBgmSlider');
    const sfxSlider = this.panelEl.querySelector('#aspSfxSlider');

    this._updateBgmToggle(this.audioSystem.isPlaying);
    bgmSlider.value = bgmPct;
    this.panelEl.querySelector('#aspBgmPct').textContent = `${bgmPct}%`;
    this._updateSliderFill(bgmSlider);

    this._updateSfxToggle(this.uiSfxSystem.enabled);
    sfxSlider.value = sfxPct;
    this.panelEl.querySelector('#aspSfxPct').textContent = `${sfxPct}%`;
    this._updateSliderFill(sfxSlider);
  }

  _updateBgmToggle(isPlaying) {
    const btn = this.panelEl.querySelector('#aspBgmToggle');
    btn.textContent = isPlaying ? '켜짐' : '꺼짐';
    btn.dataset.active = String(isPlaying);
  }

  _updateSfxToggle(isEnabled) {
    const btn = this.panelEl.querySelector('#aspSfxToggle');
    btn.textContent = isEnabled ? '켜짐' : '꺼짐';
    btn.dataset.active = String(isEnabled);
  }

  _updateSliderFill(slider) {
    const min = Number(slider.min) || 0;
    const max = Number(slider.max) || 100;
    const pct = ((Number(slider.value) - min) / (max - min)) * 100;
    slider.style.background =
      `linear-gradient(to right, var(--splat-cyan) 0%, var(--splat-cyan) ${pct}%, #d1d5db ${pct}%, #d1d5db 100%)`;
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        bgmVolume: this.audioSystem.getVolume(),
        bgmEnabled: this.audioSystem.isPlaying,
        sfxVolume: this.uiSfxSystem.volume,
        sfxEnabled: this.uiSfxSystem.enabled,
      }));
    } catch (_) {
      // Private browsing or storage full
    }
  }

  _onOutsideClick(e) {
    const musicBtn = document.querySelector('.music-btn');
    if (
      !this.panelEl.contains(e.target) &&
      e.target !== musicBtn &&
      !musicBtn?.contains(e.target)
    ) {
      this.close();
    }
  }
}
