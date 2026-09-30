' ARCHIPILOT.vbs — lance start.bat directement en mode caché (aucune fenêtre,
' pas même une brève apparition). Équivalent à double-cliquer sur start.bat,
' qui est lui-même silencieux par défaut désormais ; ce fichier reste fourni
' pour un lancement garanti sans le moindre flash de fenêtre.

Dim shell, fso, dossier
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dossier = fso.GetParentFolderName(WScript.ScriptFullName)

shell.Environment("PROCESS")("ARCHIPILOT_RELANCE") = "1"
shell.CurrentDirectory = dossier
shell.Run """" & dossier & "\start.bat""", 0, False
