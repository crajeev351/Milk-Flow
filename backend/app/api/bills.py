from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.core.database import get_db
from app.models.models import Bill, Business, Customer, User
from app.schemas.schemas import BillResponse, BillGenerateRequest
from app.api.deps import get_current_user, require_admin
from app.services.billing_service import BillingService
from app.services.pdf_service import PDFService
from app.services.whatsapp_service import WhatsAppService

router = APIRouter(prefix="/bills", tags=["Monthly Billing"])

@router.get("", response_model=List[BillResponse])
def get_bills(
    customer_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Bill)
    if customer_id:
        query = query.filter(Bill.customer_id == customer_id)
    if status_filter:
        query = query.filter(Bill.status == status_filter)
    if year and month:
        start_d = date(year, month, 1)
        # Next month calculation
        next_month = month + 1 if month < 12 else 1
        next_year = year if month < 12 else year + 1
        end_d = date(next_year, next_month, 1)
        query = query.filter(Bill.period_start >= start_d, Bill.period_start < end_d)

    bills = query.order_by(Bill.period_start.desc(), Bill.id.desc()).all()
    
    result = []
    for b in bills:
        resp = BillResponse.model_validate(b)
        resp.customer_name = b.customer.name if b.customer else "Unknown"
        resp.customer_phone = b.customer.phone if b.customer else ""
        resp.customer_address = b.customer.address if b.customer else ""
        result.append(resp)
    return result

@router.post("/generate", response_model=List[BillResponse])
def generate_monthly_bills(
    payload: BillGenerateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    target_customers = []
    if payload.customer_ids and len(payload.customer_ids) > 0:
        target_customers = db.query(Customer).filter(Customer.id.in_(payload.customer_ids)).all()
    else:
        # Generate for all active / paused customers
        target_customers = db.query(Customer).filter(Customer.status != "inactive").all()

    generated_bills = []
    for c in target_customers:
        bill = BillingService.create_or_update_bill(
            db=db,
            customer_id=c.id,
            period_start=payload.period_start,
            period_end=payload.period_end,
            additional_charges=payload.additional_charges,
            discount_amount=payload.discount_amount,
            generated_by_id=admin.id
        )
        resp = BillResponse.model_validate(bill)
        resp.customer_name = c.name
        resp.customer_phone = c.phone
        resp.customer_address = c.address
        generated_bills.append(resp)

    return generated_bills

@router.get("/{bill_id}", response_model=BillResponse)
def get_bill_detail(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    resp = BillResponse.model_validate(bill)
    resp.customer_name = bill.customer.name if bill.customer else ""
    resp.customer_phone = bill.customer.phone if bill.customer else ""
    resp.customer_address = bill.customer.address if bill.customer else ""
    return resp

@router.get("/{bill_id}/pdf")
def download_bill_pdf(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    business = db.query(Business).first() or Business()
    pdf_bytes = PDFService.generate_bill_pdf(bill, business)

    filename = f"Bill_{bill.bill_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )

@router.get("/{bill_id}/whatsapp")
def get_whatsapp_bill_payload(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    business = db.query(Business).first() or Business()
    msg = WhatsAppService.generate_bill_message(bill, business)
    url = WhatsAppService.generate_bill_url(bill, business)

    return {
        "bill_id": bill.id,
        "bill_number": bill.bill_number,
        "customer_name": bill.customer.name if bill.customer else "",
        "phone": bill.customer.phone if bill.customer else "",
        "message": msg,
        "whatsapp_url": url
    }

@router.patch("/{bill_id}/status")
def update_bill_status(
    bill_id: int,
    status_val: str = Query(..., regex="^(draft|generated|partially_paid|paid|overdue|cancelled)$"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    bill.status = status_val
    db.commit()
    return {"message": f"Bill status updated to {status_val}", "bill_id": bill.id, "status": bill.status}
