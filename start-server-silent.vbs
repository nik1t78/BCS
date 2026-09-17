Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d D:\BCS && serve -s dist -l 3000", 0, False
Set WshShell = Nothing
