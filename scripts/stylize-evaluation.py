"""Turns the movement-test photos into flat brand-coloured illustrations: the wall and floor become plain
surfaces, the figure keeps its shape in a few flat tones with a dark outline."""
import sys, colorsys
import numpy as np
from PIL import Image, ImageFilter

NAVY, NAVY2 = (15, 33, 71), (38, 62, 120)
SKY_TOP, SKY_BOTTOM = (227, 241, 251), (244, 249, 253)
GROUND, MAT, MAT_EDGE = (207, 226, 241), (185, 167, 245), (150, 132, 222)
FLOOR_LINE = 0.815  # the camera does not move: the floor starts here in every picture


def hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    h = np.zeros_like(mx)
    m = d > 1e-6
    rc = np.where(m, (mx - r) / np.maximum(d, 1e-6), 0); gc = np.where(m, (mx - g) / np.maximum(d, 1e-6), 0); bc = np.where(m, (mx - b) / np.maximum(d, 1e-6), 0)
    h = np.where(mx == r, bc - gc, np.where(mx == g, 2 + rc - bc, 4 + gc - rc))
    h = (h / 6) % 1
    return h, s, mx


def clean(mask, grow=5):
    """Removes specks and thin strips, closes small holes."""
    im = Image.fromarray((mask * 255).astype('uint8'))
    im = im.filter(ImageFilter.MinFilter(grow)).filter(ImageFilter.MaxFilter(grow))
    im = im.filter(ImageFilter.MaxFilter(grow)).filter(ImageFilter.MinFilter(grow))
    return np.asarray(im) > 127


def stylize(img, out_w=640):
    img = img.convert('RGB').filter(ImageFilter.MedianFilter(5))
    a = np.asarray(img).astype('float32') / 255
    H, W = a.shape[:2]
    h, s, v = hsv(a)
    # Shading follows the broad light, not the fabric's grain.
    vs = np.asarray(Image.fromarray((v * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(7))).astype('float32') / 255
    yy, xx = np.mgrid[0:H, 0:W]
    floor = yy > FLOOR_LINE * H

    mat = clean((h > 0.66) & (h < 0.86) & (s > 0.22) & (v > 0.25) & (yy > 0.78 * H))
    if mat.any():
        cols = np.where(mat.any(0))[0]; rows = np.where(mat.any(1))[0]
        mx0, mx1, my1 = cols.min(), cols.max(), rows.max()
    else:
        mx0 = mx1 = my1 = 0
    dark = (v < 0.34) & ~mat
    skin_hue = ((h < 0.12) | (h > 0.95)) & (s > 0.16) & (s < 0.75) & (v > 0.34)
    # On the floor, only what stands on the mat is the person: there must be mat below it in its column.
    on_mat = (np.cumsum(mat[::-1], 0)[::-1] > 8) & (xx > mx0 + 12) & (xx < mx1 - 12)
    side = (xx > 0.08 * W) & (xx < 0.92 * W)
    skin = skin_hue & (~floor | on_mat) & ~mat & side
    dark = dark & (~floor | on_mat) & side
    dark = clean(dark, 3)
    skin = clean(skin, 5) & ~dark
    figure = clean(dark | skin, 3)
    # Near the floor only the feet are real: drop anything smaller.
    low = yy > 0.78 * H
    figure = np.where(low, clean(figure, 13), figure)
    dark &= figure; skin &= figure

    out = np.zeros((H, W, 3), 'float32')
    t = (yy / (FLOOR_LINE * H)).clip(0, 1)[..., None]
    out[:] = np.array(SKY_TOP) * (1 - t) + np.array(SKY_BOTTOM) * t
    out[floor] = GROUND
    out[mat] = MAT
    # Skin: three flat tones around the person's own median colour.
    if skin.any():
        base = np.median(a[skin], 0) * 255
        tone = np.digitize(vs, [np.quantile(vs[skin], 0.25), np.quantile(vs[skin], 0.85)])
        for i, k in enumerate((0.84, 1.0, 1.1)):
            out[skin & (tone == i)] = np.clip(base * k, 0, 255)
    out[dark & (vs >= 0.17)] = NAVY2
    out[dark & (vs < 0.17)] = NAVY

    def edge(mask, width):
        im = Image.fromarray((mask * 255).astype('uint8'))
        return (np.asarray(im.filter(ImageFilter.MaxFilter(width))) > 127) & ~(np.asarray(im.filter(ImageFilter.MinFilter(3))) > 127)
    out[edge(mat, 5) & ~figure] = MAT_EDGE
    out[edge(figure, 5)] = NAVY
    out[edge(skin, 3) & figure] = NAVY
    res = Image.fromarray(out.astype('uint8')).filter(ImageFilter.ModeFilter(7)).filter(ImageFilter.GaussianBlur(1))
    return res.resize((out_w, round(out_w * H / W)), Image.LANCZOS)


if __name__ == '__main__':
    for src, dst in zip(sys.argv[1::2], sys.argv[2::2]):
        stylize(Image.open(src)).save(dst)
