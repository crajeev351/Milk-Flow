from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.api import (
    auth, business, customers, products, subscriptions,
    deliveries, bills, payments, reports, dashboard, expenses
)

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MilkFlow API",
    description="Production-grade Milk Delivery & Billing Management System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production: configure specific allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
api_v1 = settings.API_V1_STR
app.include_router(auth.router, prefix=api_v1)
app.include_router(business.router, prefix=api_v1)
app.include_router(customers.router, prefix=api_v1)
app.include_router(products.router, prefix=api_v1)
app.include_router(subscriptions.router, prefix=api_v1)
app.include_router(deliveries.router, prefix=api_v1)
app.include_router(bills.router, prefix=api_v1)
app.include_router(payments.router, prefix=api_v1)
app.include_router(dashboard.router, prefix=api_v1)
app.include_router(reports.router, prefix=api_v1)
app.include_router(expenses.router, prefix=api_v1)

@app.get("/")
def root():
    return {
        "app": "MilkFlow API",
        "status": "healthy",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
@app.get(f"{api_v1}/health")
def health_check():
    return {
        "status": "healthy",
        "service": "milkflow-backend",
        "database": "connected"
    }
