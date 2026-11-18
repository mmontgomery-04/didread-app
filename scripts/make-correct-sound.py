# Makes assets/sounds/correct.wav, the chime that plays with the green check on a correct answer
# (multiple choice, tap the sentence, put it in order). Original sound, made from sine waves here,
# so there's no licensing question. Run:  python scripts/make-correct-sound.py
# Two rising notes (A5 then E6, a perfect fifth), bell-like, about half a second, peaking near -6 dBFS.
import math, os, struct, wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'sounds', 'correct.wav')
RATE = 44100
LENGTH = 0.5
NOTES = [  # (start in seconds, frequency in Hz, decay in seconds, loudness)
    (0.00, 880.0, 0.10, 0.8),
    (0.08, 1318.5, 0.18, 1.0),
]
PARTIALS = [(1, 1.0), (2, 0.22), (3, 0.06)]  # overtone number, strength: a soft bell tone

n = int(RATE * LENGTH)
samples = [0.0] * n
for start, freq, decay, loud in NOTES:
    s0 = int(start * RATE)
    for i in range(s0, n):
        t = (i - s0) / RATE
        env = min(1.0, t / 0.004) * math.exp(-t / decay) * loud
        samples[i] += env * sum(a * math.sin(2 * math.pi * freq * k * t) for k, a in PARTIALS)
fade = int(0.03 * RATE)
for i in range(fade):
    samples[n - 1 - i] *= i / fade
scale = 0.5 / max(abs(x) for x in samples)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with wave.open(OUT, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(b''.join(struct.pack('<h', int(x * scale * 32767)) for x in samples))
print('made', os.path.relpath(OUT, ROOT))
