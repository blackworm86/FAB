#!/usr/bin/env python3
"""
FAB · pezzi 3D — materiali, base, budget e raccolta dei modelli finiti
=====================================================================

Non disegna pezzi: i modelli arrivano da TRELLIS/Meshy e passano da
pulisci_modello_ai.py. Questo script li raccoglie.

  modelli/definitivi/<id>.glb   i pezzi puliti (uno per tipo del catalogo)
  modelli/master/<id>.glb       quello che va nel gioco (copia del definitivo)
  modelli/colorati/<id>.glb     stesso pezzo, con la base nel legno della sua fazione
  modelli/report.txt            quali tipi sono pronti e quanti triangoli hanno
  visualizzatore.html           banco prova di tutti i pezzi pronti

CONVENZIONI (le stesse di docs/ASSETS-3D.md)
  - 1 unità = 1 unità di tabellone; il blocco di legno è 1,6 x 1,6 x 0,8
  - asse Y verso l'alto, la figura guarda verso +Z, origine al centro, a terra
  - un pezzo sta dentro l'impronta del blocco in piedi: 1,5 (X) x 0,7 (Z)
  - materiali: colore_fazione = la base (il gioco la ricolora col legno della fazione),
    fisso_1, fisso_2... = colori fissi del pezzo (uniformi, mezzi, ecc.)
"""

import json
from pathlib import Path

import numpy as np
import trimesh
import glb

QUI = Path(__file__).resolve().parent
RADICE = QUI.parent / "modelli"
IMPRONTA = (1.5, 0.7)        # larghezza (X) e profondità (Z) massime di un pezzo
SPESSORE_BASE = 0.06
FAZIONE_NEUTRA = "#FFFFFF"   # il colore_fazione nel master: la ricolorazione lo cambia


def catalogo():
    return json.loads((QUI.parent / "catalogo.json").read_text(encoding="utf-8"))["tipi"]


def hex_rgba(h, a=1.0):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [a]


def lineare(rgba):
    """glTF vuole i colori in spazio lineare: senza questa conversione i
    colori escono più chiari e sbiaditi nel gioco."""
    c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgba[:3]]
    return c + list(rgba[3:])


def materiale(nome, colore, emissivo=None, metallo=0.0, ruvidita=0.85):
    """Materiale glTF a tinta unita, con i colori già in spazio lineare."""
    return {"name": nome, "base": lineare(hex_rgba(colore)),
            "emissive": lineare(hex_rgba(emissivo))[:3] if emissivo else [0.0, 0.0, 0.0],
            "metallic": metallo, "roughness": ruvidita}


Z_A_Y = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])


class Pezzo:
    """Raccoglie le parti di un pezzo con il loro materiale e le scrive come
    un unico oggetto con vertici condivisi (vedi glb.py)."""

    def __init__(self, nome):
        self.nome = nome
        self.meshes, self.indici, self.materiali, self.gruppi = [], [], [], []

    def indice_materiale(self, mat):
        for i, m in enumerate(self.materiali):
            if m["name"] == mat["name"]:
                return i
        self.materiali.append(mat)
        return len(self.materiali) - 1

    def aggiungi(self, mesh, mat, gia_y_su=False, gruppo=None):
        """Le parti con lo stesso gruppo vengono saldate tra loro; parti
        diverse restano solidi separati anche se si toccano, così ognuna
        rimane chiusa."""
        m = trimesh.Trimesh(mesh.vertices.copy(), mesh.faces.copy(), process=False)
        if not gia_y_su:
            m.apply_transform(Z_A_Y)
        self.meshes.append(m)
        self.indici.append(np.full(len(m.faces), self.indice_materiale(mat)))
        self.gruppi.append(gruppo if gruppo is not None else f"parte_{len(self.meshes)}")

    @property
    def triangoli(self):
        return int(sum(len(m.faces) for m in self.meshes))

    def unito(self):
        blocchi, indici = [], []
        for g in dict.fromkeys(self.gruppi):
            sel = [i for i, x in enumerate(self.gruppi) if x == g]
            m = trimesh.util.concatenate([self.meshes[i] for i in sel])
            m.merge_vertices()          # le facce restano nello stesso ordine
            blocchi.append(m)
            indici.append(np.concatenate([self.indici[i] for i in sel]))
        tutto = trimesh.util.concatenate(blocchi)
        return tutto, np.concatenate(indici)

    def esporta(self, percorso):
        tutto, indici = self.unito()
        glb.scrivi(percorso, self.nome, tutto.vertices, tutto.faces, indici, self.materiali)


def base_blocco(nome):
    """Il pezzo con solo la base (una lastra nell'impronta del blocco); ci si aggiunge la figura."""
    p = Pezzo(nome)
    lastra = trimesh.creation.box(extents=[IMPRONTA[0], SPESSORE_BASE, IMPRONTA[1]])
    lastra.apply_translation([0, SPESSORE_BASE / 2, 0])
    p.aggiungi(lastra, materiale("colore_fazione", FAZIONE_NEUTRA, ruvidita=0.7), gia_y_su=True, gruppo="base")
    return p


def budget_di(nome):
    return next((t["triangoli"] for t in catalogo() if t["id"] == nome), 800)


def ricolora(percorso, legno):
    """Copia di un .glb finito con la base nel colore del legno di una fazione."""
    m = materiale("colore_fazione", legno, ruvidita=0.7)
    return glb.ricolora(Path(percorso).read_bytes(), {"colore_fazione": (m["base"], m["emissive"])})


def main():
    for cartella in ("definitivi", "master", "colorati", "ai_grezzi"):
        (RADICE / cartella).mkdir(parents=True, exist_ok=True)
    righe = ["tipo                           blocchi  stato       triangoli  budget"]
    for t in catalogo():
        definitivo = RADICE / "definitivi" / f"{t['id']}.glb"
        if not definitivo.exists():
            for c in ("master", "colorati"):
                (RADICE / c / f"{t['id']}.glb").unlink(missing_ok=True)
            righe.append(f"{t['id']:<30} {len(t['blocchi']):>7}  da fare")
            continue
        dati = definitivo.read_bytes()
        (RADICE / "master" / definitivo.name).write_bytes(dati)
        (RADICE / "colorati" / definitivo.name).write_bytes(ricolora(definitivo, t["legno"]))
        tri = glb.conta_triangoli(dati)
        righe.append(f"{t['id']:<30} {len(t['blocchi']):>7}  {'pronto' if tri <= t['triangoli'] else 'TROPPI':<10} {tri:>9}  {t['triangoli']:>6}")
    (RADICE / "report.txt").write_text("\n".join(righe) + "\n", encoding="utf-8")
    print("\n".join(righe))
    aggiorna_visualizzatore()


def aggiorna_visualizzatore():
    """Incorpora i .glb master (col legno della fazione) nel visualizzatore: si apre con un doppio clic."""
    import base64
    modello = QUI / "visualizzatore_template.html"
    dati = {f.stem: base64.b64encode(f.read_bytes()).decode() for f in sorted((RADICE / "colorati").glob("*.glb"))}
    info = {t["id"]: {"nome": f"{t['nome']} · {t['volume']}", "budget": t["triangoli"], "blocchi": len(t["blocchi"])} for t in catalogo()}
    html = modello.read_text(encoding="utf-8").replace("__MODELLI__", json.dumps(dati)).replace("__INFO__", json.dumps(info))
    (QUI.parent / "visualizzatore.html").write_text(html, encoding="utf-8")
    print(f"Visualizzatore aggiornato: {len(dati)} pezzi")


if __name__ == "__main__":
    main()
