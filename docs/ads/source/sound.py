#!/usr/bin/env python3
"""Soundtrack for the "What's it worth?" reel: original music + sound effects, all generated here (no licensing).
Timings match render(t) in ad.html. Writes soundtrack.wav (44.1 kHz stereo, 26 s).
Run: python3 sound.py [out.wav]
"""
import sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

SR = 44100
T = 26.0
N = int(SR * T)
rng = np.random.default_rng(7)
music = np.zeros((N, 2))
sfx = np.zeros((N, 2))


def at(buf, t, sig, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    l, r = gain * (1 - max(pan, 0)), gain * (1 + min(pan, 0))
    buf[i:i + len(sig), 0] += sig * l
    buf[i:i + len(sig), 1] += sig * r


def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def tone(freq, dur, kind="sine", a=0.005, d=0.3):
    t = np.arange(int(dur * SR)) / SR
    if kind == "saw":
        w = 2 * (t * freq % 1) - 1
    elif kind == "square":
        w = np.sign(np.sin(2 * np.pi * freq * t))
    elif kind == "tri":
        w = 2 * np.abs(2 * (t * freq % 1) - 1) - 1
    else:
        w = np.sin(2 * np.pi * freq * t)
    return w * env(len(t), a, d)


def lp(x, hz):
    b, a = butter(2, hz / (SR / 2), "low")
    return lfilter(b, a, x)


def hp(x, hz):
    b, a = butter(2, hz / (SR / 2), "high")
    return lfilter(b, a, x)


def note(n):  # MIDI number -> Hz
    return 440 * 2 ** ((n - 69) / 12)


# ---------------- music: 120 BPM, C - G - Am - F, each chord 2 beats... one bar (2 s) per chord
BEAT = 0.5
def kick():
    t = np.arange(int(0.35 * SR)) / SR
    f = 120 * np.exp(-t * 22) + 45
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def hat():
    return hp(rng.standard_normal(int(0.06 * SR)), 7000) * env(int(0.06 * SR), 0.001, 0.015)


def clap():
    n = int(0.2 * SR)
    x = hp(rng.standard_normal(n), 1200) * env(n, 0.001, 0.05)
    return x


chords = [[48, 52, 55, 60], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]]  # C, G, Am, F
roots = [36, 31, 33, 29]
start_drums = 3.3
t = 0.0
bar = 0
while t < 25.5:
    ch = chords[bar % 4]
    # chord stabs (pluck) on every beat, offbeat bounce after the drop
    for b in range(4):
        bt = t + b * BEAT
        if bt >= 25.5:
            break
        g = 0.05 if bt < start_drums else 0.075
        for n in ch[1:]:
            at(music, bt, lp(tone(note(n + 12), 0.4, "saw", 0.003, 0.12), 3000), g, pan=-0.2)
        if bt >= start_drums:
            at(music, bt + BEAT / 2, lp(tone(note(ch[-1] + 24), 0.2, "tri", 0.002, 0.06), 5000), 0.05, pan=0.3)
            at(music, bt, kick(), 0.55)
            at(music, bt + BEAT / 2, hat(), 0.18, pan=0.25)
            if b in (1, 3):
                at(music, bt, clap(), 0.22)
            # bass: root on the beat, octave bounce on the offbeat
            at(music, bt, lp(tone(note(roots[bar % 4]), 0.45, "saw", 0.005, 0.25), 600), 0.32)
            at(music, bt + BEAT / 2, lp(tone(note(roots[bar % 4] + 12), 0.2, "saw", 0.005, 0.1), 700), 0.18)
        else:
            # intro: soft pad and a riser into the drop
            at(music, bt, lp(tone(note(roots[bar % 4] + 12), 0.5, "tri", 0.05, 0.4), 800), 0.2)
    t += 4 * BEAT
    bar += 1

# riser before the drop at 3.3
n = int(1.2 * SR)
rise = rng.standard_normal(n) * np.linspace(0, 1, n) ** 2
at(music, start_drums - 1.2, hp(rise, 2000), 0.12)
# final chord at 25.5 that rings out
for n_ in [48, 55, 60, 64, 67]:
    at(music, 25.0, lp(tone(note(n_ + 12), 1.2, "saw", 0.005, 0.5), 2500), 0.07)

# ---------------- sound effects (times match ad.html)
def whoosh(dur=0.45):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    chunks = 30
    for k in range(chunks):  # sweep a band upward
        s, e = k * n // chunks, (k + 1) * n // chunks
        hz = 400 + 5000 * (k / chunks) ** 1.5
        out[s:e] = lp(x[s:e], hz)
    return out * np.sin(np.linspace(0, np.pi, n)) ** 2


def pop():
    t_ = np.arange(int(0.12 * SR)) / SR
    f = 500 + 900 * np.exp(-t_ * 40)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t_), 0.001, 0.04)


def click():
    return hp(rng.standard_normal(int(0.03 * SR)), 2500) * env(int(0.03 * SR), 0.0005, 0.006) + tone(1800, 0.03, "sine", 0.0005, 0.008) * 0.5


def ding(base=88):
    out = np.zeros(int(1.2 * SR))
    for k, m in enumerate([0, 7, 12, 16]):
        s = tone(note(base + m), 1.2 - k * 0.06, "sine", 0.002, 0.45)
        out[int(k * 0.06 * SR):int(k * 0.06 * SR) + len(s)] += s * (0.7 if k else 1)
    return out


def chaching():
    reg = hp(rng.standard_normal(int(0.08 * SR)), 3000) * env(int(0.08 * SR), 0.001, 0.02)
    out = np.zeros(int(1.3 * SR))
    out[:len(reg)] += reg * 0.8
    d = ding(91)
    out[int(0.07 * SR):int(0.07 * SR) + len(d)] += d[: len(out) - int(0.07 * SR)]
    return out


for w in [3.3, 6.1, 9.0, 13.3, 18.6, 21.8]:
    at(sfx, w - 0.25, whoosh(), 0.35)
for p_ in [0.15, 1.0, 18.8, 19.6, 20.4, 22.7, 23.4]:
    at(sfx, p_, pop(), 0.45)
at(sfx, 6.3, whoosh(0.35), 0.2, pan=0.2)          # photo slides in
for c in [7.6, 12.75]:
    at(sfx, c, click(), 0.8)                       # button taps
for k in range(10):                                # "AI is looking" shimmer
    at(sfx, 7.85 + k * 0.11, tone(note(84 + [0, 4, 7, 12][k % 4]), 0.18, "sine", 0.002, 0.06), 0.12, pan=(-0.3 if k % 2 else 0.3))
for k in range(int((10.4 - 9.3) / 0.06)):          # price count-up ticks
    at(sfx, 9.3 + k * 0.06, tone(2400, 0.02, "square", 0.0005, 0.004), 0.06)
at(sfx, 10.35, chaching(), 0.32)
for k in range(int((12.0 - 11.1) / 0.06)):
    at(sfx, 11.1 + k * 0.06, tone(2600, 0.02, "square", 0.0005, 0.004), 0.06)
at(sfx, 11.95, chaching(), 0.4)
tt = 13.7                                          # typing
while tt < 16.3:
    at(sfx, tt, click(), 0.22, pan=float(rng.uniform(-0.3, 0.3)))
    tt += float(rng.uniform(0.045, 0.09))
for k in range(9):                                 # tab blips
    at(sfx, 13.8 + k * 0.5, tone(note(76 + [0, 2, 4, 5, 7, 9, 11, 12, 14][k]), 0.12, "tri", 0.002, 0.05), 0.12)
at(sfx, 22.0, ding(84), 0.28)                      # logo chime

# ---------------- mix
mix = music * 0.55 + sfx * 0.9
fade = int(0.6 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix /= max(1e-9, np.abs(mix).max()) / 0.89
out = sys.argv[1] if len(sys.argv) > 1 else "soundtrack.wav"
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print(out)
