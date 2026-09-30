@echo off
REM Variante de start.bat qui garde une fenetre de console visible, avec les
REM messages d'erreur affiches. A utiliser uniquement pour deboguer (ex: si
REM ARCHIPILOT ne se lance pas via start.bat).

set ARCHIPILOT_DEBUG=1
set ARCHIPILOT_RELANCE=1
call "%~dp0start.bat"
