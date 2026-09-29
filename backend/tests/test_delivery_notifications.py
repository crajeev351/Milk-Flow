import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.models import (
    Customer, Product, Subscription, DeliveryRecord,
    DeliveryNotification, Business, User
)
from app.services.delivery_service import DeliveryService

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

def test_record_single_delivery_delivered(db):
    biz = Business(name="Gokul Dairy", owner_name="Rajesh", phone="9876543210")
    worker = User(email="worker@test.com", password_hash="hash", full_name="Santosh Jadhav", role="worker")
    cust = Customer(customer_code="CUST-101", name="Ramesh Verma", phone="9822112233", address="Flat 302, Green Park", area="Kothrud")
    prod = Product(name="Buffalo Milk", default_price=75.0, unit="Litre")
    db.add_all([biz, worker, cust, prod])
    db.commit()

    sub = Subscription(customer_id=cust.id, product_id=prod.id, default_quantity=2.0, unit="Litre")
    db.add(sub)
    db.commit()

    today = date(2026, 9, 15)
    res = DeliveryService.record_single_delivery(
        db=db,
        customer_id=cust.id,
        product_id=prod.id,
        delivery_date=today,
        delivery_time="morning",
        actual_quantity=2.0,
        status="delivered",
        user_id=worker.id
    )
    rec = res["record"]
    notif = res["notification"]

    assert rec.actual_quantity == 2.0
    assert rec.status == "delivered"
    assert rec.applied_rate == 75.0

    assert notif is not None
    assert notif.quantity == 2.0
    assert notif.status == "delivered"
    assert notif.is_read is False

    # Verify Customer (House Owner) WhatsApp Receipt
    cust_msg = res["customer_whatsapp_message"]
    assert "Fresh Milk Delivered!" in cust_msg
    assert "Ramesh Verma" in cust_msg
    assert "2.0 Litre" in cust_msg
    assert "Buffalo Milk" in cust_msg
    assert "Santosh Jadhav" in cust_msg
    assert "wa.me/919822112233" in res["customer_whatsapp_url"]
    assert res["customer_phone"] == "9822112233"
    assert res["customer_name"] == "Ramesh Verma"

def test_record_single_delivery_skipped(db):
    biz = Business(name="Gokul Dairy", owner_name="Rajesh", phone="9876543210")
    worker = User(email="worker@test.com", password_hash="hash", full_name="Santosh Jadhav", role="worker")
    cust = Customer(customer_code="CUST-102", name="Pooja Kadam", phone="9822445566", address="Row House 5", area="Baner")
    prod = Product(name="Cow Milk", default_price=60.0, unit="Litre")
    db.add_all([biz, worker, cust, prod])
    db.commit()

    today = date(2026, 9, 15)
    res = DeliveryService.record_single_delivery(
        db=db,
        customer_id=cust.id,
        product_id=prod.id,
        delivery_date=today,
        delivery_time="morning",
        actual_quantity=1.5, # Should be 0 when skipped
        status="skipped",
        skip_reason="Door locked",
        user_id=worker.id
    )
    rec = res["record"]
    notif = res["notification"]

    assert rec.actual_quantity == 0.0
    assert rec.status == "skipped"
    assert rec.skip_reason == "Door locked"
    assert "SKIPPED" in notif.message
    assert "Door locked" in notif.message
    assert "wa.me/919822445566" in res["customer_whatsapp_url"]


def test_notifications_unread_and_mark_read(db):
    biz = Business(name="Gokul Dairy", owner_name="Rajesh", phone="9876543210")
    cust = Customer(customer_code="CUST-103", name="Amit Patel", phone="9822119988", address="Plot 9", area="Deccan")
    prod = Product(name="Cow Milk", default_price=60.0, unit="Litre")
    db.add_all([biz, cust, prod])
    db.commit()

    today = date(2026, 9, 15)
    DeliveryService.record_single_delivery(
        db=db,
        customer_id=cust.id,
        product_id=prod.id,
        delivery_date=today,
        delivery_time="morning",
        actual_quantity=1.0,
        status="delivered"
    )

    notifs, unread = DeliveryService.get_notifications(db=db)
    assert len(notifs) == 1
    assert unread == 1

    marked = DeliveryService.mark_notifications_read(db=db)
    assert marked == 1

    _, unread_after = DeliveryService.get_notifications(db=db)
    assert unread_after == 0
