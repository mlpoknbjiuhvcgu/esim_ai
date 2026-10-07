' 隱藏視窗啟動 autostart.bat
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\user\Documents\esim_ai"
WshShell.Run Chr(34) & "C:\Users\user\Documents\esim_ai\autostart.bat" & Chr(34), 0, False
