#!/usr/bin/env python3
"""
FAB · pezzi 3D — server locale del pannello
=================================================

Fa funzionare pannello.html: riceve i comandi dal browser ed esegue gli
script del kit (pulizia, generazione, test sagome), chiama Gemini e TRELLIS
e salva i file nelle cartelle giuste.

Non serve lanciarlo a mano: basta un doppio clic su AVVIA_PANNELLO.bat.
Ascolta solo su 127.0.0.1 (il tuo computer), non è raggiungibile da fuori.

    python server_pannello.py [--porta 8078] [--apri]
"""

import argparse
import base64
import glob
import json
import os
import platform
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

QUI = Path(__file__).resolve().parent
RADICE = QUI.parent
CONFIG = RADICE / "impostazioni.json"
FILE_VERSIONE = RADICE / "VERSIONE"
VERSIONE = FILE_VERSIONE.read_text(encoding="utf-8").strip() if FILE_VERSIONE.exists() else "?"
CODICE_RIAVVIO = 3       # AVVIA_PANNELLO.bat riavvia il server quando esce con questo codice
WINDOWS = platform.system() == "Windows"
TRELLIS_URL = os.environ.get("BRIANBORU_TRELLIS_URL", "http://127.0.0.1:7960")
GEMINI_BASE = os.environ.get("BRIANBORU_GEMINI_BASE", "https://generativelanguage.googleapis.com")

# cartelle in cui il pannello può scrivere o cancellare
SCRIVIBILI = ["concept/esplorazione", "concept/scelti", "concept/viste_3d",
              "modelli/ai_grezzi", "modelli/definitivi", "modelli/props", "modelli/divisioni"]

CONFIG_PREDEFINITA = {
    "chiave_gemini": "",
    "modello_gemini": "gemini-3.1-flash-image-preview",
    "cartella_trellis": "C:\\BrianboruAI\\trellis" if WINDOWS else str(Path.home() / "trellis"),
    "precisione_trellis": "half",
    "cartella_gioco": str(RADICE.parents[1] / "web" / "public" / "pezzi") if (RADICE.parents[1] / "web").is_dir() else "",
    "blender": "",
}


# ---------------------------------------------------------------------------
# Utilità
# ---------------------------------------------------------------------------

def leggi_config():
    cfg = dict(CONFIG_PREDEFINITA)
    if CONFIG.exists():
        try:
            cfg.update(json.loads(CONFIG.read_text(encoding="utf-8")))
        except Exception:
            pass
    return cfg


def scrivi_config(nuova):
    cfg = leggi_config()
    cfg.update({k: v for k, v in nuova.items() if k in CONFIG_PREDEFINITA})
    CONFIG.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
    return cfg


def percorso_sicuro(relativo, scrittura=False):
    """Converte un percorso relativo al kit in assoluto, rifiutando tutto
    ciò che esce dal kit (o dalle cartelle scrivibili, se scrittura=True)."""
    p = (RADICE / relativo).resolve()
    if RADICE not in p.parents and p != RADICE:
        raise ValueError("percorso fuori dal kit")
    if scrittura:
        rel = p.relative_to(RADICE).as_posix()
        if not any(rel == c or rel.startswith(c + "/") for c in SCRIVIBILI):
            raise ValueError(f"cartella non scrivibile: {rel}")
    return p


def env_python():
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    return env


def trellis_attivo():
    try:
        with urllib.request.urlopen(TRELLIS_URL + "/ping", timeout=1.5) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None


def info_gpu():
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,compute_cap,driver_version,memory.total",
             "--format=csv,noheader"], capture_output=True, text=True, timeout=8)
        if out.returncode == 0 and out.stdout.strip():
            nome, cc, driver, mem = [x.strip() for x in out.stdout.strip().splitlines()[0].split(",")]
            return {"nome": nome, "compute_cap": cc, "driver": driver, "memoria": mem}
    except Exception:
        pass
    return None


def trova_blender(cfg):
    if cfg.get("blender") and Path(cfg["blender"]).exists():
        return cfg["blender"]
    candidati = sorted(glob.glob(r"C:\Program Files\Blender Foundation\Blender*\blender.exe"),
                       reverse=True)
    if candidati:
        return candidati[0]
    return shutil.which("blender") or ""


# ---------------------------------------------------------------------------
# Lavori lunghi in background, con log che il pannello legge a intervalli
# ---------------------------------------------------------------------------

LAVORI = {}
BLOCCO = threading.Lock()


def nuovo_lavoro(titolo, funzione, *args):
    lid = uuid.uuid4().hex[:10]
    lavoro = {"id": lid, "titolo": titolo, "stato": "in_corso", "log": [], "risultato": None}
    LAVORI[lid] = lavoro

    def log(riga):
        with BLOCCO:
            lavoro["log"].append(str(riga).rstrip())
            del lavoro["log"][:-800]

    def esegui():
        try:
            lavoro["risultato"] = funzione(log, *args)
            lavoro["stato"] = "fatto"
        except Exception as e:  # noqa: BLE001
            log(f"ERRORE: {e}")
            lavoro["stato"] = "errore"

    threading.Thread(target=esegui, daemon=True).start()
    return lid


def esegui_processo(log, comando, cwd=None, env=None):
    log("> " + " ".join(str(c) for c in comando))
    proc = subprocess.Popen(comando, cwd=cwd, env=env or env_python(),
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for riga in iter(proc.stdout.readline, b""):
        log(riga.decode("utf-8", errors="replace"))
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"comando terminato con codice {proc.returncode}")


def script(nome):
    return [sys.executable, str(QUI / nome)]


# ---------------------------------------------------------------------------
# Operazioni
# ---------------------------------------------------------------------------

def op_genera(log):
    esegui_processo(log, script("catalogo.py"), cwd=QUI)
    esegui_processo(log, script("genera_pezzi.py"), cwd=QUI)
    return {"report": (RADICE / "modelli" / "report.txt").read_text(encoding="utf-8")}


def op_pulisci(log, dati):
    ingresso = percorso_sicuro(dati["ingresso"])
    if not ingresso.exists():
        raise RuntimeError(f"file non trovato: {dati['ingresso']}")
    uscita = percorso_sicuro(dati["uscita"], scrittura=True)
    cmd = script("pulisci_modello_ai.py") + [str(ingresso), dati["nome"], "-o", str(uscita)]
    o = dati.get("opzioni", {})
    if o.get("base"):
        cmd.append("--base")
    for chiave, flag in (("tinta", "--tinta"), ("neon", "--neon"), ("altezza", "--altezza"),
                         ("triangoli", "--triangoli"), ("colori", "--colori"),
                         ("ruota", "--ruota"), ("dettaglio", "--dettaglio")):
        v = o.get(chiave)
        if v in (None, ""):
            continue
        if chiave in ("ruota", "triangoli") and float(v) == 0:
            continue
        cmd += [flag, str(v)]
    if o.get("palette_da"):
        concept = percorso_sicuro(o["palette_da"])
        if concept.exists():
            cmd += ["--palette-da", str(concept)]
    if o.get("asse_z_su"):
        cmd.append("--asse-z-su")
    if o.get("senza_giocatore"):
        cmd.append("--senza-giocatore")
    if o.get("texture"):
        cmd.append("--texture")
    esegui_processo(log, cmd, cwd=QUI)
    op_genera(log)
    return {"uscita": uscita.relative_to(RADICE).as_posix()}


def _tipo(dati):
    t = str(dati.get("id", ""))
    if not t.replace("_", "").isalnum() or not (RADICE / "modelli" / "definitivi" / f"{t}.glb").exists():
        raise RuntimeError(f"modello finito non trovato: {t}")
    return t


def op_dividi_proposta(log, dati):
    """La divisione salvata del tipo, oppure (nuova=True o nessun salvataggio) la proposta automatica con k figure."""
    t = _tipo(dati)
    salvata = RADICE / "modelli" / "divisioni" / f"{t}.json"
    if salvata.exists() and not dati.get("nuova"):
        log(f"divisione salvata: {salvata.name}")
        return {"divisione": json.loads(salvata.read_text(encoding="utf-8")), "salvata": True}
    cmd = script("separa_figure.py") + ["--proposta", t] + (["-k", str(int(dati["k"]))] if dati.get("k") else [])
    log("proposta automatica…")
    out = subprocess.run(cmd, cwd=QUI, env=env_python(), capture_output=True, text=True, encoding="utf-8")
    if out.returncode != 0:
        raise RuntimeError(out.stderr[-600:])
    return {"divisione": json.loads(out.stdout), "salvata": False}


def op_dividi_salva(log, dati):
    """Salva la divisione fatta nel pannello e rigenera le figure del volume."""
    t = _tipo(dati)
    k, gradi, alto, et = int(dati["k"]), float(dati["gradi"]), float(dati["altezza"]), dati["etichette"]
    if not 1 <= k <= 8 or not 0.3 <= alto <= 15 or not isinstance(et, list) or any(not isinstance(e, int) or e < -1 or e >= k for e in et):
        raise RuntimeError("divisione non valida")
    cartella = RADICE / "modelli" / "divisioni"; cartella.mkdir(parents=True, exist_ok=True)
    (cartella / f"{t}.json").write_text(json.dumps({"k": k, "gradi": gradi, "altezza": alto, "etichette": et}), encoding="utf-8")
    log(f"salvata la divisione di {t}: {k} figure, {sum(1 for e in et if e < 0)} triangoli scartati")
    esegui_processo(log, script("separa_figure.py") + ["--volume", t.split("_")[0]], cwd=QUI)
    return {}


def cartella_figure():
    """Dove stanno le figure del gioco: web/public/pezzi del repository, o modelli/figure se il kit è scaricato da solo."""
    web = RADICE.parents[1] / "web" / "public" / "pezzi"
    c = web if web.is_dir() else RADICE / "modelli" / "figure"
    c.mkdir(parents=True, exist_ok=True)
    return c


def elenco_figure():
    """Per ogni volume con figure: i tipi, i file di ogni tipo e le scelte già fatte (orientamento, origine, variante)."""
    c, out = cartella_figure(), {}
    for f in sorted(c.glob("*.json")):
        if f.stem.endswith("_config"):
            continue
        try:
            idx = json.loads(f.read_text(encoding="utf-8"))
            cfg = c / f"{f.stem}_config.json"
            out[f.stem] = {"tipi": {t: v["figure"] for t, v in idx["tipi"].items()},
                           "config": json.loads(cfg.read_text(encoding="utf-8")) if cfg.exists() else {}}
        except (ValueError, KeyError):
            continue
    return out


def salva_config_figura(dati):
    """Scrive la scelta di un tipo in <volume>_config.json: {tipo: {scelta, figure: {file: {gradi, dx, dz}}}}."""
    vol, tipo = str(dati.get("vol", "")), str(dati.get("tipo", ""))
    elenco = elenco_figure()
    if vol not in elenco or tipo not in elenco[vol]["tipi"]:
        raise ValueError("tipo sconosciuto")
    files = elenco[vol]["tipi"][tipo]
    scelta = dati.get("scelta")
    if scelta is not None and not (isinstance(scelta, int) and 0 <= scelta < len(files)):
        raise ValueError("variante non valida")
    figure = {}
    for f, v in (dati.get("figure") or {}).items():
        if f in files:
            figure[f] = {"gradi": float(v.get("gradi", 0)) % 360, "dx": max(-2, min(2, float(v.get("dx", 0)))), "dz": max(-2, min(2, float(v.get("dz", 0))))}
    cfg = cartella_figure() / f"{vol}_config.json"
    tutto = json.loads(cfg.read_text(encoding="utf-8")) if cfg.exists() else {}
    tutto[tipo] = {"scelta": scelta, "figure": figure}
    cfg.write_text(json.dumps(tutto, indent=1), encoding="utf-8")


def op_test_sagome(log):
    esegui_processo(log, script("test_sagome.py") + [str(RADICE / "concept" / "scelti")], cwd=QUI)
    return {"foglio": "concept/scelti/_test_sagome.png"}


def op_gemini(log, dati):
    cfg = leggi_config()
    chiave = cfg.get("chiave_gemini", "").strip()
    if not chiave:
        raise RuntimeError("manca la chiave API di Gemini (scheda Installazione)")
    modello = cfg.get("modello_gemini") or CONFIG_PREDEFINITA["modello_gemini"]
    parti = [{"text": dati["prompt"]}]
    for rif in dati.get("riferimenti", []):
        p = percorso_sicuro(rif)
        if not p.exists():
            raise RuntimeError(f"immagine di riferimento mancante: {rif}")
        tipo = "image/png" if p.suffix.lower() == ".png" else "image/jpeg"
        parti.append({"inline_data": {"mime_type": tipo,
                                      "data": base64.b64encode(p.read_bytes()).decode()}})
        log(f"allego {rif}")
    corpo = {"contents": [{"role": "user", "parts": parti}],
             "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}}
    url = f"{GEMINI_BASE}/v1beta/models/{modello}:generateContent"
    log(f"chiedo l'immagine a {modello}…")
    req = urllib.request.Request(url, data=json.dumps(corpo).encode(), method="POST",
                                 headers={"Content-Type": "application/json",
                                          "x-goog-api-key": chiave})
    try:
        with urllib.request.urlopen(req, timeout=240) as r:
            risposta = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Gemini ha risposto {e.code}: {e.read().decode(errors='replace')[:600]}")
    cartella = percorso_sicuro(dati["cartella"], scrittura=True)
    cartella.mkdir(parents=True, exist_ok=True)
    salvati = []
    for cand in risposta.get("candidates", []):
        for parte in cand.get("content", {}).get("parts", []):
            img = parte.get("inline_data") or parte.get("inlineData")
            if img and img.get("data"):
                ext = ".png" if "png" in (img.get("mime_type") or img.get("mimeType") or "png") else ".jpg"
                nome = dati["nome"] if not salvati else f"{Path(dati['nome']).stem}_{len(salvati)}"
                destinazione = cartella / (Path(nome).stem + ext)
                destinazione.write_bytes(base64.b64decode(img["data"]))
                salvati.append(destinazione.relative_to(RADICE).as_posix())
                log(f"salvata {salvati[-1]}")
            elif parte.get("text"):
                log("Gemini: " + parte["text"][:400])
    if not salvati:
        motivo = risposta.get("promptFeedback") or risposta.get("candidates", [{}])[0].get("finishReason")
        raise RuntimeError(f"nessuna immagine nella risposta ({motivo})")
    return {"file": salvati}


def op_trellis_genera(log, dati):
    if not trellis_attivo():
        raise RuntimeError("TRELLIS non è avviato: premi «Avvia TRELLIS» e aspetta che sia pronto")
    immagini = []
    for rel in dati["immagini"]:
        p = percorso_sicuro(rel)
        if not p.exists():
            raise RuntimeError(f"immagine mancante: {rel}")
        immagini.append(base64.b64encode(p.read_bytes()).decode())
    passi = 25 if dati.get("qualita") == "alta" else 12
    campi = [("seed", str(dati.get("seed", 1))),
             ("ss_guidance_strength", "7.5"), ("ss_sampling_steps", str(passi)),
             ("slat_guidance_strength", "3.0"), ("slat_sampling_steps", str(passi)),
             ("mesh_simplify_ratio", "0.95"), ("texture_size", "1024"),
             ("output_format", "glb")]
    if len(immagini) == 1:
        endpoint = "/generate_no_preview"
        campi.append(("image_base64", immagini[0]))
    else:
        endpoint = "/generate_multi_no_preview"
        campi += [("image_list_base64", b) for b in immagini]
    log(f"invio {len(immagini)} immagine/i a TRELLIS ({passi} passi, seed {dati.get('seed', 1)})")
    req = urllib.request.Request(TRELLIS_URL + endpoint,
                                 data=urllib.parse.urlencode(campi).encode(), method="POST",
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"TRELLIS ha rifiutato la richiesta: {e.read().decode(errors='replace')[:400]}")
    inizio, ultimo = time.time(), None
    while True:
        time.sleep(2)
        with urllib.request.urlopen(TRELLIS_URL + "/status", timeout=10) as r:
            st = json.loads(r.read().decode())
        riga = f"{st.get('status')} {st.get('progress', 0)}% {st.get('message', '')}"
        if riga != ultimo:
            log(f"[{int(time.time() - inizio)} s] {riga}")
            ultimo = riga
        if st.get("status") == "COMPLETE":
            break
        if st.get("status") == "FAILED":
            raise RuntimeError("TRELLIS: " + st.get("message", "generazione fallita"))
    with urllib.request.urlopen(TRELLIS_URL + "/download/model", timeout=120) as r:
        glb = r.read()
    cartella = RADICE / "modelli" / "ai_grezzi"
    cartella.mkdir(parents=True, exist_ok=True)
    tentativo = cartella / f"{dati['id']}__trellis_{time.strftime('%m%d-%H%M%S')}.glb"
    tentativo.write_bytes(glb)
    (cartella / f"{dati['id']}.glb").write_bytes(glb)
    log(f"salvato {tentativo.name} ({len(glb) // 1024} kB) in {int(time.time() - inizio)} s")
    return {"file": f"modelli/ai_grezzi/{dati['id']}.glb",
            "tentativo": tentativo.relative_to(RADICE).as_posix()}


def op_trellis_installa(log, dati):
    if not WINDOWS:
        raise RuntimeError("l'installazione automatica di TRELLIS funziona solo su Windows")
    destinazione = dati.get("destinazione") or leggi_config()["cartella_trellis"]
    scrivi_config({"cartella_trellis": destinazione})
    cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
           str(QUI / "installa_trellis.ps1"), "-Destinazione", destinazione]
    if not dati.get("cuda_toolkit", True):
        cmd.append("-SaltaCudaToolkit")
    esegui_processo(log, cmd, cwd=QUI)
    return {"cartella": destinazione}


def op_gioco_copia(log):
    cfg = leggi_config()
    dest = Path(cfg.get("cartella_gioco") or "")
    if not cfg.get("cartella_gioco"):
        raise RuntimeError("imposta prima la cartella degli asset del gioco")
    dest.mkdir(parents=True, exist_ok=True)
    for f in sorted((RADICE / "modelli" / "master").glob("*.glb")):
        shutil.copy2(f, dest / f.name)
        log(f"copiato {f.name}")
    return {"cartella": str(dest)}


def stato_file():
    def elenco(cartella, schema="*"):
        c = RADICE / cartella
        if not c.exists():
            return []
        return sorted((f.relative_to(RADICE).as_posix() for f in c.glob(schema) if f.is_file()),
                      key=lambda x: (RADICE / x).stat().st_mtime, reverse=True)
    return {
        "esplorazione": elenco("concept/esplorazione"),
        "scelti": elenco("concept/scelti"),
        "viste": elenco("concept/viste_3d"),
        "grezzi": elenco("modelli/ai_grezzi", "*.glb"),
        "definitivi": elenco("modelli/definitivi", "*.glb"),
        "props": elenco("modelli/props", "*.glb"),
        "divisioni": elenco("modelli/divisioni", "*.json"),
        "report": (RADICE / "modelli" / "report.txt").read_text(encoding="utf-8")
        if (RADICE / "modelli" / "report.txt").exists() else "",
    }


_GPU_CACHE = {}


def versione_su_disco():
    try:
        return FILE_VERSIONE.read_text(encoding="utf-8").strip()
    except OSError:
        return "?"


def termina(codice):
    """Chiude il server dopo aver risposto al browser."""
    threading.Timer(0.6, lambda: os._exit(codice)).start()


def pid_in_ascolto(porta):
    """PID del processo in ascolto su una porta locale (solo Windows)."""
    if not WINDOWS:
        return []
    out = subprocess.run(["powershell", "-NoProfile", "-Command",
                          f"(Get-NetTCPConnection -LocalPort {porta} -State Listen "
                          "-ErrorAction SilentlyContinue).OwningProcess"],
                         capture_output=True, text=True, timeout=15)
    return sorted({int(x) for x in out.stdout.split() if x.strip().isdigit()})


def op_stato():
    cfg = leggi_config()
    if "gpu" not in _GPU_CACHE:
        _GPU_CACHE["gpu"] = info_gpu()
    cartella_trellis = Path(cfg["cartella_trellis"])
    return {
        "server": True,
        "versione": VERSIONE,
        "versione_su_disco": versione_su_disco(),
        "sistema": platform.system(),
        "gpu": _GPU_CACHE["gpu"],
        "trellis": {
            "cartella": str(cartella_trellis),
            "installato": (cartella_trellis / "code" / "trellis_init_done.txt").exists(),
            "scaricato": (cartella_trellis / "run.bat").exists(),
            "attivo": trellis_attivo(),
            "precisione": cfg["precisione_trellis"],
        },
        "gemini": {"configurata": bool(cfg.get("chiave_gemini")), "modello": cfg["modello_gemini"]},
        "blender": trova_blender(cfg),
        "cartella_gioco": cfg.get("cartella_gioco", ""),
        "file": stato_file(),
    }


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

TIPI = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
        ".glb": "model/gltf-binary", ".json": "application/json", ".txt": "text/plain; charset=utf-8",
        ".md": "text/plain; charset=utf-8", ".bat": "text/plain; charset=utf-8",
        ".ps1": "text/plain; charset=utf-8"}


class Gestore(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, dati, codice=200):
        corpo = json.dumps(dati, ensure_ascii=False).encode()
        self.send_response(codice)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        try:
            if url.path == "/api/stato":
                return self._json(op_stato())
            if url.path == "/api/lavoro":
                lid = urllib.parse.parse_qs(url.query).get("id", [""])[0]
                lavoro = LAVORI.get(lid)
                if not lavoro:
                    return self._json({"errore": "lavoro sconosciuto"}, 404)
                with BLOCCO:
                    return self._json(dict(lavoro, log=list(lavoro["log"])))
            if url.path == "/api/impostazioni":
                cfg = leggi_config()
                cfg["chiave_gemini"] = "••••" + cfg["chiave_gemini"][-4:] if cfg["chiave_gemini"] else ""
                return self._json(cfg)
            if url.path == "/api/figure":
                return self._json(elenco_figure())
            if url.path.startswith("/figure/"):
                f = cartella_figure() / Path(urllib.parse.unquote(url.path[8:])).name
                if f.suffix not in (".glb", ".json") or not f.is_file():
                    self.send_error(404); return
                corpo = f.read_bytes()
                self.send_response(200); self.send_header("Content-Type", TIPI[f.suffix]); self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(corpo))); self.end_headers(); self.wfile.write(corpo); return
            rel = urllib.parse.unquote(url.path.lstrip("/")) or "pannello.html"
            p = percorso_sicuro(rel)
            if not p.is_file():
                self.send_error(404)
                return
            corpo = p.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", TIPI.get(p.suffix.lower(), "application/octet-stream"))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(corpo)))
            self.end_headers()
            self.wfile.write(corpo)
        except ValueError:
            self.send_error(403)

    def do_POST(self):
        lunghezza = int(self.headers.get("Content-Length", 0))
        try:
            dati = json.loads(self.rfile.read(lunghezza) or b"{}")
        except json.JSONDecodeError:
            return self._json({"errore": "JSON non valido"}, 400)
        percorso = urllib.parse.urlparse(self.path).path
        try:
            return self._json(self.instrada(percorso, dati))
        except (ValueError, RuntimeError, FileNotFoundError) as e:
            return self._json({"errore": str(e)}, 400)

    def instrada(self, percorso, dati):
        if percorso == "/api/impostazioni":
            if str(dati.get("chiave_gemini", "")).startswith("••••"):
                dati.pop("chiave_gemini")
            scrivi_config(dati)
            return {"ok": True}
        if percorso == "/api/salva_file":
            cartella = percorso_sicuro(dati["cartella"], scrittura=True)
            cartella.mkdir(parents=True, exist_ok=True)
            nome = Path(dati["nome"]).name
            dest = cartella / nome
            b64 = dati["base64"].split(",", 1)[-1]
            dest.write_bytes(base64.b64decode(b64))
            if dati.get("anche_come"):
                shutil.copy2(dest, cartella / Path(dati["anche_come"]).name)
            return {"file": dest.relative_to(RADICE).as_posix()}
        if percorso == "/api/copia":
            da = percorso_sicuro(dati["da"])
            a = percorso_sicuro(dati["a"], scrittura=True)
            a.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(da, a)
            return {"file": a.relative_to(RADICE).as_posix()}
        if percorso == "/api/elimina":
            p = percorso_sicuro(dati["percorso"], scrittura=True)
            if p.is_file():
                p.unlink()
            return {"ok": True}
        if percorso == "/api/genera":
            return {"lavoro": nuovo_lavoro("Rigenero i pezzi", op_genera)}
        if percorso == "/api/pulisci":
            return {"lavoro": nuovo_lavoro("Pulizia " + dati["nome"], op_pulisci, dati)}
        if percorso == "/api/figure/config":
            salva_config_figura(dati)
            return {"ok": True}
        if percorso == "/api/dividi/proposta":
            return {"lavoro": nuovo_lavoro("Divisione " + str(dati.get("id")), op_dividi_proposta, dati)}
        if percorso == "/api/dividi/salva":
            return {"lavoro": nuovo_lavoro("Figure " + str(dati.get("id")), op_dividi_salva, dati)}
        if percorso == "/api/test_sagome":
            return {"lavoro": nuovo_lavoro("Test sagome", op_test_sagome)}
        if percorso == "/api/gemini":
            return {"lavoro": nuovo_lavoro("Gemini", op_gemini, dati)}
        if percorso == "/api/trellis/genera":
            return {"lavoro": nuovo_lavoro("TRELLIS " + dati["id"], op_trellis_genera, dati)}
        if percorso == "/api/trellis/installa":
            return {"lavoro": nuovo_lavoro("Installazione TRELLIS", op_trellis_installa, dati)}
        if percorso == "/api/trellis/avvia":
            cfg = leggi_config()
            if dati.get("precisione") in ("half", "full"):
                cfg = scrivi_config({"precisione_trellis": dati["precisione"]})
            bat = Path(cfg["cartella_trellis"]) / "brianboru_avvia.bat"
            if not bat.exists():
                raise RuntimeError("TRELLIS non è installato in " + cfg["cartella_trellis"])
            if trellis_attivo():
                return {"ok": True, "gia_attivo": True}
            subprocess.Popen(f'start "TRELLIS - Briano Borromeo" "{bat}" {cfg["precisione_trellis"]}',
                             shell=True, cwd=str(bat.parent))
            return {"ok": True}
        if percorso == "/api/trellis/interrompi":
            try:
                urllib.request.urlopen(urllib.request.Request(TRELLIS_URL + "/interrupt",
                                                              method="POST"), timeout=5)
            except Exception:
                pass
            return {"ok": True}
        if percorso == "/api/riavvia":
            termina(CODICE_RIAVVIO)
            return {"ok": True}
        if percorso == "/api/ferma":
            termina(0)
            return {"ok": True}
        if percorso == "/api/trellis/ferma":
            pid = pid_in_ascolto(7960)
            if not pid:
                return {"ok": True, "messaggio": "TRELLIS non era in esecuzione"}
            for p in pid:
                subprocess.run(["taskkill", "/T", "/F", "/PID", str(p)], capture_output=True)
            return {"ok": True, "messaggio": "TRELLIS fermato"}
        if percorso == "/api/blender":
            blender = trova_blender(leggi_config())
            if not blender:
                raise RuntimeError("Blender non trovato: indica il percorso di blender.exe nelle impostazioni")
            file = percorso_sicuro(dati["percorso"])
            espr = ("import bpy\n"
                    "bpy.ops.wm.read_factory_settings(use_empty=True)\n"
                    "try:\n"
                    f"    bpy.ops.import_scene.gltf(filepath=r'{file}', merge_vertices=True)\n"
                    "except TypeError:\n"
                    f"    bpy.ops.import_scene.gltf(filepath=r'{file}')\n")
            subprocess.Popen([blender, "--python-expr", espr])
            return {"ok": True}
        if percorso == "/api/gioco/copia":
            return {"lavoro": nuovo_lavoro("Copia nel gioco", op_gioco_copia)}
        if percorso == "/api/apri_cartella":
            p = percorso_sicuro(dati.get("percorso", "."))
            if WINDOWS:
                os.startfile(str(p))  # noqa: S606
            return {"ok": True}
        raise ValueError("comando sconosciuto: " + percorso)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--porta", type=int, default=8078)
    ap.add_argument("--apri", action="store_true")
    args = ap.parse_args()
    for c in SCRIVIBILI:
        (RADICE / c).mkdir(parents=True, exist_ok=True)
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.porta), Gestore)
    except OSError:
        print(f"La porta {args.porta} è occupata: il pannello è già aperto in un'altra finestra.")
        print("Chiudi quella finestra (o usa FERMA_PANNELLO.bat) e riprova.")
        sys.exit(1)
    print(f"Officina dei pezzi, versione {VERSIONE}")
    # all'avvio rigenera i pezzi: dopo un aggiornamento master, colorati e
    # visualizzatore tornano subito coerenti con i modelli definitivi
    nuovo_lavoro("Rigenero i pezzi all'avvio", op_genera)
    indirizzo = f"http://127.0.0.1:{args.porta}/pannello.html"
    print(f"Pannello attivo su {indirizzo}")
    print("Lascia aperta questa finestra mentre usi il pannello. Per chiudere: Ctrl+C.")
    if args.apri:
        threading.Timer(1.0, lambda: webbrowser.open(indirizzo)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
