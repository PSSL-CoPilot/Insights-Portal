@echo off
REM Starts the dev server using the portable Node.js in .tools (no system install needed).
set "PATH=%~dp0.tools\node;%PATH%"
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run dev
