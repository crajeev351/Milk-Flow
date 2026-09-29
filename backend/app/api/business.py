from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Business, User
from app.schemas.schemas import BusinessResponse, BusinessUpdate
from app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/business", tags=["Business Profile"])

@router.get("", response_model=BusinessResponse)
def get_business_profile(db: Session = Depends(get_db)):
    biz = db.query(Business).first()
    if not biz:
        biz = Business()
        db.add(biz)
        db.commit()
        db.refresh(biz)
    return biz

@router.put("", response_model=BusinessResponse)
def update_business_profile(
    biz_in: BusinessUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    biz = db.query(Business).first()
    if not biz:
        biz = Business()
        db.add(biz)

    update_data = biz_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(biz, field, value)

    db.commit()
    db.refresh(biz)
    return biz
