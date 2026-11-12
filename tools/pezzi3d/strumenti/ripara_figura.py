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


def conta(percorso):
    return len(bordi_aperti(carica(percorso))[0])


def ripara(percorso):
    """Chiude i buchi di percorso (sovrascrive, salvando l'originale una volta). Restituisce (bordi aperti prima, dopo, buchi chiusi)."""
    g = carica(percorso)
    aperti, rep, inv = bordi_aperti(g)
    if not aperti:
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
        V.append(np.mean([g.vertices[i] for i in idx], axis=0))
        if U is not None:
            U.append(np.mean([uv[i] for i in idx], axis=0))
        centro[r] = len(V) - 1
    for a, b in aperti:                                             # il bordo (a,b) è percorso a->b: il tappo lo percorre b->a
        nuovi.append([int(rep[b]), int(rep[a]), centro[trova(a)]])
    facce = np.vstack([g.faces, np.array(nuovi)])
    mat = g.visual.material if hasattr(g.visual, "material") else None
    m = trimesh.Trimesh(np.array(V), facce, process=False)
    if U is not None:
        m.visual = trimesh.visual.TextureVisuals(uv=np.array(U), material=mat)
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
