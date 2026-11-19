#!/usr/bin/env python3
"""Synthesises OpenPanel's original notification tones into android/app/src/main/res/raw."""
import math
import os
import struct
import wave

RATE = 44100
PEAK = 0.5
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "android", "app", "src", "main", "res", "raw")

def note(freq, length, decay=6.0, partials=((1, 1.0), (2, 0.3), (3, 0.1)), triangle=False):
    samples = []
    n = int(length * RATE)
    for i in range(n):
        t = i / RATE
        value = 0.0
        for mult, amp in partials:
            phase = 2 * math.pi * freq * mult * t
            wave_value = (2 / math.pi) * math.asin(math.sin(phase)) if triangle else math.sin(phase)
            value += amp * wave_value / (mult ** 0.5)
        attack = min(1.0, t / 0.008)
        tail = min(1.0, (length - t) / 0.06)
        samples.append(value * attack * tail * math.exp(-decay * t))
    return samples

def mix(parts, total):
    out = [0.0] * int(total * RATE)
    for start, samples in parts:
        offset = int(start * RATE)
        for i, v in enumerate(samples):
            if offset + i < len(out):
                out[offset + i] += v
    return out

def sweep(f0, f1, length, decay):
    out, phase = [], 0.0
    n = int(length * RATE)
    for i in range(n):
        t = i / RATE
        phase += 2 * math.pi * (f0 + (f1 - f0) * t / length) / RATE
        out.append(math.sin(phase) * min(1.0, t / 0.004) * min(1.0, (length - t) / 0.03) * math.exp(-decay * t))
    return out

TONES = {
    "chime": lambda: mix([(0, note(523.25, 0.5)), (0.16, note(783.99, 0.7))], 0.86),
    "ripple": lambda: mix([(0, note(392.0, 0.45)), (0.12, note(493.88, 0.45)), (0.24, note(587.33, 0.45)), (0.36, note(783.99, 0.7))], 1.06),
    "bell": lambda: mix([(0, note(880.0, 1.1, 4.0, ((1, 1.0), (2.76, 0.35), (5.4, 0.12))))], 1.1),
    "tap": lambda: mix([(0, note(329.63, 0.3, 14.0, ((1, 1.0), (4, 0.25)), True)), (0.18, note(329.63, 0.3, 14.0, ((1, 1.0), (4, 0.25)), True))], 0.5),
    "drop": lambda: mix([(0, note(659.25, 0.4)), (0.18, note(493.88, 0.6))], 0.78),
    "pop": lambda: mix([(0, sweep(900, 360, 0.35, 16.0))], 0.4),
}

def write(name, samples):
    top = max(abs(v) for v in samples)
    path = os.path.join(OUT, f"tone_{name}.wav")
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(b"".join(struct.pack("<h", int(v / top * PEAK * 32767)) for v in samples))

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, build in TONES.items():
        write(name, build())
