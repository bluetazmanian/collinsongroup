"""Editable Excalidraw shapes and matching SVG exports for the solution design."""
import base64, json, os, zlib
from html import escape

HERE = os.path.dirname(os.path.abspath(__file__))
BG, INK, GREY, NAVY, BLUE = "#f4f5f7", "#111827", "#4b5563", "#1e3a8a", "#2557d6"
PALE, PALE_STROKE, LINE = "#dbe6fd", "#9db4ee", "#d1d5db"

STYLES = {  # fill, stroke, stroke width, title colour, body colour, dash
    "white":   ("#ffffff", LINE, 2, INK, GREY, False),
    "pale":    (PALE, PALE_STROKE, 2, INK, "#1f2937", False),
    "navy":    (NAVY, NAVY, 2, "#ffffff", "#dbe6fd", False),
    "blue":    (BLUE, BLUE, 2, "#ffffff", "#e6edff", False),
    "dark":    (INK, INK, 2, "#ffffff", "#d1d5db", False),
    "outline": ("#ffffff", NAVY, 3, NAVY, GREY, False),
    "chip":    ("#ffffff", NAVY, 2, NAVY, GREY, True),
    "zone":    ("#e9edf5", "#c3cde0", 2, GREY, GREY, False),
}


def font_css():
    """Embed the same fonts used by the Kainos presentation, without network access."""
    fonts = []
    for family, name, weights in [('inter', 'Inter', (400, 500, 600, 700)),
                                  ('space-grotesk', 'Space Grotesk', (500, 700))]:
        for weight in weights:
            path = os.path.join(HERE, 'fonts', f'{family}-latin-{weight}-normal.woff2')
            with open(path, 'rb') as source:
                data = base64.b64encode(source.read()).decode()
            fonts.append(f"@font-face{{font-family:'{name}';font-weight:{weight};"
                         f"src:url(data:font/woff2;base64,{data}) format('woff2');}}")
    return ''.join(fonts)


class Diagram:
    def __init__(self, w, h, title=None, subtitle=None, margin=60):
        self.w, self.h, self.svg, self.ex, self.n = w, h, [], [], 0
        self.prims, self._mute, self.title, self.subtitle = [], False, title, subtitle
        self._mute = True
        if title:
            self.text(margin, 52, title, 52, 700, INK, font="head")
        if subtitle:
            self.text(margin, 132, subtitle, 25, 400, GREY)
        self._mute = False

    # ---------- helpers
    def _id(self, p):
        self.n += 1
        return f"{p}-{self.n}"

    def _base(self, typ, x, y, w, h, stroke, fill, sw, dash=False, group=None, **kw):
        eid = self._id(typ)
        e = {"id": eid, "type": typ, "x": x, "y": y, "width": w, "height": h, "angle": 0,
             "strokeColor": stroke, "backgroundColor": fill, "fillStyle": "solid", "strokeWidth": sw,
             "strokeStyle": "dashed" if dash else "solid", "roughness": 0, "opacity": 100,
             "groupIds": [group] if group else [], "frameId": None, "roundness": None,
             "seed": zlib.crc32(eid.encode()), "version": 1, "versionNonce": zlib.crc32(eid.encode()[::-1]),
             "isDeleted": False, "boundElements": None, "updated": 1794400000000, "link": None, "locked": False}
        e.update(kw)
        self.ex.append(e)
        return e

    # ---------- primitives
    def text(self, x, y, s, size=19, weight=400, color=GREY, anchor="start", font="body", group=None, spacing=0):
        """y is the TOP of the first line. s may contain newlines."""
        if not self._mute:
            self.prims.append(dict(t="text", x=x, y=y, s=s, size=size, weight=weight, color=color, anchor=anchor, font=font, spacing=spacing))
        lines = s.split("\n")
        lh = 1.3
        fam = "'Space Grotesk'" if font == "head" else "'Inter'"
        ls = f' letter-spacing="{spacing}"' if spacing else ""
        for i, ln in enumerate(lines):
            self.svg.append(
                f'<text x="{x}" y="{y + size * 0.8 + i * size * lh:.1f}" font-family="{fam},Helvetica,Arial,sans-serif" '
                f'font-size="{size}" font-weight="{weight}" fill="{color}" text-anchor="{anchor}"{ls}>{escape(ln)}</text>')
        factor = 0.56 if weight >= 600 else 0.52
        wid = max(len(l) for l in lines) * size * factor + spacing * max(len(l) for l in lines)
        ex_x = x if anchor == "start" else (x - wid / 2 if anchor == "middle" else x - wid)
        self._base("text", ex_x, y, wid, len(lines) * size * lh, color, "transparent", 1, group=group,
                   text=s, originalText=s, fontSize=size, fontFamily=2,
                   textAlign={"start": "left", "middle": "center", "end": "right"}[anchor],
                   verticalAlign="top", containerId=None, autoResize=True, lineHeight=lh)

    def rect(self, x, y, w, h, style="white", r=16, group=None):
        fill, stroke, sw, _, _, dash = STYLES[style]
        if not self._mute:
            self.prims.append(dict(t="rect", x=x, y=y, w=w, h=h, fill=fill, stroke=stroke, sw=sw, dash=dash, r=r))
        d = ' stroke-dasharray="9 7"' if dash else ""
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" '
                        f'stroke="{stroke}" stroke-width="{sw}"{d}/>')
        self._base("rectangle", x, y, w, h, stroke, fill, sw, dash, group, roundness={"type": 3})

    def box(self, x, y, w, h, title, body="", style="white", tsize=24, bsize=18, align="middle"):
        g = self._id("g")
        fill, stroke, sw, tc, bc, dash = STYLES[style]
        self.prims.append(dict(t="box", x=x, y=y, w=w, h=h, fill=fill, stroke=stroke, sw=sw, dash=dash, r=16, title=title, body=body, tc=tc, bc=bc, tsize=tsize, bsize=bsize, align=align))
        mute0, self._mute = self._mute, True
        self.rect(x, y, w, h, style, group=g)
        blines = body.split("\n") if body else []
        tl = title.split("\n")
        th = len(tl) * tsize * 1.3
        bh = len(blines) * bsize * 1.3
        gap = 6 if blines else 0
        top = y + (h - th - gap - bh) / 2
        tx = x + w / 2 if align == "middle" else x + 26
        self.text(tx, top, title, tsize, 700, tc, align, "head", g)
        if blines:
            self.text(tx, top + th + gap, body, bsize, 400, bc, align, "body", g)
        self._mute = mute0

    def diamond(self, cx, cy, w, h, label, style="pale", size=18):
        fill, stroke, sw, tc, _, _ = STYLES[style]
        self.prims.append(dict(t="diamond", x=cx - w / 2, y=cy - h / 2, w=w, h=h, fill=fill, stroke=stroke, sw=sw, label=label, tc=tc, size=size))
        mute0, self._mute = self._mute, True
        pts = f"{cx},{cy - h / 2} {cx + w / 2},{cy} {cx},{cy + h / 2} {cx - w / 2},{cy}"
        self.svg.append(f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"/>')
        self._base("diamond", cx - w / 2, cy - h / 2, w, h, stroke, fill, sw)
        n = len(label.split("\n"))
        self.text(cx, cy - n * size * 1.3 / 2, label, size, 600, tc, "middle")
        self._mute = mute0

    def zone(self, x, y, w, h, label=None, lx=None, ly=None):
        self.rect(x, y, w, h, "zone", r=22)
        if label:
            self.text(lx if lx is not None else x + 26, ly if ly is not None else y + h - 40, label, 15, 700, GREY, spacing=1.6)

    def line(self, pts, color=GREY, sw=2.5, dash=False):
        self.prims.append(dict(t="line", pts=pts, color=color, sw=sw, dash=dash, head=False, both=False))
        d = "M" + " L".join(f"{px},{py}" for px, py in pts)
        da = ' stroke-dasharray="8 6"' if dash else ""
        self.svg.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"{da}/>')
        x0, y0 = pts[0]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        self._base("line", x0, y0, max(xs) - min(xs), max(ys) - min(ys), color, "transparent", sw, dash,
                   points=[[px - x0, py - y0] for px, py in pts], lastCommittedPoint=None, startBinding=None,
                   endBinding=None, startArrowhead=None, endArrowhead=None)

    def arrow(self, pts, color=GREY, sw=2.5, both=False, dash=False):
        self.prims.append(dict(t="line", pts=pts, color=color, sw=sw, dash=dash, head=True, both=both))
        d = "M" + " L".join(f"{px},{py}" for px, py in pts)
        mid = f"ah{color[1:]}"
        if mid not in getattr(self, "_markers", {}):
            self._markers = getattr(self, "_markers", {})
            self._markers[mid] = (f'<marker id="{mid}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" '
                                  f'markerHeight="5.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{color}"/></marker>')
        ms = f' marker-start="url(#{mid})"' if both else ""
        da = ' stroke-dasharray="8 6"' if dash else ""
        self.svg.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linejoin="round" '
                        f'marker-end="url(#{mid})"{ms}{da}/>')
        x0, y0 = pts[0]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        self._base("arrow", x0, y0, max(xs) - min(xs), max(ys) - min(ys), color, "transparent", sw, dash,
                   points=[[px - x0, py - y0] for px, py in pts], lastCommittedPoint=None, startBinding=None,
                   endBinding=None, startArrowhead="triangle" if both else None, endArrowhead="triangle", elbowed=False)

    def badge(self, x, y, n, r=15, color=BLUE):
        g = self._id("g")
        self.prims.append(dict(t="badge", x=x, y=y, r=r, color=color, n=str(n)))
        mute0, self._mute = self._mute, True
        self.svg.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}" stroke="{BG}" stroke-width="3"/>')
        self._base("ellipse", x - r, y - r, 2 * r, 2 * r, color, color, 1, group=g)
        self.text(x, y - 16 * 0.62, str(n), 16, 700, "#ffffff", "middle", "body", g)
        self._mute = mute0

    # ---------- output
    def save(self, path_noext):
        defs = "".join(getattr(self, "_markers", {}).values())
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}">'
               f'<defs><style>{font_css()}</style>{defs}</defs>'
               f'<rect width="{self.w}" height="{self.h}" fill="{BG}"/>' + "".join(self.svg) + "</svg>")
        open(path_noext + ".svg", "w").write(svg)
        json.dump(dict(w=self.w, h=self.h, title=self.title, subtitle=self.subtitle, prims=self.prims), open(path_noext + ".prims.json", "w"))
        # Excalidraw: order index
        for i, e in enumerate(self.ex):
            e["index"] = "a" + format(i, "04d")
        frame = {"id": "canvas", "type": "rectangle", "x": 0, "y": 0, "width": self.w, "height": self.h, "angle": 0,
                 "strokeColor": "transparent", "backgroundColor": BG, "fillStyle": "solid", "strokeWidth": 1,
                 "strokeStyle": "solid", "roughness": 0, "opacity": 100, "groupIds": [], "frameId": None,
                 "roundness": None, "seed": 1, "version": 1, "versionNonce": 1, "isDeleted": False,
                 "boundElements": None, "updated": 1794400000000, "link": None, "locked": True, "index": "Zz"}
        doc = {"type": "excalidraw", "version": 2, "source": "https://excalidraw.com", "elements": [frame] + self.ex,
               "appState": {"viewBackgroundColor": BG, "exportBackground": True, "exportEmbedScene": False,
                            "exportPadding": 0, "gridSize": None}, "files": {}}
        json.dump(doc, open(path_noext + ".excalidraw", "w"), indent=1)
