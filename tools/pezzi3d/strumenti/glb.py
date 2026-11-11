"""
FAB · pezzi 3D — scrittura e lettura dei file .glb dei pezzi
==================================================================

Perché un modulo apposta: le librerie generiche esportano ogni materiale come
un oggetto separato e, per ottenere lo shading piatto, staccano tutti i
triangoli tra loro. Il risultato si vede bene nel gioco ma in Blender appare
come migliaia di triangoli sciolti: "non manifold", pieno di bordi aperti.

Qui ogni pezzo diventa UN solo oggetto glTF:
  - una sola lista di vertici, condivisa da tutti i materiali (le parti
    restano saldate tra loro, il modello è chiuso dove l'originale è chiuso)
  - una "primitive" per materiale, che indica solo quali triangoli usano
    quel materiale
  - nessuna normale salvata: three.js in questo caso usa da solo lo shading
    piatto, e Blender ricalcola le normali all'importazione

I colori dei materiali sono in spazio lineare, come richiede glTF.
"""

import json
import struct

import numpy as np

GLB_MAGIC = 0x46546C67
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942


def _allinea(b, riempi=b"\x00"):
    return b + riempi * ((4 - len(b) % 4) % 4)


def scrivi(percorso, nome, vertici, facce, indice_materiale, materiali):
    """Scrive un .glb con un solo nodo e una sola mesh.

    vertici: (n, 3) float, Y in alto
    facce: (m, 3) int, ordine antiorario visto da fuori
    indice_materiale: (m,) int, il materiale di ogni triangolo
    materiali: lista di dict con chiavi name, base (4 float lineari),
               emissive (3 float lineari), metallic, roughness
    """
    vertici = np.asarray(vertici, dtype=np.float32)
    facce = np.asarray(facce, dtype=np.int64)
    indice_materiale = np.asarray(indice_materiale, dtype=np.int64)
    usati = [j for j in range(len(materiali)) if (indice_materiale == j).any()]

    binario = bytearray()
    viste, accessori, primitive = [], [], []

    def aggiungi_vista(dati, destinazione):
        offset = len(binario)
        binario.extend(_allinea(dati))
        viste.append({"buffer": 0, "byteOffset": offset, "byteLength": len(dati),
                      "target": destinazione})
        return len(viste) - 1

    v_vista = aggiungi_vista(vertici.tobytes(), 34962)
    accessori.append({"bufferView": v_vista, "componentType": 5126, "count": len(vertici),
                      "type": "VEC3", "min": vertici.min(0).tolist(),
                      "max": vertici.max(0).tolist()})
    tipo_indice = 5123 if len(vertici) < 65535 else 5125
    dtype = np.uint16 if tipo_indice == 5123 else np.uint32

    materiali_json = []
    for nuovo, j in enumerate(usati):
        m = materiali[j]
        materiali_json.append({
            "name": m["name"],
            "pbrMetallicRoughness": {"baseColorFactor": [float(x) for x in m["base"]],
                                     "metallicFactor": float(m.get("metallic", 0.0)),
                                     "roughnessFactor": float(m.get("roughness", 0.85))},
            "emissiveFactor": [float(x) for x in m.get("emissive", (0, 0, 0))],
        })
        indici = facce[indice_materiale == j].astype(dtype).ravel()
        i_vista = aggiungi_vista(indici.tobytes(), 34963)
        accessori.append({"bufferView": i_vista, "componentType": tipo_indice,
                          "count": int(len(indici)), "type": "SCALAR"})
        primitive.append({"attributes": {"POSITION": 0}, "indices": len(accessori) - 1,
                          "material": nuovo, "mode": 4})

    documento = {
        "asset": {"version": "2.0", "generator": "FAB · pezzi 3D - officina dei pezzi"},
        "scene": 0, "scenes": [{"nodes": [0]}],
        "nodes": [{"name": nome, "mesh": 0}],
        "meshes": [{"name": nome, "primitives": primitive}],
        "materials": materiali_json,
        "accessors": accessori, "bufferViews": viste,
        "buffers": [{"byteLength": len(binario)}],
    }
    js = _allinea(json.dumps(documento, separators=(",", ":")).encode(), b" ")
    bi = bytes(binario)
    totale = 12 + 8 + len(js) + 8 + len(bi)
    with open(percorso, "wb") as f:
        f.write(struct.pack("<III", GLB_MAGIC, 2, totale))
        f.write(struct.pack("<II", len(js), CHUNK_JSON) + js)
        f.write(struct.pack("<II", len(bi), CHUNK_BIN) + bi)


def leggi(dati):
    """Restituisce (documento JSON, blocco binario) di un .glb."""
    magia, _, _ = struct.unpack_from("<III", dati, 0)
    if magia != GLB_MAGIC:
        raise ValueError("non è un file .glb")
    pos, documento, binario = 12, None, b""
    while pos < len(dati):
        lunghezza, tipo = struct.unpack_from("<II", dati, pos)
        blocco = dati[pos + 8:pos + 8 + lunghezza]
        if tipo == CHUNK_JSON:
            documento = json.loads(blocco.decode())
        elif tipo == CHUNK_BIN:
            binario = blocco
        pos += 8 + lunghezza
    return documento, binario


def riscrivi(documento, binario):
    js = _allinea(json.dumps(documento, separators=(",", ":")).encode(), b" ")
    bi = _allinea(bytes(binario))
    totale = 12 + 8 + len(js) + (8 + len(bi) if bi else 0)
    out = struct.pack("<III", GLB_MAGIC, 2, totale) + struct.pack("<II", len(js), CHUNK_JSON) + js
    if bi:
        out += struct.pack("<II", len(bi), CHUNK_BIN) + bi
    return out


def ricolora(dati, colori):
    """colori: {nome_materiale: (base4 lineare, emissive3 lineare)}.
    Cambia solo i fattori dei materiali con quei nomi; la geometria resta."""
    documento, binario = leggi(dati)
    for m in documento.get("materials", []):
        if m.get("name") in colori:
            base, emissivo = colori[m["name"]]
            m.setdefault("pbrMetallicRoughness", {})["baseColorFactor"] = [float(x) for x in base]
            m["emissiveFactor"] = [float(x) for x in emissivo]
    return riscrivi(documento, binario)


def conta_triangoli(dati):
    documento, _ = leggi(dati)
    totale = 0
    for mesh in documento.get("meshes", []):
        for p in mesh.get("primitives", []):
            if "indices" in p:
                totale += documento["accessors"][p["indices"]]["count"] // 3
            else:
                totale += documento["accessors"][p["attributes"]["POSITION"]]["count"] // 3
    return totale
