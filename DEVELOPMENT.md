# MilkFlow — Local Development & Contributor Guide 🛠️

This guide contains everything you need to run, test, and develop **MilkFlow** locally on your workstation.

---

## 🏗️ Architecture Overview

MilkFlow is structured as a decoupled monorepo:

```
milk app/
├── backend/                  # Python 3.10+ FastAPI REST API
│   ├── app/
│   │   ├── api/              # API Route Handlers (auth, deliveries, bills, customers, etc.)
│   │   ├── core/             # Database connection, security, config settings
│   │   ├── models/           # SQLAlchemy 2.0 ORM Models
│   │   ├── schemas/          # Pydantic v2 Request/Response validation
│   │   └── services/         # Billing engine, PDF generator, delivery recorder
│   ├── tests/                # Automated pytest test suites
│   ├── requirements.txt      # Python dependencies
│   └── seed_data.py          # Realistic 60-day demo dataset generator
├── frontend/                 # React 18 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/       # Reusable UI components (Modals, Navbars, Layout)
│   │   ├── pages/            # Core views (Dashboard, DriverPortal, Bills, etc.)
│   │   ├── services/         # API client & offline storage sync
│   │   └── types/            # TypeScript interfaces
│   ├── package.json          # Node dependencies
│   └── vite.config.ts        # Vite configuration & dev proxy
├── DEVELOPMENT.md            # You are here! Local development instructions
├── PRODUCTION_ROADMAP.md     # Production deployment blueprint & cloud SaaS roadmap
└── README.md                 # Project executive summary
```

---

## ⚡ Quick Start: Running Locally

### 1. Prerequisites
- **Python**: 3.10, 3.11, 3.12, or 3.14
- **Node.js**: v18+ and `npm`

---

### 2. Backend Setup & Run

Open a terminal in `backend/`:

```powershell
cd "d:\milk app\backend"

# 1. Create a virtual environment (first time only)
python -m venv venv

# 2. Activate virtual environment
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux / macOS:
# source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run automated test suite
pytest -v

# 5. Populate database with realistic demo data (18 customers, 60 days of records)
python -m app.seed_data

# 6. Start the FastAPI development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

> 🌐 **Backend API:** Available at `http://127.0.0.1:8000`  
> 📖 **Interactive Swagger Docs:** `http://127.0.0.1:8000/docs`

---

### 3. Frontend Setup & Run

Open a second terminal in `frontend/`:

```powershell
cd "d:\milk app\frontend"

# 1. Install dependencies
npm install

# 2. Start Vite dev server with Hot Module Replacement (HMR)
npm run dev
```

> 🚀 **Frontend Web App:** Available at `http://127.0.0.1:5173`

---

## 🔑 Demo Login Accounts

The database seed provides two pre-configured accounts:

| Role | Email | Password | Primary Purpose |
|---|---|---|---|
| **Dairy Owner / Admin** | `admin@milkflow.com` | `password123` | Full control over billing, pricing, customers, financial analytics, and delivery routes. |
| **Delivery Executive / Rider** | `worker@milkflow.com` | `worker123` | Mobile-first **Delivery Run Portal** (`/driver`) with single-tap stop completion and navigation. |

*(The login screen also features 1-click quick login buttons for both accounts).*

---

## 🧪 Testing Guidelines

### Backend Automated Tests
All billing calculations, historical price brackets, skip logic, and delivery notifications are verified via Pytest:

```powershell
cd backend
.\venv\Scripts\pytest -v
```

Test coverage includes:
- `test_single_day_billing`: Verifies daily rate multiplication.
- `test_multiple_days_billing`: Verifies month-long delivery rollups.
- `test_skipped_deliveries_excluded`: Verifies paused or skipped stops are omitted from bills.
- `test_historical_rate_changes`: Confirms rate changes mid-month produce itemized rate brackets.
- `test_previous_balance_and_partial_payments`: Confirms accurate ledger carryover.
- `test_delivery_correction_audit_log`: Confirms corrections create immutable audit trails.
- `test_record_single_delivery_delivered`: Tests single-tap driver logging.
- `test_delivery_notifications_unread_and_mark_read`: Tests real-time owner alert feed.

### Frontend Typecheck & Build
```powershell
cd frontend
npm run build
```

---

## 🔄 Resetting Local Test Data

To wipe and re-generate a clean database state:

```powershell
cd backend
Remove-Item "milkflow.db" -ErrorAction SilentlyContinue
python -m app.seed_data
```

---

## 📱 Mobile Device Testing on Local Network

To preview the app on your physical iPhone, iPad, or Android phone connected to the same Wi-Fi:
1. Find your computer's local IP address (e.g., `192.168.1.15`).
2. Run backend with `--host 0.0.0.0`:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
3. Run frontend with `--host`:
   ```bash
   npm run dev -- --host
   ```
4. Open `http://192.168.1.15:5173` in your mobile browser.
5. Tap **Share > Add to Home Screen** on iOS Safari or **Install app** on Android Chrome to test the PWA experience!
