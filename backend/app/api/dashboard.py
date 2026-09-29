from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import date, datetime, timedelta
from typing import List, Dict, Any
from app.core.database import get_db
from app.models.models import (
    Customer, DeliveryRecord, Bill, Payment, Product, Business
)
from app.schemas.schemas import DashboardSummary, DashboardToday, DashboardMonthly, PendingPaymentCustomer
from app.services.whatsapp_service import WhatsAppService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    today = date.today()
    month_start = date(today.year, today.month, 1)

    # 1. Today's stats
    active_cust_count = db.query(Customer).filter(Customer.status == "active").count()
    
    # Deliveries today
    today_records = db.query(DeliveryRecord).filter(DeliveryRecord.delivery_date == today).all()
    
    milk_delivered = sum(r.actual_quantity for r in today_records if r.status == "delivered")
    milk_scheduled = sum(r.scheduled_quantity for r in today_records)
    expected_value = sum(
        (r.actual_quantity * r.applied_rate) for r in today_records if r.status == "delivered"
    )
    skipped_count = sum(1 for r in today_records if r.status in ["skipped", "absent", "holiday", "cancelled"])
    
    # Pending entries count: active customers who don't have a delivery record for today yet
    customers_with_records = set(r.customer_id for r in today_records)
    pending_entries = max(0, active_cust_count - len(customers_with_records))

    today_stats = DashboardToday(
        active_customers=active_cust_count,
        customers_to_deliver=active_cust_count,
        milk_scheduled=round(float(milk_scheduled), 2),
        milk_delivered=round(float(milk_delivered), 2),
        expected_value=round(float(expected_value), 2),
        skipped_deliveries=skipped_count,
        pending_entries=pending_entries
    )

    # 2. Monthly stats
    monthly_deliveries = db.query(DeliveryRecord).filter(
        DeliveryRecord.delivery_date >= month_start,
        DeliveryRecord.delivery_date <= today,
        DeliveryRecord.status == "delivered"
    ).all()
    total_milk_sold = round(sum(r.actual_quantity for r in monthly_deliveries), 2)
    total_revenue = round(sum(r.actual_quantity * r.applied_rate for r in monthly_deliveries), 2)

    monthly_payments = db.query(Payment).filter(
        Payment.payment_date >= month_start,
        Payment.payment_date <= today
    ).all()
    amount_collected = round(sum(p.amount for p in monthly_payments), 2)

    # Outstanding bills
    unpaid_bills = db.query(Bill).filter(
        Bill.status.in_(["generated", "partially_paid", "overdue"])
    ).all()
    outstanding_amount = round(sum(b.balance_remaining for b in unpaid_bills), 2)
    unpaid_customer_ids = set(b.customer_id for b in unpaid_bills if b.balance_remaining > 0)

    monthly_stats = DashboardMonthly(
        total_milk_sold=total_milk_sold,
        total_revenue=total_revenue,
        amount_collected=amount_collected,
        outstanding_amount=outstanding_amount,
        unpaid_customers_count=len(unpaid_customer_ids),
        active_customers_count=active_cust_count
    )

    # 3. Pending Payments list
    pending_list: List[PendingPaymentCustomer] = []
    # Group unpaid bills by customer
    cust_unpaid_map: Dict[int, float] = {}
    cust_last_bill: Dict[int, Bill] = {}
    for b in unpaid_bills:
        if b.balance_remaining > 0:
            cust_unpaid_map[b.customer_id] = cust_unpaid_map.get(b.customer_id, 0.0) + b.balance_remaining
            if b.customer_id not in cust_last_bill or b.period_end > cust_last_bill[b.customer_id].period_end:
                cust_last_bill[b.customer_id] = b

    for c_id, bal in sorted(cust_unpaid_map.items(), key=lambda x: x[1], reverse=True)[:10]:
        cust = db.query(Customer).filter(Customer.id == c_id).first()
        if cust:
            lb = cust_last_bill.get(c_id)
            pending_list.append(PendingPaymentCustomer(
                customer_id=cust.id,
                name=cust.name,
                phone=cust.phone,
                area=cust.area,
                balance_due=round(bal, 2),
                last_bill_number=lb.bill_number if lb else None,
                last_bill_date=lb.period_end if lb else None
            ))

    # 4. Volume Trend (last 14 days)
    volume_trend = []
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        day_recs = db.query(DeliveryRecord).filter(
            DeliveryRecord.delivery_date == d,
            DeliveryRecord.status == "delivered"
        ).all()
        vol = sum(r.actual_quantity for r in day_recs)
        volume_trend.append({
            "date": d.strftime("%d %b"),
            "full_date": d.strftime("%Y-%m-%d"),
            "volume": round(vol, 1)
        })

    # 5. Revenue Trend (last 4 months)
    revenue_trend = []
    curr_y = today.year
    curr_m = today.month
    for i in range(3, -1, -1):
        target_m = curr_m - i
        target_y = curr_y
        while target_m <= 0:
            target_m += 12
            target_y -= 1
        
        m_start = date(target_y, target_m, 1)
        next_m = target_m + 1 if target_m < 12 else 1
        next_y = target_y if target_m < 12 else target_y + 1
        m_end = date(next_y, next_m, 1) - timedelta(days=1)

        # Revenue
        m_recs = db.query(DeliveryRecord).filter(
            DeliveryRecord.delivery_date >= m_start,
            DeliveryRecord.delivery_date <= m_end,
            DeliveryRecord.status == "delivered"
        ).all()
        rev = sum(r.actual_quantity * r.applied_rate for r in m_recs)

        # Collected
        m_pays = db.query(Payment).filter(
            Payment.payment_date >= m_start,
            Payment.payment_date <= m_end
        ).all()
        col = sum(p.amount for p in m_pays)

        revenue_trend.append({
            "month": m_start.strftime("%b %y"),
            "revenue": round(rev, 2),
            "collected": round(col, 2)
        })

    # 6. Product Distribution (this month)
    product_distribution = []
    products = db.query(Product).filter(Product.is_active == True).all()
    for prod in products:
        p_recs = db.query(DeliveryRecord).filter(
            DeliveryRecord.product_id == prod.id,
            DeliveryRecord.delivery_date >= month_start,
            DeliveryRecord.status == "delivered"
        ).all()
        p_vol = sum(r.actual_quantity for r in p_recs)
        if p_vol > 0 or len(products) <= 3:
            product_distribution.append({
                "product_id": prod.id,
                "name": prod.name,
                "volume": round(p_vol, 1)
            })

    return DashboardSummary(
        today=today_stats,
        monthly=monthly_stats,
        pending_payments=pending_list,
        volume_trend=volume_trend,
        revenue_trend=revenue_trend,
        product_distribution=product_distribution
    )
