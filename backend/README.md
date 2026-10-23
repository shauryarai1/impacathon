# Impactathon Backend

FastAPI backend skeleton for the Impactathon project.

## Requirements

- Python 3.10+
- pip

## Setup (Windows)

Open PowerShell in the `backend` folder and run:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

If PowerShell blocks script execution, run once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Run

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at http://localhost:8000.

- Health check: http://localhost:8000/api/health
- Interactive docs: http://localhost:8000/docs

## Adding endpoints

Create a new module under `app/api/routes/`, define an `APIRouter`, and register it in `app/api/router.py`.