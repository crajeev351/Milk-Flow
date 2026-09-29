from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from app.core.database import get_db
from app.models.models import Payment, Bill, Customer, User
from app.schemas.schemas import PaymentCreate, PaymentResponse
from app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/payments", tags=["Payments"])

def generate_receipt_number(db: Session, payment_date: date) -> str:
    year = payment_date.strftime("%Y")
    count = db.query(Payment).filter(Payment.payment_date >= date(payment_date.year, 1, 1)).count() + 1
    return f"RCP-{year}-{count:04d}"

@router.get("", response_model=List[PaymentResponse])
def get_payments(
    customer_id: Optional[int] = None,
    bill_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Payment)
    if customer_id:
        query = query.filter(Payment.customer_id == customer_id)
    if bill_id:
        query = query.filter(Payment.bill_id == bill_id)

    payments = query.order_by(Payment.payment_date.desc(), Payment.id.desc()).limit(limit).all()
    
    result = []
    for p in payments:
        resp = PaymentResponse.model_validate(p)
        resp.customer_name = p.customer.name if p.customer else "Unknown"
        resp.bill_number = p.bill.bill_number if p.bill else None
        result.append(resp)
    return result

@router.post("", response_model=PaymentResponse)
def record_payment(
    payment_in: PaymentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    cust = db.query(Customer).filter(Customer.id == payment_in.customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    receipt_no = generate_receipt_number(db, payment_in.payment_date)

    target_bill_id = payment_in.bill_id
    remaining_payment = payment_in.amount

    # If bill_id provided, allocate directly to that bill
    if target_bill_id:
        bill = db.query(Bill).filter(Bill.id == target_bill_id).first()
        if bill:
            bill.amount_paid = round(bill.amount_paid + remaining_payment, 2)
            bill.balance_remaining = round(max(0.0, bill.total_due - bill.amount_paid), 2)
            if bill.balance_remaining == 0:
                bill.status = "paid"
            elif bill.amount_paid > 0:
                bill.status = "partially_paid"
    else:
        # Auto-allocate to customer's oldest pending bills
        unpaid_bills = db.query(Bill).filter(
            Bill.customer_id == cust.id,
            Bill.status.in_(["generated", "partially_paid", "overdue"])
        ).order_by(Bill.period_start.asc()).all()

        for b in unpaid_bills:
            if remaining_payment <= 0:
                break
            due_on_bill = b.balance_remaining
            alloc = min(remaining_payment, due_on_bill)
            b.amount_paid = round(b.amount_paid + alloc, 2)
            b.balance_remaining = round(max(0.0, b.total_due - b.amount_paid), 2)
            if b.balance_remaining == 0:
                b.status = "paid"
            else:
                b.status = "partially_paid"
            remaining_payment = round(remaining_payment - alloc, 2)
            if not target_bill_id:
                target_bill_id = b.id

    payment = Payment(
        receipt_number=receipt_no,
        customer_id=payment_in.customer_id,
        bill_id=target_bill_id,
        amount=payment_in.amount,
        payment_date=payment_in.payment_date,
        payment_method=payment_in.payment_method,
        reference_number=payment_in.reference_number,
        notes=payment_in.notes,
        recorded_by_id=admin.id
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    resp = PaymentResponse.model_validate(payment)
    resp.customer_name = cust.name
    resp.bill_number = payment.bill.bill_number if payment.bill else None
    return resp
