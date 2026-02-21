"""
16-bit game SFX generator.

Creates a small chiptune-style SFX bank as 16-bit mono WAV files.

Usage:
  python src/utils/sfx_16bit_generator.py
  python src/utils/sfx_16bit_generator.py --seed 7 --variants 4
  python src/utils/sfx_16bit_generator.py --output-dir src/assets/sfx
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import wave
from array import array

SAMPLE_RATE = 44100
MAX_AMP = 32767


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def ease_out_cubic(t: float) -> float:
    x = clamp(t, 0.0, 1.0)
    return 1.0 - ((1.0 - x) ** 3)


def envelope(t: float, dur: float, atk: float, dec: float, sus: float, rel: float) -> float:
    release_start = max(0.0, dur - rel)
    if t < atk:
        return t / atk if atk > 0.0 else 1.0
    if t < atk + dec:
        return 1.0 - (1.0 - sus) * ((t - atk) / dec)
    if t < release_start:
        return sus
    if t < dur and rel > 0.0:
        return sus * (1.0 - (t - release_start) / rel)
    return 0.0


def phase_sine(phase: float) -> float:
    return math.sin(2.0 * math.pi * phase)


def phase_square(phase: float, duty: float = 0.5) -> float:
    return 1.0 if (phase % 1.0) < duty else -1.0


def phase_triangle(phase: float) -> float:
    t = phase % 1.0
    return 4.0 * t - 1.0 if t < 0.5 else 3.0 - (4.0 * t)


def noise(rng: random.Random) -> float:
    return rng.uniform(-1.0, 1.0)


def render_shot(rng: random.Random, duration: float, variant: int) -> array:
    samples = array("f")
    n = int(SAMPLE_RATE * duration)
    base_start = 1600.0 + rng.uniform(-140.0, 120.0) + variant * 25.0
    base_end = 280.0 + rng.uniform(-40.0, 45.0)
    click_boost = 0.22 + rng.uniform(-0.04, 0.05)

    for i in range(n):
        t = i / SAMPLE_RATE
        prog = i / max(1, n - 1)
        pitch = base_start + (base_end - base_start) * ease_out_cubic(prog)
        main = phase_square(pitch * t, duty=0.35 + rng.uniform(-0.03, 0.03))
        sub = phase_triangle((pitch * 0.52) * t)
        bite = noise(rng) * (1.0 - prog) * click_boost
        env = envelope(t, duration, atk=0.001, dec=0.045, sus=0.25, rel=0.05)
        samples.append((main * 0.65 + sub * 0.25 + bite) * env)
    return samples


def render_hit(rng: random.Random, duration: float, variant: int) -> array:
    samples = array("f")
    n = int(SAMPLE_RATE * duration)
    freq = 180.0 + variant * 16.0 + rng.uniform(-20.0, 22.0)
    for i in range(n):
        t = i / SAMPLE_RATE
        prog = i / max(1, n - 1)
        tonal = phase_triangle(freq * t) * (0.7 + 0.2 * (1.0 - prog))
        noisy = noise(rng) * (0.45 - 0.3 * prog)
        env = envelope(t, duration, atk=0.0, dec=0.02, sus=0.15, rel=0.06)
        samples.append((tonal * 0.75 + noisy * 0.55) * env)
    return samples


def render_crit(rng: random.Random, duration: float, variant: int) -> array:
    samples = array("f")
    n = int(SAMPLE_RATE * duration)
    f1 = 1200.0 + variant * 40.0 + rng.uniform(-40.0, 60.0)
    f2 = f1 * 1.5
    for i in range(n):
        t = i / SAMPLE_RATE
        prog = i / max(1, n - 1)
        chirp = phase_square((f1 + 800.0 * prog) * t, 0.3)
        ring = phase_sine((f2 + 1000.0 * prog) * t)
        env = envelope(t, duration, atk=0.002, dec=0.04, sus=0.2, rel=0.08)
        sparkle = noise(rng) * (0.12 + 0.1 * (1.0 - prog))
        samples.append((chirp * 0.58 + ring * 0.36 + sparkle) * env)
    return samples


def render_explosion(rng: random.Random, duration: float, variant: int, big: bool) -> array:
    samples = array("f")
    n = int(SAMPLE_RATE * duration)
    low_start = (170.0 if big else 230.0) + variant * 9.0
    low_end = 48.0 if big else 85.0
    grit = 0.95 if big else 0.72

    for i in range(n):
        t = i / SAMPLE_RATE
        prog = i / max(1, n - 1)
        low = low_start + (low_end - low_start) * ease_out_cubic(prog)
        boom = phase_sine(low * t)
        rumble = phase_triangle((low * 0.35) * t)
        hiss = noise(rng) * (1.0 - prog) * grit
        env = envelope(t, duration, atk=0.0, dec=0.08 if big else 0.05, sus=0.42 if big else 0.3, rel=0.2 if big else 0.11)
        samples.append((boom * 0.58 + rumble * 0.32 + hiss * 0.68) * env)
    return samples


def render_ui_click(rng: random.Random, duration: float, variant: int) -> array:
    samples = array("f")
    n = int(SAMPLE_RATE * duration)
    f = 980.0 + variant * 25.0 + rng.uniform(-10.0, 15.0)
    for i in range(n):
        t = i / SAMPLE_RATE
        tick = phase_square((f + 150.0) * t, duty=0.2)
        body = phase_sine(f * t)
        env = envelope(t, duration, atk=0.0, dec=0.015, sus=0.12, rel=0.03)
        samples.append((tick * 0.6 + body * 0.3) * env)
    return samples


def render_ui_error(rng: random.Random, duration: float, variant: int) -> array:
    samples = array("f")
    n = int(SAMPLE_RATE * duration)
    f_start = 260.0 + variant * 8.0
    f_end = 140.0
    for i in range(n):
        t = i / SAMPLE_RATE
        prog = i / max(1, n - 1)
        f = f_start + (f_end - f_start) * prog
        main = phase_square(f * t, duty=0.5)
        env = envelope(t, duration, atk=0.0, dec=0.07, sus=0.25, rel=0.12)
        samples.append(main * env * 0.78)
    return samples


def render_wave_start(rng: random.Random, duration: float, variant: int) -> array:
    samples = array("f")
    n = int(SAMPLE_RATE * duration)
    root = 380.0 + variant * 12.0
    for i in range(n):
        t = i / SAMPLE_RATE
        prog = i / max(1, n - 1)
        f = root + (root * 1.35 * prog)
        main = phase_triangle(f * t)
        top = phase_square((f * 2.01) * t, duty=0.25)
        env = envelope(t, duration, atk=0.002, dec=0.08, sus=0.4, rel=0.16)
        samples.append((main * 0.65 + top * 0.22) * env)
    return samples


def render_wave_clear(rng: random.Random, duration: float, variant: int) -> array:
    samples = array("f")
    n = int(SAMPLE_RATE * duration)
    root = 520.0 + variant * 18.0
    for i in range(n):
        t = i / SAMPLE_RATE
        prog = i / max(1, n - 1)
        f = root + (root * 0.7 * ease_out_cubic(prog))
        main = phase_square(f * t, duty=0.4)
        harmony = phase_sine((f * 1.5) * t)
        env = envelope(t, duration, atk=0.003, dec=0.06, sus=0.35, rel=0.18)
        samples.append((main * 0.48 + harmony * 0.44) * env)
    return samples


def render_tower_place(rng: random.Random, duration: float, variant: int) -> array:
    samples = array("f")
    n = int(SAMPLE_RATE * duration)
    f1 = 280.0 + variant * 10.0
    f2 = 360.0 + variant * 14.0
    split = int(n * 0.6)
    for i in range(n):
        t = i / SAMPLE_RATE
        f = f1 if i < split else f2
        wave_a = phase_triangle(f * t)
        wave_b = phase_square((f * 2.0) * t, duty=0.3)
        env = envelope(t, duration, atk=0.001, dec=0.05, sus=0.24, rel=0.1)
        samples.append((wave_a * 0.62 + wave_b * 0.18) * env)
    return samples


def render_tower_upgrade(rng: random.Random, duration: float, variant: int) -> array:
    samples = array("f")
    n = int(SAMPLE_RATE * duration)
    base = 420.0 + variant * 16.0
    for i in range(n):
        t = i / SAMPLE_RATE
        prog = i / max(1, n - 1)
        # Three-segment rising effect.
        if prog < 0.33:
            f = base
        elif prog < 0.66:
            f = base * 1.26
        else:
            f = base * 1.52
        voice = phase_square(f * t, duty=0.4)
        shine = phase_sine((f * 2.0) * t)
        env = envelope(t, duration, atk=0.001, dec=0.09, sus=0.35, rel=0.14)
        samples.append((voice * 0.52 + shine * 0.34) * env)
    return samples


def normalize(samples: array, peak_target: float = 0.9) -> array:
    peak = max(abs(v) for v in samples) if samples else 1.0
    if peak <= 1e-9:
        return samples
    scale = peak_target / peak
    return array("f", (clamp(v * scale, -1.0, 1.0) for v in samples))


def write_wav(path: str, samples: array) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pcm = array("h", (int(clamp(v, -1.0, 1.0) * MAX_AMP) for v in samples))
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm.tobytes())


def build_bank(seed: int | None, variants: int) -> dict:
    rng = random.Random(seed)
    return {
        "shot": {"duration": 0.14, "renderer": render_shot, "variants": variants},
        "hit": {"duration": 0.12, "renderer": render_hit, "variants": variants},
        "crit": {"duration": 0.18, "renderer": render_crit, "variants": variants},
        "explosion_small": {"duration": 0.24, "renderer": lambda r, d, v: render_explosion(r, d, v, False), "variants": variants},
        "explosion_big": {"duration": 0.42, "renderer": lambda r, d, v: render_explosion(r, d, v, True), "variants": variants},
        "ui_click": {"duration": 0.08, "renderer": render_ui_click, "variants": max(2, variants // 2)},
        "ui_error": {"duration": 0.2, "renderer": render_ui_error, "variants": max(2, variants // 2)},
        "wave_start": {"duration": 0.26, "renderer": render_wave_start, "variants": max(2, variants // 2)},
        "wave_clear": {"duration": 0.3, "renderer": render_wave_clear, "variants": max(2, variants // 2)},
        "tower_place": {"duration": 0.16, "renderer": render_tower_place, "variants": variants},
        "tower_upgrade": {"duration": 0.28, "renderer": render_tower_upgrade, "variants": variants},
    }


def generate_sfx(output_dir: str, seed: int | None, variants: int, dry_run: bool = False) -> dict:
    bank = build_bank(seed, variants)
    os.makedirs(output_dir, exist_ok=True)

    files = {}
    total = 0
    for event_name, spec in bank.items():
        event_files = []
        event_seed = sum(ord(ch) for ch in event_name)
        for idx in range(spec["variants"]):
            variant_seed = (seed or 0) + (event_seed * 97) + (idx * 13)
            samples = spec["renderer"](random.Random(variant_seed), spec["duration"], idx)
            samples = normalize(samples, peak_target=0.9)
            filename = f"{event_name}_{idx + 1}.wav"
            path = os.path.join(output_dir, filename)
            if not dry_run:
                write_wav(path, samples)
            event_files.append(filename)
            total += 1
            print(f"  {filename:26s} | {len(samples) / SAMPLE_RATE:>4.2f}s")
        files[event_name] = event_files

    manifest = {
        "format": "wav_pcm_16_mono",
        "sample_rate": SAMPLE_RATE,
        "seed": seed,
        "events": files,
        "count": total,
    }

    manifest_path = os.path.join(output_dir, "sfx_manifest.json")
    if not dry_run:
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

    print()
    print(f"[DONE] Generated {total} files")
    print(f"       Output: {output_dir}")
    print(f"       Manifest: {manifest_path}")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate 16-bit chiptune-style game SFX bank.")
    parser.add_argument("--output-dir", type=str, default="src/assets/sfx")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--variants", type=int, default=3, help="Variants per main event (>=1)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    variants = max(1, args.variants)

    print("=" * 58)
    print("  16-bit Game SFX Generator")
    print("=" * 58)
    print(f"  output_dir : {args.output_dir}")
    print(f"  seed       : {args.seed}")
    print(f"  variants   : {variants}")
    print()

    generate_sfx(args.output_dir, args.seed, variants, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
