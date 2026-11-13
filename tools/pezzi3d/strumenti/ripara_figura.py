#!/usr/bin/env python3
"""
FAB · pezzi 3D — chiude i buchi di una figura (mesh "non manifold": bordi aperti)
================================================================================

I buchi vengono dai modelli di Meshy e dai tagli dei gruppi in figure singole. Per ogni buco
(un gruppo connesso di bordi aperti) aggiunge un vertice al centro del buco e un triangolo per
ogni bordo: la figura diventa chiusa, la texture resta quella (il nuovo vertice prende la media
delle coordinate texture del bordo). L'originale resta in modelli/figure_originali/.

  python ripara_figura.py FILE.glb [FILE2.glb ...]      ripara (sovrascrive, tiene l'originale)
  python ripara_figura.py --conta FILE.glb              dice solo quanti bordi aperti ci sono

Limite: un buco molto grande o concavo viene chiuso a ventaglio dal centro, e può uscire un po' dalla forma:
si vede nel pannello (Orientamento); in quel caso conviene rigenerare la figura.
"""

import argparse
import shutil
import sys
from pathlib import Path

import numpy as np
import trimesh

KIT = Path(__file__).resolve().parent.parent
ORIGINALI = KIT / "modelli" / "figure_originali"


def carica(percorso):
    s = trimesh.load(percorso, force="scene")
    g = s.to_geometry() if hasattr(s, "to_geometry") else s.dump(concatenate=True)
    return g


def bordi_aperti(g):
    """Bordi (a, b) di triangoli che nessun altro triangolo ricambia, in indici di posizione unica; più il vettore posizione->vertice."""
    _, rep, inv = np.unique(np.round(g.vertices, 5), axis=0, return_index=True, return_inverse=True)
    f = inv.reshape(-1)[g.faces]                                   # facce in indici di posizione
    d = np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]])
    visti = {(int(a), int(b)) for a, b in d}
    aperti = [(a, b) for a, b in visti if (b, a) not in visti and a != b]
    return aperti, rep, inv.reshape(-1)


def pulisci_texture(g, lato=512):
    """Texture pulita: la texture è un mosaico di isolette (una per pezzo di mesh) su sfondo nero senza margine, e al GPU i bordi
    delle isolette si mescolano col nero: sono le righe scure sulla figura. Qui la texture si ingrandisce a lato x lato e il nero
    attorno alle isolette si riempie col colore dell'isoletta più vicina ("padding"). Restituisce l'immagine (PIL)."""
    from PIL import Image, ImageDraw, ImageFilter
    from scipy import ndimage
    img = g.visual.material.baseColorTexture.convert("RGB").resize((lato, lato), Image.LANCZOS)
    mask = Image.new("L", (lato, lato), 0); d = ImageDraw.Draw(mask)
    uv = np.asarray(g.visual.uv)
    for f in g.faces:
        d.polygon([(float(uv[i][0]) * lato, (1 - float(uv[i][1])) * lato) for i in f], fill=255)
    valido = np.asarray(mask.filter(ImageFilter.MinFilter(5))) > 0       # via 2 pixel di bordo: sono già sfumati col nero
    a = np.asarray(img)
    if not valido.any():
        return img
    _, (iy, ix) = ndimage.distance_transform_edt(~valido, return_indices=True)
    return Image.fromarray(a[iy, ix])


def conta(percorso):
    return len(bordi_aperti(carica(percorso))[0])


def ripara(percorso, lato=512):
    """Chiude i buchi di percorso (sovrascrive, salvando l'originale una volta). Restituisce (bordi aperti prima, dopo, buchi chiusi)."""
    g = carica(percorso)
    aperti, rep, inv = bordi_aperti(g)
    if not aperti:                      # niente buchi: solo la texture
        mat = g.visual.material
        mat.baseColorTexture = pulisci_texture(g, lato)
        ORIGINALI.mkdir(parents=True, exist_ok=True)
        if not (ORIGINALI / Path(percorso).name).exists():
            shutil.copy2(percorso, ORIGINALI / Path(percorso).name)
        Path(percorso).write_bytes(trimesh.Scene(g).export(file_type="glb"))
        return 0, 0, 0
    uv = np.asarray(g.visual.uv) if getattr(g.visual, "uv", None) is not None else None
    # un buco = una componente connessa dei bordi aperti
    padre = {}
    def trova(x):
        while padre.setdefault(x, x) != x:
            padre[x] = padre[padre[x]]; x = padre[x]
        return x
    for a, b in aperti:
        padre[trova(a)] = trova(b)
    comp = {}
    for a, b in aperti:
        comp.setdefault(trova(a), set()).update((a, b))
    V, U, nuovi = list(g.vertices), (list(uv) if uv is not None else None), []
    centro = {}
    for r, pos in comp.items():
        idx = [int(rep[p]) for p in pos]                            # un vertice vero per ogni posizione del bordo
        centro[r] = np.mean([g.vertices[i] for i in idx], axis=0)
    for a, b in aperti:                                             # il bordo (a,b) è percorso a->b: il tappo lo percorre b->a
        ia, ib = int(rep[a]), int(rep[b])                           # un vertice centrale per ogni triangolo, con coordinata texture a metà del bordo:
        V.append(centro[trova(a)])                                  # il triangolo ha area zero nella texture e prende il colore del bordo che chiude
        if U is not None:
            U.append((uv[ia] + uv[ib]) / 2)
        nuovi.append([ib, ia, len(V) - 1])
    facce = np.vstack([g.faces, np.array(nuovi)])
    mat = g.visual.material if hasattr(g.visual, "material") else None
    m = trimesh.Trimesh(np.array(V), facce, process=False)
    if U is not None:
        m.visual = trimesh.visual.TextureVisuals(uv=np.array(U), material=mat)
        if mat is not None and getattr(mat, "baseColorTexture", None) is not None:
            mat.baseColorTexture = pulisci_texture(m, lato)
    ORIGINALI.mkdir(parents=True, exist_ok=True)
    if not (ORIGINALI / Path(percorso).name).exists():
        shutil.copy2(percorso, ORIGINALI / Path(percorso).name)
    Path(percorso).write_bytes(trimesh.Scene(m).export(file_type="glb"))
    return len(aperti), len(bordi_aperti(carica(percorso))[0]), len(comp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--conta", action="store_true")
    a = ap.parse_args()
    for f in a.files:
        if a.conta:
            print(f"{Path(f).name}: {conta(f)} bordi aperti")
        else:
            prima, dopo, buchi = ripara(f)
            print(f"{Path(f).name}: {prima} bordi aperti -> {dopo} ({buchi} buchi chiusi)")


if __name__ == "__main__":
    sys.exit(main())
