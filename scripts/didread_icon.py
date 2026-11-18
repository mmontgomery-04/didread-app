# The DidRead "DR" monogram in the brand colors: accent green (#8DBE9F) on the warm near-black
# (#1B1917). One drawing, used for the website's icons (scripts/build-site.py) and the app's icons
# (scripts/make-app-icon.py), so they always match. Plain Python, no image packages: the strokes
# are drawn by distance, smoothing only the pixels an edge passes through.
import math, struct, zlib

BG, FG = '#1B1917', '#8DBE9F'
STROKE = 80
SCALE = 1.16  # letters scaled up around the centre so they read at 16 px
TILE_RADIUS = 224  # rounded corners for the browser-tab icon (on the 1024 grid)
PATHS = [  # the angular "DR" on a 1024 grid, as round-jointed strokes; D is closed
    [(242, 300), (374, 300), (482, 420), (482, 604), (374, 724), (242, 724), (242, 300)],
    [(592, 724), (592, 300), (694, 300), (772, 378), (772, 430), (682, 520), (592, 520)],
    [(682, 520), (782, 724)],
]

_SEGMENTS = [
    tuple(512 + (v - 512) * SCALE for v in (x1, y1, x2, y2))
    for pts in PATHS for (x1, y1), (x2, y2) in zip(pts, pts[1:])
]
_HALF = STROKE * SCALE / 2


def _rgb(hex_color):
    return tuple(int(hex_color[i:i + 2], 16) for i in (1, 3, 5))


def svg(rounded=True):
    """The icon as SVG: a rounded tile (browser tab) or a square."""
    d = ''.join('M' + 'L'.join(f'{x} {y}' for x, y in pts) for pts in PATHS)
    rx = f' rx="{TILE_RADIUS}"' if rounded else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024"{rx} fill="{BG}"/>'
            f'<path d="{d}" fill="none" stroke="{FG}" stroke-width="{STROKE}" stroke-linecap="round" stroke-linejoin="round" '
            f'transform="translate(512 512) scale({SCALE}) translate(-512 -512)"/></svg>\n')


def _stroke_distance(x, y):
    """Distance from the stroke's edge: negative inside the letters."""
    best = math.inf
    for x1, y1, x2, y2 in _SEGMENTS:
        dx, dy = x2 - x1, y2 - y1
        t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
        best = min(best, math.hypot(x - x1 - t * dx, y - y1 - t * dy))
    return best - _HALF


def _tile_distance(x, y):
    """Distance from the rounded tile's edge: negative inside."""
    r = TILE_RADIUS
    cx, cy = min(max(x, r), 1024 - r), min(max(y, r), 1024 - r)
    return math.hypot(x - cx, y - cy) - r


def png(size, background='square'):
    """
    PNG bytes at size x size. background: 'square' (opaque, no transparency: app icons),
    'rounded' (the rounded tile on transparency: browser tab) or None (the green letters alone on
    transparency: the layer of the iOS 26 layered icon).
    """
    bg, fg = _rgb(BG), _rgb(FG)
    unit = 1024 / size
    edge = unit * 0.75
    n = 4  # samples per side, only for pixels an edge passes through
    opaque = background == 'square'
    rows = bytearray()
    for py in range(size):
        rows.append(0)
        for px in range(size):
            x, y = (px + 0.5) * unit, (py + 0.5) * unit
            ds = _stroke_distance(x, y)
            dt = _tile_distance(x, y) if background == 'rounded' else -math.inf
            if abs(ds) > edge and abs(dt) > edge:
                ink = 1.0 if ds < 0 else 0.0
                tile = 1.0 if dt < 0 else 0.0
            else:
                ink_n = tile_n = 0
                for sy in range(n):
                    for sx in range(n):
                        X, Y = (px + (sx + 0.5) / n) * unit, (py + (sy + 0.5) / n) * unit
                        if background != 'rounded' or _tile_distance(X, Y) < 0:
                            tile_n += 1
                            ink_n += _stroke_distance(X, Y) < 0
                tile = tile_n / (n * n)
                ink = ink_n / tile_n if tile_n else 0.0
            if background is None:
                rows.extend(fg)
                rows.append(round(ink * 255))
            else:
                rows.extend(round(b + (f - b) * ink) for b, f in zip(bg, fg))
                if not opaque:
                    rows.append(round(tile * 255))
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    color_type = 2 if opaque else 6  # RGB, or RGBA
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, color_type, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b''))


def ico(pngs):
    """A .ico file holding PNG images (supported by every current browser)."""
    out, offset = struct.pack('<HHH', 0, 1, len(pngs)), 6 + 16 * len(pngs)
    for data in pngs:
        size = struct.unpack('>I', data[16:20])[0]
        out += struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    return out + b''.join(pngs)
