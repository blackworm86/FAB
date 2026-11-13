#!/usr/bin/env python3
"""
FAB · pezzi 3D — figura pulita: forma leggera e chiusa, colori netti al posto della texture
==========================================================================================

Dalla figura con texture (quella che il gioco usa oggi) fa una figura nuova:
  1. FORMA   salda i vertici, toglie triangoli doppi o degeneri e briciole staccate, la alleggerisce
             (decimazione che rispetta la sagoma) e chiude i buchi;
  2. COLORE  ogni triangolo prende UN colore, letto dalla texture della figura di partenza (media di
             più punti del triangolo) e ridotto a una tavolozza di pochi colori puliti (k-means in Lab).
             Niente immagine: nessuna sfocatura, nessuna cucitura, nessuna riga, a qualsiasi zoom.
Il gioco disegna la figura con ombreggiatura morbida (troops.ts): i colori restano netti per triangolo.

  python pulisci_figura.py FILE.glb [...] [--triangoli N] [--colori K]

Sovrascrive il file; l'originale resta in modelli/figure_originali/ (se non c'è già).
Budget predefinito: 1300 triangoli per un soldato, 2000 per un veicolo (fino a 1,5 volte dove servono dettagli di colore) (deciso dalla forma: più lungo che alto).
"""

import argparse
import shutil
import sys
from pathlib import Path

import numpy as np
import trimesh
from scipy.cluster.vq import kmeans2
from scipy.spatial import cKDTree

QUI = Path(__file__).resolve().parent
sys.path.insert(0, str(QUI))
from ripara_figura import ORIGINALI, carica  # noqa: E402


def lab(rgb):
    c = np.asarray(rgb, float) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T / [0.9505, 1.0, 1.089]
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.c_[116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])]


def colori_superficie(g, punti, campioni=250000):
    """Colore della texture di g nei punti dati: il colore del campione più vicino di una nuvola fitta sulla superficie di g."""
    img = np.asarray(g.visual.material.baseColorTexture.convert("RGB"), float)
    h, w = img.shape[:2]
    rng = np.random.default_rng(3)
    area = g.area_faces
    tri = rng.choice(len(g.faces), size=campioni, p=area / area.sum())
    r1, r2 = rng.random(campioni), rng.random(campioni); sq = np.sqrt(r1)
    bari = np.c_[1 - sq, sq * (1 - r2), sq * r2]
    pos = np.einsum("nk,nkc->nc", bari, g.vertices[g.faces[tri]])
    uv = np.einsum("nk,nkc->nc", bari, g.visual.uv[g.faces[tri]])
    x = np.clip((np.mod(uv[:, 0], 1) * (w - 1)).round().astype(int), 0, w - 1)
    y = np.clip(((1 - np.mod(uv[:, 1], 1)) * (h - 1)).round().astype(int), 0, h - 1)
    _, i = cKDTree(pos).query(punti)
    return img[y, x][i]


def forma_pulita(g, budget):
    m = trimesh.Trimesh(g.vertices.copy(), g.faces.copy(), process=False)
    m.merge_vertices()                                              # saldata per posizione: le cuciture della texture non contano più
    m.update_faces(m.nondegenerate_faces()); m.update_faces(m.unique_faces()); m.remove_unreferenced_vertices()
    parti = m.split(only_watertight=False)
    if len(parti) > 1:                                              # briciole staccate: via solo le parti minuscole (le ruote di un carro restano)
        tot = sum(p.area for p in parti)
        m = trimesh.util.concatenate([p for p in parti if p.area >= 0.0005 * tot or len(p.faces) >= 12])
        m.merge_vertices()
    if len(m.faces) > budget:
        m = m.simplify_quadric_decimation(face_count=budget)
        m.merge_vertices(); m.update_faces(m.nondegenerate_faces()); m.remove_unreferenced_vertices()
    trimesh.repair.fill_holes(m)
    trimesh.repair.fix_winding(m)
    return m


def chiudi_buchi(m):
    """Chiude i buchi rimasti con un ventaglio dal centro di ciascuno (come ripara_figura.py)."""
    e = m.faces[:, [0, 1, 1, 2, 2, 0]].reshape(-1, 2)
    visti = {(int(a), int(b)) for a, b in e}
    aperti = [(a, b) for a, b in visti if (b, a) not in visti]
    if not aperti:
        return m
    padre = {}
    def trova(x):
        while padre.setdefault(x, x) != x:
            padre[x] = padre[padre[x]]; x = padre[x]
        return x
    for a, b in aperti:
        padre[trova(a)] = trova(b)
    gruppi = {}
    for a, b in aperti:
        gruppi.setdefault(trova(a), set()).update((a, b))
    V, F, centro = list(m.vertices), list(m.faces), {}
    for r, vs in gruppi.items():
        V.append(np.mean([m.vertices[i] for i in vs], axis=0)); centro[r] = len(V) - 1
    for a, b in aperti:
        F.append([b, a, centro[trova(a)]])
    return trimesh.Trimesh(np.array(V), np.array(F), process=False)


def pulisci(percorso, budget=None, k=16):
    g = carica(percorso)
    if getattr(g.visual, "uv", None) is None or getattr(g.visual.material, "baseColorTexture", None) is None:
        print(f"{Path(percorso).name}: niente texture, salto"); return None
    e = g.extents; veicolo = max(e[0], e[2]) > 1.6 * e[1]
    budget = budget or (2000 if veicolo else 1300)
    prima = len(g.faces)
    m = chiudi_buchi(forma_pulita(g, budget))
    pesi = np.array([[1, 1, 1], [4, 1, 1], [1, 4, 1], [1, 1, 4], [2, 2, 1], [2, 1, 2], [1, 2, 2]], float)
    pesi /= pesi.sum(1, keepdims=True)
    campiona = lambda mm: colori_superficie(g, np.einsum("sk,nkc->nsc", pesi, mm.triangles).reshape(-1, 3)).reshape(len(mm.faces), len(pesi), 3)
    # dettagli di colore (mimetica, stelle, fasce): un triangolo i cui punti hanno colori diversi si divide in 4, finché c'è budget
    for _ in range(3):
        c = campiona(m); L = lab(c.reshape(-1, 3)).reshape(len(m.faces), len(pesi), 3)
        spread = np.linalg.norm(L - np.median(L, axis=1, keepdims=True), axis=2).max(1)
        posto = int((budget * 1.5 - len(m.faces)) / 3)
        da = np.argsort(-spread)[: max(0, posto)]; da = da[spread[da] > 18]
        if not len(da):
            break
        v, f = trimesh.remesh.subdivide(m.vertices, m.faces, face_index=da)
        m = trimesh.Trimesh(v, f, process=False)
    T = m.triangles
    c = campiona(m)
    L = lab(c.reshape(-1, 3)).reshape(len(T), len(pesi), 3)
    med = np.median(L, axis=1)                                      # mediana: un dettaglio di pochi pixel non sporca il triangolo
    area = m.area_faces
    k = min(k, len(T))
    rng = np.random.default_rng(1)
    camp = rng.choice(len(T), size=min(len(T), 4000), p=area / area.sum())
    cen, _ = kmeans2(med[camp], k, minit="++", seed=1, iter=30)
    lab_fac = np.argmin(((med[:, None, :] - cen[None]) ** 2).sum(2), axis=1)
    rgb_cen = np.array([np.median(c[lab_fac == j].reshape(-1, 3), axis=0) if (lab_fac == j).any() else [128, 128, 128] for j in range(len(cen))])
    # un triangolo isolato di un colore diverso da tutti i vicini prende il colore della maggioranza dei vicini (macchie)
    adj = m.face_adjacency
    vic = [[] for _ in range(len(T))]
    for a, b in adj:
        vic[a].append(b); vic[b].append(a)
    for _ in range(2):
        nuovo = lab_fac.copy()
        for i, v in enumerate(vic):
            if len(v) >= 2 and all(lab_fac[j] != lab_fac[i] for j in v):
                nuovo[i] = np.bincount(lab_fac[v]).argmax()
        lab_fac = nuovo
    lin = np.where(rgb_cen / 255 > 0.04045, ((rgb_cen / 255 + 0.055) / 1.055) ** 2.4, rgb_cen / 12.92 / 255)     # glTF vuole i colori dei vertici in spazio lineare
    colore = np.c_[np.round(lin[lab_fac] * 255), np.full(len(T), 255)].astype(np.uint8)
    # un vertice per (punto, colore): il colore resta netto tra triangoli di colori diversi, ma i triangoli dello stesso colore
    # condividono i vertici (file molto più leggero di un vertice per triangolo)
    chiave = np.c_[m.faces.reshape(-1), np.repeat(lab_fac, 3)]
    uniche, inv = np.unique(chiave, axis=0, return_inverse=True)
    out = trimesh.Trimesh(m.vertices[uniche[:, 0]], inv.reshape(-1, 3), process=False)
    out.visual = trimesh.visual.ColorVisuals(out, vertex_colors=colore[np.repeat(np.arange(len(T)), 3)][np.unique(inv.reshape(-1), return_index=True)[1]])
    mat = trimesh.visual.material.PBRMaterial(name="figura", baseColorFactor=[255, 255, 255, 255], metallicFactor=0.0, roughnessFactor=0.85)
    ORIGINALI.mkdir(parents=True, exist_ok=True)
    if not (ORIGINALI / Path(percorso).name).exists():
        shutil.copy2(percorso, ORIGINALI / Path(percorso).name)
    scena = trimesh.Scene(); scena.add_geometry(out, node_name="figura", geom_name="figura")
    import glb
    doc, binario = glb.leggi(scena.export(file_type="glb"))
    doc["materials"] = [{"name": "figura", "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0.0, "roughnessFactor": 0.85}}]   # senza, glTF vale "metallo": figura scura
    for mesh in doc["meshes"]:
        for pr in mesh["primitives"]:
            pr["material"] = 0
    dati = glb.riscrivi(doc, binario)
    Path(percorso).write_bytes(dati)
    return prima, len(m.faces), len(rgb_cen), len(dati) // 1024


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--triangoli", type=int)
    ap.add_argument("--colori", type=int, default=16)
    a = ap.parse_args()
    for f in a.files:
        r = pulisci(f, a.triangoli, a.colori)
        if r:
            print(f"{Path(f).name}: {r[0]} -> {r[1]} triangoli, {r[2]} colori, {r[3]} kB")


if __name__ == "__main__":
    main()
