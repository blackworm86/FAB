#!/usr/bin/env python3
"""
FAB · pezzi 3D — dai modelli di gruppo alle figure singole per il gioco
======================================================================

Il gioco mostra una figura per ogni passo di forza (4 passi = 4 soldati), quindi
gli servono figure SINGOLE. Meshy ha fatto gruppi (tre soldati, due carri) uniti
in un solo pezzo: questo script li taglia, gira ogni figura verso +Z, le dà la
scala reale (M unità di tabellone per metro) e scrive:

  web/public/pezzi/<tipo>_<n>.glb   una figura
  web/public/pezzi/<volume>.json    per il gioco: blocco -> tipo, tipo -> figure

USO (dalla cartella strumenti):  python separa_figure.py [--volume bulge]

Per i prossimi volumi conviene generare in Meshy UNA figura per file: allora
basta mettere k = 1 nella tabella TIPI e il taglio non serve.
"""

import argparse
import json
from pathlib import Path

import numpy as np
import trimesh
from scipy.cluster.vq import kmeans2

QUI = Path(__file__).resolve().parent
KIT = QUI.parent
M = 0.18   # unità di tabellone (cm) per metro: un soldato ~0.32, uno Sherman ~0.53 di altezza
TEXTURE = 256
# tipo: (figure nel file, asse su cui stanno affiancate 0=X 1=Z, rotazione in gradi per guardare +Z, altezza reale in m, "tutte" | "la_piu_grande")
TIPI = {
    "bulge_british_armor": (2, 1, 90, 2.97, "tutte"), "bulge_british_inf": (3, 0, 0, 1.8, "tutte"),
    "bulge_german_airborne": (3, 0, 0, 1.8, "tutte"), "bulge_german_armor": (2, 1, 90, 2.99, "tutte"),
    "bulge_german_inf": (3, 0, 0, 1.8, "tutte"), "bulge_german_mech": (2, 1, 90, 2.3, "la_piu_grande"),   # il semicingolato, senza i due fanti minuscoli
    "bulge_german_mountain": (3, 0, 0, 1.8, "tutte"), "bulge_us_airborne": (3, 0, 0, 1.8, "tutte"),
    "bulge_us_armor": (2, 0, 0, 2.97, "tutte"), "bulge_us_cavalry": (2, 0, 0, 2.3, "tutte"),
    "bulge_us_inf": (3, 0, 0, 1.8, "tutte"),
}
VEICOLI = ("armor", "cavalry", "mech", "recon", "motorized")


def componenti(m):
    w = trimesh.Trimesh(m.vertices, m.faces, process=False)
    w.merge_vertices(merge_tex=True, merge_norm=True)   # le cuciture della texture non separano le parti
    return trimesh.graph.connected_component_labels(w.face_adjacency, node_count=len(w.faces)), w.triangles_center


def taglia(g, k, asse, tieni):
    """Liste di facce, una per figura, ordinate lungo l'asse."""
    c = g.triangles_center[:, [0, 2]]
    if tieni == "la_piu_grande":   # veicolo e fanti minuscoli: taglio nel vuoto più largo, tengo il lato più pieno
        z = np.sort(c[:, asse]); i = np.argmax(np.diff(z)); soglia = (z[i] + z[i + 1]) / 2
        lato = c[:, asse] < soglia
        return [np.where(lato if lato.sum() > len(c) / 2 else ~lato)[0]]
    if k == 1:
        return [np.arange(len(g.faces))]
    init = np.c_[np.linspace(c[:, 0].min(), c[:, 0].max(), k + 2)[1:-1], np.linspace(c[:, 1].min(), c[:, 1].max(), k + 2)[1:-1]]
    init[:, 1 - asse] = c[:, 1 - asse].mean()
    _, lab = kmeans2(c, init, minit="matrix", seed=1)
    # una parte intera (fucile, torretta, corpo) va a una sola figura; solo i corpi davvero fusi da Meshy restano tagliati faccia per faccia
    comp, _ = componenti(g)
    for cc in np.unique(comp):
        f = np.where(comp == cc)[0]; voti = np.bincount(lab[f], minlength=k)
        if voti.max() >= 0.85 * len(f) or len(f) < 0.25 * len(lab) / k:
            lab[f] = voti.argmax()
    return sorted((np.where(lab == i)[0] for i in range(k)), key=lambda f: c[f, asse].mean())


def senza_briciole(m):
    """Toglie le briciole galleggianti (la punta del fucile del vicino): parti minuscole fuori dal resto della figura."""
    cl, tc = componenti(m)
    piccole = np.bincount(cl) < 0.015 * len(m.faces)
    if piccole.all():
        return m
    lo, hi = tc[~piccole[cl]].min(0), tc[~piccole[cl]].max(0); pad = 0.03 * (hi - lo)
    via = np.zeros(len(piccole), bool)
    for l in np.where(piccole)[0]:
        ct = tc[cl == l].mean(0); via[l] = not np.all((ct >= lo - pad) & (ct <= hi + pad))
    return m.submesh([np.where(~via[cl])[0]], append=True) if via.any() else m


def figura(g, facce, gradi, alto):
    m = senza_briciole(g.submesh([facce], append=True))
    m.apply_transform(trimesh.transformations.rotation_matrix(np.radians(gradi), [0, 1, 0]))
    lo, hi = m.bounds
    m.apply_translation([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
    m.apply_scale(alto * M / (hi[1] - lo[1]))
    m.visual.material.name = "figura"
    img = m.visual.material.baseColorTexture
    if img is not None and max(img.size) > TEXTURE:
        m.visual.material.baseColorTexture = img.resize((TEXTURE, TEXTURE))
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--volume", default="bulge")
    ap.add_argument("--uscita", default=str(KIT.parents[1] / "web" / "public" / "pezzi"))
    a = ap.parse_args()
    out = Path(a.uscita); out.mkdir(parents=True, exist_ok=True)
    tipi = {t["id"]: t for t in json.loads((KIT / "catalogo.json").read_text(encoding="utf-8"))["tipi"]}
    indice = {"tipi": {}, "blocchi": {}}
    for nome, (k, asse, gradi, alto, tieni) in TIPI.items():
        if not nome.startswith(a.volume + "_"):
            continue
        src = KIT / "modelli" / "definitivi" / f"{nome}.glb"
        if not src.exists():
            print(f"{nome}: manca {src.name}, salto"); continue
        g = trimesh.load(src, force="scene").geometry["figura"]
        files = []
        for j, facce in enumerate(taglia(g, k, asse, tieni)):
            m = figura(g, facce, gradi, alto)
            p = out / f"{nome}_{j}.glb"; p.write_bytes(trimesh.Scene(m).export(file_type="glb")); files.append(p.name)
            print(f"{p.name:32} {len(m.faces):5} triangoli  {np.round(m.extents, 2).tolist()}")
        indice["tipi"][nome] = {"figure": files, "veicolo": any(v in nome for v in VEICOLI)}
        for b in tipi[nome]["blocchi"]:
            indice["blocchi"][b] = nome
    (out / f"{a.volume}.json").write_text(json.dumps(indice, indent=1), encoding="utf-8")
    print(f"\n{len(indice['tipi'])} tipi, {len(indice['blocchi'])} blocchi -> {out / (a.volume + '.json')}")


if __name__ == "__main__":
    main()
