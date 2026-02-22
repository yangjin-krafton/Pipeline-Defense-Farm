"""
Upgrade-grade SFX generator — 짧고 명확한 등급 차이.

연달아 재생(120ms 간격)을 고려해 짧게 설계.
등급이 높을수록: 더 밝음 / 더 많은 음수 / 더 풍부한 배음.

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
MAX_AMP     = 32767

# ── Note frequencies ──────────────────────────────────────────────────────────
C3 = 130.81
C4, D4, E4, G4, A4 = 261.63, 293.66, 329.63, 392.00, 440.00
C5, E5, G5, A5     = 523.25, 659.25, 783.99, 880.00
C6, E6              = 1046.50, 1318.51


def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def ease_out(t):
    x = clamp(t, 0.0, 1.0)
    return 1.0 - (1.0 - x) ** 3

def sine(f, t):          return math.sin(2.0 * math.pi * f * t)
def square(f, t, d=0.5): return 1.0 if (f * t % 1.0) < d else -1.0
def tri(f, t):
    p = (f * t) % 1.0
    return 4.0 * p - 1.0 if p < 0.5 else 3.0 - 4.0 * p
def nz(rng):             return rng.uniform(-1.0, 1.0)

def adsr(t, dur, a, d, s, r):
    rs = max(0.0, dur - r)
    if t < a:             return t / a if a > 0 else 1.0
    if t < a + d:         return 1.0 - (1.0 - s) * ((t - a) / d)
    if t < rs:            return s
    if t < dur and r > 0: return s * (1.0 - (t - rs) / r)
    return 0.0


# ── Grade render functions ────────────────────────────────────────────────────

def render_upgrade_reveal_c(rng, dur, variant):
    """C — 단조로운 저음 틱 (0.08s). 거의 들리지 않을 정도로 조용."""
    s, n = array("f"), int(SAMPLE_RATE * dur)
    # 낮은 주파수 사각파 단발 틱
    f = C3 * (1.0 + variant * 0.015)
    for i in range(n):
        t = i / SAMPLE_RATE
        tone = square(f, t, 0.3) * 0.4 + tri(f * 2, t) * 0.2
        e = adsr(t, dur, 0.001, 0.020, 0.05, 0.040)
        s.append(tone * e * 0.55)
    return s


def render_upgrade_reveal_b(rng, dur, variant):
    """B — 단음 딩 중음역 (0.10s). 단순하고 짧음."""
    s, n = array("f"), int(SAMPLE_RATE * dur)
    f = D4 * (1.0 + variant * 0.012)
    for i in range(n):
        t = i / SAMPLE_RATE
        tone = sine(f, t) * 0.60 + tri(f, t) * 0.25
        e = adsr(t, dur, 0.001, 0.030, 0.12, 0.050)
        s.append(tone * e)
    return s


def render_upgrade_reveal_a(rng, dur, variant):
    """A — C4→E4 두 음 상승 (0.14s). 살짝 긍정적인 느낌."""
    s, n = array("f"), int(SAMPLE_RATE * dur)
    notes = [C4, E4]
    nd = dur / len(notes)
    for i in range(n):
        t = i / SAMPLE_RATE
        ni  = min(int(t / nd), len(notes) - 1)
        f   = notes[ni] * (1.0 + variant * 0.010)
        lt  = t - ni * nd
        tone = sine(f, t) * 0.55 + sine(f * 2.0, t) * 0.22
        e    = adsr(lt, nd * 0.9, 0.001, 0.025, 0.25, 0.040)
        s.append(tone * e)
    return s


def render_upgrade_reveal_s(rng, dur, variant):
    """S — G4→C5→G5 빠른 상승 + 스파클 (0.18s). 밝고 경쾌."""
    s, n = array("f"), int(SAMPLE_RATE * dur)
    notes = [G4, C5, G5]
    nd = dur / len(notes)
    for i in range(n):
        t = i / SAMPLE_RATE
        ni  = min(int(t / nd), len(notes) - 1)
        f   = notes[ni] * (1.0 + variant * 0.010)
        lt  = t - ni * nd
        tone  = square(f, t, 0.38) * 0.38 + sine(f, t) * 0.40
        spark = nz(rng) * 0.12 * math.exp(-lt / nd * 5.0)
        e     = adsr(lt, nd * 0.88, 0.001, 0.020, 0.30, 0.030)
        s.append((tone + spark) * e)
    return s


def render_upgrade_reveal_ss(rng, dur, variant):
    """SS — C5+E5+G5 동시 화음 타격 + 상승 아르페지오 (0.24s). 명쾌한 팡파르."""
    s, n = array("f"), int(SAMPLE_RATE * dur)
    # 0~60%: C5·E5·G5 동시 화음 (punch)
    # 60~100%: 짧은 상승 아르페지오 (C6 bell)
    split = int(n * 0.60)
    for i in range(n):
        t    = i / SAMPLE_RATE
        prog = i / max(1, n - 1)
        if i < split:
            lt = t
            ld = dur * 0.60
            # 3화음 동시 타격
            chord = (sine(C5 * (1 + variant * 0.01), t) * 0.40 +
                     sine(E5 * (1 + variant * 0.01), t) * 0.32 +
                     sine(G5 * (1 + variant * 0.01), t) * 0.25 +
                     square(C5 * (1 + variant * 0.01), t, 0.35) * 0.18)
            e = adsr(lt, ld, 0.001, 0.040, 0.35, 0.060)
        else:
            lt = t - dur * 0.60
            ld = dur * 0.40
            # C6 벨 아르페지오
            chord = (sine(C6 * (1 + variant * 0.01), t) * 0.45 +
                     sine(E6 * (1 + variant * 0.01), t) * 0.28)
            e = adsr(lt, ld, 0.001, 0.020, 0.20, 0.050)
        s.append(chord * e * 0.88)
    return s


def render_upgrade_reveal_sss(rng, dur, variant):
    """SSS — 풀 코드 폭발 + 고음 벨 공명 (0.32s). 최고 등급 임팩트."""
    s, n = array("f"), int(SAMPLE_RATE * dur)
    # Phase 1 (0~50%): 전체 코드 폭발 (C4+G4+C5+E5+G5) + 임팩트 노이즈
    # Phase 2 (50~100%): 고음 벨 여운 (C5+C6+E6) 빠른 감쇄
    split = int(n * 0.50)
    for i in range(n):
        t    = i / SAMPLE_RATE
        prog = i / max(1, n - 1)
        if i < split:
            lt  = t
            ld  = dur * 0.50
            v   = 1.0 + variant * 0.012
            # 저·중·고 코드 레이어
            low   = (tri(C4 * v, t) * 0.20 + square(G4 * v, t, 0.40) * 0.18)
            mid   = (sine(C5 * v, t) * 0.28 + sine(E5 * v, t) * 0.22 + sine(G5 * v, t) * 0.18)
            hi    = square(C5 * v * 2.0, t, 0.30) * 0.12
            burst = nz(rng) * 0.18 * math.exp(-lt / (dur * 0.12))
            e     = adsr(lt, ld, 0.001, 0.035, 0.55, 0.070)
            s.append((low + mid + hi + burst) * e * 0.85)
        else:
            lt  = t - dur * 0.50
            ld  = dur * 0.50
            v   = 1.0 + variant * 0.012
            bell = (sine(C5 * v, t) * 0.30 +
                    sine(C6 * v, t) * 0.28 +
                    sine(E6 * v, t) * 0.18)
            shim = sine(G5 * v * 3.01, t) * 0.08 * math.exp(-lt / (ld * 0.4))
            e    = adsr(lt, ld, 0.001, 0.020, 0.12, 0.120)
            s.append((bell + shim) * e * 0.82)
    return s


# ── Utils ─────────────────────────────────────────────────────────────────────

def normalize(samples: array, peak=0.92) -> array:
    pk = max(abs(v) for v in samples) if samples else 1.0
    if pk <= 1e-9: return samples
    sc = peak / pk
    return array("f", (clamp(v * sc, -1.0, 1.0) for v in samples))


def write_wav(path: str, samples: array) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    pcm = array("h", (int(clamp(v, -1.0, 1.0) * MAX_AMP) for v in samples))
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm.tobytes())


# ── Bank ──────────────────────────────────────────────────────────────────────

UPGRADE_BANK = [
    ("upgrade_reveal_c",   0.08, render_upgrade_reveal_c),
    ("upgrade_reveal_b",   0.10, render_upgrade_reveal_b),
    ("upgrade_reveal_a",   0.14, render_upgrade_reveal_a),
    ("upgrade_reveal_s",   0.18, render_upgrade_reveal_s),
    ("upgrade_reveal_ss",  0.24, render_upgrade_reveal_ss),
    ("upgrade_reveal_sss", 0.32, render_upgrade_reveal_sss),
]


def generate_upgrade_sfx(output_dir: str, seed: int, variants: int = 2) -> dict:
    new_events: dict[str, list[str]] = {}
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 58)
    print("  Upgrade Grade SFX Generator  (짧고 명확한 등급 차이)")
    print("=" * 58)
    print(f"  C  0.08s  저음 틱")
    print(f"  B  0.10s  단음 딩")
    print(f"  A  0.14s  C→E 상승")
    print(f"  S  0.18s  G→C→G 스윕")
    print(f"  SS 0.24s  화음 타격 + 벨")
    print(f" SSS 0.32s  풀 코드 폭발")
    print()

    for event_name, dur, renderer in UPGRADE_BANK:
        event_files = []
        eseed = sum(ord(c) for c in event_name)
        for idx in range(variants):
            vseed = seed + eseed * 97 + idx * 13
            samples = renderer(random.Random(vseed), dur, idx)
            samples = normalize(samples)
            fname = f"{event_name}_{idx + 1}.wav"
            path  = os.path.join(output_dir, fname)
            write_wav(path, samples)
            event_files.append(fname)
            print(f"  {fname:34s} | {len(samples) / SAMPLE_RATE:.3f}s")
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
    print(f"[DONE] {total} files → {output_dir}")
    print(f"       Manifest updated: {manifest_path}")
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
