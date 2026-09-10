Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = ScriptDir

' Kill any lingering old processes first (silent, ignore errors)
On Error Resume Next
WshShell.Run "cmd /c taskkill /f /im mshta.exe >nul 2>&1", 0, True
On Error GoTo 0

' 1. Show the splash screen (HTA window) — runs async, non-blocking
WshShell.Run "mshta.exe """ & ScriptDir & "\scripts\splash.hta""", 1, False

' 2. Start the BurnNote server + tunnel (silently, no console window)
WshShell.Run "node """ & ScriptDir & "\scripts\start-with-tunnel.js""", 0, False
