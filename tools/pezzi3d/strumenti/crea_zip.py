#!/usr/bin/env python3
"""Crea lo ZIP del kit da scaricare: python crea_zip.py [uscita.zip]
Dentro: programmi, documenti, catalogo e i modelli finiti (modelli/definitivi).
Fuori: la chiave (impostazioni.json), .venv, concept, modelli grezzi e copie rigenerate."""
import sys
import zipfile
from pathlib import Path

import catalogo

KIT = Path(__file__).resolve().parent.parent
FUORI = {".venv", "concept", "__pycache__", "ai_grezzi", "master", "colorati", "figure"}
FILE_FUORI = {"impostazioni.json", "visualizzatore.html", "report.txt"}

catalogo.main()                                   # catalogo aggiornato ai dati del gioco
uscita = Path(sys.argv[1] if len(sys.argv) > 1 else KIT.parent / f"fab-pezzi3d-{(KIT / 'VERSIONE').read_text().strip()}.zip")
with zipfile.ZipFile(uscita, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(KIT.rglob("*")):
        rel = f.relative_to(KIT)
        if f.is_file() and not FUORI & set(rel.parts) and f.name not in FILE_FUORI:
            z.write(f, Path("fab-pezzi3d") / rel)
    web = KIT.parents[1] / "web" / "public" / "pezzi"          # le figure del gioco: la scheda Orientamento le legge da modelli/figure
    for f in sorted(web.glob("*")) if web.is_dir() else []:
        if f.suffix in (".glb", ".json"):
            z.write(f, Path("fab-pezzi3d") / "modelli" / "figure" / f.name)
print(f"scritto {uscita}")
