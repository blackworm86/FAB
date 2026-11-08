"""Hatched city fills drawn as plain strokes, for every game's map-lines.svg.

An SVG <pattern> fill made phones draw the whole line work blank (Sicily's board is rasterized wider than a phone GPU's 4096 px texture
limit, and Chrome on a phone then dropped the drawing), so no board file uses <pattern>: a city is its ground colour, the hatch as
ordinary line segments, and its outline, as flat siblings (the 3D map strips the cities group with a non-nested match).

As a script it converts an existing board file in place:  python3 tools/hatch.py web/public/sicily/map-lines.svg
"""
import math, re, sys


def _rot(x, y, a):
    c, s = math.cos(a), math.sin(a)
    return x * c - y * s, x * s + y * c


def hatch_d(pts, gap, angle=45):
    """The hatch segments inside the polygon pts, as one path: lines spaced `gap` apart, turned `angle` degrees (as patternTransform=rotate(angle))."""
    a = math.radians(angle)
    q = [_rot(x, y, -a) for x, y in pts]
    if q[0] != q[-1]:
        q.append(q[0])
    x0, x1 = min(p[0] for p in q), max(p[0] for p in q)
    out = []
    for k in range(math.ceil(x0 / gap), math.floor(x1 / gap) + 1):
        x = k * gap
        ys = sorted(y0 + (y1 - y0) * (x - xa) / (xb - xa) for (xa, y0), (xb, y1) in zip(q, q[1:]) if (xa <= x) != (xb <= x))
        for ya, yb in zip(ys[::2], ys[1::2]):
            (sx, sy), (ex, ey) = _rot(x, ya, a), _rot(x, yb, a)
            out.append(f'M{sx:.1f} {sy:.1f}L{ex:.1f} {ey:.1f}')
    return ''.join(out)


def city(pts, ground, line, line_w, edge, edge_w, gap):
    """One hatched city: its ground, the hatch, its outline."""
    d = 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z'
    return (f'<path d="{d}" fill="{ground}"/>'
            f'<path d="{hatch_d(pts, gap)}" fill="none" stroke="{line}" stroke-width="{line_w}"/>'
            f'<path d="{d}" fill="none" stroke="{edge}" stroke-width="{edge_w}" stroke-linejoin="round"/>')


def _pairs(s):
    n = [float(v) for v in re.findall(r'-?\d*\.?\d+(?:e-?\d+)?', s)]
    return list(zip(n[::2], n[1::2]))


def _points(d):
    """A path's outline as points: M L H V C S Z, absolute or relative (cubics sampled)."""
    out, x, y, cx, cy = [], 0.0, 0.0, None, None
    for cmd, args in re.findall(r'([MLHVCSZmlhvcsz])([^MLHVCSZmlhvcsz]*)', d):
        n = [float(v) for v in re.findall(r'-?\d*\.?\d+(?:e-?\d+)?', args)]
        rel, C = cmd.islower(), cmd.upper()
        if C == 'Z':
            continue
        step = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4}[C]
        for i in range(0, len(n), step):
            a = n[i:i + step]; ox, oy = (x, y) if rel else (0.0, 0.0)
            if C in 'ML':
                x, y = a[0] + ox, a[1] + oy; out.append((x, y)); cx = None
            elif C == 'H':
                x = a[0] + (x if rel else 0); out.append((x, y)); cx = None
            elif C == 'V':
                y = a[0] + (y if rel else 0); out.append((x, y)); cx = None
            else:
                if C == 'C':
                    c1 = (a[0] + ox, a[1] + oy); a = a[2:]
                else:
                    c1 = (2 * x - cx, 2 * y - cy) if cx is not None else (x, y)
                c2, e = (a[0] + ox, a[1] + oy), (a[2] + ox, a[3] + oy)
                for k in range(1, 9):
                    u = k / 8; v = 1 - u
                    out.append((v**3 * x + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u**3 * e[0], v**3 * y + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u**3 * e[1]))
                cx, cy = c2; x, y = e
    return out


def convert(svg):
    m = re.search(r'<defs><pattern id="hatch" width="([\d.]+)"[^>]*><rect[^>]*fill="([^"]+)"/><path[^>]*stroke="([^"]+)" stroke-width="([\d.]+)"/></pattern></defs>\n?', svg)
    if not m:
        return svg
    gap, ground, line, line_w = float(m[1]), m[2], m[3], m[4]
    svg = svg[:m.start()] + svg[m.end():]
    g = re.search(r'<g id="cities"([^>]*)>(.*?)</g>', svg, re.S)
    ga = g[1]
    gedge = re.search(r'stroke="([^"]+)"', ga); gw = re.search(r'stroke-width="([\d.]+)"', ga)
    items = []
    for e in re.finditer(r'<(polygon|path)\b([^>]*)/>', g[2]):
        at = e[2]
        pts = _pairs(re.search(r'points="([^"]+)"', at)[1]) if e[1] == 'polygon' else _points(re.search(r'd="([^"]+)"', at)[1])
        edge = (re.search(r'stroke="([^"]+)"', at) or gedge)[1]; ew = (re.search(r'stroke-width="([\d.]+)"', at) or gw)[1]
        items.append(city(pts, ground, line, line_w, edge, ew, gap))
    assert 'url(#hatch)' not in svg.replace(g[0], ''), 'hatch used outside the cities group'
    return svg.replace(g[0], f'<g id="cities">{"".join(items)}</g>')


if __name__ == '__main__':
    for f in sys.argv[1:]:
        t = open(f).read(); n = convert(t)
        assert '<pattern' not in n and 'url(#' not in n, f
        open(f, 'w').write(n); print(f, len(t) // 1024, '->', len(n) // 1024, 'KB')
