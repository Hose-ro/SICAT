from pathlib import Path
from PIL import Image

ROOT_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT_DIR / "public"
MASTER_PATH = ROOT_DIR / "src" / "logoTec" / "logotec-master.png"

# Icons instalables: se quedan con el fondo blanco del master (iOS y los
# iconos maskable renderizan el alfa como negro).
OPAQUE_SPECS = [
    ("pwa-192.png", 192),
    ("pwa-512.png", 512),
    ("apple-touch-icon.png", 180),
]

# Icono de marca dentro de la app y favicon: solo la silueta azul.
TRANSPARENT_SPECS = [
    ("app-icon.png", 512),
]

BRAND_BLUE = (0, 42, 111)
ALPHA_FLOOR = 6  # ruido casi blanco del master -> totalmente transparente


def silhouette(master):
    """Convierte el blanco del master en alfa conservando la forma.

    El master solo tiene dos colores (blanco y el azul institucional), asi que
    un pixel mezclado cumple R = 255 * (1 - alfa): el canal rojo da el alfa
    exacto y el color se restituye al azul puro sin halos.
    """
    out = Image.new("RGBA", master.size)
    pixels = []
    for r, _g, _b in master.getdata():
        alpha = 255 - r
        pixels.append((*BRAND_BLUE, 0 if alpha <= ALPHA_FLOOR else alpha))
    out.putdata(pixels)
    return out


def main():
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    master = Image.open(MASTER_PATH).convert("RGB")

    for file_name, size in OPAQUE_SPECS:
        master.resize((size, size), Image.Resampling.LANCZOS).save(PUBLIC_DIR / file_name)

    mark = silhouette(master)
    for file_name, size in TRANSPARENT_SPECS:
        mark.resize((size, size), Image.Resampling.LANCZOS).save(PUBLIC_DIR / file_name)


if __name__ == "__main__":
    main()
