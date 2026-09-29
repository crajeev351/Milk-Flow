import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.core.security import create_access_token
from app.models.models import User, Business, Customer, Product

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Ensure test business
    biz = db.query(Business).filter(Business.id == 1).first()
    if not biz:
        biz = Business(id=1, name="Test Dairy", owner_name="Owner", phone="9999999999")
        db.add(biz)
        db.commit()
        
    # Ensure test admin
    admin = db.query(User).filter(User.email == "testadmin@milkflow.com").first()
    if not admin:
        admin = User(
            email="testadmin@milkflow.com",
            password_hash="fakehash",
            full_name="Test Admin",
            role="admin",
            business_id=1,
            is_active=True
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    # Ensure product
    prod = db.query(Product).first()
    if not prod:
        prod = Product(name="Test Cow Milk", default_price=60.0, unit="Litre", is_active=True, business_id=1)
        db.add(prod)
        db.commit()
        
    token = create_access_token(subject=admin.id)
    db.close()
    return {"token": token, "admin_id": admin.id}

def test_health_check_endpoints():
    r1 = client.get("/health")
    assert r1.status_code == 200
    assert r1.json()["status"] == "healthy"
    
    r2 = client.get("/api/v1/health")
    assert r2.status_code == 200
    assert r2.json()["status"] == "healthy"

def test_bulk_customer_import(setup_db):
    headers = {"Authorization": f"Bearer {setup_db['token']}"}
    payload = {
        "customers": [
            {
                "name": "Karan Johar",
                "phone": "9111222333",
                "address": "Bungalow 5, Bandra",
                "area": "West",
                "default_quantity": 2.0,
                "product_name": "Cow Milk",
                "custom_rate": 65.0,
                "delivery_time": "morning"
            },
            {
                "name": "Pooja Hegde",
                "phone": "9222333444",
                "address": "Flat 102, Silver Arch",
                "area": "East",
                "default_quantity": 1.5,
                "delivery_time": "evening"
            }
        ]
    }
    
    res = client.post("/api/v1/customers/bulk-import", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["imported_count"] >= 1

def test_public_customer_vacation_pause(setup_db):
    # Customer can pause using their phone number
    tomorrow = date.today() + timedelta(days=1)
    next_week = date.today() + timedelta(days=7)
    
    payload = {
        "phone_or_code": "9111222333",
        "start_date": str(tomorrow),
        "end_date": str(next_week),
        "reason": "Family Vacation"
    }
    
    res = client.post("/api/v1/customers/public-pause", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "Karan Johar" in data["customer_name"]
