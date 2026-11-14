#!/usr/bin/env python3
"""
FAB · pezzi 3D — dai modelli finiti alle figure singole per il gioco
===================================================================

Il gioco mostra UNA figura per unità (soldato, carro...). Se Meshy ha fatto un gruppo
(tre soldati, due carri) uniti in un pezzo, il gruppo va diviso. La divisione di ogni
tipo sta in modelli/divisioni/<tipo>.json: per ogni triangolo del modello, a quale
figura appartiene (0, 1, 2...) oppure -1 = scartato (briciole, pezzi del vicino).
Si fa e si corregge a mano nel pannello (Pezzi > Dividi in figure); senza file,
lo script propone una divisione automatica.

  python separa_figure.py --volume bulge              scrive le figure del volume
  python separa_figure.py --proposta bulge_us_inf -k 3  stampa la proposta automatica (JSON)

Scrive web/public/pezzi/<tipo>_<n>.glb e <volume>.json nel repository
(fuori dal repository: modelli/figure/ del kit, da mandare a chi aggiorna il gioco).
"""

import argparse
import json
from pathlib import Path

import numpy as np
import trimesh
from scipy.cluster.vq import kmeans2

import ripara_figura

QUI = Path(__file__).resolve().parent
KIT = QUI.parent
DIVISIONI = KIT / "modelli" / "divisioni"
M = 0.18   # unità di tabellone (cm) per metro
TEXTURE = 1024   # lato massimo della texture nel gioco (Meshy dà 2048)
# proposta automatica dei gruppi di The Bulge: (figure nel file, asse su cui stanno affiancate 0=X 1=Z, gradi per guardare +Z, altezza reale in m, "tutte" | "la_piu_grande")
TIPI = {
    # The Bulge, rifatto il 13/11/2026: una figura per file come Golan e Sicilia (l'orientamento si corregge nella scheda Orientamento)
    "bulge_british_armor": (1, 0, 0, 2.97, "tutte"), "bulge_british_inf": (1, 0, 0, 1.8, "tutte"),
    "bulge_german_airborne": (1, 0, 0, 1.8, "tutte"), "bulge_german_armor": (1, 0, 0, 2.99, "tutte"),
    "bulge_german_inf": (1, 0, 0, 1.8, "tutte"), "bulge_german_mech": (1, 0, 0, 2.3, "tutte"),
    "bulge_german_mountain": (1, 0, 0, 1.8, "tutte"), "bulge_us_airborne": (1, 0, 0, 1.8, "tutte"),
    "bulge_us_armor": (1, 0, 0, 2.97, "tutte"), "bulge_us_cavalry": (1, 0, 0, 2.3, "tutte"),
    "bulge_us_inf": (1, 0, 0, 1.8, "tutte"),
    # Golan '73: una figura per file; i veicoli arrivano col muso verso -X (90 gradi li girano verso +Z); altezze reali
    "golan73_israeli_inf": (1, 0, 0, 1.8, "tutte"), "golan73_israeli_airborne": (1, 0, 0, 1.8, "tutte"),
    "golan73_israeli_armor": (1, 0, 90, 3.0, "tutte"), "golan73_israeli_mech": (1, 0, 90, 2.26, "tutte"),    # Centurion, M3 semicingolato
    "golan73_israeli_ghost": (1, 0, 90, 3.0, "tutte"),                                                        # Centurion finto
    "golan73_syrian_inf": (1, 0, 0, 1.8, "tutte"), "golan73_syrian_airborne": (1, 0, 0, 1.8, "tutte"),
    "golan73_syrian_armor": (1, 0, 90, 2.35, "tutte"), "golan73_syrian_mech": (1, 0, 90, 2.07, "tutte"),     # T-55, BMP-1
    "golan73_syrian_recon": (1, 0, 90, 2.3, "tutte"),                                                         # BRDM-2
    # Sicily '43: come Golan, una figura per file e veicoli col muso verso -X
    "sicily_us_inf": (1, 0, 0, 1.8, "tutte"), "sicily_us_airborne": (1, 0, 0, 1.8, "tutte"), "sicily_us_armor": (1, 0, 90, 2.97, "tutte"),
    "sicily_british_inf": (1, 0, 0, 1.8, "tutte"), "sicily_british_airborne": (1, 0, 0, 1.8, "tutte"), "sicily_british_armor": (1, 0, 90, 2.97, "tutte"),
    "sicily_german_mech": (1, 0, 90, 2.68, "tutte"),                                                         # Panzer IV
    "sicily_italian_inf": (1, 0, 0, 1.8, "tutte"), "sicily_italian_mountain_inf": (1, 0, 0, 1.8, "tutte"), "sicily_italian_garrison": (1, 0, 0, 1.8, "tutte"),
    "sicily_italian_motorized_inf": (1, 0, 90, 2.5, "tutte"),                                                # autocarro
}
# lunghezza reale dello scafo in metri: il gioco misura così i veicoli (Meshy li fa tozzi e alti, la sola altezza li rimpicciolisce)
LUNGHEZZA = {
    "bulge_british_armor": 5.9, "bulge_german_armor": 6.87, "bulge_german_mech": 5.98, "bulge_us_armor": 5.9, "bulge_us_cavalry": 5.0,     # Firefly, Panther, Sd.Kfz.251, Sherman, M8 Greyhound
    "golan73_israeli_armor": 7.8, "golan73_israeli_ghost": 7.8, "golan73_israeli_mech": 6.2,                                             # Centurion, finto Centurion, M3
    "golan73_syrian_armor": 6.45, "golan73_syrian_mech": 6.74, "golan73_syrian_recon": 5.75,                                              # T-55, BMP-1, BRDM-2
    "sicily_british_armor": 5.9, "sicily_us_armor": 5.9, "sicily_german_mech": 5.92, "sicily_italian_motorized_inf": 6.2,                # Sherman, Sherman, Panzer IV, Fiat 626
}
VEICOLI = ("armor", "cavalry", "mech", "recon", "motorized", "ghost")
veicolo = lambda tipo: any(v in tipo for v in VEICOLI)


def sorgente(tipo):
    """Il modello da cui nasce la figura: il più recente tra modelli/ai_grezzi/<tipo>.glb (scaricato da Meshy o TRELLIS, così com'è)
    e modelli/definitivi/<tipo>.glb (pulito dal pannello). None se non c'è nessuno dei due."""
    c = [p for p in (KIT / "modelli" / "ai_grezzi" / f"{tipo}.glb", KIT / "modelli" / "definitivi" / f"{tipo}.glb") if p.exists()]
    return max(c, key=lambda p: p.stat().st_mtime) if c else None


def modello(tipo):
    """La mesh della figura, triangoli nello stesso ordine del file (come la vede il pannello): la parte "figura" o, in un file di Meshy, la mesh unica."""
    s = trimesh.load(sorgente(tipo), force="scene", process=False)
    if "figura" in s.geometry:
        return s.geometry["figura"]
    g = max(s.geometry.values(), key=lambda x: len(x.faces))
    for nodo in s.graph.nodes_geometry:                             # la posa del nodo (Meshy a volte la usa)
        t, nome = s.graph[nodo]
        if s.geometry[nome] is g:
            g = g.copy(); g.apply_transform(t); break
    return g


def componenti(m, facce=None):
    w = trimesh.Trimesh(m.vertices, m.faces if facce is None else m.faces[facce], process=False)
    w.merge_vertices(merge_tex=True, merge_norm=True)   # le cuciture della texture non separano le parti
    return trimesh.graph.connected_component_labels(w.face_adjacency, node_count=len(w.faces)), w.triangles_center


def proposta(g, k, asse=0, tieni="tutte"):
    """Etichetta per triangolo: la figura (0..k-1) o -1 (scartato)."""
    c = g.triangles_center[:, [0, 2]]
    lab = np.zeros(len(g.faces), int)
    if tieni == "la_piu_grande":   # veicolo e fanti minuscoli: taglio nel vuoto più largo, tengo il lato più pieno
        z = np.sort(c[:, asse]); i = np.argmax(np.diff(z)); soglia = (z[i] + z[i + 1]) / 2
        lato = c[:, asse] < soglia
        lab[:] = np.where(lato if lato.sum() > len(c) / 2 else ~lato, 0, -1)
    elif k > 1:
        init = np.c_[np.linspace(c[:, 0].min(), c[:, 0].max(), k + 2)[1:-1], np.linspace(c[:, 1].min(), c[:, 1].max(), k + 2)[1:-1]]
        init[:, 1 - asse] = c[:, 1 - asse].mean()
        _, lab = kmeans2(c, init, minit="matrix", seed=1)
        comp, _ = componenti(g)   # una parte intera (fucile, torretta) va a una sola figura; solo i corpi fusi restano tagliati
        for cc in np.unique(comp):
            f = np.where(comp == cc)[0]; voti = np.bincount(lab[f], minlength=k)
            if voti.max() >= 0.85 * len(f) or len(f) < 0.25 * len(lab) / k:
                lab[f] = voti.argmax()
        ordine = np.argsort([c[lab == j, asse].mean() for j in range(k)])   # figure numerate lungo l'asse
        lab = np.argsort(ordine)[lab]
    for j in range(k if k > 1 else 0):   # briciole (solo nei gruppi: in una figura sola una parte staccata è vera, es. la canna di una mitragliatrice): parti minuscole di una figura che stanno fuori dal resto (la punta del fucile del vicino)
        f = np.where(lab == j)[0]
        if not len(f):
            continue
        cl, tc = componenti(g, f); piccole = np.bincount(cl) < 0.015 * len(f)
        if piccole.all():
            continue
        lo, hi = tc[~piccole[cl]].min(0), tc[~piccole[cl]].max(0); pad = 0.03 * (hi - lo)
        for l in np.where(piccole)[0]:
            ct = tc[cl == l].mean(0)
            if not np.all((ct >= lo - pad) & (ct <= hi + pad)):
                lab[f[cl == l]] = -1
    return lab


def divisione(tipo):
    """La divisione salvata dal pannello, o la proposta automatica."""
    p = DIVISIONI / f"{tipo}.json"
    if p.exists():
        d = json.loads(p.read_text(encoding="utf-8"))
        return d["k"], d["gradi"], d["altezza"], np.array(d["etichette"])
    k, asse, gradi, alto, tieni = TIPI.get(tipo, (1, 0, 0, 2.5 if veicolo(tipo) else 1.8, "tutte"))
    return k, gradi, alto, proposta(modello(tipo), k, asse, tieni)


def figura(g, facce, gradi, alto):
    m = g.submesh([facce], append=True)
    m.apply_transform(trimesh.transformations.rotation_matrix(np.radians(gradi), [0, 1, 0]))
    lo, hi = m.bounds
    m.apply_translation([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
    m.apply_scale(alto * M / (hi[1] - lo[1]))
    m.visual.material.name = "figura"
    img = m.visual.material.baseColorTexture
    if img is not None and max(img.size) > TEXTURE:
        m.visual.material.baseColorTexture = img.resize((TEXTURE, TEXTURE))
    return m


def uscita_predefinita():
    web = KIT.parents[1] / "web" / "public"
    return web / "pezzi" if web.is_dir() else KIT / "modelli" / "figure"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--volume", default="bulge")
    ap.add_argument("--uscita", default=None)
    ap.add_argument("--proposta", metavar="TIPO", help="stampa la proposta automatica per questo tipo e esce")
    ap.add_argument("-k", type=int, default=None, help="con --proposta: quante figure ci sono nel modello")
    a = ap.parse_args()
    if a.proposta:
        k0, asse, gradi, alto, tieni = TIPI.get(a.proposta, (1, 0, 0, 2.5 if veicolo(a.proposta) else 1.8, "tutte"))
        k = a.k or k0
        lab = proposta(modello(a.proposta), k, asse if k == k0 else 0, tieni if k == k0 else "tutte")
        print(json.dumps({"k": k, "gradi": gradi, "altezza": alto, "etichette": lab.tolist()}))
        return
    out = Path(a.uscita) if a.uscita else uscita_predefinita(); out.mkdir(parents=True, exist_ok=True)
    tipi = {t["id"]: t for t in json.loads((KIT / "catalogo.json").read_text(encoding="utf-8"))["tipi"]}
    indice = {"tipi": {}, "blocchi": {}}
    for tipo in tipi:
        if not tipo.startswith(a.volume + "_") or sorgente(tipo) is None:
            continue
        esistenti = sorted(out.glob(f"{tipo}_*.glb"))
        if sorgente(tipo).parent.name == "definitivi" and esistenti:      # niente modello nuovo da Meshy: le figure già nel gioco restano
            indice["tipi"][tipo] = {"figure": [f.name for f in esistenti], "veicolo": veicolo(tipo), **({"lunghezza": LUNGHEZZA[tipo]} if tipo in LUNGHEZZA else {})}
            for b in tipi[tipo]["blocchi"]:
                indice["blocchi"][b] = tipo
            print(f"{tipo}: nessun modello nuovo in ai_grezzi, tengo le figure attuali"); continue
        g = modello(tipo)
        k, gradi, alto, lab = divisione(tipo)
        if len(lab) != len(g.faces):                                # modello nuovo: la divisione salvata era del vecchio
            print(f"{tipo}: la divisione salvata era di un altro modello, uso la proposta automatica")
            k0, asse, gradi, alto, tieni = TIPI.get(tipo, (1, 0, 0, 2.5 if veicolo(tipo) else 1.8, "tutte")); k = k0
            lab = proposta(g, k, asse, tieni)
        prima = out / f"{tipo}_0.glb"
        if prima.exists() and sorgente(tipo).stat().st_mtime > prima.stat().st_mtime:   # modello nuovo: le scelte di Orientamento erano per il vecchio
            cfg = out / f"{a.volume}_config.json"
            if cfg.exists():
                c = json.loads(cfg.read_text(encoding="utf-8"))
                if c.pop(tipo, None) is not None:
                    cfg.write_text(json.dumps(c, indent=1), encoding="utf-8"); print(f"{tipo}: modello nuovo, orientamento da rifare nella scheda Orientamento")
        for vecchio in out.glob(f"{tipo}_*.glb"):
            vecchio.unlink()
        files = []
        for j in range(k):
            facce = np.where(lab == j)[0]
            if not len(facce):
                continue
            m = figura(g, facce, gradi, alto)
            p = out / f"{tipo}_{len(files)}.glb"; p.write_bytes(trimesh.Scene(m).export(file_type="glb")); files.append(p.name)
            ripara_figura.ripara(p, lato=min(TEXTURE, max(m.visual.material.baseColorTexture.size)) if getattr(m.visual.material, "baseColorTexture", None) else TEXTURE)   # buchi chiusi, texture senza righe scure
            print(f"{p.name:32} {len(m.faces):5} triangoli  {np.round(m.extents, 2).tolist()}")
        indice["tipi"][tipo] = {"figure": files, "veicolo": veicolo(tipo), **({"lunghezza": LUNGHEZZA[tipo]} if tipo in LUNGHEZZA else {})}
        for b in tipi[tipo]["blocchi"]:
            indice["blocchi"][b] = tipo
    (out / f"{a.volume}.json").write_text(json.dumps(indice, indent=1), encoding="utf-8")
    print(f"\n{len(indice['tipi'])} tipi, {len(indice['blocchi'])} blocchi -> {out}")


if __name__ == "__main__":
    main()
