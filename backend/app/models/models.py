import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime,
    ForeignKey, Text, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from app.core.database import Base

class Business(Base):
    __tablename__ = "business"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, default="Shree Krishna Dairy & Milk Services")
    owner_name = Column(String(255), nullable=False, default="Rajesh Sharma")
    phone = Column(String(50), nullable=False, default="9876543210")
    alternate_phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True, default="Pune, Maharashtra")
    email = Column(String(255), nullable=True, default="contact@milkflow.local")
    currency = Column(String(10), default="INR", nullable=False)
    currency_symbol = Column(String(10), default="₹", nullable=False)
    billing_cycle = Column(String(50), default="monthly_calendar", nullable=False)
    upi_id = Column(String(100), nullable=True, default="dairy@upi")
    invoice_prefix = Column(String(20), default="INV", nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    users = relationship("User", back_populates="business")
    products = relationship("Product", back_populates="business")
    customers = relationship("Customer", back_populates="business")
    bills = relationship("Bill", back_populates="business")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("business.id", ondelete="CASCADE"), nullable=True, default=1, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    role = Column(String(50), default="admin", nullable=False)  # "admin", "worker"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    business = relationship("Business", back_populates="users")
    deliveries_recorded = relationship("DeliveryRecord", back_populates="recorded_by", foreign_keys="DeliveryRecord.recorded_by_id")
    audit_logs = relationship("DeliveryAuditLog", back_populates="changed_by")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("business.id", ondelete="CASCADE"), nullable=True, default=1, index=True)
    name = Column(String(255), nullable=False, index=True)  # Cow Milk, Buffalo Milk, Curd, Paneer
    description = Column(Text, nullable=True)
    category = Column(String(100), default="Milk", nullable=False)
    unit = Column(String(50), default="Litre", nullable=False)  # Litre, Kilogram, Piece
    default_price = Column(Float, nullable=False, default=60.0)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    business = relationship("Business", back_populates="products")
    price_history = relationship("ProductPriceHistory", back_populates="product", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="product")
    delivery_records = relationship("DeliveryRecord", back_populates="product")

class ProductPriceHistory(Base):
    __tablename__ = "product_price_history"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    price = Column(Float, nullable=False)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="price_history")

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("business.id", ondelete="CASCADE"), nullable=True, default=1, index=True)
    customer_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=False, index=True)
    alternate_phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=False)
    area = Column(String(150), nullable=False, index=True)
    email = Column(String(255), nullable=True)
    status = Column(String(50), default="active", nullable=False)  # "active", "paused", "inactive"
    default_delivery_time = Column(String(50), default="morning", nullable=False)  # "morning", "evening", "both"
    assigned_worker_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    route_sequence = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)
    start_date = Column(Date, default=datetime.date.today, nullable=False)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    business = relationship("Business", back_populates="customers")
    assigned_worker = relationship("User", foreign_keys=[assigned_worker_id])
    subscriptions = relationship("Subscription", back_populates="customer", cascade="all, delete-orphan")
    pauses = relationship("CustomerPause", back_populates="customer", cascade="all, delete-orphan")
    delivery_records = relationship("DeliveryRecord", back_populates="customer")
    bills = relationship("Bill", back_populates="customer")
    payments = relationship("Payment", back_populates="customer")

class CustomerPause(Base):
    __tablename__ = "customer_pauses"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("business.id", ondelete="CASCADE"), nullable=True, default=1, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    reason = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    customer = relationship("Customer", back_populates="pauses")

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("business.id", ondelete="CASCADE"), nullable=True, default=1, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    default_quantity = Column(Float, nullable=False, default=1.0)
    unit = Column(String(50), default="Litre", nullable=False)
    custom_rate = Column(Float, nullable=True)
    delivery_frequency = Column(String(50), default="daily", nullable=False)
    delivery_time = Column(String(50), default="morning", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    start_date = Column(Date, default=datetime.date.today, nullable=False)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    customer = relationship("Customer", back_populates="subscriptions")
    product = relationship("Product", back_populates="subscriptions")

class DeliveryRecord(Base):
    __tablename__ = "delivery_records"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("business.id", ondelete="CASCADE"), nullable=True, default=1, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True)
    delivery_date = Column(Date, nullable=False, index=True)
    delivery_time = Column(String(50), default="morning", nullable=False)
    scheduled_quantity = Column(Float, nullable=False, default=1.0)
    actual_quantity = Column(Float, nullable=False, default=1.0)
    applied_rate = Column(Float, nullable=False)
    status = Column(String(50), default="delivered", nullable=False)
    skip_reason = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("customer_id", "product_id", "delivery_date", "delivery_time", name="uq_customer_product_date_time"),
        Index("idx_delivery_date_customer", "delivery_date", "customer_id"),
        Index("idx_delivery_business_date", "business_id", "delivery_date"),
    )

    customer = relationship("Customer", back_populates="delivery_records")
    product = relationship("Product", back_populates="delivery_records")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id], back_populates="deliveries_recorded")
    audit_logs = relationship("DeliveryAuditLog", back_populates="delivery", cascade="all, delete-orphan")

class DeliveryAuditLog(Base):
    __tablename__ = "delivery_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    delivery_id = Column(Integer, ForeignKey("delivery_records.id"), nullable=False)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    old_quantity = Column(Float, nullable=False)
    new_quantity = Column(Float, nullable=False)
    old_status = Column(String(50), nullable=False)
    new_status = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    delivery = relationship("DeliveryRecord", back_populates="audit_logs")
    changed_by = relationship("User", back_populates="audit_logs")

class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("business.id", ondelete="CASCADE"), nullable=True, default=1, index=True)
    bill_number = Column(String(100), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    total_quantity = Column(Float, nullable=False, default=0.0)
    milk_total_amount = Column(Float, nullable=False, default=0.0)
    previous_balance = Column(Float, nullable=False, default=0.0)
    additional_charges = Column(Float, nullable=False, default=0.0)
    discount_amount = Column(Float, nullable=False, default=0.0)
    total_due = Column(Float, nullable=False, default=0.0)
    amount_paid = Column(Float, nullable=False, default=0.0)
    balance_remaining = Column(Float, nullable=False, default=0.0)
    status = Column(String(50), default="generated", nullable=False)
    notes = Column(Text, nullable=True)
    generated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    __table_args__ = (
        Index("idx_bill_customer_period", "customer_id", "period_start", "period_end"),
        Index("idx_bill_business_period", "business_id", "period_start", "period_end"),
    )

    business = relationship("Business", back_populates="bills")
    customer = relationship("Customer", back_populates="bills")
    items = relationship("BillItem", back_populates="bill", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="bill")
    generated_by = relationship("User", foreign_keys=[generated_by_id])

class BillItem(Base):
    __tablename__ = "bill_items"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    rate = Column(Float, nullable=False)
    total_quantity = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    rate_period_description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    bill = relationship("Bill", back_populates="items")
    product = relationship("Product")

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("business.id", ondelete="CASCADE"), nullable=True, default=1, index=True)
    receipt_number = Column(String(100), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=True, index=True)
    amount = Column(Float, nullable=False)
    payment_date = Column(Date, default=datetime.date.today, nullable=False)
    payment_method = Column(String(50), default="cash", nullable=False)
    reference_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    customer = relationship("Customer", back_populates="payments")
    bill = relationship("Bill", back_populates="payments")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])

class BusinessExpense(Base):
    __tablename__ = "business_expenses"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("business.id", ondelete="CASCADE"), nullable=True, default=1, index=True)
    date = Column(Date, default=datetime.date.today, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    amount = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

class MilkProcurement(Base):
    __tablename__ = "milk_procurement"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("business.id", ondelete="CASCADE"), nullable=True, default=1, index=True)
    date = Column(Date, default=datetime.date.today, nullable=False, index=True)
    supplier_name = Column(String(255), nullable=False)
    purchase_quantity = Column(Float, nullable=False)
    purchase_rate = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

class DeliveryNotification(Base):
    __tablename__ = "delivery_notifications"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("business.id", ondelete="CASCADE"), nullable=True, default=1, index=True)
    delivery_record_id = Column(Integer, ForeignKey("delivery_records.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    worker_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    quantity = Column(Float, nullable=False)
    product_name = Column(String(100), nullable=True)
    status = Column(String(50), default="delivered", nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    customer = relationship("Customer")
    worker = relationship("User", foreign_keys=[worker_id])
    delivery_record = relationship("DeliveryRecord")
