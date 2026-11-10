#!/usr/bin/env python3
"""
FAB · pezzi 3D — catalogo dei pezzi da modellare
================================================

Legge data/<volume>/units.json e raggruppa i blocchi per TIPO (volume, fazione,
classe): 211 blocchi diventano ~32 modelli, perché due fanteria tedesca della
stessa battaglia usano lo stesso modello. Scrive:

  catalogo.json   per gli script
  catalogo.js     per il pannello (si apre anche come file)

Il testo "soggetto" (in inglese, è il prompt) si cambia qui sotto, poi si
rilancia:  python catalogo.py        (il pannello lo fa da solo all'avvio)
Uno stesso tipo si può rifinire per singolo blocco più avanti (es. Peiper):
per ora no, vedi docs/ASSETS-3D.md.
"""

import json
from collections import OrderedDict
from pathlib import Path

QUI = Path(__file__).resolve().parent
KIT = QUI.parent
REPO = QUI.parents[2]

# legno dei blocchi nel gioco (web/src/art.ts, golan-art.ts, sicily-art.ts): non cambiarlo qui senza cambiarlo là
LEGNO = {"german": "#8e9296", "us": "#5d8a45", "british": "#3f6fb8",
         "israeli": "#2ea1d5", "syrian": "#2a7f42", "italian": "#e66525"}

VOLUMI = OrderedDict(bulge="The Bulge (Ardennes, Dec 1944)", golan73="Golan '73 (Oct 1973)",
                     sicily="Sicily '43 (Jul 1943)")

NOME_FAZIONE = {"german": "German", "us": "US", "british": "British", "israeli": "Israeli", "syrian": "Syrian", "italian": "Italian"}
NOME_CLASSE = {"inf": "infantry", "armor": "armour", "mech": "mechanised", "airborne": "airborne", "cavalry": "cavalry", "mountain": "mountain",
               "recon": "recon", "garrison": "garrison", "ghost": "decoy", "motorized_inf": "motorised infantry", "mountain_inf": "Alpini"}

# classe del blocco -> nome corto e composizione (quanti pezzi stanno sulla base)
GRUPPO = {"inf": "a squad of three", "armor": "two tanks, one behind the other", "mech": "one armoured half-track with two infantrymen walking beside it",
          "airborne": "a squad of three", "cavalry": "two light vehicles, one behind the other", "mountain": "a squad of three",
          "recon": "two armoured cars, one behind the other", "garrison": "a squad of three", "ghost": "one dummy tank",
          "motorized_inf": "one truck with two infantrymen beside it", "mountain_inf": "a squad of three"}

# (volume, fazione, classe) -> soggetto del prompt: equipaggiamento reale dell'epoca
S = {
    ("bulge", "german", "inf"): "Volksgrenadiers, Germany, December 1944: M43 field caps or steel helmets with snow capes, field-grey greatcoats, Kar98k rifles, one with a Panzerfaust",
    ("bulge", "german", "armor"): "Panther Ausf. G tanks, Germany, December 1944: dark-yellow ambush camouflage with green stripes, long 75 mm gun, balkenkreuz on the turret side",
    ("bulge", "german", "mech"): "Panzergrenadiers, Germany, December 1944, with an Sd.Kfz. 251 half-track: field-grey uniforms and helmets, MP40 and StG44",
    ("bulge", "german", "airborne"): "Fallschirmjager, Germany, December 1944: splinter-camouflage smocks, rounded paratrooper helmets, StG44 rifles",
    ("bulge", "german", "mountain"): "Gebirgsjager, Germany, December 1944: field caps with edelweiss, mountain anoraks, rucksacks, Kar98k rifles",
    ("bulge", "us", "inf"): "US Army GIs, December 1944: M1 steel helmets, olive-drab wool overcoats, M1 Garand rifles, canvas gaiters, winter snow",
    ("bulge", "us", "armor"): "M4A3 Sherman tanks, US Army, December 1944: olive-drab, white star on the hull, short 75 mm gun, stowage on the back deck",
    ("bulge", "us", "airborne"): "US 101st Airborne paratroopers, December 1944: M1 helmets with netting, jump jackets with big pockets, M1 carbines, bandoliers",
    ("bulge", "us", "cavalry"): "an M8 Greyhound armoured car and an M5 Stuart light tank, US cavalry reconnaissance, December 1944: olive drab with white stars",
    ("bulge", "british", "inf"): "British Tommies, December 1944: Mk II Brodie helmets, khaki battledress, Lee-Enfield rifles, webbing",
    ("bulge", "british", "armor"): "Sherman Firefly tanks, British Army, December 1944: olive-drab, long 17-pounder gun, Allied star",
    ("golan73", "israeli", "inf"): "Israeli IDF infantry, October 1973: olive-green fatigues, M1 steel helmets, Uzi and FN FAL rifles, canvas webbing",
    ("golan73", "israeli", "armor"): "Centurion (Sho't) tanks, Israel, October 1973: sand-yellow paint, 105 mm gun, rear stowage bins, Star of David on the hull",
    ("golan73", "israeli", "mech"): "IDF mechanised infantry, October 1973: an M3 half-track with a pintle machine gun, infantrymen in olive fatigues and steel helmets beside it",
    ("golan73", "israeli", "airborne"): "IDF paratroopers, October 1973: red boots, red berets, olive fatigues, Uzi submachine guns, rucksacks",
    ("golan73", "israeli", "ghost"): "a decoy tank, Israel 1973: an inflatable or plywood dummy Centurion with a thin transparent ghostly look",
    ("golan73", "syrian", "inf"): "Syrian Army infantry, October 1973: olive-brown fatigues, steel helmets, AK-47 rifles, RPG-7 launcher",
    ("golan73", "syrian", "armor"): "T-55 tanks, Syria, October 1973: dark olive-green, rounded cast turret, 100 mm gun, extra fuel drums on the rear deck",
    ("golan73", "syrian", "mech"): "Syrian mechanised infantry, October 1973: a BMP-1 armoured vehicle, infantrymen in olive fatigues beside it",
    ("golan73", "syrian", "airborne"): "Syrian commando paratroopers, October 1973: camouflage uniforms, red berets, AK-47 rifles, light packs",
    ("golan73", "syrian", "recon"): "BRDM-2 amphibious armoured cars, Syria, October 1973: olive green, small turret with a machine gun",
    ("sicily", "us", "inf"): "US Army GIs, Sicily July 1943: M1 steel helmets, khaki-olive field uniforms, M1 Garand rifles, canvas leggings",
    ("sicily", "us", "armor"): "M4 Sherman tanks, US Army, Sicily 1943: olive drab, white star, short 75 mm gun, desert dust",
    ("sicily", "us", "airborne"): "US 82nd Airborne paratroopers, Sicily 1943: M1942 jump jackets with large pockets, M1 helmets, M1 carbines",
    ("sicily", "british", "inf"): "British Eighth Army infantry, Sicily 1943: khaki drill shorts and shirts, Mk II Brodie helmets, Lee-Enfield rifles",
    ("sicily", "british", "armor"): "Sherman and Churchill tanks, British Army, Sicily 1943: sand-khaki paint, 75 mm gun, Allied star",
    ("sicily", "british", "airborne"): "British 1st Airborne paratroopers, Sicily 1943: red berets, Denison smocks, Sten guns",
    ("sicily", "german", "mech"): "Hermann Goring Division panzergrenadiers, Sicily 1943, with a Panzer IV tank: sand-yellow paint, tropical uniforms, steel helmets",
    ("sicily", "italian", "inf"): "Italian Royal Army infantry, Sicily 1943: grey-green uniforms, M33 steel helmets, Carcano rifles",
    ("sicily", "italian", "garrison"): "Italian coastal-defence troops, Sicily 1943: grey-green uniforms, M33 helmets, leggings, a machine gun on a tripod",
    ("sicily", "italian", "motorized_inf"): "Italian motorised infantry, Sicily 1943: a Fiat truck, soldiers in grey-green uniforms and M33 helmets beside it",
    ("sicily", "italian", "mountain_inf"): "Italian Alpini mountain troops, Sicily 1943: feathered Alpini hats, grey-green wool uniforms, rucksacks, Carcano rifles",
}

# altezza massima della figura, in unità di tabellone (il blocco è alto 1,6); i veicoli sono più bassi
ALTEZZA = {"armor": 0.55, "mech": 0.6, "cavalry": 0.45, "recon": 0.45, "motorized_inf": 0.6, "ghost": 0.55}
ALTEZZA_FANTE = 0.8
TRIANGOLI = 800

# il pezzo "nascosto": sostituisce ogni blocco che il giocatore non può vedere (il retro del blocco).
# Uno solo per tutti: il telo è in verde acqua segnaposto e diventa colore_fazione, così il gioco lo tinge
# col legno della fazione (grigio tedesco, verde US, arancio italiano...).
TINTA = "#16A6A0"
NASCOSTO = {"id": "hidden", "volume": "tutti", "volume_nome": "Tutti i volumi", "fazione": "tutte", "classe": "hidden",
            "legno": "#8e9296", "nome": "Hidden unit", "gruppo": "one anonymous covered load",
            "soggetto": "a military canvas tarpaulin draped over an unidentifiable low pile of crates and equipment, tied down with ropes, "
                        "nothing recognisable underneath, no weapons showing. The tarpaulin is solid teal (#16A6A0), the ropes dark brown",
            "altezza": 0.6, "triangoli": 400, "tinta": TINTA, "blocchi": []}


def tipo_di(vol, u):
    """Il simbolo NATO dice la classe (mech, airborne, cavalry...); cls è più grezzo."""
    classe = u.get("symbol") or u.get("cls") or u.get("kind")
    return u.get("nation") or u["side"], {"infantry": "inf"}.get(classe, classe)


def costruisci():
    tipi = OrderedDict()
    saltati = []
    for vol in VOLUMI:
        L = json.loads((REPO / "data" / vol / "units.json").read_text(encoding="utf-8"))
        L = L if isinstance(L, list) else L["units"]
        for u in L:
            if "special_action_block" in (u.get("cls"), u.get("kind")) or not (u.get("symbol") or u.get("cls") or u.get("kind")):
                saltati.append(u["id"])
                continue
            fazione, classe = tipo_di(vol, u)
            chiave = (vol, fazione, classe)
            if chiave not in S:
                raise SystemExit(f"manca il soggetto per {chiave} (blocco {u['id']} {u.get('name')}): aggiungilo in catalogo.py")
            t = tipi.setdefault(chiave, {
                "id": f"{vol}_{fazione}_{classe}", "volume": vol, "volume_nome": VOLUMI[vol], "fazione": fazione,
                "classe": classe, "legno": LEGNO[fazione], "nome": f"{NOME_FAZIONE[fazione]} {NOME_CLASSE[classe]}",
                "gruppo": GRUPPO[classe], "soggetto": S[chiave], "altezza": ALTEZZA.get(classe, ALTEZZA_FANTE),
                "triangoli": TRIANGOLI, "blocchi": []})
            t["blocchi"].append(u["id"])
    return list(tipi.values()) + [NASCOSTO], saltati


def main():
    if not (REPO / "data").is_dir():   # kit scaricato da solo, fuori dal repository: si usa il catalogo già pronto
        print("catalogo: dati del gioco non trovati, uso catalogo.json così com'è")
        return
    tipi, saltati = costruisci()
    (KIT / "catalogo.json").write_text(json.dumps({"tipi": tipi, "senza_modello": saltati}, indent=1, ensure_ascii=False), encoding="utf-8")
    (KIT / "catalogo.js").write_text("const CATALOGO = " + json.dumps(tipi, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"{len(tipi)} tipi di pezzo per {sum(len(t['blocchi']) for t in tipi)} blocchi (senza modello: {len(saltati)} blocchi Special Action)")


if __name__ == "__main__":
    main()
