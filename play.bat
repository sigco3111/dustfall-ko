@echo off
rem Double-click to play Dustfall. Keep this window open while you play.
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run dev -- --open
