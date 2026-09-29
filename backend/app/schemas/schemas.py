from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
import datetime as dt

Date = dt.date
DateTime = dt.datetime

# Token & Auth
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class TokenPayload(BaseModel):
    sub: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: str = "admin"
    business_id: Optional[int] = None

class UserCreate(UserBase):
    password: str
    business_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: DateTime

    class Config:
        from_attributes = True

# Business
class BusinessBase(BaseModel):
    name: str = "Shree Krishna Dairy & Milk Services"
    owner_name: str = "Rajesh Sharma"
    phone: str = "9876543210"
    alternate_phone: Optional[str] = None
    address: Optional[str] = "Pune, Maharashtra"
    email: Optional[str] = "contact@milkflow.local"
    currency: str = "INR"
    currency_symbol: str = "₹"
    billing_cycle: str = "monthly_calendar"
    upi_id: Optional[str] = "dairy@upi"
    invoice_prefix: str = "INV"

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    owner_name: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None
    billing_cycle: Optional[str] = None
    upi_id: Optional[str] = None
    invoice_prefix: Optional[str] = None

class BusinessResponse(BusinessBase):
    id: int
    created_at: DateTime
    updated_at: Optional[DateTime] = None

    class Config:
        from_attributes = True

# Product & Price
class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "Milk"
    unit: str = "Litre"
    default_price: float = Field(gt=0, description="Default rate per unit")
    is_active: bool = True

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    default_price: Optional[float] = Field(None, gt=0)
    is_active: Optional[bool] = None

class ProductPriceHistoryResponse(BaseModel):
    id: int
    product_id: int
    price: float
    effective_from: Date
    effective_to: Optional[Date] = None

    class Config:
        from_attributes = True

class ProductPriceUpdate(BaseModel):
    price: float = Field(gt=0)
    effective_from: Date

class ProductResponse(ProductBase):
    id: int
    created_at: DateTime
    price_history: List[ProductPriceHistoryResponse] = []

    class Config:
        from_attributes = True

# Customer Pause
class CustomerPauseCreate(BaseModel):
    start_date: Date
    end_date: Optional[Date] = None
    reason: Optional[str] = None

class CustomerPauseResponse(BaseModel):
    id: int
    customer_id: int
    start_date: Date
    end_date: Optional[Date] = None
    reason: Optional[str] = None
    is_active: bool
    created_at: DateTime

    class Config:
        from_attributes = True

# Subscription
class SubscriptionBase(BaseModel):
    product_id: int
    default_quantity: float = Field(default=1.0, ge=0)
    unit: str = "Litre"
    custom_rate: Optional[float] = Field(None, ge=0)
    delivery_frequency: str = "daily"
    delivery_time: str = "morning"
    is_active: bool = True
    start_date: Date = Field(default_factory=dt.date.today)
    end_date: Optional[Date] = None

class SubscriptionCreate(SubscriptionBase):
    customer_id: int

class SubscriptionUpdate(BaseModel):
    default_quantity: Optional[float] = Field(None, ge=0)
    unit: Optional[str] = None
    custom_rate: Optional[float] = Field(None, ge=0)
    delivery_frequency: Optional[str] = None
    delivery_time: Optional[str] = None
    is_active: Optional[bool] = None
    end_date: Optional[Date] = None

class SubscriptionResponse(SubscriptionBase):
    id: int
    customer_id: int
    product: Optional[ProductResponse] = None
    created_at: DateTime

    class Config:
        from_attributes = True

# Customer
class CustomerBase(BaseModel):
    customer_code: Optional[str] = None
    name: str
    phone: str
    alternate_phone: Optional[str] = None
    address: str
    area: str
    email: Optional[str] = None
    status: str = "active"  # "active", "paused", "inactive"
    default_delivery_time: str = "morning"  # "morning", "evening", "both"
    assigned_worker_id: Optional[int] = None
    route_sequence: int = 0
    notes: Optional[str] = None
    start_date: Date = Field(default_factory=dt.date.today)
    end_date: Optional[Date] = None

class CustomerCreate(CustomerBase):
    initial_product_id: Optional[int] = None
    initial_quantity: Optional[float] = 1.0
    initial_rate: Optional[float] = None
    initial_delivery_time: Optional[str] = "morning"

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    address: Optional[str] = None
    area: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None
    default_delivery_time: Optional[str] = None
    assigned_worker_id: Optional[int] = None
    route_sequence: Optional[int] = None
    notes: Optional[str] = None
    end_date: Optional[Date] = None

class CustomerResponse(CustomerBase):
    id: int
    created_at: DateTime
    updated_at: Optional[DateTime] = None
    current_balance: Optional[float] = 0.0
    assigned_worker_name: Optional[str] = None

    class Config:
        from_attributes = True

class CustomerDetailResponse(CustomerResponse):
    subscriptions: List[SubscriptionResponse] = []
    pauses: List[CustomerPauseResponse] = []
    total_delivered_this_month: Optional[float] = 0.0
    pending_balance: Optional[float] = 0.0

# Delivery Record
class DeliveryRecordBase(BaseModel):
    customer_id: int
    product_id: int
    subscription_id: Optional[int] = None
    delivery_date: Date
    delivery_time: str = "morning"
    scheduled_quantity: float = Field(ge=0)
    actual_quantity: float = Field(ge=0)
    applied_rate: float = Field(ge=0)
    status: str = "delivered"  # "delivered", "skipped", "absent", "holiday", "cancelled"
    skip_reason: Optional[str] = None
    notes: Optional[str] = None

class DeliveryRecordCreate(DeliveryRecordBase):
    pass

class DeliveryRecordUpdate(BaseModel):
    actual_quantity: float = Field(ge=0)
    status: str
    skip_reason: Optional[str] = None
    notes: Optional[str] = None
    correction_reason: Optional[str] = "Admin update"

class DeliveryAuditLogResponse(BaseModel):
    id: int
    delivery_id: int
    changed_by_id: Optional[int] = None
    old_quantity: float
    new_quantity: float
    old_status: str
    new_status: str
    reason: Optional[str] = None
    created_at: DateTime

    class Config:
        from_attributes = True

class DeliveryRecordResponse(DeliveryRecordBase):
    id: int
    recorded_by_id: Optional[int] = None
    created_at: DateTime
    updated_at: Optional[DateTime] = None
    customer_name: Optional[str] = None
    product_name: Optional[str] = None

    class Config:
        from_attributes = True

# Daily Delivery Sheet Item (Frontend speed view)
class DeliverySheetItem(BaseModel):
    customer_id: int
    customer_code: str
    customer_name: str
    phone: str
    address: str
    area: str
    route_sequence: int
    product_id: int
    product_name: str
    unit: str
    subscription_id: Optional[int] = None
    delivery_time: str
    is_paused: bool = False
    pause_reason: Optional[str] = None
    scheduled_quantity: float
    actual_quantity: float
    applied_rate: float
    status: str  # "delivered", "skipped", "pending"
    skip_reason: Optional[str] = None
    existing_record_id: Optional[int] = None
    notes: Optional[str] = None
    delivered_at: Optional[DateTime] = None
    worker_name: Optional[str] = None

class DeliveryBulkSaveItem(BaseModel):
    customer_id: int
    product_id: int
    subscription_id: Optional[int] = None
    delivery_time: str = "morning"
    scheduled_quantity: float
    actual_quantity: float
    applied_rate: float
    status: str  # "delivered", "skipped", "absent", "holiday"
    skip_reason: Optional[str] = None
    notes: Optional[str] = None

class DeliveryBulkSaveRequest(BaseModel):
    delivery_date: Date
    delivery_time: Optional[str] = "morning"
    entries: List[DeliveryBulkSaveItem]

class SingleDeliveryRecordRequest(BaseModel):
    customer_id: int
    product_id: int
    delivery_date: Date
    delivery_time: str = "morning"
    actual_quantity: float = Field(ge=0)
    status: str = "delivered"
    skip_reason: Optional[str] = None
    notes: Optional[str] = None

class DeliveryNotificationResponse(BaseModel):
    id: int
    delivery_record_id: Optional[int] = None
    customer_id: int
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    worker_id: Optional[int] = None
    worker_name: Optional[str] = None
    title: str
    message: str
    quantity: float
    product_name: Optional[str] = None
    status: str
    is_read: bool
    created_at: DateTime

    class Config:
        from_attributes = True

class DeliveryNotificationListResponse(BaseModel):
    notifications: List[DeliveryNotificationResponse]
    unread_count: int

class SingleDeliveryRecordResponse(BaseModel):
    delivery_record: DeliveryRecordResponse
    notification: Optional[DeliveryNotificationResponse] = None
    customer_name: str
    customer_phone: str
    customer_whatsapp_message: str
    customer_whatsapp_url: str
    whatsapp_message: str
    whatsapp_url: str
    owner_phone: str
    owner_whatsapp_message: Optional[str] = None
    owner_whatsapp_url: Optional[str] = None



# Bills
class BillItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    rate: float
    total_quantity: float
    total_amount: float
    rate_period_description: Optional[str] = None

    class Config:
        from_attributes = True

class BillResponse(BaseModel):
    id: int
    bill_number: str
    customer_id: int
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    period_start: Date
    period_end: Date
    total_quantity: float
    milk_total_amount: float
    previous_balance: float
    additional_charges: float
    discount_amount: float
    total_due: float
    amount_paid: float
    balance_remaining: float
    status: str
    notes: Optional[str] = None
    created_at: DateTime
    items: List[BillItemResponse] = []

    class Config:
        from_attributes = True

class BillGenerateRequest(BaseModel):
    customer_ids: Optional[List[int]] = None  # None = all active customers
    period_start: Date
    period_end: Date
    additional_charges: float = 0.0
    discount_amount: float = 0.0

# Payments
class PaymentCreate(BaseModel):
    customer_id: int
    bill_id: Optional[int] = None
    amount: float = Field(gt=0)
    payment_date: Date = Field(default_factory=dt.date.today)
    payment_method: str = "cash"  # "cash", "upi", "bank_transfer", "cheque"
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class PaymentResponse(BaseModel):
    id: int
    receipt_number: str
    customer_id: int
    customer_name: Optional[str] = None
    bill_id: Optional[int] = None
    bill_number: Optional[str] = None
    amount: float
    payment_date: Date
    payment_method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: DateTime

    class Config:
        from_attributes = True

# Expenses & Procurement
class BusinessExpenseCreate(BaseModel):
    date: Date = Field(default_factory=dt.date.today)
    title: str
    category: str = "other"
    amount: float = Field(gt=0)
    notes: Optional[str] = None

class BusinessExpenseResponse(BaseModel):
    id: int
    date: Date
    title: str
    category: str
    amount: float
    notes: Optional[str] = None
    created_at: DateTime

    class Config:
        from_attributes = True

class MilkProcurementCreate(BaseModel):
    date: Date = Field(default_factory=dt.date.today)
    supplier_name: str
    purchase_quantity: float = Field(gt=0)
    purchase_rate: float = Field(gt=0)
    notes: Optional[str] = None

class MilkProcurementResponse(BaseModel):
    id: int
    date: Date
    supplier_name: str
    purchase_quantity: float
    purchase_rate: float
    total_cost: float
    notes: Optional[str] = None
    created_at: DateTime

    class Config:
        from_attributes = True

# Dashboard & Analytics
class DashboardToday(BaseModel):
    active_customers: int
    customers_to_deliver: int
    milk_scheduled: float
    milk_delivered: float
    expected_value: float
    skipped_deliveries: int
    pending_entries: int

class DashboardMonthly(BaseModel):
    total_milk_sold: float
    total_revenue: float
    amount_collected: float
    outstanding_amount: float
    unpaid_customers_count: int
    active_customers_count: int

class PendingPaymentCustomer(BaseModel):
    customer_id: int
    name: str
    phone: str
    area: str
    balance_due: float
    last_bill_number: Optional[str] = None
    last_bill_date: Optional[Date] = None

class DashboardSummary(BaseModel):
    today: DashboardToday
    monthly: DashboardMonthly
    pending_payments: List[PendingPaymentCustomer]
    volume_trend: List[Dict[str, Any]]
    revenue_trend: List[Dict[str, Any]]
    product_distribution: List[Dict[str, Any]]

# Bulk Customer Import & Vacation Pause
class BulkCustomerImportItem(BaseModel):
    name: str
    phone: str
    address: str
    area: str
    default_quantity: float = 1.0
    product_id: Optional[int] = None
    product_name: Optional[str] = "Cow Milk"
    custom_rate: Optional[float] = None
    delivery_time: Optional[str] = "morning"

class BulkCustomerImportRequest(BaseModel):
    customers: List[BulkCustomerImportItem]

class BulkImportResponse(BaseModel):
    imported_count: int
    skipped_count: int
    message: str

class PublicPauseRequest(BaseModel):
    phone_or_code: str
    start_date: Date
    end_date: Optional[Date] = None
    reason: Optional[str] = "Customer Vacation"
