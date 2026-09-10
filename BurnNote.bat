@echo off
title BurnNote Launcher
cls
echo ========================================================
echo               INICIANDO BURNNOTE
echo   Cifrado Zero-Knowledge con Tunel Publico Automatico
echo ========================================================
echo.
cd /d "%~dp0"
node scripts/start-with-tunnel.js
pause
