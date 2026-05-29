# Multicloud Curator

Panel kontrol web untuk mengagregasi metadata file lintas akun Google Drive dan Dropbox. Visibilitas terpadu, pencarian terfederasi, deteksi duplikasi, file besar/usang, dan audit izin publik — tanpa membaca atau memindahkan konten file.

**Status:** Proof of Concept (Tugas Akhir Rifki Kaida — NIM 18220032).

## Tech Stack

- **Backend:** Python 3.10+, FastAPI, SQLAlchemy 2.x, Alembic, SQLite, Fernet
- **Frontend:** React 18, Vite, TypeScript (strict), Tailwind CSS 3, React Router 6
- **Auth:** OAuth 2.0 (Authorization Code) — Google Drive & Dropbox

## Setup (Fresh Clone)

### Prerequisites

- Python 3.10 atau lebih baru (`python --version`)
- Node.js 20 LTS atau lebih baru (`node --version`)
- Google Cloud OAuth Client (Web app) dengan redirect URI `http://localhost:8000/api/accounts/connect/callback`
- Dropbox App (Scoped access, Full Dropbox) dengan redirect URI yang sama

### Backend (Terminal 1)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt

# Generate Fernet key untuk token encryption
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Salin .env.example ke .env, lalu isi nilai real (lihat panduan di dalam file)
Copy-Item .env.example .env
notepad .env

# Apply migration (buat app.db + seed default keywords)
alembic upgrade head

# Run dev server
uvicorn app.main:app --reload --port 8000
```

Verify: buka `http://localhost:8000/api/health` → `{"data": {"status": "ok"}, "meta": {...}}`. Swagger UI tersedia di `http://localhost:8000/docs`.

### Frontend (Terminal 2)

```powershell
cd frontend
npm install
npm run dev
```

Verify: buka `http://localhost:5173/` → halaman menampilkan status backend (di-fetch via proxy `/api/health`).

```


