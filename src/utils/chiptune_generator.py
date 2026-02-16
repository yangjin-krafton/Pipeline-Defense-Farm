"""
16-Bit Chiptune Game Music Generator v2
========================================
악기 6종 x 패턴 3종 = 18개 WAV + 곡 구조 기반 합주.

개선:
  - 곡 구조: intro -> verse -> chorus -> bridge -> chorus -> outro
  - 섹션별 악기 등장/퇴장 (밀도 변화)
  - 마디별 볼륨 다이나믹스 (크레센도, 옥타브 시프트)
  - 패턴 변주 폭 확대 (A/B/C가 확연히 다름)
  - 곡 구조 JSON 내보내기 (HTML 플레이어 연동)

사용법:
  python src/chiptune_generator.py
  python src/chiptune_generator.py --bpm 140 --seed 42
"""

import array
import struct
import wave
import math
import random
import json
import argparse
import os

SAMPLE_RATE = 44100
MAX_AMP = 32767
INSTRUMENT_DIR = "src/assets/bgm/instruments"
VARIANT_LABELS = ["A", "B", "C"]

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F",
              "F#", "G", "G#", "A", "A#", "B"]


def note_freq(name):
    if name == "R":
        return 0.0
    octave = int(name[-1])
    note = name[:-1]
    semitone = NOTE_NAMES.index(note)
    dist = (octave - 4) * 12 + (semitone - 9)
    return 440.0 * (2.0 ** (dist / 12.0))


# ── 파형 ─────────────────────────────────────────────

def square_wave(phase):
    return 1.0 if (phase % 1.0) < 0.5 else -1.0

def pulse_wave(phase):
    return 1.0 if (phase % 1.0) < 0.25 else -1.0

def triangle_wave(phase):
    t = phase % 1.0
    return 4.0 * t - 1.0 if t < 0.5 else 3.0 - 4.0 * t

def sawtooth_wave(phase):
    return 2.0 * (phase % 1.0) - 1.0

def noise_wave(phase):
    x = int(phase * SAMPLE_RATE) & 0xFFFF
    x ^= (x << 7) & 0xFFFF
    x ^= (x >> 9) & 0xFFFF
    x ^= (x << 8) & 0xFFFF
    return (x / 32768.0) - 1.0

def sine_wave(phase):
    return math.sin(2.0 * math.pi * phase)


# ── 엔벨로프 ─────────────────────────────────────────

def adsr(t, dur, atk=0.01, dec=0.05, sus=0.6, rel=0.05):
    rs = max(0, dur - rel)
    if t < atk:
        return t / atk if atk > 0 else 1.0
    if t < atk + dec:
        return 1.0 - (1.0 - sus) * ((t - atk) / dec)
    if t < rs:
        return sus
    if t < dur:
        return sus * (1.0 - (t - rs) / rel)
    return 0.0

def drum_env(t, dur):
    return max(0.0, 1.0 - t / (dur * 0.3)) if t <= dur else 0.0


# ── 렌더링 ───────────────────────────────────────────

def render_pattern(wave_func, pattern, beat_dur, volume=0.5,
                   is_drum=False, **env_kw):
    samples = array.array('f')  # float array (fast)
    for note_name, beats in pattern:
        freq = note_freq(note_name) if note_name != "R" else 0.0
        dur = beat_dur * beats
        n = int(SAMPLE_RATE * dur)
        if freq == 0.0:
            samples.extend(array.array('f', b'\x00\x00\x00\x00') * n)
        else:
            env_func = drum_env if is_drum else adsr
            inv_sr = 1.0 / SAMPLE_RATE
            for i in range(n):
                t = i * inv_sr
                val = wave_func(freq * t)
                env = env_func(t, dur, **env_kw) if not is_drum else env_func(t, dur)
                samples.append(val * env * volume)
    return samples


def write_wav(filename, samples):
    os.makedirs(os.path.dirname(filename) or ".", exist_ok=True)
    # array.array 로 한번에 패킹 (O(n) vs O(n²) 문자열 연결)
    int_arr = array.array('h', (int(max(-1, min(1, s)) * MAX_AMP) for s in samples))
    with wave.open(filename, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(int_arr.tobytes())


def read_wav(filename):
    with wave.open(filename, "r") as wf:
        n = wf.getnframes()
        raw = wf.readframes(n)
    int_arr = array.array('h')
    int_arr.frombytes(raw)
    inv = 1.0 / MAX_AMP
    return array.array('f', (v * inv for v in int_arr))


# ── 악기별 3가지 패턴 (C major, 8박) ────────────────
# A = 기본, B = 변주, C = 대조적 변주
# 음식 테마: 경쾌하고 밝은 멜로디

def get_all_patterns():
    return {
        "melody": {
            "wave": square_wave,
            "volume": 0.35,
            "env": {"atk": 0.01, "dec": 0.05, "sus": 0.5, "rel": 0.04},
            "patterns": {
                "A": [  # 경쾌한 음식 테마 (맛있다!)
                    ("C5",0.5),("E5",0.5),("G5",0.5),("E5",0.5),
                    ("F5",0.5),("E5",0.5),("D5",0.5),("C5",0.5),
                    ("E5",0.5),("G5",0.5),("C6",0.5),("G5",0.5),
                    ("F5",0.5),("E5",0.5),("D5",1.0),
                ],
                "B": [  # 통통 튀는 변주 (냠냠냠)
                    ("G4",0.25),("G4",0.25),("A4",0.5),("B4",0.5),("C5",0.5),
                    ("D5",0.5),("E5",0.5),("F5",1.0),
                    ("E5",0.5),("D5",0.5),("C5",0.5),("B4",0.5),
                    ("C5",1.0),("G4",1.0),
                ],
                "C": [  # 고음 클라이막스 (맛의 정점!)
                    ("C6",0.5),("E6",0.5),("G6",0.5),("E6",0.5),
                    ("F6",0.5),("E6",0.5),("D6",1.0),
                    ("C6",0.5),("G5",0.5),("E5",0.5),("G5",0.5),
                    ("C6",1.5),("G5",0.5),
                ],
            },
        },

        "harmony": {
            "wave": pulse_wave,
            "volume": 0.20,
            "env": {"atk": 0.01, "dec": 0.08, "sus": 0.4, "rel": 0.04},
            "patterns": {
                "A": [  # 부드러운 대선율 (달콤한 여운)
                    ("E4",1.0),("G4",1.0),
                    ("F4",0.5),("E4",0.5),("D4",1.0),
                    ("C4",1.0),("E4",0.5),("D4",0.5),
                    ("C4",1.0),("R",1.0),
                ],
                "B": [  # 리듬감 있는 변주 (씹는 리듬)
                    ("G4",0.25),("R",0.25),("G4",0.25),("R",0.25),
                    ("E4",0.25),("R",0.25),("E4",0.25),("R",0.25),
                    ("F4",0.25),("R",0.25),("F4",0.25),("R",0.25),
                    ("D4",0.5),("C4",0.5),("D4",0.5),("E4",0.5),
                    ("C4",1.0),("R",1.0),
                ],
                "C": [  # 옥타브 위 대선율 (맛의 하모니)
                    ("E5",0.5),("G5",0.5),("E5",0.5),("C5",0.5),
                    ("G4",1.0),("A4",1.0),
                    ("B4",0.5),("C5",0.5),("E5",0.5),("C5",0.5),
                    ("G4",1.0),("R",1.0),
                ],
            },
        },

        "bass": {
            "wave": triangle_wave,
            "volume": 0.45,
            "env": {"atk": 0.005, "dec": 0.02, "sus": 0.7, "rel": 0.02},
            "patterns": {
                "A": [  # 통통 튀는 워킹 베이스 (소화의 리듬)
                    ("C2",1.0),("C2",0.5),("C3",0.5),
                    ("F2",1.0),("F2",0.5),("F3",0.5),
                    ("G2",1.0),("G2",0.5),("G3",0.5),
                    ("C2",1.0),("G2",0.5),("C3",0.5),
                ],
                "B": [  # 8분음표 펄스 베이스 (활발한 소화)
                    ("C2",0.5),("C3",0.5),("C2",0.5),("E2",0.5),
                    ("F2",0.5),("F3",0.5),("F2",0.5),("G2",0.5),
                    ("A2",0.5),("A3",0.5),("G2",0.5),("G3",0.5),
                    ("C2",0.5),("C3",0.5),("G2",0.5),("C3",0.5),
                ],
                "C": [  # 파워풀한 상승 베이스 (소화 완료!)
                    ("C2",1.0),("D2",0.5),("E2",0.5),
                    ("F2",1.0),("G2",0.5),("A2",0.5),
                    ("B2",1.0),("C3",0.5),("B2",0.5),
                    ("G2",1.5),("C3",0.5),
                ],
            },
        },

        "pad": {
            "wave": sawtooth_wave,
            "volume": 0.10,
            "env": {"atk": 0.1, "dec": 0.1, "sus": 0.3, "rel": 0.1},
            "patterns": {
                "A": [  # C - F - G (밝은 코드 진행)
                    ("C3",2.0),("F3",2.0),
                    ("G3",2.0),("C3",2.0),
                ],
                "B": [  # Am - F - G (감성적 변주)
                    ("A3",2.0),("F3",2.0),
                    ("G3",2.0),("E3",2.0),
                ],
                "C": [  # F - G - C (긍정적 해결)
                    ("F3",2.0),("G3",2.0),
                    ("C4",4.0),
                ],
            },
        },

        "drums": {
            "wave": noise_wave,
            "volume": 0.30,
            "env": {},
            "is_drum": True,
            "patterns": {
                "A": [  # 기본 4/4 비트
                    ("C2",0.5),("G5",0.5),("E3",0.5),("G5",0.5),
                    ("C2",0.5),("G5",0.5),("E3",0.5),("G5",0.5),
                    ("C2",0.5),("G5",0.5),("E3",0.5),("G5",0.5),
                    ("C2",0.5),("G5",0.5),("E3",0.5),("G5",0.5),
                ],
                "B": [  # 하이햇만 (인트로/브릿지용)
                    ("G5",0.5),("R",0.5),("G5",0.5),("R",0.5),
                    ("G5",0.5),("R",0.5),("G5",0.5),("G5",0.25),("G5",0.25),
                    ("G5",0.5),("R",0.5),("G5",0.5),("R",0.5),
                    ("G5",0.5),("G5",0.25),("G5",0.25),("G5",0.5),("R",0.5),
                ],
                "C": [  # 더블 킥 필인 (클라이막스용)
                    ("C2",0.25),("C2",0.25),("G5",0.5),("E3",0.5),("G5",0.5),
                    ("C2",0.25),("C2",0.25),("G5",0.25),("G5",0.25),
                    ("E3",0.25),("E3",0.25),("G5",0.5),
                    ("C2",0.5),("G5",0.5),("E3",0.5),("G5",0.5),
                    ("E3",0.25),("E3",0.25),("E3",0.25),("E3",0.25),
                    ("C2",0.5),("G5",0.5),
                ],
            },
        },

        "arpeggio": {
            "wave": sine_wave,
            "volume": 0.15,
            "env": {"atk": 0.005, "dec": 0.08, "sus": 0.2, "rel": 0.03},
            "patterns": {
                "A": [  # 반짝이는 아르페지오 (음식의 반짝임)
                    ("C5",0.25),("E5",0.25),("G5",0.25),("E5",0.25),
                    ("C5",0.25),("E5",0.25),("G5",0.25),("E5",0.25),
                    ("F4",0.25),("A4",0.25),("C5",0.25),("A4",0.25),
                    ("F4",0.25),("A4",0.25),("C5",0.25),("A4",0.25),
                    ("G4",0.25),("B4",0.25),("D5",0.25),("B4",0.25),
                    ("G4",0.25),("B4",0.25),("D5",0.25),("B4",0.25),
                    ("C5",0.25),("E5",0.25),("G5",0.25),("E5",0.25),
                    ("C5",0.25),("E5",0.25),("G5",0.25),("E5",0.25),
                ],
                "B": [  # 여유로운 아르페지오 (소화 중)
                    ("C5",0.5),("E5",0.5),("G5",0.5),("R",0.5),
                    ("F4",0.5),("A4",0.5),("C5",0.5),("R",0.5),
                    ("G4",0.5),("B4",0.5),("D5",0.5),("R",0.5),
                    ("C5",0.5),("E5",0.5),("G5",0.5),("R",0.5),
                ],
                "C": [  # 고속 반짝임 (맛의 피날레!)
                    ("C6",0.25),("G5",0.25),("E5",0.25),("C5",0.25),
                    ("E6",0.25),("C6",0.25),("G5",0.25),("E5",0.25),
                    ("F5",0.25),("C5",0.25),("A4",0.25),("F4",0.25),
                    ("C6",0.25),("A5",0.25),("F5",0.25),("C5",0.25),
                    ("G5",0.25),("D5",0.25),("B4",0.25),("G4",0.25),
                    ("D6",0.25),("B5",0.25),("G5",0.25),("D5",0.25),
                    ("C6",0.25),("E5",0.25),("G5",0.25),("C5",0.25),
                    ("E6",0.25),("C6",0.25),("G5",0.25),("E5",0.25),
                ],
            },
        },
    }


# ── 곡 구조 정의 ────────────────────────────────────

# 각 섹션별 사용 패턴 + 활성 악기 + 볼륨 계수
# pattern: A/B/C 중 선택 (또는 "random")
# active: 해당 섹션에서 연주하는 악기 목록
# gain: 섹션 전체 볼륨 계수

SONG_SECTIONS = [
    {
        "name": "intro",
        "bars": 2,
        "active": ["drums", "bass"],
        "preferred": {"drums": "B", "bass": "A"},
        "gain": 0.6,
    },
    {
        "name": "build",
        "bars": 2,
        "active": ["drums", "bass", "pad", "arpeggio"],
        "preferred": {"drums": "A", "bass": "A", "pad": "A", "arpeggio": "B"},
        "gain": 0.75,
    },
    {
        "name": "verse",
        "bars": 4,
        "active": ["melody", "harmony", "bass", "drums", "pad"],
        "preferred": {"melody": "A", "harmony": "A", "bass": "A",
                      "drums": "A", "pad": "A"},
        "gain": 0.85,
    },
    {
        "name": "chorus",
        "bars": 4,
        "active": ["melody", "harmony", "bass", "drums", "pad", "arpeggio"],
        "preferred": {"melody": "B", "harmony": "C", "bass": "B",
                      "drums": "A", "pad": "B", "arpeggio": "A"},
        "gain": 1.0,
    },
    {
        "name": "bridge",
        "bars": 2,
        "active": ["pad", "arpeggio", "bass"],
        "preferred": {"pad": "C", "arpeggio": "B", "bass": "C"},
        "gain": 0.5,
    },
    {
        "name": "chorus2",
        "bars": 4,
        "active": ["melody", "harmony", "bass", "drums", "pad", "arpeggio"],
        "preferred": {"melody": "C", "harmony": "C", "bass": "C",
                      "drums": "C", "pad": "B", "arpeggio": "C"},
        "gain": 1.0,
    },
    {
        "name": "outro",
        "bars": 2,
        "active": ["melody", "pad", "arpeggio"],
        "preferred": {"melody": "A", "pad": "C", "arpeggio": "B"},
        "gain": 0.55,
    },
]


def generate_instrument_wavs(bpm):
    beat_dur = 60.0 / bpm
    all_patterns = get_all_patterns()
    generated = {}

    print(f"[STEP 1] 악기별 WAV 파일 생성 (6종 x 3패턴 = 18파일)")
    print(f"         BPM: {bpm} | 1박: {beat_dur:.3f}초")
    print()

    for inst_name, inst in all_patterns.items():
        wave_func = inst["wave"]
        volume = inst["volume"]
        env_kw = inst["env"]
        is_drum = inst.get("is_drum", False)
        generated[inst_name] = {}

        for variant in VARIANT_LABELS:
            pattern = inst["patterns"][variant]
            filename = f"{INSTRUMENT_DIR}/{inst_name}_{variant}.wav"
            samples = render_pattern(wave_func, pattern, beat_dur,
                                     volume, is_drum, **env_kw)
            write_wav(filename, samples)
            dur = len(samples) / SAMPLE_RATE
            size = os.path.getsize(filename)
            print(f"  {filename:40s} | {dur:.1f}s | {size:>8,} bytes")
            generated[inst_name][variant] = filename

    print()
    return generated


def compose_structured(generated, seed=None):
    """곡 구조 기반 합주. 섹션별로 악기 등퇴장 + 볼륨 다이나믹스."""
    if seed is not None:
        random.seed(seed)

    all_inst = list(generated.keys())

    # WAV 파일 캐시 (같은 파일을 반복 로드 방지)
    wav_cache = {}
    def get_wav(path):
        if path not in wav_cache:
            wav_cache[path] = read_wav(path)
        return wav_cache[path]

    bar_duration_samples = None
    tracks = {name: array.array('f') for name in all_inst}
    song_map = []

    print(f"[STEP 2] 곡 구조 기반 합주")
    if seed is not None:
        print(f"         시드: {seed}")
    print()

    total_bars = 0

    for section in SONG_SECTIONS:
        sec_name = section["name"]
        sec_bars = section["bars"]
        active_set = set(section["active"])
        preferred = section.get("preferred", {})
        gain = section["gain"]

        print(f"  [{sec_name.upper():10s}] {sec_bars}마디 | gain={gain:.0%} "
              f"| 악기: {', '.join(section['active'])}")

        for bar_i in range(sec_bars):
            bar_info = {
                "section": sec_name,
                "bar": total_bars,
                "gain": gain,
                "instruments": {},
            }

            if sec_name in ("verse", "chorus", "chorus2"):
                progress = (bar_i + 1) / sec_bars
                bar_gain = gain * (0.85 + 0.15 * progress)
            elif sec_name == "outro":
                progress = bar_i / max(1, sec_bars - 1)
                bar_gain = gain * (1.0 - 0.5 * progress)
            elif sec_name == "intro":
                progress = (bar_i + 1) / sec_bars
                bar_gain = gain * (0.5 + 0.5 * progress)
            else:
                bar_gain = gain

            for inst_name in all_inst:
                if inst_name in active_set:
                    pref = preferred.get(inst_name, "A")
                    variant = random.choice(VARIANT_LABELS) if random.random() < 0.2 else pref

                    wav_path = generated[inst_name][variant]
                    samples = get_wav(wav_path)

                    if bar_duration_samples is None:
                        bar_duration_samples = len(samples)

                    tracks[inst_name].extend(
                        array.array('f', (s * bar_gain for s in samples)))

                    bar_info["instruments"][inst_name] = {
                        "variant": variant,
                        "gain": round(bar_gain, 2),
                    }
                else:
                    if bar_duration_samples is not None:
                        tracks[inst_name].extend(
                            array.array('f', b'\x00\x00\x00\x00') * bar_duration_samples)
                    bar_info["instruments"][inst_name] = None

            song_map.append(bar_info)
            total_bars += 1

    print()

    max_len = max(len(s) for s in tracks.values())
    for name in tracks:
        diff = max_len - len(tracks[name])
        if diff > 0:
            tracks[name].extend(array.array('f', b'\x00\x00\x00\x00') * diff)

    print(f"  믹싱 중... ({max_len:,} 샘플, {max_len/SAMPLE_RATE:.1f}초)")

    # 빠른 믹싱: 첫 트랙을 기반으로 나머지를 더함
    track_list = list(tracks.values())
    mixed = array.array('f', track_list[0])
    for trk in track_list[1:]:
        for i in range(max_len):
            mixed[i] += trk[i]

    peak = max(abs(s) for s in mixed) if mixed else 1.0
    scale = 0.85 / peak if peak > 1.0 else 0.85
    mixed = array.array('f', (s * scale for s in mixed))

    return mixed, song_map


def main():
    parser = argparse.ArgumentParser(
        description="16-Bit Chiptune Generator v2: 곡 구조 + 다이나믹스"
    )
    parser.add_argument("--bpm", type=int, default=130)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("-o", "--output", type=str,
                        default="src/assets/bgm/game_theme.wav")
    args = parser.parse_args()

    print("=" * 58)
    print("  16-Bit Chiptune Game Music Generator v2")
    print("  곡 구조 + 악기 등퇴장 + 다이나믹스 + 변주")
    print("=" * 58)
    print()

    generated = generate_instrument_wavs(args.bpm)
    mixed, song_map = compose_structured(generated, args.seed)

    write_wav(args.output, mixed)
    size = os.path.getsize(args.output)
    dur = len(mixed) / SAMPLE_RATE

    # 곡 구조 JSON 내보내기 (HTML 플레이어 연동)
    meta = {
        "bpm": args.bpm,
        "seed": args.seed,
        "beats_per_bar": 8,
        "total_bars": len(song_map),
        "duration": round(dur, 1),
        "sections": [],
        "bars": song_map,
    }
    # 섹션 요약
    for sec in SONG_SECTIONS:
        meta["sections"].append({
            "name": sec["name"],
            "bars": sec["bars"],
            "active": sec["active"],
            "gain": sec["gain"],
        })

    json_path = args.output.replace(".wav", "_structure.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    print()
    print(f"[DONE] {args.output} ({dur:.1f}초 | {size:,} bytes)")
    print(f"       {json_path}")
    print()

    # 곡 구조 시각화
    print("  곡 구조:")
    for sec in SONG_SECTIONS:
        n = sec["bars"]
        block = "#" * n
        empty = "." * (20 - n)
        active_count = len(sec["active"])
        print(f"  {sec['name']:10s} [{block}{empty}] "
              f"{n}bar | {active_count}inst | {sec['gain']:.0%}")

    print()
    print("  다시 실행하면 약간씩 다른 변주가 생성됩니다!")


if __name__ == "__main__":
    main()
