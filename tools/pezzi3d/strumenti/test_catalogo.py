"""Controllo del catalogo: python test_catalogo.py (ogni blocco ha il suo pezzo, nessun tipo vuoto)."""
import json
import catalogo

tipi, saltati = catalogo.costruisci()
for vol in catalogo.VOLUMI:
    L = json.loads((catalogo.REPO / "data" / vol / "units.json").read_text(encoding="utf-8"))
    L = L if isinstance(L, list) else L["units"]
    ids = {u["id"] for u in L}
    usati = {b for t in tipi if t["volume"] == vol for b in t["blocchi"]} | (set(saltati) & ids)
    assert usati == ids, f"{vol}: blocchi senza pezzo {sorted(ids - usati)}"
assert len({t["id"] for t in tipi}) == len(tipi) and all(t["blocchi"] for t in tipi)
assert all(t["legno"] == catalogo.LEGNO[t["fazione"]] for t in tipi)
assert len(saltati) == 6          # i blocchi Special Action non hanno un modello
print(f"ok: {len(tipi)} tipi")
