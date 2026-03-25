from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
SPECS = [
    ("pwa-192.png", 192),
    ("pwa-512.png", 512),
    ("apple-touch-icon.png", 180),
]

NAVY = (20, 59, 132, 255)
WHITE = (255, 255, 255, 255)
SHADOW = (15, 23, 42, 22)
SUPER_SAMPLE = 4
X_OFFSET = 28
Y_OFFSET = 16
LOGO_SCALE = 0.82

GEAR_POINTS = [
    (256.0, 20.0),
    (308.5, 94.3),
    (394.7, 65.1),
    (393.5, 156.1),
    (480.4, 183.1),
    (426.0, 256.0),
    (480.4, 328.9),
    (393.5, 355.9),
    (394.7, 446.9),
    (308.5, 417.7),
    (256.0, 492.0),
    (203.5, 417.7),
    (117.3, 446.9),
    (118.5, 355.9),
    (31.6, 328.9),
    (86.0, 256.0),
    (31.6, 183.1),
    (118.5, 156.1),
    (117.3, 65.1),
    (203.5, 94.3),
]

BACKGROUND_STROKES = [
    (14, (86, 126), [((131, 102), (190, 99), (246, 116)), ((289, 129), (326, 152), (354, 185)), ((389, 226), (406, 283), (401, 337))]),
    (11, (120, 103), [((171, 112), (219, 133), (258, 162))]),
    (10, (154, 98), [((199, 112), (240, 136), (273, 166))]),
    (13, (79, 158), [((147, 160), (211, 173), (269, 197))]),
    (12, (71, 188), [((140, 191), (201, 204), (254, 226))]),
    (12, (64, 218), [((129, 222), (185, 235), (233, 257))]),
    (10, (60, 248), [((114, 255), (159, 272), (199, 297))]),
    (9, (67, 287), [((108, 297), (142, 315), (173, 340))]),
    (9, (81, 326), [((111, 341), (136, 361), (158, 388))]),
]

MASK_PATHS = [
    (12, (72, 109), [((109, 159), (125, 214), (117, 278)), ((110, 336), (122, 384), (151, 424))]),
    (12, (246, 191), [
        ((223, 197), (205, 216), (196, 239)),
        ((187, 263), (188, 292), (198, 316)),
        ((211, 347), (241, 370), (271, 370)),
        ((290, 370), (307, 360), (320, 343)),
        ((309, 346), (296, 345), (284, 339)),
        ((264, 329), (249, 308), (247, 286)),
        ((261, 286), (275, 281), (287, 272)),
        ((301, 262), (309, 247), (309, 230)),
        ((309, 214), (301, 199), (287, 190)),
        ((273, 181), (256, 182), (246, 191)),
    ]),
]

DETAIL_STROKES = [
    (9, (219, 242), [((235, 237), (249, 228), (260, 216))]),
    (11, (244, 367), [((230, 385), (223, 409), (224, 435))]),
    (11, (143, 355), [((180, 365), (203, 393), (207, 438))]),
    (14, (278, 166), [((329, 189), (362, 241), (364, 298)), ((365, 331), (355, 363), (335, 389))]),
    (11, (308, 224), [((326, 236), (337, 257), (337, 279)), ((337, 300), (328, 319), (314, 334))]),
]

CIRCLES = [
    (196, 169, 22, 12),
    (182, 245, 17, 10),
]

DOTS = [
    (204, 161, 7),
    (182, 245, 5),
]


def main():
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    for file_name, size in SPECS:
        render_icon(size).save(PUBLIC_DIR / file_name)


def render_icon(size: int) -> Image.Image:
    render_size = size * SUPER_SAMPLE
    scale = render_size / 512.0
    canvas = Image.new("RGBA", (render_size, render_size), WHITE)
    logo_layer = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(logo_layer)

    gear_points = [mark_point(x, y, scale) for x, y in GEAR_POINTS]
    draw.polygon(gear_points, fill=NAVY)

    for width, start, curves in BACKGROUND_STROKES:
        draw.line(
            sample_cubic_path(start, curves, scale),
            fill=WHITE,
            width=max(1, int(round(width * scale))),
            joint="curve",
        )

    for width, start, curves in MASK_PATHS:
        points = sample_cubic_path(start, curves, scale)
        draw.polygon(points, fill=NAVY)
        draw.line(
            points,
            fill=WHITE,
            width=max(1, int(round(width * scale))),
            joint="curve",
        )

    for width, start, curves in DETAIL_STROKES:
        draw.line(
            sample_cubic_path(start, curves, scale),
            fill=WHITE,
            width=max(1, int(round(width * scale))),
            joint="curve",
        )

    for cx, cy, radius, stroke_width in CIRCLES:
        bounds = circle_bounds(cx, cy, radius, scale)
        draw.ellipse(bounds, fill=NAVY, outline=WHITE, width=max(1, int(round(stroke_width * scale))))

    for cx, cy, radius in DOTS:
        draw.ellipse(circle_bounds(cx, cy, radius, scale), fill=WHITE)

    canvas.alpha_composite(create_shadow(logo_layer, render_size))
    canvas.alpha_composite(logo_layer)

    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def create_shadow(layer: Image.Image, size: int) -> Image.Image:
    alpha = layer.getchannel("A").filter(ImageFilter.GaussianBlur(max(1, size // 56)))
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow.paste(SHADOW, (int(round(size * 0.01)), int(round(size * 0.014))), alpha)
    return shadow


def sample_cubic_path(start, curves, scale):
    points = [mark_point(*start, scale)]
    current = start

    for c1, c2, end in curves:
        steps = 28
        for step in range(1, steps + 1):
            t = step / steps
            x = cubic(current[0], c1[0], c2[0], end[0], t)
            y = cubic(current[1], c1[1], c2[1], end[1], t)
            points.append(mark_point(x, y, scale))
        current = end

    return points


def mark_point(x, y, scale):
    return ((X_OFFSET + (LOGO_SCALE * x)) * scale, (Y_OFFSET + (LOGO_SCALE * y)) * scale)


def circle_bounds(cx, cy, radius, scale):
    x, y = mark_point(cx, cy, scale)
    r = radius * LOGO_SCALE * scale
    return (x - r, y - r, x + r, y + r)


def cubic(p0, p1, p2, p3, t):
    inv = 1 - t
    return (
        (inv ** 3) * p0
        + 3 * (inv ** 2) * t * p1
        + 3 * inv * (t ** 2) * p2
        + (t ** 3) * p3
    )


if __name__ == "__main__":
    main()
