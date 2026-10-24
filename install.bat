@echo off
setlocal
rem Aakash Dashboard installer wrapper for Windows.
rem Usage: install.bat [options]   (passes options to install.ps1)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
endlocal
