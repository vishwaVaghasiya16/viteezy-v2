@echo off
cd /d D:\Harsh\Client\viteezy-v2
call venv\Scripts\activate.bat
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause

