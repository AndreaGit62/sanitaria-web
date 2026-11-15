@echo off
setlocal
cd /d "%~dp0"
set "VISILAB_NODE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined VISILAB_NODE set "VISILAB_NODE=%%N"
if not defined VISILAB_NODE (
  for /d %%D in ("%ProgramFiles%\WindowsApps\OpenAI.CodexPrimaryRuntime*") do (
    if exist "%%D\dependencies\node\bin\node.exe" set "VISILAB_NODE=%%D\dependencies\node\bin\node.exe"
  )
)
if not defined VISILAB_NODE (
  echo Node.js non trovato. Installa Node.js 22 LTS o successivo.
  pause
  exit /b 1
)
if not exist "node_modules\next\dist\bin\next" (
  echo Dipendenze non trovate. Segui le istruzioni nel README.md.
  pause
  exit /b 1
)
echo VisiLab - agenda sanitaria
echo Apri http://localhost:3000 nel browser.
echo Per fermare l'app premi CTRL+C. Mantieni aperta questa finestra.
"%VISILAB_NODE%" node_modules\next\dist\bin\next dev --hostname 0.0.0.0
if errorlevel 1 pause
