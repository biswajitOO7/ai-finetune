@echo off
echo Setting up Python environment...

if not exist venv (
    python -m venv venv
    echo Virtual environment created.
) else (
    echo Virtual environment already exists.
)

echo Installing Python dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt

echo Starting Node.js server...
node server.js
