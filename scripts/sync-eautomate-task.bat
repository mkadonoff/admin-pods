@echo off
REM e-automate Sync Task
REM Runs every 15 minutes via Windows Task Scheduler

cd /d C:\src\admin-pods\api
call npm run sync:eautomate >> C:\src\admin-pods\logs\sync-eautomate.log 2>&1
