@echo off
title Detener BurnNote
cd /d "%~dp0"
if exist .burnnote.pid (
    set /p PID=<.burnnote.pid
    taskkill /F /PID %PID% /T >nul 2>&1
    del .burnnote.pid >nul 2>&1
    echo BurnNote se ha detenido correctamente.
) else (
    echo BurnNote no estaba en ejecucion.
)
timeout /t 2 >nul
