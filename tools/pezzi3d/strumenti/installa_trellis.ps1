<#
  Briano Borromeo 2077 - installazione automatica di TRELLIS (image-to-3D in locale)
  ================================================================================

  Usa il pacchetto Windows "trellis-stable-projectorz" di Igor Aherne
  (Python portatile incluso, modalita' fp16 per schede con poca memoria, API locale)
  e lo adatta alle GPU della serie GTX 10 (Pascal, come la GTX 1080 Ti):

    - il pacchetto installa PyTorch 2.7.0 per CUDA 12.8, che NON contiene piu' il
      codice per le GPU Pascal; lo script lo sostituisce con PyTorch 2.7.0 per
      CUDA 12.6, che le supporta ancora
    - installa il Visual C++ Redistributable e (per le GTX 10) il CUDA Toolkit 12.8,
      come richiesto dall'autore del pacchetto per le schede piu' vecchie
    - fa un test della GPU alla fine e scrive l'esito

  Lancialo dal pannello (scheda Installazione) oppure a mano:
    powershell -ExecutionPolicy Bypass -File installa_trellis.ps1 -Destinazione C:\BrianboruAI\trellis

  Spazio necessario: circa 25 GB. Tempo: 20-60 minuti, a seconda della connessione.
#>

param(
    [string]$Destinazione = "C:\BrianboruAI\trellis",
    [switch]$SaltaCudaToolkit,
    [switch]$Reinstalla
)

# "Continue": in Windows PowerShell 5 con "Stop" basta un avviso di pip per
# interrompere tutto. Gli errori veri vengono controllati uno per uno.
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$RepoApi   = "https://api.github.com/repos/IgorAherne/trellis-stable-projectorz/releases/tags/latest"
$ZipRiserva = "https://github.com/IgorAherne/trellis-stable-projectorz/releases/download/latest/NEW_v40_py311_trellis_stableprojectorz.zip"
$CudaUrl   = "https://developer.download.nvidia.com/compute/cuda/12.8.0/network_installers/cuda_12.8.0_windows_network.exe"
$CudaPacchetti = "cudart_12.8 nvcc_12.8 nvrtc_12.8 nvrtc_dev_12.8 cublas_12.8 cublas_dev_12.8 curand_12.8 curand_dev_12.8 cusparse_12.8 cusparse_dev_12.8 cusolver_12.8 cusolver_dev_12.8 cufft_12.8 cufft_dev_12.8 thrust_12.8"
$VcUrl     = "https://aka.ms/vs/17/release/vc_redist.x64.exe"

function Passo($testo) { Write-Output ""; Write-Output "=== $testo" }
function Info($testo)  { Write-Output "    $testo" }
function Fine($testo)  { Write-Output ""; Write-Output "ERRORE: $testo"; exit 1 }

function Scarica($url, $file) {
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        & curl.exe -L --fail -sS -o $file $url
        if ($LASTEXITCODE -ne 0) { throw "download fallito: $url" }
    } else {
        Invoke-WebRequest -Uri $url -OutFile $file -UseBasicParsing -ErrorAction Stop
    }
}

# --------------------------------------------------------------------------
Passo "1/8 Controllo della scheda video"
$smi = Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue
if (-not $smi) { Fine "nvidia-smi non trovato: serve una scheda NVIDIA con i driver installati." }
$riga = (& nvidia-smi.exe --query-gpu=name,compute_cap,driver_version,memory.total --format=csv,noheader | Select-Object -First 1)
$campi = $riga.Split(",") | ForEach-Object { $_.Trim() }
$gpu, $cc, $driver, $memoria = $campi[0], [double]$campi[1], $campi[2], $campi[3]
Info "GPU: $gpu  |  compute capability $cc  |  driver $driver  |  memoria $memoria"
$pascal = $cc -lt 7.0
if ($cc -lt 6.0) { Fine "questa GPU e' troppo vecchia per TRELLIS (serve almeno una GTX 10)." }
if ($pascal) { Info "GPU della serie GTX 10 (Pascal): applico le correzioni necessarie." }
$driverMaggiore = [int]($driver.Split(".")[0])
if ($driverMaggiore -lt 527) { Fine "driver NVIDIA troppo vecchio ($driver): aggiornalo da nvidia.com e riprova." }

# --------------------------------------------------------------------------
Passo "2/8 Controllo della cartella e dello spazio su disco"
if ($Destinazione -match "\s") { Fine "il percorso non deve contenere spazi: $Destinazione" }
try { New-Item -ItemType Directory -Force -Path $Destinazione -ErrorAction Stop | Out-Null }
catch { Fine "non riesco a creare la cartella $Destinazione" }
$disco = (Get-Item $Destinazione).PSDrive
$liberiGB = [math]::Round($disco.Free / 1GB, 1)
Info "Cartella: $Destinazione  |  spazio libero: $liberiGB GB"
if ($liberiGB -lt 25) { Fine "servono almeno 25 GB liberi sul disco $($disco.Name):" }

# --------------------------------------------------------------------------
Passo "3/8 Visual C++ Redistributable"
$vc = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" -ErrorAction SilentlyContinue
if ($vc -and $vc.Installed -eq 1) {
    Info "gia' installato (versione $($vc.Version))"
} else {
    $vcExe = Join-Path $env:TEMP "vc_redist.x64.exe"
    Info "scarico e installo (Windows chiedera' il permesso di amministratore)"
    try {
        Scarica $VcUrl $vcExe
        $p = Start-Process -FilePath $vcExe -ArgumentList "/install /quiet /norestart" -Verb RunAs -Wait -PassThru -ErrorAction Stop
        Info "fatto (codice $($p.ExitCode))"
    } catch { Info "ATTENZIONE: Visual C++ non installato: $($_.Exception.Message)" }
}

# --------------------------------------------------------------------------
Passo "4/8 CUDA Toolkit 12.8 (solo per GTX 10)"
$cudaDir = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.8"
if (-not $pascal) {
    Info "non serve per questa GPU"
} elseif ($SaltaCudaToolkit) {
    Info "saltato su richiesta"
} elseif (Test-Path (Join-Path $cudaDir "bin\nvcc.exe")) {
    Info "gia' installato in $cudaDir"
} else {
    $cudaExe = Join-Path $env:TEMP "cuda_12.8.0_windows_network.exe"
    Info "scarico l'installer di rete NVIDIA"
    try {
        Scarica $CudaUrl $cudaExe
        Info "installo solo i componenti del toolkit, NON il driver (Windows chiedera' il permesso)"
        $p = Start-Process -FilePath $cudaExe -ArgumentList "-s $CudaPacchetti" -Verb RunAs -Wait -PassThru -ErrorAction Stop
        Info "installer terminato (codice $($p.ExitCode))"
    } catch {
        Info "ATTENZIONE: installazione del CUDA Toolkit non riuscita: $($_.Exception.Message)"
        Info "Se il test finale fallisce, installalo a mano da developer.nvidia.com/cuda-12-8-0-download-archive"
    }
}

# --------------------------------------------------------------------------
Passo "5/8 Download del pacchetto TRELLIS per Windows"
$runBat = Join-Path $Destinazione "run.bat"
if ((Test-Path $runBat) -and -not $Reinstalla) {
    Info "gia' presente in $Destinazione"
} else {
    $url = $ZipRiserva
    try {
        $rel = Invoke-RestMethod -Uri $RepoApi -Headers @{ "User-Agent" = "brianboru" } -ErrorAction Stop
        $asset = $rel.assets | Where-Object { $_.name -like "*trellis_stableprojectorz.zip" -and $_.name -notlike "OLD_*" } | Select-Object -First 1
        if ($asset) { $url = $asset.browser_download_url }
    } catch { Info "API GitHub non raggiungibile, uso il link di riserva" }
    Info "scarico $url"
    Info "(circa 330 MB, attendi)"
    $zip = Join-Path $env:TEMP "trellis_stableprojectorz.zip"
    try { Scarica $url $zip } catch { Fine "download del pacchetto non riuscito: $($_.Exception.Message)" }
    Info "estraggo in $Destinazione"
    & tar.exe -xf $zip -C $Destinazione
    if ($LASTEXITCODE -ne 0) { Expand-Archive -Path $zip -DestinationPath $Destinazione -Force }
    Remove-Item $zip -ErrorAction SilentlyContinue
    if (-not (Test-Path $runBat)) {
        $sotto = Get-ChildItem $Destinazione -Directory | Where-Object { Test-Path (Join-Path $_.FullName "run.bat") } | Select-Object -First 1
        if ($sotto) {
            Get-ChildItem $sotto.FullName -Force | Move-Item -Destination $Destinazione -Force
            Remove-Item $sotto.FullName -Recurse -Force
        }
    }
    if (-not (Test-Path $runBat)) { Fine "il pacchetto scaricato non ha la struttura attesa (manca run.bat)." }
}

# --------------------------------------------------------------------------
Passo "6/8 Adattamento per la tua GPU"
$installPy = Join-Path $Destinazione "code\install.py"
$testo = [IO.File]::ReadAllText($installPy)
if ($pascal) {
    $nuovo = $testo -replace "download\.pytorch\.org/whl/cu128", "download.pytorch.org/whl/cu126"
    if ($nuovo -ne $testo) {
        [IO.File]::WriteAllText($installPy, $nuovo, (New-Object System.Text.UTF8Encoding($false)))
        Info "PyTorch verra' installato per CUDA 12.6 (supporta le GTX 10)"
    } else {
        Info "install.py gia' adattato o con formato diverso: nessuna modifica"
    }
} else {
    Info "nessuna modifica necessaria"
}

# script di supporto usati dal pannello
$installaBat = @"
@echo off
call "%~dp0environment.bat"
cd /d "%~dp0code"
%PYTHON% -m pip install --upgrade pip
%PYTHON% install.py
if errorlevel 1 exit /b 1
echo initComplete > trellis_init_done.txt
"@
$testBat = @"
@echo off
call "%~dp0environment.bat"
cd /d "%~dp0code"
%PYTHON% brianboru_test.py
"@
$avviaBat = @"
@echo off
title TRELLIS - Briano Borromeo 2077
echo Non cliccare dentro questa finestra: Windows mette in pausa il programma.
echo Se succede, clicca nella finestra e premi Invio.
cd /d "%~dp0"
set PREC=%1
if "%PREC%"=="" set PREC=half
call run.bat --precision %PREC%
"@
$testPy = @"
import sys
import torch
print('PyTorch', torch.__version__, '| CUDA', torch.version.cuda)
assert torch.cuda.is_available(), 'CUDA non disponibile'
print('GPU', torch.cuda.get_device_name(0), 'capability', torch.cuda.get_device_capability(0))
print('Architetture supportate da PyTorch:', torch.cuda.get_arch_list())
x = torch.randn(512, 512, device='cuda'); (x @ x).sum().item()
h = x.half(); (h @ h).sum().item()
print('calcolo su GPU: ok')
import xformers.ops
q = torch.randn(1, 64, 4, 32, device='cuda', dtype=torch.float16)
xformers.ops.memory_efficient_attention(q, q, q)
print('xformers: ok')
import spconv.pytorch
print('spconv: ok')
import nvdiffrast.torch as dr
dr.RasterizeCudaContext()
print('nvdiffrast: ok')
import diff_gaussian_rasterization
print('diff_gaussian_rasterization: ok')
print('TEST_OK')
"@
$ascii = New-Object System.Text.ASCIIEncoding
[IO.File]::WriteAllText((Join-Path $Destinazione "brianboru_installa.bat"), $installaBat, $ascii)
[IO.File]::WriteAllText((Join-Path $Destinazione "brianboru_test.bat"), $testBat, $ascii)
[IO.File]::WriteAllText((Join-Path $Destinazione "brianboru_avvia.bat"), $avviaBat, $ascii)
[IO.File]::WriteAllText((Join-Path $Destinazione "code\brianboru_test.py"), $testPy, $ascii)
Info "creati brianboru_installa.bat, brianboru_test.bat, brianboru_avvia.bat"

# --------------------------------------------------------------------------
Passo "7/8 Installazione delle librerie Python (la parte lunga)"
$flag = Join-Path $Destinazione "code\trellis_init_done.txt"
if ((Test-Path $flag) -and -not $Reinstalla) {
    Info "gia' fatta in precedenza"
} else {
    if ($Reinstalla) {
        Remove-Item $flag -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $Destinazione "code\venv") -Recurse -Force -ErrorAction SilentlyContinue
    }
    # il percorso non contiene spazi (controllato al passo 2), quindi niente virgolette
    $bat = Join-Path $Destinazione 'brianboru_installa.bat'
    & cmd.exe /c "$bat 2>&1" | ForEach-Object { Write-Output "    $_" }
    if (-not (Test-Path $flag)) { Fine "installazione delle librerie non riuscita: guarda le righe sopra." }
    Info "librerie installate"
}

# --------------------------------------------------------------------------
Passo "8/8 Test della GPU"
$bat = Join-Path $Destinazione 'brianboru_test.bat'
$esito = & cmd.exe /c "$bat 2>&1" | ForEach-Object { Write-Host "    $_"; $_ }
if (($esito | Out-String) -match "TEST_OK") {
    Write-Output ""
    Write-Output "INSTALLAZIONE COMPLETATA. Ora dal pannello premi 'Avvia TRELLIS'."
    Write-Output "Al primo avvio TRELLIS scarica i suoi modelli (alcuni GB): ci vuole un po'."
} else {
    Fine "il test della GPU non e' passato. Copia le righe sopra se chiedi aiuto. Puoi comunque usare Meshy."
}
