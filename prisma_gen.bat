@echo off
cd /d "C:\Users\Dev\Desktop\AI projects\DataForge\dataforge-app"
echo Running from: %CD% >> C:\Users\Dev\Desktop\pg_log.txt 2>&1
node node_modules\prisma\build\index.js db push --accept-data-loss >> C:\Users\Dev\Desktop\pg_log.txt 2>&1
echo DB PUSH EXIT: %errorlevel% >> C:\Users\Dev\Desktop\pg_log.txt
node node_modules\prisma\build\index.js generate >> C:\Users\Dev\Desktop\pg_log.txt 2>&1
echo GENERATE EXIT: %errorlevel% >> C:\Users\Dev\Desktop\pg_log.txt
echo DONE >> C:\Users\Dev\Desktop\pg_log.txt
