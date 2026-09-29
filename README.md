# MilkFlow — Dairy Operations & Billing Management System

**MilkFlow** is a modern, production-grade web application built specifically for local milk sellers and dairy businesses. Designed with a mobile-first philosophy, MilkFlow enables a milk seller to record a morning's deliveries in under two minutes with minimum taps, while providing backend-enforced monthly billing, ReportLab PDF invoices, 1-click WhatsApp bill sharing, payment reconciliation, and real-time business analytics.

---

## 🌟 Key Features

### 1. High-Speed Daily Delivery Engine
- **"Same as Yesterday"**: One-click bulk copy of yesterday's actual delivery quantities to today for non-paused customers.
- **Quick Quantity Chips**: Large, thumb-friendly tap targets (`0`, `0.5`, `1`, `1.5`, `2`, `2.5`, `3`, `+`, `-`, and manual decimal input).
- **Delivery Exceptions & Reasons**: Instant `✓ Delivered` or `✕ Skip` with categorized reasons (*Customer out of town*, *Surplus milk*, *Holiday*, etc.).
- **Pause Handling**: Automatic exclusion of paused customers from daily deliveries and billing.
- **Offline Delivery Mode**: LocalStorage cache and queued sync with duplicate conflict prevention.
- **Audited Corrections**: Editing past deliveries preserves an immutable audit log of who changed what, when, old/new quantities, and reason.

### 2. Reliable Backend Billing Service
- **Source of Truth**: Exact billing calculations computed strictly in the backend, not the frontend.
- **Formula**:
  $$\text{Bill Total} = \sum (\text{actual delivered qty} \times \text{applicable historical rate}) + \text{extra charges} - \text{discounts} + \text{previous balance} - \text{payments}$$
- **Historical Rate Integrity**: Delivery records store the locked-in rate applied at delivery time, guaranteeing that future price changes never mutate historical bills.
- **Itemized Rate Brackets**: Detailed item lines (e.g., *Sep 1–15: 15.0 L @ ₹58.00; Sep 16–30: 15.0 L @ ₹60.00*).

### 3. Invoices, Receipts & WhatsApp Sharing
- **Server-Side PDF Invoices**: Professional ReportLab invoices with dairy branding, UPI handle, itemized breakdown table, and INR balance due.
- **WhatsApp Bill Sharing**: Formats clean, polite WhatsApp messages with direct `https://wa.me/91...?text=...` launch links.
- **Payment Reminders**: One-tap payment reminder button on the dashboard for customers with outstanding dues.
- **Payment Receipts**: Instant modal receipts for Cash, UPI, and Bank Transfer collections.

### 4. Operations Dashboard & Analytics
- **Today's Section**: Active customers, delivered vs scheduled litres, expected value, pending entries, and skipped count.
- **Monthly KPIs**: Total volume sold, total revenue, collections, and net outstanding dues.
- **Recharts Analytics**: 14-day daily volume trends, 4-month revenue vs collection comparisons, and product breakdown pie charts.

### 5. Procurement & Profit Reconciliation
- **Daily Reconciliation**: Milk Purchased (L) vs Milk Sold (L) = Buffer/Remaining (L).
- **Estimated Daily Profit**: Revenue minus procurement cost and operating expenses (van fuel, packaging pouches, staff wages, electricity).

---

## 🏗️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide React, TanStack Query, Recharts, React Router v6 |
| **Backend** | Python 3.14, FastAPI, SQLAlchemy 2.0, Pydantic v2, ReportLab, PyJWT, Bcrypt |
| **Database** | SQLite (development/testing) / PostgreSQL (production) |
| **Testing** | Pytest automated test suite |

---

## 🚀 Quick Setup & Run Instructions

### Prerequisites
- Python 3.10+ (tested on Python 3.14)
- Node.js 18+ and npm

---

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run automated tests
pytest -v

# Seed realistic demo database (18 customers, 60 days of deliveries, bills, payments)
python -m app.seed_data

# Start FastAPI server (runs on http://127.0.0.1:8000)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

### 2. Frontend Setup

```bash
cd frontend

# Install npm packages
npm install

# Start Vite dev server (runs on http://127.0.0.1:5173)
npm run dev
```

---

## 🔑 Demo Credentials

| Role | Email | Password | Access |
|---|---|---|---|
| **Owner / Admin** | `admin@milkflow.com` | `password123` | Full access: Customers, Subscriptions, Pricing, Deliveries, Billing, Payments, Analytics, Settings |
| **Delivery Worker** | `worker@milkflow.com` | `worker123` | Route view, Daily delivery entry, Customer contact view |

> 💡 *The login page includes 1-click quick login buttons for both roles.*

---

## 🗄️ Relational Database Schema

- `users`: Authentication, bcrypt password hashes, roles (`admin`, `worker`).
- `business`: Business name, owner, phone, UPI ID, invoice prefix, address.
- `products`: Product catalog, units (`Litre`, `Kilogram`, `Piece`), standard price.
- `product_price_history`: Effective date brackets (`effective_from`, `effective_to`, `price`).
- `customers`: Customer code, name, phone, address, area, route sequence, delivery slot, status (`active`, `paused`, `inactive`).
- `customer_pauses`: Start and end date for vacation pauses, pause reason.
- `subscriptions`: Customer-product subscriptions with custom rates, default quantities, frequency.
- `delivery_records`: Unique per customer/product/date/slot; stores scheduled qty, actual qty, applied rate, status (`delivered`, `skipped`), skip reason.
- `delivery_audit_logs`: Immutable audit records of delivery corrections.
- `bills` & `bill_items`: Monthly invoices with itemized rate periods, previous balance, payments, balance remaining.
- `payments`: Cash/UPI/Bank payments with auto-allocation to pending customer bills.
- `milk_procurement`: Supplier intake volume, purchase rate, total cost.
- `business_expenses`: Operating costs categorized by transport, packaging, electricity, wages.

---

## 🧪 Automated Tests

The backend test suite covers:
1. Single day billing: `1 L × ₹60 = ₹60`
2. Multi-day aggregation: `30 days × 1 L × ₹60 = ₹1,800`
3. Skipped delivery handling: `30 days - 5 skipped = 25 billable days`
4. Historical rate changes: `15 days @ ₹58 + 15 days @ ₹60 = ₹1,770` with 2 item lines
5. Previous balance & partial payment reconciliation: `₹2,000 + ₹300 - ₹1,000 = ₹1,300`
6. Audited delivery corrections: Verifies audit log creation with old/new values.

Run tests:
```bash
cd backend
.\venv\Scripts\pytest -v
```

---

## 📚 Documentation & Next Steps

MilkFlow maintains two dedicated reference guides depending on your immediate goal:

### 1. 🛠️ Local Development & Testing Guide
Looking to run, modify, or test MilkFlow on your local machine?  
👉 See **[DEVELOPMENT.md](file:///d:/milk%20app/DEVELOPMENT.md)** for:
- Virtual environment setup & dependency installation
- Running the FastAPI backend & React Vite frontend locally
- Pytest automated test execution
- Seeding realistic 60-day demo datasets
- Local network testing on physical mobile phones & iPads

### 2. 🚀 Production Launch & Multi-Tenant SaaS Blueprint
Ready to take MilkFlow live to paying milk vendors with **$0 upfront hosting costs**?  
👉 See **[PRODUCTION_ROADMAP.md](file:///d:/milk%20app/PRODUCTION_ROADMAP.md)** for:
- Multi-tenant architecture (`business_id` scoping)
- Production PostgreSQL connection pooling & Alembic migrations
- 100% Free tier cloud deployment (Vercel + Render + Neon.tech)
- PWA setup (installable without App Store fees)
- Dynamic UPI QR codes on ReportLab PDF invoices
- Go-To-Market vendor onboarding playbook

---

## ⚡ Quick Run Cheat Sheet

```powershell
# Backend (FastAPI on Port 8000)
cd backend; .\venv\Scripts\uvicorn.exe app.main:app --reload

# Frontend (Vite on Port 5173)
cd frontend; npm run dev
```

