@echo off
REM Lance ARCHIPILOT en utilisant le Node.js portable embarque (aucune installation requise).
REM Double-cliquez simplement sur ce fichier pour demarrer l'application : il se relance
REM lui-meme sans fenetre visible (voir start-debug.bat pour deboguer avec une console).

if defined ARCHIPILOT_RELANCE goto :lancer
set ARCHIPILOT_RELANCE=1
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%~f0' -WorkingDirectory '%~dp0' -WindowStyle Hidden"
exit /b

:lancer
cd /d "%~dp0"
set NODE_EXE=%~dp0runtime\win\node.exe

REM Cree un raccourci sur le Bureau au tout premier lancement (ne fait rien si
REM le raccourci existe deja) : pointe vers ARCHIPILOT.vbs pour un demarrage
REM silencieux, avec l'icone de l'app. Le chemin du Bureau est resolu via
REM .NET (GetFolderPath) plutot que %USERPROFILE%\Desktop, qui est faux des
REM que le Bureau a ete redirige (OneDrive, lecteur different, etc.).
powershell -NoProfile -WindowStyle Hidden -Command "$bureau = [Environment]::GetFolderPath('Desktop'); $lnk = Join-Path $bureau 'ARCHIPILOT.lnk'; if (-not (Test-Path $lnk)) { $s = New-Object -ComObject WScript.Shell; $sc = $s.CreateShortcut($lnk); $sc.TargetPath = '%~dp0ARCHIPILOT.vbs'; $sc.WorkingDirectory = '%~dp0'; $sc.IconLocation = '%~dp0public\favicon.ico'; $sc.Description = 'Lancer ARCHIPILOT'; $sc.Save() } " >nul 2>&1

REM Si une instance precedente d'ARCHIPILOT tourne encore (fenetre fermee avec la croix
REM au lieu de Ctrl+C), elle reste occupee sur le port 5173 et le nouveau lancement
REM bascule sur 5174, 5175... ce qui ouvre plusieurs onglets. On la ferme d'abord.
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

if not exist "%NODE_EXE%" (
    if defined ARCHIPILOT_DEBUG (
        echo.
        echo [ERREUR] Le fichier runtime\win\node.exe est introuvable.
        echo Consultez le README.md pour savoir comment le telecharger et l'installer.
        echo.
        pause
    )
    exit /b 1
)

"%NODE_EXE%" "%~dp0server.js"

REM Le serveur s'arrete tout seul quand la fenetre ARCHIPILOT se ferme (voir server.js) :
REM rien a fermer manuellement. En mode debug (start-debug.bat), on garde la console
REM ouverte pour lire un eventuel message d'erreur.
if defined ARCHIPILOT_DEBUG (
    echo.
    echo Le serveur ARCHIPILOT s'est arrete.
    pause
)
