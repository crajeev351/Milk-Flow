import pytest
from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.models import (
    Customer, Product, ProductPriceHistory, Subscription,
    DeliveryRecord, CustomerPause, Bill, BillItem, Payment, User
)
from app.services.billing_service import BillingService
from app.services.delivery_service import DeliveryService

# In-memory test SQLite DB
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)

def test_single_day_billing(db):
    """Test 1 L × ₹60 = ₹60"""
    cust = Customer(customer_code="CUST-T01", name="Test Customer", phone="9999999999", address="Test Address", area="Test Area")
    prod = Product(name="Cow Milk", default_price=60.0, unit="Litre")
    db.add_all([cust, prod])
    db.commit()

    d_date = date(2026, 9, 1)
    rec = DeliveryRecord(
        customer_id=cust.id,
        product_id=prod.id,
        delivery_date=d_date,
        delivery_time="morning",
        scheduled_quantity=1.0,
        actual_quantity=1.0,
        applied_rate=60.0,
        status="delivered"
    )
    db.add(rec)
    db.commit()

    calc = BillingService.calculate_customer_bill(db, cust.id, d_date, d_date)
    assert calc["total_quantity"] == 1.0
    assert calc["milk_total_amount"] == 60.0
    assert calc["total_due"] == 60.0

def test_multiple_days_billing(db):
    """Test 30 days × 1 L × ₹60 = ₹1,800"""
    cust = Customer(customer_code="CUST-T02", name="Monthly Customer", phone="9999999998", address="Test Address", area="Test Area")
    prod = Product(name="Cow Milk", default_price=60.0, unit="Litre")
    db.add_all([cust, prod])
    db.commit()

    start_d = date(2026, 9, 1)
    end_d = date(2026, 9, 30)

    for i in range(30):
        cur = start_d + timedelta(days=i)
        db.add(DeliveryRecord(
            customer_id=cust.id,
            product_id=prod.id,
            delivery_date=cur,
            delivery_time="morning",
            scheduled_quantity=1.0,
            actual_quantity=1.0,
            applied_rate=60.0,
            status="delivered"
        ))
    db.commit()

    calc = BillingService.calculate_customer_bill(db, cust.id, start_d, end_d)
    assert calc["total_quantity"] == 30.0
    assert calc["milk_total_amount"] == 1800.0
    assert calc["total_due"] == 1800.0

def test_skipped_deliveries_excluded(db):
    """Test 30 days - 5 skipped = 25 billable days"""
    cust = Customer(customer_code="CUST-T03", name="Skip Customer", phone="9999999997", address="Test Address", area="Test Area")
    prod = Product(name="Cow Milk", default_price=60.0, unit="Litre")
    db.add_all([cust, prod])
    db.commit()

    start_d = date(2026, 9, 1)
    end_d = date(2026, 9, 30)

    for i in range(30):
        cur = start_d + timedelta(days=i)
        is_skipped = (i < 5)  # 5 skipped days
        db.add(DeliveryRecord(
            customer_id=cust.id,
            product_id=prod.id,
            delivery_date=cur,
            delivery_time="morning",
            scheduled_quantity=1.0,
            actual_quantity=0.0 if is_skipped else 1.0,
            applied_rate=60.0,
            status="skipped" if is_skipped else "delivered",
            skip_reason="Customer away" if is_skipped else None
        ))
    db.commit()

    calc = BillingService.calculate_customer_bill(db, cust.id, start_d, end_d)
    assert calc["total_quantity"] == 25.0
    assert calc["milk_total_amount"] == 1500.0  # 25 * 60 = 1500
    assert calc["total_due"] == 1500.0

def test_historical_rate_changes(db):
    """Test 15 days × ₹58 + 15 days × ₹60 = ₹870 + ₹900 = ₹1,770"""
    cust = Customer(customer_code="CUST-T04", name="Rate Change Customer", phone="9999999996", address="Test Address", area="Test Area")
    prod = Product(name="Cow Milk", default_price=60.0, unit="Litre")
    db.add_all([cust, prod])
    db.commit()

    start_d = date(2026, 9, 1)
    end_d = date(2026, 9, 30)

    for i in range(30):
        cur = start_d + timedelta(days=i)
        applied_rate = 58.0 if i < 15 else 60.0
        db.add(DeliveryRecord(
            customer_id=cust.id,
            product_id=prod.id,
            delivery_date=cur,
            delivery_time="morning",
            scheduled_quantity=1.0,
            actual_quantity=1.0,
            applied_rate=applied_rate,
            status="delivered"
        ))
    db.commit()

    calc = BillingService.calculate_customer_bill(db, cust.id, start_d, end_d)
    assert calc["total_quantity"] == 30.0
    assert calc["milk_total_amount"] == 1770.0  # 15*58 (870) + 15*60 (900)
    assert len(calc["items"]) == 2  # Two distinct rate brackets

def test_previous_balance_and_partial_payments(db):
    """Bill ₹2,000 + Previous ₹300 - Paid ₹1,000 = Due ₹1,300"""
    cust = Customer(customer_code="CUST-T05", name="Balance Customer", phone="9999999995", address="Test Address", area="Test Area")
    db.add(cust)
    db.commit()

    # Prior unpaid bill
    prior_bill = Bill(
        bill_number="INV-202608-001",
        customer_id=cust.id,
        period_start=date(2026, 8, 1),
        period_end=date(2026, 8, 31),
        total_quantity=30.0,
        milk_total_amount=1800.0,
        total_due=1800.0,
        amount_paid=1500.0,
        balance_remaining=300.0,
        status="partially_paid"
    )
    db.add(prior_bill)
    db.commit()

    # Current month: ₹2,000 deliveries
    prod = Product(name="Buffalo Milk", default_price=100.0, unit="Litre")
    db.add(prod)
    db.commit()

    cur_start = date(2026, 9, 1)
    cur_end = date(2026, 9, 20)
    for i in range(20):
        db.add(DeliveryRecord(
            customer_id=cust.id,
            product_id=prod.id,
            delivery_date=cur_start + timedelta(days=i),
            delivery_time="morning",
            scheduled_quantity=1.0,
            actual_quantity=1.0,
            applied_rate=100.0,
            status="delivered"
        ))
    
    # Payment made in current month: ₹1,000
    db.add(Payment(
        receipt_number="RCP-2026-T01",
        customer_id=cust.id,
        amount=1000.0,
        payment_date=date(2026, 9, 10),
        payment_method="upi"
    ))
    db.commit()

    calc = BillingService.calculate_customer_bill(db, cust.id, cur_start, cur_end)
    assert calc["milk_total_amount"] == 2000.0
    assert calc["previous_balance"] == 300.0
    assert calc["total_due"] == 2300.0
    assert calc["amount_paid"] == 1000.0
    assert calc["balance_remaining"] == 1300.0

def test_delivery_correction_audit_log(db):
    """Correcting delivery records an immutable audit log"""
    user = User(email="admin@test.com", password_hash="hash", full_name="Admin", role="admin")
    cust = Customer(customer_code="CUST-T06", name="Audit Customer", phone="9999999994", address="Test Address", area="Test Area")
    prod = Product(name="Cow Milk", default_price=60.0, unit="Litre")
    db.add_all([user, cust, prod])
    db.commit()

    rec = DeliveryRecord(
        customer_id=cust.id,
        product_id=prod.id,
        delivery_date=date(2026, 9, 10),
        delivery_time="morning",
        scheduled_quantity=5.0,
        actual_quantity=5.0,
        applied_rate=60.0,
        status="delivered"
    )
    db.add(rec)
    db.commit()

    # Correct from 5L to 1L
    DeliveryService.correct_delivery(
        db=db,
        delivery_id=rec.id,
        new_quantity=1.0,
        new_status="delivered",
        skip_reason=None,
        notes="Customer actually took only 1L",
        reason="Incorrect morning entry",
        user_id=user.id
    )

    db.refresh(rec)
    assert rec.actual_quantity == 1.0
    assert len(rec.audit_logs) == 1
    log = rec.audit_logs[0]
    assert log.old_quantity == 5.0
    assert log.new_quantity == 1.0
    assert log.reason == "Incorrect morning entry"
