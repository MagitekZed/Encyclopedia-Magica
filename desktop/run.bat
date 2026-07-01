@echo off
REM Windows double-click launcher — runs the roller with the stock Python 3.
cd /d "%~dp0"
python roller.py %*
if errorlevel 1 pause
