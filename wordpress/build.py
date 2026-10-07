#!/usr/bin/env python3
"""Baut das WordPress-Plugin wordpress/dist/wisi-site.zip aus index.html + img/.

- Bilder: JPG über 80 KB werden zu WebP (q82), wenn das mindestens 20 % spart.
- Merkblätter: Links zeigen auf die identischen PDFs in der WordPress-Mediathek.
- Entfernt das Feedback-Kit (bali-feedback.pages.dev).

    python3 wordpress/build.py
"""
import os
import re
import shutil
import zipfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PLUGIN = os.path.join(ROOT, "wordpress", "wisi-site")
DIST = os.path.join(ROOT, "wordpress", "dist")
OUT = os.path.join(DIST, "wisi-site")

# Gleiche Datei (Byte für Byte geprüft) in wp-content/uploads/
MERKBLAETTER = {
    "Schimmel-Merkblatt-zum-Abgeben.pdf": "2026/09/",
    "Zusammenhang-Luftfeuchte-und-Temperatur.pdf": "2024/05/",
    "Welchen-Raum-wie-lueften.pdf": "2024/05/",
    "Gute-Luftqualitaet-Merkblatt-zum-Abgeben.pdf": "2024/05/",
    "Kondenswasser-Bildung-aus-fff-broschuere-optimal-lueften-de.pdf.pdf": "2023/04/",
    "fff-broschuere-optimal-lueften-de.pdf.pdf": "2023/04/",
    "fff-broschuere-fensterpflege-de.pdf.pdf": "2023/04/",
}

OG_IMAGE = "e51b91f485b6.webp"  # Martin mit Servicebus


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(os.path.join(OUT, "app", "img"))
    for f in ("wisi-site.php", "boot.js"):
        shutil.copy(os.path.join(SRC_PLUGIN, f), OUT)

    renamed, saved = {}, 0
    for f in sorted(os.listdir(os.path.join(ROOT, "img"))):
        src = os.path.join(ROOT, "img", f)
        dst = os.path.join(OUT, "app", "img", f)
        size = os.path.getsize(src)
        if f.endswith(".jpg") and size > 80 * 1024:
            webp = dst[:-4] + ".webp"
            Image.open(src).save(webp, "WEBP", quality=82, method=6)
            if os.path.getsize(webp) <= size * 0.8:
                renamed[f] = f[:-4] + ".webp"
                saved += size - os.path.getsize(webp)
                continue
            os.remove(webp)
        shutil.copy(src, dst)

    # Vorschaubild für Google, WhatsApp, Facebook (1200 x 630)
    og = Image.open(os.path.join(ROOT, "img", OG_IMAGE)).convert("RGB")
    w, h = og.size
    ch = round(w * 630 / 1200)
    top = min(max(0, round(h * 0.42 - ch / 2)), h - ch)
    og.crop((0, top, w, top + ch)).resize((1200, 630), Image.LANCZOS).save(
        os.path.join(OUT, "app", "og.jpg"), "JPEG", quality=84, optimize=True, progressive=True)

    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    html, n_kit = re.subn(r'<script id="wisi-kit".*?</script>', "", html, flags=re.S)
    assert n_kit == 1, "feedback kit not found"

    def img(m):
        name = renamed.get(m.group(2), m.group(2))
        return m.group(1) + "%%WISI_APP%%img/" + name

    html, n_img = re.subn(r'(["\'])img/([0-9a-f]{12}\.[a-z]+)', img, html)

    def pdf(m):
        name = m.group(2)
        return m.group(1) + "%%WISI_UPLOADS%%" + MERKBLAETTER[name] + name

    html, n_pdf = re.subn(r'(["\'])merkblaetter/([^"\']+\.pdf)', pdf, html)
    left = re.findall(r'["\'](?:img|merkblaetter)/[^"\']*', html)
    assert not left, left

    open(os.path.join(OUT, "app", "index.html"), "w", encoding="utf-8").write(html)

    zpath = os.path.join(DIST, "wisi-site.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for d, _, files in os.walk(OUT):
            for f in files:
                p = os.path.join(d, f)
                z.write(p, os.path.relpath(p, DIST))
    print(f"img refs {n_img}, pdf refs {n_pdf}, JPG->WebP {len(renamed)} (-{saved // 1024} KB)")
    print(f"{zpath}: {os.path.getsize(zpath) // 1024} KB")


if __name__ == "__main__":
    main()
