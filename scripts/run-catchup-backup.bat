@echo off
set "NODE_PATH=C:\Users\MINHTUYENLASER\Documents\Codex\tools\node-v24.16.0-win-x64\node.exe"
cd /d "E:\Product\7. Go CNC\PM\ok\gomita_quan_ly_cong_ty"
"%NODE_PATH%" scripts\check-catchup-backup.js >> scripts\backup.log 2>&1
