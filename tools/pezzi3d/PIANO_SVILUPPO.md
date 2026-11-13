# FAB · officina dei pezzi 3D

Kit adattato da quello di Briano Borromeo 2077: stesso pannello nel browser (prompt → concept 2D → viste → modello 3D con TRELLIS o Meshy → pulizia → gioco), ma i pezzi sono i **32 tipi di blocco** più il pezzo **nascosto** (il telo che copre le unità che non vedi, tinto col legno della fazione) di The Bulge, Golan '73 e Sicily '43. Il piano del progetto, le regole dei pezzi e le decisioni aperte sono in **`docs/ASSETS-3D.md`** del repository: leggi quello per primo.

## 1. Avvio rapido

1. Doppio clic su **`AVVIA_PANNELLO.bat`** (Windows; la prima volta installa Python e le librerie). Il pannello è su `http://127.0.0.1:8078` (la porta 8077 resta a Briano Borromeo, i due pannelli possono restare aperti insieme).
2. Scheda **Installazione**: TRELLIS e chiave Gemini sono gli stessi del kit di Briano Borromeo. Se TRELLIS è già installato in `C:\BrianboruAI\trellis`, il pannello lo trova da solo: non reinstallarlo.
3. Scheda **Produzione** (il modo veloce):
   - **Genera i concept mancanti**: la prima volta fa solo il pezzo di stile (The Bulge · US infantry);
   - nella galleria clicca l'immagine migliore: diventa il concept scelto (e, per il pezzo di stile, lo stile di tutti gli altri);
   - ripremi **Genera i concept mancanti** per gli altri 32 pezzi, poi scegli nella galleria;
   - accendi TRELLIS e premi **Viste, 3D e pulizia per tutti i pezzi scelti**: va da solo, pezzo dopo pezzo; «Ferma» e si riprende da dove eri;
   - guarda la scheda **Anteprima**; un pezzo che non va si apre dalla tabella e si rifà nella scheda **Pezzi**, passo per passo.
   Senza chiave Gemini: nella scheda Pezzi «Copia prompt», genera sul sito e trascina le immagini; poi la Produzione fa 3D e pulizia per tutti.
4. Su Linux/macOS: `python3 -m venv .venv && .venv/bin/pip install -r strumenti/requisiti.txt && .venv/bin/python strumenti/server_pannello.py`.

Il catalogo dei pezzi si rigenera da `data/*/units.json` a ogni avvio (`strumenti/catalogo.py`). I testi dei prompt (equipaggiamento reale di ogni tipo) si cambiano lì.

**Buchi (nella scheda «Orientamento»).** Sotto ogni figura: «● N bordi aperti» e linee **rosse** sulla figura = buchi nella mesh (il gioco usa materiali a una faccia, quindi dai buchi si vede il terreno). «Chiudi i buchi di questo tipo» o «…di tutto il volume» li chiude con un clic (`strumenti/ripara_figura.py`: un vertice al centro di ogni buco e un triangolo per bordo, texture conservata); l'originale resta in `modelli/figure_originali/`. Lo stesso clic **pulisce anche la texture**: la texture è un mosaico di isolette su sfondo nero senza margine, e il GPU mescola i bordi con quel nero (le righe scure sulla figura); lo script ingrandisce la texture a 512 px e riempie il nero col colore dell'isoletta più vicina. Dopo aver chiuso, ricontrolla l'aspetto: un buco molto grande o concavo viene chiuso a ventaglio e può uscire un po' dalla forma (in quel caso rigenera la figura). Il gioco disegna comunque le figure a due facce, quindi un buco rimasto mostra il retro e non il terreno.

**Orientamento (scheda «Orientamento»).** Per ogni tipo del gioco mostra le sue figure dall'alto con una **freccia gialla** (l'AVANTI del gioco) e una **croce rossa** (il punto d'appoggio). Per ogni figura: ↺ ↻ ruotano (90°, 180°, 5°), le frecce ← → ↑ ↓ spostano, «Centra» azzera lo spostamento; «Usa questa» sceglie quale variante usare nel gioco (le altre non vengono caricate). Si salva da solo in `<volume>_config.json` accanto alle figure (`web/public/pezzi` nel repository, `modelli/figure` fuori); il gioco lo legge subito, senza rigenerare niente. Il quadratino verde nell'elenco = tipo già controllato. Per mandarmi le scelte: il file `<volume>_config.json`.

**Dal modello al gioco.** Il gioco usa UNA figura per unità. Se un modello ne contiene più di una (i gruppi di The Bulge), nella scheda Pezzi apri il tipo e usa **5 · Dividi in figure**: parte da una proposta automatica, ogni figura ha un colore e il grigio scuro è scartato. «Parte intera» dà con un clic tutta la parte toccata (fucile, torretta, corpo) alla figura scelta; «Pennello» dipinge i triangoli (col pennello la vista si gira col tasto destro); «Annulla» torna indietro. Imposta i gradi per far guardare la figura in avanti e l'altezza reale, poi «Salva e crea le figure»: la divisione resta in `modelli/divisioni/` e le figure vanno in `web/public/pezzi/` del repository (fuori dal repository in `modelli/figure/`, da mandare).

## 2. Cartelle

```
tools/pezzi3d/
├── catalogo.json / catalogo.js    i 32 tipi (generati)
├── concept/                       immagini (esplorazione, scelti, viste_3d): NON nel repository
├── modelli/ai_grezzi/             uscite di TRELLIS/Meshy: NON nel repository
├── modelli/definitivi/<id>.glb    i pezzi puliti: SÌ nel repository
├── modelli/master, colorati       copie rigenerate a ogni avvio
└── impostazioni.json              chiave Gemini: mai nel repository
```

## 3. TRELLIS sulla GTX 1080 Ti

### Cosa usa

Il pacchetto Windows **trellis-stable-projectorz** di Igor Aherne: TRELLIS di Microsoft con Python portatile incluso, una modalità a mezza precisione pensata per schede da 8 GB e un’API locale su `127.0.0.1:7960`. Il pannello parla con quell’API.

### Il problema della tua scheda, e come l’installer lo risolve

Il pacchetto installa PyTorch 2.7.0 per **CUDA 12.8**. Le build di PyTorch per CUDA 12.8 non contengono più il codice per le schede con compute capability 6.1 (Pascal, cioè GTX 10): su una 1080 Ti TRELLIS non partirebbe. L’installer:

1. legge la GPU con `nvidia-smi`;
2. installa Visual C++ Redistributable e, per le GTX 10, i componenti del **CUDA Toolkit 12.8** (senza toccare il driver), come indicato dall’autore del pacchetto per le schede più vecchie;
3. scarica ed estrae il pacchetto;
4. modifica il suo `install.py` perché installi **PyTorch 2.7.0 per CUDA 12.6**, che supporta ancora le GTX 10;
5. installa tutte le librerie (la parte lunga);
6. esegue un **test della GPU**: calcolo in piena e mezza precisione, xformers, spconv, nvdiffrast, rasterizzatore gaussiano.

Ho controllato i binari inclusi nel pacchetto: le estensioni usate per generare mesh e texture (nvdiffrast, rasterizzatore gaussiano, spconv) contengono codice per la tua architettura. Due estensioni (kaolin e il renderer a octree) sono compilate solo per schede più recenti, ma la generazione usata dal pannello non le chiama. Non ho potuto provare su una 1080 Ti vera: per questo l’installer finisce con un test che dice chiaramente se funziona.

### Cosa aspettarsi

- **Memoria:** 11 GB bastano in modalità **half** (consigliata).
- **Velocità:** le GTX 10 sono molto lente nei calcoli a mezza precisione. Se una generazione «rapida» supera i 10 minuti, prova **full** (più veloce su queste schede, ma può esaurire la memoria).
- **Primo avvio:** TRELLIS scarica i suoi modelli, alcuni GB.
- **La finestra nera di TRELLIS** va lasciata aperta. Se ci clicchi dentro Windows la mette in pausa: clicca nella finestra e premi Invio.

### Se qualcosa non va

| Sintomo | Cosa fare |
|---|---|
| Il test finale non passa | Copia le ultime righe del log. Puoi rilanciare a mano con reinstallazione completa: `powershell -ExecutionPolicy Bypass -File strumenti\installa_trellis.ps1 -Destinazione C:\BrianboruAI\trellis -Reinstalla`. Intanto usa Meshy. |
| «no kernel image is available» | PyTorch non è quello per CUDA 12.6: rilancia con `-Reinstalla`. |
| Memoria esaurita (out of memory) | Usa **half**, chiudi giochi e browser pesanti, riavvia TRELLIS. |
| Il pannello dice «TRELLIS non è avviato» | Scheda Installazione → Avvia TRELLIS, aspetta che il chip in alto diventi verde. |
| Errore durante l’installazione delle librerie | Di solito è la rete: riprova «Installa / ripara». |

### Licenza

Il codice di TRELLIS è MIT, ma secondo l’autore del pacchetto alcuni moduli che usa hanno licenze solo per ricerca e valutazione. Per un uso commerciale dei modelli generati verifica prima le licenze; in alternativa usa Meshy con un piano adatto.

---

## 4. Gemini API

- Crea la chiave su `aistudio.google.com/apikey` e incollala nella scheda Installazione.
- Il modello predefinito è `gemini-3.1-flash-image-preview` (Nano Banana 2). Se Google cambia nome, scrivi quello nuovo nel campo «Modello».
- La generazione di immagini via API di solito è a pagamento, con un costo di pochi centesimi a immagine. Controlla prezzi e limiti nella console prima di generare in quantità.
- La chiave resta solo nel file `impostazioni.json` sul tuo PC. Non condividere quel file.

---

## 5. Meshy (alternativa a TRELLIS)

Nel riquadro B del passo «Modello 3D» trovi le impostazioni per ogni pezzo. In sintesi: **Model → Image to 3D → Smart Topology → Meshy T2**, Poly Count indicato (400 per le pedine; fino a 600 se il personaggio ha molti dettagli), Texture attiva, Image Enhancement e Pose disattivati, Download in formato GLB.

**Attenzione al piano gratuito:** sul piano Free si scaricano solo i modelli generati con **Meshy 5**, al massimo 10 al mese. I modelli Smart Topology, Meshy 6 e Meshy 7 si vedono ma non si scaricano. Le strade possibili:

- un mese di piano Pro (circa 20 dollari): download illimitati e licenza privata, e i modelli fatti in quel mese restano scaricabili anche dopo;
- Meshy 5 sul piano Free, se è ancora nel menu dei modelli: qualità inferiore, ma la pulizia la porta comunque al budget;
- TRELLIS sul tuo PC, gratis.

I modelli del piano Free hanno licenza CC BY 4.0, che richiede di citare Meshy nei crediti del gioco.

---

## 6. Blender (solo per ritocchi)

Il pulsante «Apri in Blender» apre il modello già importato. Operazioni utili:

| Operazione | Come si fa |
|---|---|
| Vedere i triangoli | `Overlays > Statistics` |
| Cucire vertici doppi | `Tab`, `A`, `Mesh > Clean Up > Merge by Distance` |
| Togliere frammenti | `Select > Select All by Trait > Loose Geometry`, poi `X` |
| Chiudere un buco | seleziona il bordo e premi `F` |
| Ingrandire l’elemento chiave | mouse su una sua faccia, `L`, poi `S` |
| Shading piatto | `Object > Shade Flat` |

Esportazione: `File > Export > glTF 2.0`, formato **glTF Binary**, **+Y Up** attivo, Apply Modifiers attivo, UVs disattivo, compressione disattivata. Salva sopra lo stesso file in `modelli/definitivi/` o `modelli/props/`, poi «Rigenera tutti i pezzi» nella scheda Anteprima. Non rinominare `colore_giocatore` e `neon_giocatore`.

---

## 7. Problemi comuni del pannello

| Sintomo | Cosa fare |
|---|---|
| La pagina dice «Pannello offline» | Il pannello è stato aperto come file: chiudilo e usa `AVVIA_PANNELLO.bat`. |
| `AVVIA_PANNELLO.bat` non trova Python e winget fallisce | Installa Python da python.org spuntando «Add python.exe to PATH», poi riprova. |
| Il browser non si apre | Apri a mano `http://127.0.0.1:8078`. |
| Un pulsante resta grigio | Passaci sopra con il mouse: il suggerimento dice cosa manca (chiave Gemini, TRELLIS spento, concept non scelto). |
| Gemini risponde con un errore | La consolle mostra il messaggio di Google: di solito chiave errata, credito esaurito o nome del modello cambiato. |

---

