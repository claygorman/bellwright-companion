#!/usr/bin/env python3
"""Crop NPC portraits out of Bellwright screen photos/screenshots.

Photograph (or screenshot) each villager's character panel — the square,
blue-framed portrait must be visible — then run:

    python3 tools/portrait-cropper.py photos/*.jpg

For each input this detects the blue-bordered portrait square, crops it,
and writes crops to ./portrait-crops/ for review. Rename each crop to the
villager's name slug (e.g. "lukas-hudd.png") and drop it into
web/public/portraits/ — the UI prefers these real portraits and falls back
to save-data-generated avatars for anyone without a file.

Requires Pillow (pip install pillow). Rotate flag: photos shot sideways
need --rotate cw|ccw. Detection is tuned to the game's blue UI frame;
screenshots (not photos) detect most reliably.
"""
import sys, os
from PIL import Image

def detect(img):
    small = img.resize((img.width // 4, img.height // 4))
    px = small.load(); W, H = small.size
    rows = {}
    for y in range(H):
        run = best = bx = start = 0
        for x in range(W):
            r, g, b = px[x, y][:3]
            if b > 120 and b - r > 35 and 50 < g < b + 25:
                if run == 0: start = x
                run += 1
                if run > best: best, bx = run, start
            else:
                run = 0
        if best > 50: rows[y] = (bx, bx + best)
    cands = []
    ys = sorted(rows)
    for i, y1 in enumerate(ys):
        for y2 in ys[i+1:]:
            dy = y2 - y1
            x1s, x1e = rows[y1]; x2s, x2e = rows[y2]
            w = min(x1e, x2e) - max(x1s, x2s)
            if w < 60 or dy < 60: continue
            if abs(dy - w) > w * 0.15: continue
            cands.append((w * dy, max(x1s, x2s), y1, min(x1e, x2e), y2))
    if not cands: return None
    _, xs, ys_, xe, ye = max(cands)
    return tuple(v * 4 for v in (xs, ys_, xe, ye))

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    rotate = next((a.split('=')[-1] for a in sys.argv[1:] if a.startswith('--rotate')), None)
    os.makedirs('portrait-crops', exist_ok=True)
    for path in args:
        img = Image.open(path)
        if rotate == 'cw': img = img.rotate(-90, expand=True)
        if rotate == 'ccw': img = img.rotate(90, expand=True)
        box = detect(img)
        base = os.path.splitext(os.path.basename(path))[0]
        if not box:
            print(f'{base}: no portrait frame detected'); continue
        xs, ys, xe, ye = box
        inset = int((xe - xs) * 0.03)
        img.crop((xs + inset, ys + inset, xe - inset, ye - inset)).resize((256, 256)) \
           .save(f'portrait-crops/{base}.png')
        print(f'{base}: portrait-crops/{base}.png')

if __name__ == '__main__':
    main()
