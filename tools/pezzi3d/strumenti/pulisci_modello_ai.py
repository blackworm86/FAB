#!/usr/bin/env python3
"""
FAB · pezzi 3D — pulizia dei modelli 3D generati da AI
============================================================

Trasforma il .glb di un generatore (Meshy, TRELLIS, Tripo...) in un pezzo
conforme alle regole del kit, cercando di NON rovinare quello che il
generatore ha fatto bene.

COME LAVORA
  1. legge la forma e, a parte, una "nuvola" fitta di campioni di colore
     presi dalla texture (o dai colori dei vertici): la texture contiene i
     dettagli dipinti che la forma non ha (occhiali, perle, bottoni)
  2. ruota, scala e appoggia il modello a terra; con --base lo mette sulla
     base ottagonale standard
  3. ripara la forma: salda i vertici, chiude i piccoli buchi, toglie solo
     la "polvere" (frammenti sotto lo 0,1% della superficie)
  4. FORMA: se il modello rientra già nel budget (es. Meshy Smart Topology)
     la forma resta quella originale; se è troppo pesante (es. TRELLIS)
     viene ridotta in due tappe
  5. COLORI: i colori piatti vengono dal concept 2D (--palette-da) oppure
     dalla texture; ogni campione prende il colore più vicino
  6. DETTAGLI: dove un triangolo copre più colori, viene diviso (in modo
     "conforme": anche i vicini vengono divisi quanto basta, così non si
     aprono buchi) finché il budget lo permette; ogni triangolo prende poi il
     colore che copre la maggior parte della sua superficie
  7. assegna i materiali speciali (colore_fazione: la parte che il gioco tinge col legno della fazione) e
     scrive un unico oggetto con vertici condivisi: il modello resta chiuso
     ("manifold") dove l'originale era chiuso

USO
  pip install trimesh numpy scipy pillow fast_simplification
  python pulisci_modello_ai.py INGRESSO.glb bulge_us_armor --base --senza-giocatore --altezza 0.55 --palette-da concept.png

OPZIONI PRINCIPALI
  --triangoli N    budget totale (default: quello del tipo in catalogo.json, 800)
  --base           aggiunge la base ottagonale standard
  --altezza H      altezza della figura in unità di gioco (default 1.0)
  --tinta "#hex"   colore che diventerà il colore del giocatore
  --neon "#hex"    colore che diventerà il neon del giocatore
  --senza-giocatore nessun colore diventa colore del giocatore (props fissi)
  --colori K       quanti colori piatti tenere (default 6)
  --palette-da IMG prende i colori dal concept 2D (consigliato)
  --dettaglio D    quanto dividere i triangoli a cavallo di più colori:
                   0 = mai, 1 = poco, 2 = normale (default), 3 = molto
  --ruota GRADI    rotazione attorno all'asse verticale
  --asse-z-su      se il modello arriva con Z in alto
  -o PERCORSO      file di uscita
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import trimesh
from scipy.spatial import cKDTree

QUI = Path(__file__).resolve().parent
sys.path.insert(0, str(QUI))
import genera_pezzi as gp  # noqa: E402  (base, materiali e palette condivisi)
import glb  # noqa: E402

QUOTA_BASE = gp.SPESSORE_BASE   # altezza della base, se c'è
CAMPIONI_TOTALI = 150000


# ---------------------------------------------------------------------------
# Colori: spazio Lab (vicino alla percezione umana)
# ---------------------------------------------------------------------------
# In RGB un beige pelle e un rosa neon possono sembrare "vicini"; in Lab no.
# La luminosità L conta la metà: le texture dei generatori hanno ombre e luci
# "dipinte" sopra, che non devono creare colori diversi.

PESO_L = 0.5


def rgb_a_lab(rgb):
    c = np.asarray(rgb, dtype=float) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def pesato(lab):
    return lab * np.array([PESO_L, 1.0, 1.0])


def distanza_lab(a, b):
    return np.sqrt(((pesato(a) - pesato(b)) ** 2).sum(-1))


def hex_a_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)


def rgb_a_hex(c):
    return "#" + "".join(f"{int(round(v)):02X}" for v in np.clip(c, 0, 255))


def kmeans(dati, pesi, k, giri=40, seme=0):
    """k-means pesato (k-means++), su dati già in spazio Lab pesato."""
    rng = np.random.default_rng(seme)
    k = max(1, min(k, len(np.unique(dati.round(1), axis=0))))
    p0 = pesi / pesi.sum()
    centri = [dati[rng.choice(len(dati), p=p0)]]
    for _ in range(1, k):
        d = np.min(((dati[:, None] - np.array(centri)[None]) ** 2).sum(-1), axis=1)
        p = d * pesi
        centri.append(dati[rng.choice(len(dati), p=p / p.sum())] if p.sum() > 0
                      else dati[rng.integers(len(dati))])
    centri = np.array(centri, dtype=float)
    for _ in range(giri):
        etichette = np.argmin(((dati[:, None] - centri[None]) ** 2).sum(-1), axis=1)
        for j in range(k):
            sel = etichette == j
            if sel.any():
                centri[j] = np.average(dati[sel], axis=0, weights=pesi[sel])
    return centri, etichette


def palette_da_immagine(percorso, k, soglia=30):
    """Ricava i colori piatti dal concept 2D: è la fonte più pulita, senza le
    ombre e le sbavature che il generatore 3D cuoce nella texture."""
    from PIL import Image
    img = Image.open(percorso).convert("RGBA")
    img.thumbnail((320, 320))
    a = np.asarray(img, dtype=float)
    rgb, alfa = a[..., :3], a[..., 3]
    if (alfa < 250).mean() > 0.05:
        maschera = alfa > 128
    else:
        bordo = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
        maschera = np.sqrt(((rgb - np.median(bordo, axis=0)) ** 2).sum(-1)) > soglia
    # toglie i pixel di bordo, mezzi figura e mezzi sfondo
    from scipy.ndimage import binary_erosion
    maschera = binary_erosion(maschera, iterations=2)
    pix = rgb[maschera]
    if len(pix) < 50:
        raise RuntimeError("non trovo la figura nel concept (sfondo non uniforme?)")
    lab = pesato(rgb_a_lab(pix))
    centri, et = kmeans(lab, np.ones(len(lab)), k + 1)
    colori, quote = [], []
    for j in range(len(centri)):
        sel = et == j
        if sel.mean() < 0.004:          # meno dello 0,4% della figura: rumore
            continue
        colori.append(np.median(pix[sel], axis=0))
        quote.append(sel.mean())
    return unisci_simili(np.array(colori), np.array(quote))


def unisci_simili(colori, quote, soglia=18):
    """Unisce i colori quasi uguali (ombre e luci dello stesso materiale):
    resta il più esteso, e prende anche la quota dell'altro."""
    ordine = np.argsort(quote)[::-1]
    tenuti, somma = [], {}
    for i in ordine:
        # qui la luminosità conta per intero: grigio e nero restano distinti
        vicino = [j for j in tenuti
                  if np.linalg.norm(rgb_a_lab(colori[i]) - rgb_a_lab(colori[j])) <= soglia]
        if vicino:
            somma[vicino[0]] += quote[i]
        else:
            tenuti.append(i)
            somma[i] = quote[i]
    return np.array([colori[i] for i in tenuti]), np.array([somma[i] for i in tenuti])


# ---------------------------------------------------------------------------
# Lettura: forma + nuvola di campioni di colore
# ---------------------------------------------------------------------------

def _materiale_pbr(vis):
    mat = getattr(vis, "material", None)
    if mat is None:
        return None
    if isinstance(mat, trimesh.visual.material.SimpleMaterial):
        mat = mat.to_pbr()
    return mat


def campiona_geometria(g, quanti, rng):
    """Punti a caso sulla superficie di g, con il colore letto nel punto
    esatto (texture interpolata tramite le UV, o colori dei vertici)."""
    area = g.area_faces
    if area.sum() <= 0:
        return np.zeros((0, 3)), np.zeros((0, 3)), np.zeros(0)
    n_per_faccia = np.maximum(1, np.round(area / area.sum() * quanti)).astype(int)
    n_per_faccia = np.minimum(n_per_faccia, 600)
    facce = np.repeat(np.arange(len(g.faces)), n_per_faccia)
    r1, r2 = rng.random(len(facce)), rng.random(len(facce))
    s = np.sqrt(r1)
    bari = np.c_[1 - s, s * (1 - r2), s * r2]                  # uniformi nel triangolo
    tri = g.vertices[g.faces[facce]]
    punti = np.einsum("nk,nkc->nc", bari, tri)
    pesi = area[facce] / n_per_faccia[facce]

    vis = g.visual
    colori = np.full((len(facce), 3), 200.0)
    if isinstance(vis, trimesh.visual.ColorVisuals):
        if vis.kind == "face":
            colori = vis.face_colors[facce, :3].astype(float)
        elif vis.kind == "vertex":
            colori = np.einsum("nk,nkc->nc", bari, vis.vertex_colors[g.faces[facce], :3].astype(float))
    else:
        mat = _materiale_pbr(vis)
        if mat is not None:
            fattore = np.array(mat.baseColorFactor if mat.baseColorFactor is not None
                               else [255, 255, 255, 255], dtype=float)[:3]
            fattore = fattore * 255 if fattore.max() <= 1.0 else fattore
            immagine = getattr(mat, "baseColorTexture", None)
            uv = getattr(vis, "uv", None)
            if immagine is not None and uv is not None and len(uv) == len(g.vertices):
                img = np.asarray(immagine.convert("RGB"), dtype=float)
                h, w = img.shape[:2]
                uvp = np.einsum("nk,nkc->nc", bari, uv[g.faces[facce]])
                x = np.clip((np.mod(uvp[:, 0], 1.0) * (w - 1)).round().astype(int), 0, w - 1)
                y = np.clip(((1 - np.mod(uvp[:, 1], 1.0)) * (h - 1)).round().astype(int), 0, h - 1)
                colori = img[y, x] * (fattore / 255.0)
            else:
                colori = np.tile(fattore, (len(facce), 1))
    return punti, colori, pesi


def leggi_modello(percorso):
    """Restituisce la forma unita (vertici saldati) e la nuvola di campioni."""
    scena = trimesh.load(percorso, force="scene")
    rng = np.random.default_rng(7)
    geometrie = []
    for nodo in scena.graph.nodes_geometry:
        trasf, nome_geom = scena.graph[nodo]
        g = scena.geometry[nome_geom]
        if isinstance(g, trimesh.Trimesh) and len(g.faces):
            geometrie.append((g, trasf))
    if not geometrie:
        sys.exit("Nessuna mesh trovata nel file di ingresso.")
    area_tot = sum(g.area for g, _ in geometrie)
    forme, P, C, W = [], [], [], []
    for g, trasf in geometrie:
        p, c, w = campiona_geometria(g, int(CAMPIONI_TOTALI * g.area / area_tot), rng)
        P.append(trimesh.transform_points(p, trasf)); C.append(c); W.append(w)
        f = trimesh.Trimesh(g.vertices.copy(), g.faces.copy(), process=False)
        f.apply_transform(trasf)
        forme.append(f)
    forma = trimesh.util.concatenate(forme)
    # i generatori duplicano i vertici sulle cuciture della texture: li salda
    forma.merge_vertices(merge_tex=True, merge_norm=True)
    forma.update_faces(forma.nondegenerate_faces())
    forma.update_faces(forma.unique_faces())
    forma.remove_unreferenced_vertices()
    return forma, np.vstack(P), np.vstack(C), np.concatenate(W)


# ---------------------------------------------------------------------------
# Forma
# ---------------------------------------------------------------------------

def matrice_posa(forma, args):
    """Rotazione, scala e traslazione per mettere la figura in piedi, a terra,
    centrata e (con --base) dentro la base."""
    M = np.eye(4)
    if args.asse_z_su:
        M = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]) @ M
    if args.ruota:
        M = trimesh.transformations.rotation_matrix(np.radians(args.ruota), [0, 1, 0]) @ M
    v = trimesh.transform_points(forma.vertices, M)
    lo, hi = v.min(0), v.max(0)
    # mai più alto di --altezza e mai fuori dall'impronta del blocco, così non copre i vicini
    scala = min(args.altezza / (hi[1] - lo[1]), 0.95 * gp.IMPRONTA[0] / (hi[0] - lo[0]), 0.95 * gp.IMPRONTA[1] / (hi[2] - lo[2]))
    centro = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    T = trimesh.transformations.translation_matrix(-centro)
    S = trimesh.transformations.scale_matrix(scala)
    A = trimesh.transformations.translation_matrix([0, QUOTA_BASE if args.base else 0, 0])
    return A @ S @ T @ M


def ripara_forma(forma, quota_polvere=0.001):
    """Salda, chiude i piccoli buchi, orienta le facce e toglie la polvere."""
    gruppi = trimesh.graph.connected_components(forma.face_adjacency,
                                                nodes=np.arange(len(forma.faces)), min_len=1)
    area, totale = forma.area_faces, forma.area
    tieni = np.zeros(len(forma.faces), bool)
    for g in gruppi:
        if area[g].sum() >= quota_polvere * totale:
            tieni[g] = True
    tolti = len(gruppi) - sum(1 for g in gruppi if tieni[g[0]])
    if tolti:
        print(f"tolti {tolti} frammenti minuscoli (meno dello 0,1% della superficie)")
        forma.update_faces(tieni)
        forma.remove_unreferenced_vertices()
    prima = aperti(forma)
    trimesh.repair.fix_winding(forma)
    forma = chiudi_buchi(forma)
    trimesh.repair.fix_winding(forma)
    if forma.is_watertight:
        trimesh.repair.fix_inversion(forma, multibody=True)
    dopo = aperti(forma)
    if prima:
        print(f"bordi aperti nel modello di partenza: {prima}, dopo la riparazione: {dopo}")
    return forma


def chiudi_buchi(m, max_lati=80):
    """Chiude ogni buco (anello di bordi aperti) con un "tappo" a ventaglio
    attorno al suo centro. Funziona anche per buchi grandi e non piatti,
    che la riparazione standard lascia aperti."""
    F = m.faces
    diretti = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    chiavi = np.sort(diretti, axis=1)
    _, inv, conte = np.unique(chiavi, axis=0, return_inverse=True, return_counts=True)
    bordo = diretti[conte[inv.ravel()] == 1]
    if len(bordo) == 0:
        return m
    successivo = {}
    for a, b in bordo:
        successivo.setdefault(int(b), []).append(int(a))   # il tappo percorre il bordo al contrario
    vertici, nuove = [m.vertices], []
    nv = len(m.vertices)
    visitati = set()
    for inizio in list(successivo):
        if inizio in visitati:
            continue
        anello, v = [], inizio
        while v not in visitati and v in successivo and len(anello) <= max_lati:
            visitati.add(v)
            anello.append(v)
            v = successivo[v][0]
        if len(anello) < 3 or len(anello) > max_lati or v != inizio:
            continue
        centro = m.vertices[anello].mean(0)
        vertici.append(centro[None])
        for i in range(len(anello)):
            nuove.append((anello[i], anello[(i + 1) % len(anello)], nv))
        nv += 1
    if not nuove:
        return m
    return trimesh.Trimesh(np.vstack(vertici), np.vstack([F, np.array(nuove)]), process=False)


def aperti(m):
    _, conte = np.unique(m.edges_sorted, axis=0, return_counts=True)
    return int((conte == 1).sum())


def decima(m, budget):
    """Riduzione in due tappe (prima ~6000 triangoli, poi il budget)."""
    ridotta = m
    for obiettivo in (6000, budget):
        if len(ridotta.faces) > obiettivo:
            ridotta = ridotta.simplify_quadric_decimation(face_count=obiettivo)
    tentativi = 0
    while len(ridotta.faces) > budget and tentativi < 4:
        ridotta = ridotta.simplify_quadric_decimation(face_count=int(budget * 0.95))
        tentativi += 1
    ridotta.merge_vertices()
    ridotta.update_faces(ridotta.nondegenerate_faces())
    ridotta.remove_unreferenced_vertices()
    trimesh.repair.fix_winding(ridotta)
    return ridotta


def _area(p0, p1, p2):
    return 0.5 * np.linalg.norm(np.cross(p1 - p0, p2 - p0))


def _ventaglio(poligono, V):
    """Triangola un poligono convesso a ventaglio, scegliendo il vertice di
    partenza che evita i triangoli più schiacciati."""
    n = len(poligono)
    if n == 3:
        return [tuple(poligono)]
    migliore, scelta = -1.0, 0
    for i in range(n):
        minima = min(_area(V[poligono[i]], V[poligono[(i + j) % n]], V[poligono[(i + j + 1) % n]])
                     for j in range(1, n - 1))
        if minima > migliore:
            migliore, scelta = minima, i
    return [(poligono[scelta], poligono[(scelta + j) % n], poligono[(scelta + j + 1) % n])
            for j in range(1, n - 1)]


def taglia_sui_confini(m, tagli):
    """Taglia i triangoli lungo i confini di colore.

    tagli: {faccia: (punto_sul_piano, direzione, soglia)}, cioè la retta che
    separa i due colori dentro quel triangolo. Ogni punto di taglio su un lato
    viene condiviso con il triangolo vicino, che a sua volta viene diviso:
    nessun vertice resta "appeso", la superficie resta chiusa."""
    V = [v for v in m.vertices]
    F = m.faces
    punto_lato = {}                    # (a, b) ordinato -> indice nuovo vertice
    corda = {}                         # faccia -> (vertice, vertice) del taglio

    def lato(a, b):
        return (a, b) if a < b else (b, a)

    for f, (c0, d, soglia) in tagli.items():
        tri = F[f]
        val = [float((V[v] - c0) @ d - soglia) for v in tri]
        estremi = []
        for i in range(3):
            a, b = tri[i], tri[(i + 1) % 3]
            fa, fb = val[i], val[(i + 1) % 3]
            if (fa > 0) == (fb > 0):
                continue
            t = fa / (fa - fb)
            if t < 0.12:
                estremi.append(int(a))           # il taglio passa (quasi) per il vertice
            elif t > 0.88:
                estremi.append(int(b))
            else:
                chiave = lato(int(a), int(b))
                if chiave not in punto_lato:
                    V.append(V[a] + t * (V[b] - V[a]))
                    punto_lato[chiave] = len(V) - 1
                estremi.append(punto_lato[chiave])
        estremi = list(dict.fromkeys(estremi))
        if len(estremi) == 2:
            corda[f] = (estremi[0], estremi[1])
    V = np.array(V)
    nuove, padre = [], []
    for f, tri in enumerate(F):
        perimetro = []
        for i in range(3):
            a, b = int(tri[i]), int(tri[(i + 1) % 3])
            perimetro.append(a)
            if lato(a, b) in punto_lato:
                perimetro.append(punto_lato[lato(a, b)])
        pezzi = [perimetro]
        if f in corda and all(x in perimetro for x in corda[f]):
            i, j = sorted(perimetro.index(x) for x in corda[f])
            if j - i >= 2 and len(perimetro) - (j - i) >= 2:
                pezzi = [perimetro[i:j + 1], perimetro[j:] + perimetro[:i + 1]]
        for poli in pezzi:
            for t in _ventaglio(poli, V):
                if _area(V[t[0]], V[t[1]], V[t[2]]) > 1e-12:
                    nuove.append(t)
                    padre.append(f)
    return trimesh.Trimesh(V, np.array(nuove), process=False), np.array(padre)


def retta_di_separazione(p, lab_a):
    """La retta (sul piano del triangolo) che separa meglio i campioni di due
    colori: direzione tra i due baricentri, soglia che sbaglia meno campioni."""
    a, b = p[lab_a], p[~lab_a]
    ca, cb = a.mean(0), b.mean(0)
    d = cb - ca
    if np.linalg.norm(d) < 1e-9:
        return None
    s = (p - ca) @ d
    ordine = np.argsort(s)
    ss, aa = s[ordine], lab_a[ordine]
    # errore se il taglio sta dopo l'indice i: B prima del taglio + A dopo
    b_prima = np.cumsum(~aa)
    a_dopo = aa.sum() - np.cumsum(aa)
    i = int(np.argmin(b_prima + a_dopo))
    soglia = (ss[i] + ss[min(i + 1, len(ss) - 1)]) / 2
    return ca, d, soglia


# ---------------------------------------------------------------------------
# Colori sui triangoli
# ---------------------------------------------------------------------------

def etichette_punti(colori, palette_lab, peso_l=True):
    lab = pesato(rgb_a_lab(colori))
    d = ((lab[:, None, :] - palette_lab[None]) ** 2).sum(-1)
    return np.argmin(d, axis=1)


def leviga_punti(punti, etichette, k, peso):
    """Ogni campione prende il colore più votato tra i suoi 8 vicini: toglie il
    rumore della texture senza cancellare i dettagli piccoli."""
    _, vicini = cKDTree(punti).query(punti, k=9)
    voti = np.zeros((len(punti), k))
    for j in range(vicini.shape[1]):
        np.add.at(voti, (np.arange(len(punti)), etichette[vicini[:, j]]), peso[etichette[vicini[:, j]]])
    return np.argmax(voti, axis=1)


def assegna_campioni(m, punti, tolleranza):
    """Per ogni campione, il triangolo più vicino (o -1 se è troppo lontano:
    succede con i frammenti tolti)."""
    kk = min(8, len(m.faces))
    _, cand = cKDTree(m.triangles_center).query(punti, k=kk)
    cand = np.asarray(cand).reshape(len(punti), kk)
    ripetuti = np.repeat(punti, kk, axis=0)
    vicini = trimesh.triangles.closest_point(m.triangles[cand.ravel()], ripetuti)
    dist = np.linalg.norm(vicini - ripetuti, axis=1).reshape(len(punti), kk)
    scelta = np.argmin(dist, axis=1)
    tri = cand[np.arange(len(punti)), scelta]
    tri[dist[np.arange(len(punti)), scelta] > tolleranza] = -1
    return tri


def voti_triangoli(m, tri, etichette, pesi, k, peso):
    ok = tri >= 0
    voti = np.zeros((len(m.faces), k))
    np.add.at(voti, (tri[ok], etichette[ok]), pesi[ok] * peso[etichette[ok]])
    return voti


def colora(m, punti, etichette, pesi, k, peso, tolleranza, budget, livello):
    """Assegna un colore a ogni triangolo. Dove un triangolo copre due colori
    (il bordo degli occhiali, la fascia del cappello) lo taglia lungo il
    confine, finché il budget lo consente."""
    soglia = {0: 0.0, 1: 0.7, 2: 0.82, 3: 0.92}[livello]
    giri = {0: 0, 1: 2, 2: 3, 3: 5}[livello]
    for _ in range(giri):
        tri = assegna_campioni(m, punti, tolleranza)
        voti = voti_triangoli(m, tri, etichette, pesi, k, peso)
        tot = voti.sum(1)
        purezza = np.where(tot > 0, voti.max(1) / np.maximum(tot, 1e-12), 1.0)
        candidati = np.where((purezza < soglia) & (tot > 0))[0]
        spazio = budget - len(m.faces)
        if len(candidati) == 0 or spazio < 6:
            break
        importanza = (1 - purezza[candidati]) * m.area_faces[candidati]
        candidati = candidati[np.argsort(-importanza)][: max(1, spazio // 4)]
        ordine = np.argsort(tri)
        inizio = np.searchsorted(tri[ordine], candidati)
        fine = np.searchsorted(tri[ordine], candidati, side="right")
        tagli = {}
        for f, i0, i1 in zip(candidati, inizio, fine):
            idx = ordine[i0:i1]
            if len(idx) < 6:
                continue
            due = np.argsort(-voti[f])[:2]
            lab = etichette[idx]
            dentro = np.isin(lab, due)
            if dentro.sum() < 6:
                continue
            r = retta_di_separazione(punti[idx][dentro], lab[dentro] == due[0])
            if r is not None:
                tagli[int(f)] = r
        if not tagli:
            break
        nuovo, _ = taglia_sui_confini(m, tagli)
        if len(nuovo.faces) > budget:
            break
        m = nuovo
    tri = assegna_campioni(m, punti, tolleranza)
    voti = voti_triangoli(m, tri, etichette, pesi, k, peso)
    risultato = np.argmax(voti, axis=1)
    vuoti = voti.sum(1) == 0
    if vuoti.any():
        _, idx = cKDTree(punti).query(m.triangles_center[vuoti])
        risultato[vuoti] = etichette[idx]
    return m, risultato


# ---------------------------------------------------------------------------
# Materiali
# ---------------------------------------------------------------------------

SOGLIA_NEON = 40      # distanza Lab massima per riconoscere il colore giocatore


def tinta_e_saturazione(lab):
    a, b = lab[..., 1], lab[..., 2]
    return np.degrees(np.arctan2(b, a)), np.hypot(a, b)


def trova_neon(palette, neon_hex, escludi=None):
    """Il neon nei concept esce spesso più chiaro o più pastello del codice
    richiesto: lo riconosco dalla tinta (l'angolo del colore) e da una
    saturazione minima, non dalla distanza esatta. Così il beige della pelle
    o il lilla dei capelli non diventano mai neon."""
    h, c = tinta_e_saturazione(rgb_a_lab(palette))
    ht, ct = tinta_e_saturazione(rgb_a_lab(hex_a_rgb(neon_hex)))
    diff = np.abs((h - ht + 180) % 360 - 180)
    ok = (diff <= 40) & (c >= max(25, 0.4 * ct))
    if escludi is not None:
        ok[escludi] = False
    if not ok.any():
        return None
    return int(np.argmin(np.where(ok, diff, np.inf)))


def pesi_accento(palette, quote, args):
    """Peso maggiore per i colori accento: il neon e i colori molto saturi ma piccoli."""
    peso = np.ones(len(palette))
    _, c = tinta_e_saturazione(rgb_a_lab(palette))
    peso[(c >= 35) & (quote < 0.06)] = 1.6
    if args.neon:
        i = trova_neon(palette, args.neon)
        if i is not None:
            peso[i] = 1.6
    return peso


def assegna_materiali(palette, aree, args):
    """Decide il nome di ogni colore. Con --senza-giocatore (sempre, per FAB) sono tutti fissi."""
    nomi = [None] * len(palette)
    lab = rgb_a_lab(palette)
    i_tinta = None
    if args.senza_giocatore:
        pass
    elif args.tinta:
        d = distanza_lab(lab, rgb_a_lab(hex_a_rgb(args.tinta)))
        i_tinta = int(np.argmin(d))
        if d[i_tinta] > SOGLIA_NEON:
            print(f"ATTENZIONE: nel modello non c'è nessun colore vicino a --tinta {args.tinta}: "
                  "controlla la tabella e rilancia con il codice giusto.")
    else:
        i_tinta = int(np.argmax(aree))
    if i_tinta is not None:
        nomi[i_tinta] = "colore_fazione"
    if args.neon:
        i_neon = trova_neon(palette, args.neon, escludi=i_tinta)
        if i_neon is not None:
            nomi[i_neon] = "neon_giocatore"
        else:
            print(f"ATTENZIONE: nessun colore abbastanza vicino a --neon {args.neon}: "
                  "il neon resta un colore fisso.")
    n = 1
    for i in range(len(nomi)):
        if nomi[i] is None:
            nomi[i] = f"fisso_{n}"
            n += 1
    return nomi


# ---------------------------------------------------------------------------
# Modo "texture" (predefinito per FAB): tiene forma e texture del generatore
# ---------------------------------------------------------------------------

def pulisci_con_texture(args, budget_totale):
    scena = trimesh.load(args.ingresso, force="scene")
    geo = [(scena.geometry[n], t) for t, n in (scena.graph[k] for k in scena.graph.nodes_geometry)
           if isinstance(scena.geometry[n], trimesh.Trimesh) and len(scena.geometry[n].faces)]
    # shortcut: tiene la mesh più grande con la sua texture (Meshy e TRELLIS ne danno una sola); se servono più pezzi, unirli prima
    g, trasf = max(geo, key=lambda x: len(x[0].faces))
    g = g.copy(); g.apply_transform(trasf)
    mat = _materiale_pbr(g.visual)
    immagine = getattr(mat, "baseColorTexture", None) if mat is not None else None
    uv = getattr(g.visual, "uv", None)
    if immagine is None or uv is None:
        sys.exit("Il modello non ha una texture: usa la pulizia a colori piatti (togli «tieni la texture»).")
    tri_ingresso = len(g.faces)
    base = gp.base_blocco(args.nome) if args.base else None
    budget = budget_totale - (base.triangoli if base else 0)
    forma = trimesh.Trimesh(g.vertices, g.faces, process=False)
    # niente riduzione: ridurre un modello con texture strappa le cuciture (macchie scure). Il budget si dà al generatore.
    if len(forma.faces) > budget:
        print(f"ATTENZIONE: {tri_ingresso} triangoli, oltre il budget di {budget}: rigenera con meno poligoni "
              f"(Meshy: Poly Count {budget}). Il modello resta com'è.")
    M = matrice_posa(forma, args)
    forma.apply_transform(M)
    lato = min(args.texture_px, max(immagine.size))
    img = immagine.convert("RGB").resize((lato, lato))
    pbr = trimesh.visual.material.PBRMaterial(name="figura", baseColorTexture=img, metallicFactor=0.0, roughnessFactor=0.9)
    forma.visual = trimesh.visual.TextureVisuals(uv=uv, material=pbr)
    uscita_scena = trimesh.Scene()
    uscita_scena.add_geometry(forma, node_name="figura", geom_name="figura")
    if base:
        b, _ = base.unito()
        b.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
            name="colore_fazione", baseColorFactor=[255, 255, 255, 255], metallicFactor=0.0, roughnessFactor=0.7))
        uscita_scena.add_geometry(b, node_name="colore_fazione", geom_name="colore_fazione")
    uscita = Path(args.uscita) if args.uscita else QUI.parent / "modelli" / "definitivi" / f"{args.nome}.glb"
    uscita.parent.mkdir(parents=True, exist_ok=True)
    uscita.write_bytes(uscita_scena.export(file_type="glb"))
    tot = len(forma.faces) + (base.triangoli if base else 0)
    print(f"\n{args.ingresso}  ->  {uscita}")
    print(f"triangoli: {tri_ingresso} in ingresso, {tot} in uscita (budget {budget_totale}); texture {lato} px")


# ---------------------------------------------------------------------------
# Programma
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Pulisce un modello 3D generato da AI.")
    ap.add_argument("ingresso", help="file .glb/.gltf/.obj/.fbx esportato dal generatore")
    ap.add_argument("nome", help="nome del pezzo, es. pedina_punk, festa, polizia")
    ap.add_argument("--triangoli", type=int)
    ap.add_argument("--base", action="store_true")
    ap.add_argument("--altezza", type=float, default=1.0)
    ap.add_argument("--tinta")
    ap.add_argument("--neon")
    ap.add_argument("--senza-giocatore", action="store_true")
    ap.add_argument("--colori", type=int, default=6)
    ap.add_argument("--palette-da", help="immagine del concept da cui prendere i colori")
    ap.add_argument("--dettaglio", type=int, default=2, choices=[0, 1, 2, 3])
    ap.add_argument("--ruota", type=float, default=0.0)
    ap.add_argument("--asse-z-su", action="store_true")
    ap.add_argument("-o", "--uscita")
    ap.add_argument("--texture", action="store_true", help="tiene forma e texture del generatore (consigliato per FAB)")
    ap.add_argument("--texture-px", type=int, default=512, help="lato massimo della texture (default 512: 33 pezzi stanno nella memoria di un telefono)")
    args = ap.parse_args()
    if args.texture:
        return pulisci_con_texture(args, args.triangoli or gp.budget_di(args.nome))

    budget_totale = args.triangoli or gp.budget_di(args.nome)
    pezzo = gp.Pezzo(args.nome)
    if args.base:
        pezzo = gp.base_blocco(args.nome)
        budget = budget_totale - pezzo.triangoli
    else:
        budget = budget_totale

    # 1. lettura e posa
    forma, punti, colori, pesi = leggi_modello(args.ingresso)
    tri_ingresso = len(forma.faces)
    M = matrice_posa(forma, args)
    forma.apply_transform(M)
    punti = trimesh.transform_points(punti, M)
    pesi = pesi * (np.linalg.det(M[:3, :3]) ** (2 / 3))
    print(f"ingresso: {tri_ingresso} triangoli, {len(punti)} campioni di colore")

    # 2. riparazione e forma
    forma = ripara_forma(forma)
    if len(forma.faces) > budget:
        # modello pesante: si riduce lasciando spazio ai dettagli di colore
        obiettivo = int(budget * (0.7 if args.dettaglio else 1.0))
        print(f"modello pesante: riduco la forma a {obiettivo} triangoli")
        forma = decima(forma, obiettivo)
    else:
        print("il modello rientra nel budget: la forma resta quella originale")

    # 3. palette
    if args.palette_da:
        palette, quote = palette_da_immagine(args.palette_da, args.colori)
        print(f"palette dal concept: {', '.join(rgb_a_hex(c) for c in palette)}")
    else:
        lab = pesato(rgb_a_lab(colori))
        centri, et = kmeans(lab[::4], pesi[::4], args.colori + 1)
        tenuti = [j for j in range(len(centri)) if (et == j).any()]
        palette = np.array([np.median(colori[::4][et == j], axis=0) for j in tenuti])
        quote = np.array([(et == j).mean() for j in tenuti])
        palette, quote = unisci_simili(palette, quote, soglia=20)
        print(f"palette dalla texture: {', '.join(rgb_a_hex(c) for c in palette)}")
    k = len(palette)
    peso = pesi_accento(palette, quote, args)

    # 4. colori: campioni -> palette -> triangoli (dividendo dove serve)
    et_punti = leviga_punti(punti, etichette_punti(colori, pesato(rgb_a_lab(palette))), k, peso)
    tolleranza = 0.03 * args.altezza
    figura, etichette = colora(forma, punti, et_punti, pesi, k, peso, tolleranza, budget, args.dettaglio)

    # 5. materiali e scrittura
    aree = np.array([figura.area_faces[etichette == j].sum() for j in range(k)])
    nomi = assegna_materiali(palette, aree, args)
    righe = []
    for j, nome_mat in enumerate(nomi):
        sel = etichette == j
        if not sel.any():
            continue
        mat = gp.materiale(nome_mat, rgb_a_hex(palette[j]), ruvidita=0.8)
        parte = trimesh.Trimesh(figura.vertices, figura.faces[sel], process=False)
        pezzo.aggiungi(parte, mat, gia_y_su=True, gruppo="figura")
        righe.append((mat["name"], rgb_a_hex(palette[j]), aree[j] / aree.sum() * 100, int(sel.sum())))

    uscita = Path(args.uscita) if args.uscita else QUI.parent / "modelli" / "definitivi" / f"{args.nome}.glb"
    uscita.parent.mkdir(parents=True, exist_ok=True)
    pezzo.esporta(uscita)

    finale, _ = pezzo.unito()
    print(f"\n{args.ingresso}  ->  {uscita}")
    print(f"triangoli: {tri_ingresso} in ingresso, {pezzo.triangoli} in uscita (budget {budget_totale})")
    print(f"forma della figura: {'chiusa (manifold)' if figura.is_watertight else str(aperti(figura)) + ' bordi aperti'}")
    print(f"\n{'materiale':<20} {'colore':<9} {'superficie':>10} {'triangoli':>10}")
    for nome_mat, colore, perc, tri in sorted(righe, key=lambda r: -r[2]):
        print(f"{nome_mat:<20} {colore:<9} {perc:>9.1f}% {tri:>10}")
    print("\nI colori sono quelli del concept: se ne manca uno, alza --colori; se ci sono macchie, abbassalo.")


if __name__ == "__main__":
    main()
