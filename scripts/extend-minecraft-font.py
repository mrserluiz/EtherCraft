#!/usr/bin/env python3
"""Create the EtherCraft Minecraft webfont with Portuguese Latin glyphs."""

from pathlib import Path

from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import GlyphComponent


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/fonts/Minecraft.ttf"
OUTPUT = ROOT / "assets/fonts/Minecraft-PTBR.ttf"


def rectangle(pen, x, y, width=64, height=64):
    pen.moveTo((x, y))
    pen.lineTo((x + width, y))
    pen.lineTo((x + width, y + height))
    pen.lineTo((x, y + height))
    pen.closePath()


def make_accent(kind):
    pen = TTGlyphPen(None)
    patterns = {
        "acute": [(0, 0), (64, 64), (128, 128)],
        "grave": [(128, 0), (64, 64), (0, 128)],
        "circumflex": [(0, 0), (64, 64), (128, 64), (192, 0)],
        "tilde": [(0, 64), (64, 128), (128, 128), (192, 64), (256, 0)],
        "dieresis": [(0, 64), (192, 64)],
        "ring": [(64, 0), (0, 64), (128, 64), (64, 128)],
        "cedilla": [(64, 0), (128, -64), (64, -128), (0, -128)],
    }
    for x, y in patterns[kind]:
        rectangle(pen, x, y)
    return pen.glyph(), {
        "acute": 192,
        "grave": 192,
        "circumflex": 256,
        "tilde": 320,
        "dieresis": 256,
        "ring": 192,
        "cedilla": 192,
    }[kind]


def component(name, x=0, y=0):
    item = GlyphComponent()
    item.glyphName = name
    item.x = x
    item.y = y
    item.flags = 0x4
    return item


font = TTFont(SOURCE)
glyf = font["glyf"]
hmtx = font["hmtx"].metrics
cmap = font.getBestCmap()

for accent in ("acute", "grave", "circumflex", "tilde", "dieresis", "ring", "cedilla"):
    name = f"ec.{accent}"
    glyph, width = make_accent(accent)
    glyf[name] = glyph
    hmtx[name] = (width, 0)

# The original lowercase i includes its dot. Accented i uses this matching stem.
pen = TTGlyphPen(None)
rectangle(pen, 0, 0, 128, 576)
glyf["ec.dotlessi"] = pen.glyph()
hmtx["ec.dotlessi"] = hmtx["i"]

characters = {
    "À": ("A", "grave"), "Á": ("A", "acute"), "Â": ("A", "circumflex"),
    "Ã": ("A", "tilde"), "Ä": ("A", "dieresis"), "Å": ("A", "ring"),
    "à": ("a", "grave"), "á": ("a", "acute"), "â": ("a", "circumflex"),
    "ã": ("a", "tilde"), "ä": ("a", "dieresis"), "å": ("a", "ring"),
    "È": ("E", "grave"), "É": ("E", "acute"), "Ê": ("E", "circumflex"), "Ë": ("E", "dieresis"),
    "è": ("e", "grave"), "é": ("e", "acute"), "ê": ("e", "circumflex"), "ë": ("e", "dieresis"),
    "Ì": ("I", "grave"), "Í": ("I", "acute"), "Î": ("I", "circumflex"), "Ï": ("I", "dieresis"),
    "ì": ("ec.dotlessi", "grave"), "í": ("ec.dotlessi", "acute"),
    "î": ("ec.dotlessi", "circumflex"), "ï": ("ec.dotlessi", "dieresis"),
    "Ò": ("O", "grave"), "Ó": ("O", "acute"), "Ô": ("O", "circumflex"),
    "Õ": ("O", "tilde"), "Ö": ("O", "dieresis"),
    "ò": ("o", "grave"), "ó": ("o", "acute"), "ô": ("o", "circumflex"),
    "õ": ("o", "tilde"), "ö": ("o", "dieresis"),
    "Ù": ("U", "grave"), "Ú": ("U", "acute"), "Û": ("U", "circumflex"), "Ü": ("U", "dieresis"),
    "ù": ("u", "grave"), "ú": ("u", "acute"), "û": ("u", "circumflex"), "ü": ("u", "dieresis"),
    "Ç": ("C", "cedilla"), "ç": ("c", "cedilla"),
    "Ñ": ("N", "tilde"), "ñ": ("n", "tilde"),
    "Ý": ("Y", "acute"), "Ÿ": ("Y", "dieresis"),
    "ý": ("y", "acute"), "ÿ": ("y", "dieresis"),
}

accent_widths = {
    "acute": 192, "grave": 192, "circumflex": 256, "tilde": 320,
    "dieresis": 256, "ring": 192, "cedilla": 192,
}

for char, (base, accent) in characters.items():
    glyph_name = f"uni{ord(char):04X}"
    advance, left_bearing = hmtx[base]
    base_glyph = glyf[base]
    base_top = 576 if char.islower() else 768
    accent_y = base_top + (64 if accent != "cedilla" else 0)
    accent_x = round((advance - accent_widths[accent]) / 128) * 64

    glyph = glyf.glyphs.get(glyph_name)
    if glyph is None:
        from fontTools.ttLib.tables._g_l_y_f import Glyph
        glyph = Glyph()
    glyph.numberOfContours = -1
    glyph.components = [component(base)]
    if accent == "cedilla":
        glyph.components.append(component(f"ec.{accent}", accent_x, -64))
    else:
        glyph.components.append(component(f"ec.{accent}", accent_x, accent_y))
    glyf[glyph_name] = glyph
    hmtx[glyph_name] = (advance, left_bearing)
    cmap[ord(char)] = glyph_name

# Ensure all Unicode cmap subtables used by browsers contain the new mappings.
for table in font["cmap"].tables:
    if table.isUnicode():
        for char in characters:
            table.cmap[ord(char)] = f"uni{ord(char):04X}"

font["head"].yMax = 1024
font.save(OUTPUT)
print(f"Created {OUTPUT.relative_to(ROOT)} with {len(characters)} accented glyphs")
