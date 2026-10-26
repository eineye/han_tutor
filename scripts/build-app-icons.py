# Makes the PWA maskable icon and the Android launcher icons / splash screens from public/icon-512.png.
# Run after changing the logo:  python3 scripts/build-app-icons.py   (needs Pillow)
from PIL import Image, ImageDraw

NAVY = (2, 50, 124, 255)
CREAM = (255, 248, 241, 255)
RES = 'android/app/src/main/res'

src = Image.open('public/icon-512.png').convert('RGBA')
# inner part of the navy card (without the white sticker border), corners filled with navy
box = (73, 38, 431, 457)
inner = src.crop(box)
mask = Image.new('L', inner.size, 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner.width - 1, inner.height - 1), radius=30, fill=255)
content = Image.new('RGBA', inner.size, NAVY)
content.paste(inner, (0, 0), mask)


def on_navy(size, fill):
    """Square navy image with the card content centered, filling `fill` of the height."""
    canvas = Image.new('RGBA', (size, size), NAVY)
    h = round(size * fill)
    w = round(h * content.width / content.height)
    canvas.alpha_composite(content.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2))
    return canvas


# PWA maskable icon: everything important inside the central 80 % circle
on_navy(512, 0.74).save('public/icon-maskable-512.png')

dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for d, k in dens.items():
    # adaptive icon foreground (108 dp, safe zone 66 dp) on the navy background color
    on_navy(round(108 * k), 0.6).save(f'{RES}/mipmap-{d}/ic_launcher_foreground.png')
    # legacy square + round icons (Android 7)
    n = round(48 * k)
    on_navy(n, 0.86).save(f'{RES}/mipmap-{d}/ic_launcher.png')
    r = on_navy(n, 0.8)
    m = Image.new('L', (n, n), 0)
    ImageDraw.Draw(m).ellipse((0, 0, n - 1, n - 1), fill=255)
    out = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    out.paste(r, (0, 0), m)
    out.save(f'{RES}/mipmap-{d}/ic_launcher_round.png')

# splash screens: the sticker logo centered on the app's cream background
splash = {'drawable': (480, 320)}
for d, k in dens.items():
    splash[f'drawable-port-{d}'] = (round(320 * k), round(480 * k))
    splash[f'drawable-land-{d}'] = (round(480 * k), round(320 * k))
for folder, (w, h) in splash.items():
    canvas = Image.new('RGBA', (w, h), CREAM)
    s = round(min(w, h) * 0.42)
    canvas.alpha_composite(src.resize((s, s), Image.LANCZOS), ((w - s) // 2, (h - s) // 2))
    canvas.convert('RGB').save(f'{RES}/{folder}/splash.png')
print('icons and splash screens written')
