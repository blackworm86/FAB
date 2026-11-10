#!/usr/bin/env python3
"""
FAB · pezzi 3D — test delle sagome sui concept 2D
=======================================================

Prende una cartella di immagini di concept (generate con l'AI o disegnate),
ritaglia ogni figura dallo sfondo, la riempie di nero e la rimpicciolisce a
32 pixel: così vedi se la fazione si riconosce solo dalla forma, come
succederà sul tabellone.

Il risultato è un unico foglio PNG con, per ogni immagine, il concept
originale, la sagoma piena e la sagoma a 32 pixel ingrandita.

USO
  pip install pillow numpy
  python test_sagome.py ../concept/scelti            (cartella di immagini)
  python test_sagome.py ../concept/scelti -o foglio.png --soglia 40

Funziona meglio con sfondo uniforme (grigio chiaro o trasparente), che è
proprio quello che chiedono i prompt del PIANO.
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ESTENSIONI = {".png", ".jpg", ".jpeg", ".webp"}
LATO = 200        # lato di ogni riquadro nel foglio
PICCOLA = 32      # risoluzione del test di lettura


def maschera(img, soglia):
    """Vero dove c'è la figura. Usa la trasparenza se c'è, altrimenti
    stima il colore dello sfondo dal bordo dell'immagine."""
    rgba = np.asarray(img.convert("RGBA"), dtype=float)
    if (rgba[..., 3] < 250).mean() > 0.05:
        return rgba[..., 3] > 128
    rgb = rgba[..., :3]
    bordo = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    sfondo = np.median(bordo, axis=0)
    return np.sqrt(((rgb - sfondo) ** 2).sum(-1)) > soglia


def quadrato(m):
    """Ritaglia attorno alla figura e la mette al centro di un quadrato."""
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        return None
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = m.shape
    lato = int(max(h, w) * 1.1)
    tela = np.zeros((lato, lato), bool)
    oy, ox = (lato - h) // 2, (lato - w) // 2
    tela[oy:oy + h, ox:ox + w] = m
    return tela


def sagoma_img(m, lato):
    img = Image.fromarray(np.where(m, 0, 235).astype(np.uint8), "L")
    return img.resize((lato, lato), Image.BOX).convert("RGB")


def main():
    ap = argparse.ArgumentParser(description="Test delle sagome sui concept.")
    ap.add_argument("cartella")
    ap.add_argument("-o", "--uscita", default=None)
    ap.add_argument("--soglia", type=float, default=35,
                    help="quanto un pixel deve differire dallo sfondo (default 35)")
    args = ap.parse_args()

    cartella = Path(args.cartella)
    file = sorted(f for f in cartella.iterdir()
                  if f.suffix.lower() in ESTENSIONI and not f.name.startswith("_"))
    if not file:
        raise SystemExit(f"Nessuna immagine in {cartella}")

    font = ImageFont.load_default()
    righe = []
    for f in file:
        img = Image.open(f)
        m = quadrato(maschera(img, args.soglia))
        if m is None:
            print(f"{f.name}: non trovo la figura, prova a cambiare --soglia")
            continue
        orig = img.convert("RGB")
        orig.thumbnail((LATO, LATO))
        piena = sagoma_img(m, LATO)
        piccola = sagoma_img(m, PICCOLA).convert("L").point(lambda v: 0 if v < 128 else 235)
        piccola = piccola.resize((LATO, LATO), Image.NEAREST).convert("RGB")
        riga = Image.new("RGB", (LATO * 3 + 40, LATO + 24), (255, 255, 255))
        riga.paste(orig, ((LATO - orig.width) // 2, 24 + (LATO - orig.height) // 2))
        riga.paste(piena, (LATO + 20, 24))
        riga.paste(piccola, (2 * LATO + 40, 24))
        ImageDraw.Draw(riga).text((4, 6), f.name, fill=(0, 0, 0), font=font)
        righe.append(riga)

    # foglio: concept uno sotto l'altro, più una striscia finale con tutte
    # le sagome a 32 px affiancate, alla dimensione reale e raddoppiata
    piccole = [sagoma_img(quadrato(maschera(Image.open(f), args.soglia)), PICCOLA)
               for f in file if quadrato(maschera(Image.open(f), args.soglia)) is not None]
    striscia = Image.new("RGB", (max(len(piccole) * (PICCOLA * 2 + 8), 200), PICCOLA * 3 + 40),
                         (255, 255, 255))
    d = ImageDraw.Draw(striscia)
    d.text((4, 4), "Tutte insieme a 32 px (sopra) e a 64 px (sotto):", fill=(0, 0, 0), font=font)
    for i, p in enumerate(piccole):
        striscia.paste(p, (8 + i * (PICCOLA * 2 + 8), 20))
        striscia.paste(p.resize((PICCOLA * 2, PICCOLA * 2), Image.NEAREST),
                       (8 + i * (PICCOLA * 2 + 8), 20 + PICCOLA + 4))

    larghezza = max([r.width for r in righe] + [striscia.width])
    foglio = Image.new("RGB", (larghezza, sum(r.height for r in righe) + striscia.height + 10),
                       (255, 255, 255))
    y = 0
    for r in righe:
        foglio.paste(r, (0, y))
        y += r.height
    foglio.paste(striscia, (0, y + 10))
    uscita = Path(args.uscita) if args.uscita else cartella / "_test_sagome.png"
    foglio.save(uscita)
    print(f"Foglio salvato in {uscita}")


if __name__ == "__main__":
    main()
