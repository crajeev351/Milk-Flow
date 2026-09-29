from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from typing import List, Optional
from datetime import date, datetime, timedelta
from app.core.database import get_db
from app.models.models import (
    Customer, Subscription, Product, CustomerPause, DeliveryRecord, Bill, Payment, User
)
from app.schemas.schemas import (
    CustomerCreate, CustomerUpdate, CustomerResponse, CustomerDetailResponse,
    CustomerPauseCreate, CustomerPauseResponse, DeliveryRecordResponse,
    BulkCustomerImportRequest, BulkImportResponse, PublicPauseRequest
)
from app.api.deps import get_current_user, require_admin
from app.services.billing_service import BillingService

router = APIRouter(prefix="/customers", tags=["Customers"])

def generate_customer_code(db: Session) -> str:
    count = db.query(Customer).count() + 1
    return f"CUST-{count:03d}"

@router.get("", response_model=List[CustomerResponse])
def get_customers(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    area_filter: Optional[str] = None,
    delivery_time: Optional[str] = None,
    worker_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Customer)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Customer.name.ilike(s),
                Customer.phone.ilike(s),
                Customer.customer_code.ilike(s),
                Customer.area.ilike(s)
            )
        )
    if status_filter:
        query = query.filter(Customer.status == status_filter)
    if area_filter:
        query = query.filter(Customer.area == area_filter)
    if delivery_time:
        query = query.filter(Customer.default_delivery_time.in_([delivery_time, "both"]))
    if worker_id:
        query = query.filter(Customer.assigned_worker_id == worker_id)

    customers = query.order_by(Customer.route_sequence.asc(), Customer.name.asc()).all()
    
    # Calculate live balance for each customer
    result = []
    for c in customers:
        resp = CustomerResponse.model_validate(c)
        resp.assigned_worker_name = c.assigned_worker.full_name if c.assigned_worker else None
        # Calculate pending bills
        unpaid_bills = db.query(Bill).filter(
            Bill.customer_id == c.id,
            Bill.status.in_(["generated", "partially_paid", "overdue"])
        ).all()
        resp.current_balance = round(sum(b.balance_remaining for b in unpaid_bills), 2)
        result.append(resp)
    return result

@router.post("", response_model=CustomerDetailResponse)
def create_customer(
    cust_in: CustomerCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    code = cust_in.customer_code or generate_customer_code(db)
    
    # Check duplicate code
    if db.query(Customer).filter(Customer.customer_code == code).first():
        code = f"{code}-{int(datetime.now().timestamp()) % 1000}"

    cust = Customer(
        customer_code=code,
        name=cust_in.name,
        phone=cust_in.phone,
        alternate_phone=cust_in.alternate_phone,
        address=cust_in.address,
        area=cust_in.area,
        email=cust_in.email,
        status=cust_in.status,
        default_delivery_time=cust_in.default_delivery_time,
        assigned_worker_id=cust_in.assigned_worker_id,
        route_sequence=cust_in.route_sequence,
        notes=cust_in.notes,
        start_date=cust_in.start_date or date.today()
    )
    db.add(cust)
    db.flush()

    # If initial product selected, create subscription
    if cust_in.initial_product_id:
        prod = db.query(Product).filter(Product.id == cust_in.initial_product_id).first()
        if prod:
            sub = Subscription(
                customer_id=cust.id,
                product_id=prod.id,
                default_quantity=cust_in.initial_quantity or 1.0,
                unit=prod.unit,
                custom_rate=cust_in.initial_rate,
                delivery_time=cust_in.initial_delivery_time or "morning",
                is_active=True
            )
            db.add(sub)

    db.commit()
    db.refresh(cust)
    return cust

@router.get("/{customer_id}", response_model=CustomerDetailResponse)
def get_customer_details(customer_id: int, db: Session = Depends(get_db)):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    today = date.today()
    month_start = date(today.year, today.month, 1)

    # Deliveries this month
    delivered = db.query(func.sum(DeliveryRecord.actual_quantity)).filter(
        DeliveryRecord.customer_id == cust.id,
        DeliveryRecord.delivery_date >= month_start,
        DeliveryRecord.status == "delivered"
    ).scalar() or 0.0

    # Unpaid balance
    unpaid_bills = db.query(Bill).filter(
        Bill.customer_id == cust.id,
        Bill.status.in_(["generated", "partially_paid", "overdue"])
    ).all()
    pending_bal = round(sum(b.balance_remaining for b in unpaid_bills), 2)

    resp = CustomerDetailResponse.model_validate(cust)
    resp.assigned_worker_name = cust.assigned_worker.full_name if cust.assigned_worker else None
    resp.total_delivered_this_month = round(float(delivered), 2)
    resp.pending_balance = pending_bal
    resp.current_balance = pending_bal
    return resp

@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    cust_in: CustomerUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = cust_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cust, field, value)

    db.commit()
    db.refresh(cust)
    return cust

@router.patch("/{customer_id}/status")
def change_customer_status(
    customer_id: int,
    status_val: str = Query(..., regex="^(active|paused|inactive)$"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    cust.status = status_val
    if status_val == "inactive":
        cust.end_date = date.today()
    elif status_val == "active":
        cust.end_date = None

    db.commit()
    return {"message": f"Customer status updated to {status_val}", "customer_id": cust.id, "status": cust.status}

# Customer Pauses
@router.post("/{customer_id}/pauses", response_model=CustomerPauseResponse)
def add_customer_pause(
    customer_id: int,
    pause_in: CustomerPauseCreate,
    db: Session = Depends(get_db)
):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    pause = CustomerPause(
        customer_id=cust.id,
        start_date=pause_in.start_date,
        end_date=pause_in.end_date,
        reason=pause_in.reason or "Customer away",
        is_active=True
    )
    db.add(pause)
    db.commit()
    db.refresh(pause)
    return pause

@router.delete("/{customer_id}/pauses/{pause_id}")
def cancel_customer_pause(
    customer_id: int,
    pause_id: int,
    db: Session = Depends(get_db)
):
    pause = db.query(CustomerPause).filter(
        CustomerPause.id == pause_id,
        CustomerPause.customer_id == customer_id
    ).first()
    if not pause:
        raise HTTPException(status_code=404, detail="Pause record not found")
    
    pause.is_active = False
    pause.end_date = date.today() - timedelta(days=1)
    db.commit()
    return {"message": "Pause cancelled; deliveries resumed"}

# History & Deliveries
@router.get("/{customer_id}/deliveries", response_model=List[DeliveryRecordResponse])
def get_customer_delivery_history(
    customer_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 60,
    db: Session = Depends(get_db)
):
    query = db.query(DeliveryRecord).filter(DeliveryRecord.customer_id == customer_id)
    if start_date:
        query = query.filter(DeliveryRecord.delivery_date >= start_date)
    if end_date:
        query = query.filter(DeliveryRecord.delivery_date <= end_date)

    records = query.order_by(DeliveryRecord.delivery_date.desc()).limit(limit).all()
    
    # Populate product and customer names
    result = []
    for r in records:
        resp = DeliveryRecordResponse.model_validate(r)
        resp.customer_name = r.customer.name if r.customer else None
        resp.product_name = r.product.name if r.product else None
        result.append(resp)
    return result

# Bulk Customer Import from Register / Excel / CSV
@router.post("/bulk-import", response_model=BulkImportResponse)
def bulk_import_customers(
    payload: BulkCustomerImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    imported = 0
    skipped = 0
    default_product = db.query(Product).filter(Product.is_active == True).first()
    
    for item in payload.customers:
        clean_phone = item.phone.strip()
        existing = db.query(Customer).filter(Customer.phone == clean_phone).first()
        if existing:
            skipped += 1
            continue
            
        code = generate_customer_code(db)
        customer = Customer(
            business_id=current_user.business_id or 1,
            customer_code=code,
            name=item.name.strip(),
            phone=clean_phone,
            address=item.address.strip() or "Local Area",
            area=item.area.strip() or "Central",
            default_delivery_time=item.delivery_time or "morning",
            status="active",
            start_date=date.today()
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
        
        prod_id = item.product_id
        if not prod_id:
            if item.product_name:
                prod = db.query(Product).filter(Product.name.ilike(f"%{item.product_name}%")).first()
                prod_id = prod.id if prod else (default_product.id if default_product else 1)
            else:
                prod_id = default_product.id if default_product else 1
                
        sub = Subscription(
            business_id=current_user.business_id or 1,
            customer_id=customer.id,
            product_id=prod_id,
            default_quantity=item.default_quantity or 1.0,
            custom_rate=item.custom_rate,
            delivery_frequency="daily",
            delivery_time=item.delivery_time or "morning",
            is_active=True
        )
        db.add(sub)
        db.commit()
        imported += 1

    return {
        "imported_count": imported,
        "skipped_count": skipped,
        "message": f"Successfully imported {imported} customers ({skipped} skipped as duplicate phones)."
    }

# Public Self-Service Customer Vacation Pause
@router.post("/public-pause")
def public_customer_pause(
    payload: PublicPauseRequest,
    db: Session = Depends(get_db)
):
    key = payload.phone_or_code.strip()
    customer = db.query(Customer).filter(
        or_(
            Customer.customer_code.ilike(key),
            Customer.phone.ilike(f"%{key}%")
        )
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="No customer found with this phone number or code")

    pause = CustomerPause(
        business_id=customer.business_id or 1,
        customer_id=customer.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason or "Customer Vacation",
        is_active=True
    )
    db.add(pause)
    db.commit()
    return {
        "status": "success",
        "customer_name": customer.name,
        "start_date": str(payload.start_date),
        "end_date": str(payload.end_date) if payload.end_date else "Until resumed",
        "message": f"Deliveries paused for {customer.name} from {payload.start_date}."
    }
