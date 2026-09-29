from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta
from app.core.database import get_db
from app.models.models import BusinessExpense, MilkProcurement, DeliveryRecord
from app.schemas.schemas import (
    BusinessExpenseCreate, BusinessExpenseResponse,
    MilkProcurementCreate, MilkProcurementResponse
)
from app.api.deps import require_admin, User

router = APIRouter(prefix="/expenses", tags=["Expenses & Procurement"])

@router.get("", response_model=List[BusinessExpenseResponse])
def get_expenses(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(BusinessExpense)
    if start_date:
        query = query.filter(BusinessExpense.date >= start_date)
    if end_date:
        query = query.filter(BusinessExpense.date <= end_date)
    if category:
        query = query.filter(BusinessExpense.category == category)
    return query.order_by(BusinessExpense.date.desc()).all()

@router.post("", response_model=BusinessExpenseResponse)
def add_expense(
    exp_in: BusinessExpenseCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    exp = BusinessExpense(
        date=exp_in.date,
        title=exp_in.title,
        category=exp_in.category,
        amount=exp_in.amount,
        notes=exp_in.notes
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp

@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    exp = db.query(BusinessExpense).filter(BusinessExpense.id == expense_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(exp)
    db.commit()
    return {"message": "Expense deleted successfully"}

# Procurement
@router.get("/procurement", response_model=List[MilkProcurementResponse])
def get_procurement_logs(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(MilkProcurement)
    if start_date:
        query = query.filter(MilkProcurement.date >= start_date)
    if end_date:
        query = query.filter(MilkProcurement.date <= end_date)
    return query.order_by(MilkProcurement.date.desc()).all()

@router.post("/procurement", response_model=MilkProcurementResponse)
def add_procurement(
    proc_in: MilkProcurementCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    total = round(proc_in.purchase_quantity * proc_in.purchase_rate, 2)
    proc = MilkProcurement(
        date=proc_in.date,
        supplier_name=proc_in.supplier_name,
        purchase_quantity=proc_in.purchase_quantity,
        purchase_rate=proc_in.purchase_rate,
        total_cost=total,
        notes=proc_in.notes
    )
    db.add(proc)
    db.commit()
    db.refresh(proc)
    return proc

@router.get("/reconciliation")
def get_procurement_reconciliation(
    target_date: date = Query(default_factory=date.today),
    db: Session = Depends(get_db)
):
    # Total milk bought today
    procs = db.query(MilkProcurement).filter(MilkProcurement.date == target_date).all()
    bought_qty = sum(p.purchase_quantity for p in procs)
    proc_cost = sum(p.total_cost for p in procs)

    # Total milk delivered today
    delivs = db.query(DeliveryRecord).filter(
        DeliveryRecord.delivery_date == target_date,
        DeliveryRecord.status == "delivered"
    ).all()
    sold_qty = sum(d.actual_quantity for d in delivs)
    sold_revenue = sum(d.actual_quantity * d.applied_rate for d in delivs)

    remaining_qty = max(0.0, round(bought_qty - sold_qty, 2))
    
    # Other expenses today
    other_exps = db.query(BusinessExpense).filter(BusinessExpense.date == target_date).all()
    other_cost = sum(e.amount for e in other_exps)

    total_cost = round(proc_cost + other_cost, 2)
    estimated_profit = round(sold_revenue - total_cost, 2)

    return {
        "date": target_date,
        "milk_purchased_litres": round(bought_qty, 2),
        "milk_sold_litres": round(sold_qty, 2),
        "milk_remaining_litres": remaining_qty,
        "procurement_cost": round(proc_cost, 2),
        "sales_revenue": round(sold_revenue, 2),
        "other_expenses": round(other_cost, 2),
        "total_expenses": total_cost,
        "estimated_profit": estimated_profit
    }
