from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
source = root / 'src/extension/assets/brand/tuhamho-brow-cat.png'
extension_dir = root / 'src/extension/public/icon'
canonical_dir = root / 'src/extension/assets/brand/icons'
tauri_dir = root / 'src/windows/src-tauri/icons'
base = Image.open(source).convert('RGB')

def render(size: int) -> Image.Image:
    scale = 4
    canvas = Image.new('RGBA', (size * scale, size * scale), '#050914')
    draw = ImageDraw.Draw(canvas)
    pad = max(1, round(size * scale * 0.035))
    radius = round(size * scale * 0.19)
    draw.rounded_rectangle((pad, pad, size * scale - pad - 1, size * scale - pad - 1), radius=radius, fill='#101a31', outline='#42a5ff', width=max(1, round(size * scale * 0.012)))
    inset = round(size * scale * 0.075)
    art = base.resize((size * scale - 2 * inset, size * scale - 2 * inset), Image.Resampling.LANCZOS)
    mask = Image.new('L', art.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, art.width - 1, art.height - 1), radius=round(size * scale * 0.15), fill=255)
    canvas.paste(art, (inset, inset), mask)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)

for folder in (extension_dir, canonical_dir, tauri_dir):
    folder.mkdir(parents=True, exist_ok=True)
for size in (16, 32, 48, 96, 128):
    render(size).save(extension_dir / f'{size}.png', optimize=True)
    render(size).save(canonical_dir / f'{size}.png', optimize=True)
for size, name in ((32, '32x32.png'), (128, '128x128.png'), (256, '128x128@2x.png'), (512, 'icon.png')):
    render(size).save(tauri_dir / name, optimize=True)
    if size == 512:
        render(size).save(root / 'src/extension/assets/brand/tuhamho-brow-icon.png', optimize=True)
render(256).convert('RGB').save(tauri_dir / 'icon.ico', format='ICO', sizes=[(16,16), (32,32), (48,48), (64,64), (128,128), (256,256)])
render(512).save(tauri_dir / 'icon.icns', format='ICNS')
