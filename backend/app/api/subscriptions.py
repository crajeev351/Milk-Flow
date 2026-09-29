from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.models import Subscription, Customer, Product, User
from app.schemas.schemas import (
    SubscriptionCreate, SubscriptionUpdate, SubscriptionResponse
)
from app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])

@router.get("/customer/{customer_id}", response_model=List[SubscriptionResponse])
def get_customer_subscriptions(customer_id: int, db: Session = Depends(get_db)):
    return db.query(Subscription).filter(
        Subscription.customer_id == customer_id,
        Subscription.is_active == True
    ).all()

@router.post("", response_model=SubscriptionResponse)
def create_subscription(
    sub_in: SubscriptionCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    cust = db.query(Customer).filter(Customer.id == sub_in.customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    prod = db.query(Product).filter(Product.id == sub_in.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    sub = Subscription(
        customer_id=sub_in.customer_id,
        product_id=sub_in.product_id,
        default_quantity=sub_in.default_quantity,
        unit=sub_in.unit or prod.unit,
        custom_rate=sub_in.custom_rate,
        delivery_frequency=sub_in.delivery_frequency,
        delivery_time=sub_in.delivery_time,
        is_active=sub_in.is_active,
        start_date=sub_in.start_date,
        end_date=sub_in.end_date
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub

@router.put("/{sub_id}", response_model=SubscriptionResponse)
def update_subscription(
    sub_id: int,
    sub_in: SubscriptionUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    update_data = sub_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sub, field, value)

    db.commit()
    db.refresh(sub)
    return sub

@router.delete("/{sub_id}")
def deactivate_subscription(
    sub_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    sub.is_active = False
    db.commit()
    return {"message": "Subscription deactivated successfully"}
