@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or newer is required to run the local Studio server.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4173 in your browser after the server starts.
echo Press Ctrl+C to stop. AI is off unless a key and model are configured.
node scripts/start.mjs
pause
