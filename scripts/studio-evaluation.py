"""Sets the person of each movement-test photo on a clean brand backdrop: the real photo of the person,
cut out, on a soft sky-blue studio wall and floor, with a contact shadow under the feet.
Usage: compose.py photo mask out [photo mask out …]"""
import sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

WALL_TOP, WALL_BOTTOM = (232, 243, 252), (244, 249, 253)   # halo → page background
FLOOR_NEAR, FLOOR_FAR = (214, 230, 244), (226, 238, 249)
NAVY = (15, 33, 71)
FLOOR_LINE = 0.80  # the camera does not move: the floor starts here in every picture


def backdrop(W, H):
    y = np.linspace(0, 1, H)[:, None, None]
    horizon = int(FLOOR_LINE * H)
    out = np.empty((H, W, 3), 'float32')
    t = (y[:horizon] / FLOOR_LINE)
    out[:horizon] = np.array(WALL_TOP) * (1 - t) + np.array(WALL_BOTTOM) * t
    f = ((y[horizon:] - FLOOR_LINE) / (1 - FLOOR_LINE))
    out[horizon:] = np.array(FLOOR_FAR) * (1 - f) + np.array(FLOOR_NEAR) * f
    # A soft pool of light on the wall behind the person, as in a studio.
    yy, xx = np.mgrid[0:H, 0:W]
    glow = np.exp(-(((xx - W * .5) / (W * .42)) ** 2 + ((yy - H * .42) / (H * .5)) ** 2))[..., None]
    out[:horizon] += (255 - out[:horizon]) * glow[:horizon] * .55
    return out


def compose(photo, mask, out_w=640):
    photo = photo.convert('RGB'); W, H = photo.size
    m = mask.convert('L').resize((W, H))
    # Pull the edge in by a pixel so no rim of the old wall comes along, then soften it.
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.1))
    a = np.asarray(m).astype('float32')[..., None] / 255
    p = np.asarray(photo).astype('float32')
    # A light grade: a touch more contrast and warmth, so the person does not look grey on the clean backdrop.
    p = np.clip((p - 128) * 1.08 + 132, 0, 255) * np.array([1.02, 1.0, .985])
    bg = backdrop(W, H)
    # Contact shadow: where the feet meet the floor.
    solid = np.asarray(m) > 128
    rows = np.where(solid.any(1))[0]
    if len(rows):
        bottom = rows.max(); feet = solid[max(0, bottom - int(H * .035)):bottom + 1]
        cols = np.where(feet.any(0))[0]; cx = (cols.min() + cols.max()) / 2; half = (cols.max() - cols.min()) / 2
        sh = Image.new('L', (W, H), 0); d = ImageDraw.Draw(sh)
        d.ellipse([cx - half * 1.9, bottom - H * .012, cx + half * 1.9, bottom + H * .02], fill=70)
        d.ellipse([cx - half * 1.2, bottom - H * .008, cx + half * 1.2, bottom + H * .012], fill=150)
        s = np.asarray(sh.filter(ImageFilter.GaussianBlur(W * .012))).astype('float32')[..., None] / 255
        bg = bg * (1 - s * .5) + np.array(NAVY) * s * .5
    out = np.clip(bg * (1 - a) + p * a, 0, 255).astype('uint8')
    return Image.fromarray(out).resize((out_w, round(out_w * H / W)), Image.LANCZOS)


if __name__ == '__main__':
    a = sys.argv[1:]
    for i in range(0, len(a), 3):
        compose(Image.open(a[i]), Image.open(a[i + 1])).save(a[i + 2])
