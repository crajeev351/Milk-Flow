from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date, timedelta
from app.core.database import get_db
from app.models.models import Product, ProductPriceHistory, User
from app.schemas.schemas import (
    ProductCreate, ProductUpdate, ProductResponse, ProductPriceUpdate, ProductPriceHistoryResponse
)
from app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/products", tags=["Products"])

@router.get("", response_model=List[ProductResponse])
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).order_by(Product.id.asc()).all()

@router.post("", response_model=ProductResponse)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    prod = Product(
        name=product_in.name,
        description=product_in.description,
        category=product_in.category,
        unit=product_in.unit,
        default_price=product_in.default_price,
        is_active=product_in.is_active
    )
    db.add(prod)
    db.flush()

    # Initial price history entry
    hist = ProductPriceHistory(
        product_id=prod.id,
        price=product_in.default_price,
        effective_from=date.today()
    )
    db.add(hist)
    db.commit()
    db.refresh(prod)
    return prod

@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    return prod

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = product_in.model_dump(exclude_unset=True)
    new_price = update_data.pop("default_price", None)

    for field, value in update_data.items():
        setattr(prod, field, value)

    # If price changed, update price history
    if new_price is not None and new_price != prod.default_price:
        today = date.today()
        # Close current active price
        curr_hist = db.query(ProductPriceHistory).filter(
            ProductPriceHistory.product_id == prod.id,
            ProductPriceHistory.effective_to == None
        ).first()
        if curr_hist:
            curr_hist.effective_to = today - timedelta(days=1)

        new_hist = ProductPriceHistory(
            product_id=prod.id,
            price=new_price,
            effective_from=today
        )
        db.add(new_hist)
        prod.default_price = new_price

    db.commit()
    db.refresh(prod)
    return prod

@router.post("/{product_id}/prices", response_model=ProductPriceHistoryResponse)
def add_price_history_bracket(
    product_id: int,
    price_in: ProductPriceUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    # Close previous active bracket
    prev = db.query(ProductPriceHistory).filter(
        ProductPriceHistory.product_id == product_id,
        ProductPriceHistory.effective_to == None
    ).first()
    if prev:
        prev.effective_to = price_in.effective_from - timedelta(days=1)

    new_entry = ProductPriceHistory(
        product_id=product_id,
        price=price_in.price,
        effective_from=price_in.effective_from
    )
    db.add(new_entry)
    prod.default_price = price_in.price
    db.commit()
    db.refresh(new_entry)
    return new_entry
