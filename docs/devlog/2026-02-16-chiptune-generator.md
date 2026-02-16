# Devlog: 16-Bit Chiptune Music Generator

**Date:** 2026-02-16

## Summary

Pipeline Defense Farm 게임용 16비트 칩튠 음악 생성 시스템 구축.
Python 스크립트로 악기별 WAV 파일을 생성하고, HTML 플레이어로 브라우저에서 재생.

## What was built

### chiptune_generator.py (v2)

순수 Python (외부 라이브러리 없음)으로 레트로 게임 음악을 합성한다.

**악기 6종**, 각각 고유 파형:

| # | Instrument | Waveform | Role |
|---|-----------|----------|------|
| 1 | melody | Square | Main theme |
| 2 | harmony | Pulse (25%) | Counter-melody |
| 3 | bass | Triangle | Bass line |
| 4 | pad | Sawtooth | Chord pad |
| 5 | drums | Noise | Percussion |
| 6 | arpeggio | Sine | Bell arpeggio |

**악기당 3가지 패턴 변주** (A/B/C):
- A = 기본 패턴
- B = 리듬/구조 변주
- C = 대조적 변주 (클라이막스용)

각 패턴은 개별 WAV 파일로 저장됨 (6 x 3 = 18 files).

### Song Structure System (v2 핵심 개선)

v1은 패턴을 단순 랜덤 나열 -> 반복감이 심했음.
v2에서 실제 곡 구조를 도입:

```
intro   [##..................] 2bar | 2inst | 60%   drums + bass only
build   [##..................] 2bar | 4inst | 75%   + pad, arpeggio
verse   [####................] 4bar | 5inst | 85%   + melody, harmony
chorus  [####................] 4bar | 6inst | 100%  full ensemble
bridge  [##..................] 2bar | 3inst | 50%   pad + arp + bass
chorus2 [####................] 4bar | 6inst | 100%  full (variant C)
outro   [##..................] 2bar | 3inst | 55%   melody + pad + arp
```

**반복감을 줄이는 4가지 메커니즘:**

1. **악기 등퇴장** - 섹션마다 활성 악기가 다름. intro에 2개 -> chorus에 6개 전체 합주 -> bridge에서 3개로 축소 -> 다시 전체 폭발
2. **다이나믹스** - intro는 fade-in, verse/chorus는 crescendo, outro는 fade-out. 같은 패턴이라도 볼륨이 다름
3. **패턴 분화** - 섹션별 preferred 패턴이 다름 (verse=A, chorus=B, chorus2=C). 20% 확률로 랜덤 변주 삽입
4. **곡 구조 자체** - 밀도가 낮은 구간(bridge)과 높은 구간(chorus)의 교차로 전개감 생성

### HTML Player (player.html)

Web Audio API 기반 브라우저 플레이어.

- Section bar: 현재 섹션 하이라이트
- Gain meter: 마디별 볼륨 시각화
- Arrangement grid: 20마디 x 6악기의 패턴/on-off 표시
- Instrument panel: 악기별 현재 재생 패턴 + A/B/C 미리듣기
- Frequency visualizer: 실시간 스펙트럼 표시
- BPM/Volume 슬라이더

곡 구조는 `game_theme_structure.json`에서 로드하거나, 없으면 기본 구조를 JS에서 생성.

## Technical notes

### Performance

v1 -> v2 최적화:
- `write_wav`: 문자열 연결 O(n^2) -> `array.array('h')` 한번에 pack O(n)
- `read_wav`: sample-by-sample unpack -> `array.frombytes()` bulk decode
- `render_pattern`: `list` -> `array.array('f')` (메모리 효율)
- WAV 캐시 도입: 같은 파일 반복 로드 방지 (20마디 x 6악기 = 120회 -> 18회)

### File structure

```
src/
  chiptune_generator.py    # 생성기 스크립트
sandbox/
  player.html              # 웹 플레이어
  game_theme.wav           # 최종 합주 결과 (~74초)
  game_theme_structure.json # 곡 구조 메타데이터
  instruments/             # 악기별 개별 WAV (18 files)
    melody_A.wav ... melody_C.wav
    harmony_A.wav ... harmony_C.wav
    bass_A.wav ... bass_C.wav
    pad_A.wav ... pad_C.wav
    drums_A.wav ... drums_C.wav
    arpeggio_A.wav ... arpeggio_C.wav
```

### Usage

```bash
# 생성 (매번 약간 다른 변주)
python src/chiptune_generator.py

# 시드 고정으로 재현 가능
python src/chiptune_generator.py --seed 42 --bpm 140

# 플레이어 실행
cd sandbox && python -m http.server 8765
# -> http://localhost:8765/player.html
```

## What's next

- 키 변경 지원 (현재 C minor 고정)
- 이펙트: 비브라토, 피치 슬라이드, 에코/딜레이
- 더 많은 패턴 변주 (D, E 추가)
- 실시간 브라우저 합성 (Web Audio oscillator로 WAV 없이 직접 생성)
