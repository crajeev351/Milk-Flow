import csv
import io
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from typing import Optional, Dict, Any, List
from app.core.database import get_db
from app.models.models import Customer, DeliveryRecord, Bill, Payment, Product
from app.api.deps import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])

@router.get("/daily")
def get_daily_report(
    report_date: date = Query(default_factory=date.today),
    db: Session = Depends(get_db)
):
    records = db.query(DeliveryRecord).filter(DeliveryRecord.delivery_date == report_date).all()
    
    total_customers_served = sum(1 for r in records if r.status == "delivered" and r.actual_quantity > 0)
    total_litres_delivered = sum(r.actual_quantity for r in records if r.status == "delivered")
    total_expected_value = sum(r.actual_quantity * r.applied_rate for r in records if r.status == "delivered")
    skipped_count = sum(1 for r in records if r.status in ["skipped", "absent", "holiday", "cancelled"])

    # Product breakdown
    prod_map: Dict[str, Dict[str, Any]] = {}
    for r in records:
        if r.status == "delivered":
            p_name = r.product.name if r.product else "Milk"
            if p_name not in prod_map:
                prod_map[p_name] = {"name": p_name, "quantity": 0.0, "amount": 0.0, "unit": r.product.unit if r.product else "L"}
            prod_map[p_name]["quantity"] += r.actual_quantity
            prod_map[p_name]["amount"] += (r.actual_quantity * r.applied_rate)

    return {
        "date": report_date,
        "total_customers_served": total_customers_served,
        "total_litres_delivered": round(total_litres_delivered, 2),
        "total_expected_value": round(total_expected_value, 2),
        "skipped_deliveries": skipped_count,
        "product_breakdown": list(prod_map.values())
    }

@router.get("/monthly")
def get_monthly_report(
    year: int = Query(default_factory=lambda: date.today().year),
    month: int = Query(default_factory=lambda: date.today().month),
    db: Session = Depends(get_db)
):
    start_d = date(year, month, 1)
    next_m = month + 1 if month < 12 else 1
    next_y = year if month < 12 else year + 1
    end_d = date(next_y, next_m, 1) - timedelta(days=1)

    deliveries = db.query(DeliveryRecord).filter(
        DeliveryRecord.delivery_date >= start_d,
        DeliveryRecord.delivery_date <= end_d,
        DeliveryRecord.status == "delivered"
    ).all()

    total_sales = sum(r.actual_quantity * r.applied_rate for r in deliveries)
    total_quantity = sum(r.actual_quantity for r in deliveries)

    payments = db.query(Payment).filter(
        Payment.payment_date >= start_d,
        Payment.payment_date <= end_d
    ).all()
    total_payments = sum(p.amount for p in payments)

    bills = db.query(Bill).filter(
        Bill.period_start >= start_d,
        Bill.period_start <= end_d
    ).all()
    outstanding = sum(b.balance_remaining for b in bills)

    # New customers signed up in this month
    new_customers = db.query(Customer).filter(
        Customer.start_date >= start_d,
        Customer.start_date <= end_d
    ).count()

    return {
        "year": year,
        "month": month,
        "period": f"{start_d.strftime('%B %Y')}",
        "total_sales": round(total_sales, 2),
        "total_quantity": round(total_quantity, 2),
        "total_payments": round(total_payments, 2),
        "outstanding_balance": round(outstanding, 2),
        "new_customers_count": new_customers,
        "bills_generated_count": len(bills)
    }

# CSV Export endpoints
@router.get("/export/customers")
def export_customers_csv(db: Session = Depends(get_db)):
    customers = db.query(Customer).order_by(Customer.route_sequence.asc(), Customer.name.asc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Customer Code", "Name", "Phone", "Alternate Phone", "Area", "Address", "Delivery Slot", "Status", "Start Date", "Notes"])

    for c in customers:
        writer.writerow([
            c.customer_code,
            c.name,
            c.phone,
            c.alternate_phone or "",
            c.area,
            c.address,
            c.default_delivery_time,
            c.status,
            c.start_date,
            c.notes or ""
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=milkflow_customers.csv"}
    )

@router.get("/export/deliveries")
def export_deliveries_csv(
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    end_date: date = Query(default_factory=date.today),
    db: Session = Depends(get_db)
):
    deliveries = db.query(DeliveryRecord).filter(
        DeliveryRecord.delivery_date >= start_date,
        DeliveryRecord.delivery_date <= end_date
    ).order_by(DeliveryRecord.delivery_date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Customer Code", "Customer Name", "Product", "Scheduled Qty", "Actual Qty", "Unit", "Rate", "Total Amount", "Status", "Skip Reason", "Delivery Slot"])

    for d in deliveries:
        c_code = d.customer.customer_code if d.customer else ""
        c_name = d.customer.name if d.customer else ""
        p_name = d.product.name if d.product else ""
        p_unit = d.product.unit if d.product else "L"
        amt = round(d.actual_quantity * d.applied_rate, 2) if d.status == "delivered" else 0.0

        writer.writerow([
            d.delivery_date,
            c_code,
            c_name,
            p_name,
            d.scheduled_quantity,
            d.actual_quantity,
            p_unit,
            d.applied_rate,
            amt,
            d.status,
            d.skip_reason or "",
            d.delivery_time
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=milkflow_deliveries_{start_date}_{end_date}.csv"}
    )
