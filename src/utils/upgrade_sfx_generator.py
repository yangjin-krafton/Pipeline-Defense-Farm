"""
Upgrade-grade SFX generator — 축제 느낌 (festival-style chiptune).

Generates 6 grade-reveal sounds (SSS / SS / S / A / B / C),
each with 2 variants, and appends them to the existing sfx_manifest.json.

Usage:
  python src/utils/upgrade_sfx_generator.py
  python src/utils/upgrade_sfx_generator.py --output-dir src/assets/sfx --seed 2026
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

# ── C major scale note frequencies ──────────────────────────────────────────
C4, D4, E4, F4, G4, A4, B4 = 261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88
C5, D5, E5, F5, G5, A5, B5 = 523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77
C6, E6, G6 = 1046.50, 1318.51, 1567.98


def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def ease_out(t):
    x = clamp(t, 0.0, 1.0)
    return 1.0 - (1.0 - x) ** 3

def sine(f, t):     return math.sin(2.0 * math.pi * f * t)
def square(f, t, d=0.5): return 1.0 if (f * t % 1.0) < d else -1.0
def tri(f, t):
    p = (f * t) % 1.0
    return 4.0 * p - 1.0 if p < 0.5 else 3.0 - 4.0 * p
def nz(rng):        return rng.uniform(-1.0, 1.0)

def env(t, dur, a, d, s, r):
    rs = max(0.0, dur - r)
    if t < a:             return t / a if a > 0 else 1.0
    if t < a + d:         return 1.0 - (1.0 - s) * ((t - a) / d)
    if t < rs:            return s
    if t < dur and r > 0: return s * (1.0 - (t - rs) / r)
    return 0.0


# ── Grade render functions ───────────────────────────────────────────────────

def render_upgrade_reveal_c(rng, dur, variant):
    """C — 조용한 단일 딩 (soft single ding)."""
    s, n = array("f"), int(SAMPLE_RATE * dur)
    f = C4 * (1.0 + variant * 0.012)
    for i in range(n):
        t = i / SAMPLE_RATE
        tone = sine(f, t) * 0.55 + sine(f * 2.0, t) * 0.18
        e = env(t, dur, 0.002, 0.05, 0.08, 0.10)
        s.append(tone * e)
    return s


def render_upgrade_reveal_b(rng, dur, variant):
    """B — 짧은 상승 딩 (short rising ding)."""
    s, n = array("f"), int(SAMPLE_RATE * dur)
    f0, f1 = D4 + variant * 6.0, G4 + variant * 6.0
    for i in range(n):
        t = i / SAMPLE_RATE
        prog = i / max(1, n - 1)
        f = f0 + (f1 - f0) * ease_out(prog)
        tone = tri(f, t) * 0.50 + sine(f * 2.0, t) * 0.22
        e = env(t, dur, 0.002, 0.07, 0.15, 0.12)
        s.append(tone * e)
    return s


def render_upgrade_reveal_a(rng, dur, variant):
    """A — 3음 상승 아르페지오 (3-note ascending arpeggio)."""
    s, n = array("f"), int(SAMPLE_RATE * dur)
    notes = [C4, E4, G4]
    nd = dur / len(notes)
    for i in range(n):
        t = i / SAMPLE_RATE
        ni = min(int(t / nd), len(notes) - 1)
        f = notes[ni] * (1.0 + variant * 0.01)
        lt = t - ni * nd
        tone = sine(f, t) * 0.52 + sine(f * 2.0, t) * 0.24 + tri(f * 0.5, t) * 0.14
        e = env(lt, nd * 0.9, 0.002, 0.04, 0.3, 0.07)
        s.append(tone * e)
    return s


def render_upgrade_reveal_s(rng, dur, variant):
    """S — 반짝이는 상승 스윕 (sparkling ascending sweep)."""
    s, n = array("f"), int(SAMPLE_RATE * dur)
    f0, f1 = G4 + variant * 12.0, G5 + variant * 12.0
    for i in range(n):
        t = i / SAMPLE_RATE
        prog = i / max(1, n - 1)
        f = f0 + (f1 - f0) * ease_out(prog)
        tone  = square(f, t, 0.38) * 0.38 + sine(f, t) * 0.38
        above = sine(f * 2.0, t) * 0.18
        spark = nz(rng) * 0.10 * (1.0 - prog)
        e = env(t, dur, 0.003, 0.09, 0.35, 0.14)
        s.append((tone + above + spark) * e)
    return s


def render_upgrade_reveal_ss(rng, dur, variant):
    """SS — 5음 팡파르 + 반짝임 (5-note fanfare + sparkle)."""
    s, n = array("f"), int(SAMPLE_RATE * dur)
    notes = [C4, E4, G4, C5, E5]
    nd = dur / len(notes)
    for i in range(n):
        t = i / SAMPLE_RATE
        prog = i / max(1, n - 1)
        ni = min(int(t / nd), len(notes) - 1)
        f = notes[ni] * (1.0 + variant * 0.01)
        lt = t - ni * nd
        bell = (sine(f, t) * 0.45 + sine(f * 2.0, t) * 0.25 +
                sine(f * 3.0, t) * 0.12 + square(f, t, 0.35) * 0.16)
        spark = nz(rng) * 0.09
        # 전체 볼륨은 뒤쪽으로 서서히 커짐 (마지막 음에서 최대)
        overall = 0.5 + 0.5 * ease_out(prog)
        e = env(lt, nd * 0.85, 0.002, 0.03, 0.45, 0.06)
        s.append((bell + spark) * e * overall * 0.85)
    return s


def render_upgrade_reveal_sss(rng, dur, variant):
    """SSS — 7음 대축제 팡파르 (grand 7-note festival fanfare)."""
    s, n = array("f"), int(SAMPLE_RATE * dur)
    notes = [C4, E4, G4, C5, E5, G5, C6]
    nd = dur / len(notes)
    for i in range(n):
        t = i / SAMPLE_RATE
        prog = i / max(1, n - 1)
        ni = min(int(t / nd), len(notes) - 1)
        f = notes[ni] * (1.0 + variant * 0.012)
        lt = t - ni * nd
        lp = min(1.0, lt / nd)
        # 풍성한 화음 + 옥타브 배음
        chord = (square(f, t, 0.40) * 0.30 +
                 sine(f, t)         * 0.28 +
                 sine(f * 2.0, t)   * 0.20 +
                 sine(f * 3.0, t)   * 0.10 +
                 tri(f * 0.5, t)    * 0.10)
        spark  = nz(rng) * 0.14 * math.exp(-lp * 4.5)
        shimmer = sine(f * 4.01, t) * 0.07 * (1.0 - prog * 0.4)
        # 음량 crescendo — 앞쪽은 조용하고 끝으로 갈수록 폭발
        overall = 0.35 + 0.65 * ease_out(prog ** 0.6)
        e = env(lt, nd * 0.9, 0.002, 0.025, 0.60, 0.05)
        s.append((chord + spark + shimmer) * e * overall * 0.88)
    return s


# ── Utils ────────────────────────────────────────────────────────────────────

def normalize(samples: array, peak=0.90) -> array:
    pk = max(abs(v) for v in samples) if samples else 1.0
    if pk <= 1e-9: return samples
    sc = peak / pk
    return array("f", (clamp(v * sc, -1.0, 1.0) for v in samples))


def write_wav(path: str, samples: array) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    pcm = array("h", (int(clamp(v, -1.0, 1.0) * MAX_AMP) for v in samples))
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm.tobytes())


# ── Grade bank definition ────────────────────────────────────────────────────

UPGRADE_BANK = [
    ("upgrade_reveal_c",   0.18, render_upgrade_reveal_c),
    ("upgrade_reveal_b",   0.24, render_upgrade_reveal_b),
    ("upgrade_reveal_a",   0.30, render_upgrade_reveal_a),
    ("upgrade_reveal_s",   0.36, render_upgrade_reveal_s),
    ("upgrade_reveal_ss",  0.50, render_upgrade_reveal_ss),
    ("upgrade_reveal_sss", 0.68, render_upgrade_reveal_sss),
]


def generate_upgrade_sfx(output_dir: str, seed: int, variants: int = 2) -> dict:
    new_events: dict[str, list[str]] = {}
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 58)
    print("  Upgrade Grade SFX Generator  (축제 느낌)")
    print("=" * 58)

    for event_name, dur, renderer in UPGRADE_BANK:
        event_files = []
        eseed = sum(ord(c) for c in event_name)
        for idx in range(variants):
            vseed = seed + eseed * 97 + idx * 13
            rng = random.Random(vseed)
            samples = renderer(rng, dur, idx)
            samples = normalize(samples)
            fname = f"{event_name}_{idx + 1}.wav"
            path = os.path.join(output_dir, fname)
            write_wav(path, samples)
            event_files.append(fname)
            print(f"  {fname:34s} | {len(samples) / SAMPLE_RATE:.2f}s")
        new_events[event_name] = event_files

    # ── Update manifest ──────────────────────────────────────────────────────
    manifest_path = os.path.join(output_dir, "sfx_manifest.json")
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding="utf-8") as f:
            manifest = json.load(f)

    manifest.setdefault("events", {}).update(new_events)
    manifest["count"] = sum(len(v) for v in manifest["events"].values())

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    total = sum(len(v) for v in new_events.values())
    print()
    print(f"[DONE] Generated {total} upgrade SFX files")
    print(f"       Output  : {output_dir}")
    print(f"       Manifest: {manifest_path}")
    return new_events


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default="src/assets/sfx")
    parser.add_argument("--seed", type=int, default=20260222)
    parser.add_argument("--variants", type=int, default=2)
    args = parser.parse_args()
    generate_upgrade_sfx(args.output_dir, args.seed, args.variants)


if __name__ == "__main__":
    main()
