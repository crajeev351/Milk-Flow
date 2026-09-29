from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.core.database import get_db
from app.models.models import DeliveryRecord, DeliveryAuditLog, User
from app.schemas.schemas import (
    DeliverySheetItem, DeliveryBulkSaveRequest, DeliveryRecordResponse,
    DeliveryRecordUpdate, DeliveryAuditLogResponse,
    SingleDeliveryRecordRequest, SingleDeliveryRecordResponse,
    DeliveryNotificationResponse, DeliveryNotificationListResponse
)
from app.api.deps import get_current_user
from app.services.delivery_service import DeliveryService

router = APIRouter(prefix="/deliveries", tags=["Daily Deliveries"])

@router.get("/sheet", response_model=List[DeliverySheetItem])
def get_daily_delivery_sheet(
    delivery_date: date = Query(default_factory=date.today),
    delivery_time: str = Query("morning", regex="^(morning|evening)$"),
    worker_id: Optional[int] = None,
    all_customers: bool = False,
    area: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Workers only see their assigned customers if specified and not all_customers
    if current_user.role == "worker" and not worker_id and not all_customers:
        worker_id = current_user.id

    sheet = DeliveryService.get_daily_sheet(
        db=db,
        delivery_date=delivery_date,
        delivery_time=delivery_time,
        worker_id=worker_id,
        area=area
    )
    return sheet


@router.post("/bulk")
def bulk_save_deliveries(
    payload: DeliveryBulkSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count = DeliveryService.bulk_save(
        db=db,
        delivery_date=payload.delivery_date,
        entries=payload.entries,
        user_id=current_user.id
    )
    return {"message": f"Successfully saved {count} delivery records", "count": count}

@router.post("/same-as-yesterday")
def apply_same_as_yesterday(
    target_date: date = Query(default_factory=date.today),
    delivery_time: str = Query("morning", regex="^(morning|evening)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count = DeliveryService.apply_same_as_yesterday(
        db=db,
        target_date=target_date,
        delivery_time=delivery_time,
        user_id=current_user.id
    )
    return {"message": f"Applied yesterday's quantities to {count} customer entries", "count": count}

@router.put("/{delivery_id}/correct", response_model=DeliveryRecordResponse)
def correct_delivery_record(
    delivery_id: int,
    update_in: DeliveryRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        updated = DeliveryService.correct_delivery(
            db=db,
            delivery_id=delivery_id,
            new_quantity=update_in.actual_quantity,
            new_status=update_in.status,
            skip_reason=update_in.skip_reason,
            notes=update_in.notes,
            reason=update_in.correction_reason or "Manual correction",
            user_id=current_user.id
        )
        resp = DeliveryRecordResponse.model_validate(updated)
        resp.customer_name = updated.customer.name if updated.customer else None
        resp.product_name = updated.product.name if updated.product else None
        return resp
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/audits", response_model=List[DeliveryAuditLogResponse])
def get_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    audits = db.query(DeliveryAuditLog).order_by(DeliveryAuditLog.created_at.desc()).limit(limit).all()
    return audits

@router.post("/record-single", response_model=SingleDeliveryRecordResponse)
def record_single_delivery(
    payload: SingleDeliveryRecordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        res = DeliveryService.record_single_delivery(
            db=db,
            customer_id=payload.customer_id,
            product_id=payload.product_id,
            delivery_date=payload.delivery_date,
            delivery_time=payload.delivery_time,
            actual_quantity=payload.actual_quantity,
            status=payload.status,
            skip_reason=payload.skip_reason,
            notes=payload.notes,
            user_id=current_user.id
        )
        rec = res["record"]
        notif = res["notification"]

        rec_resp = DeliveryRecordResponse.model_validate(rec)
        rec_resp.customer_name = rec.customer.name if rec.customer else None
        rec_resp.product_name = rec.product.name if rec.product else None

        notif_resp = DeliveryNotificationResponse.model_validate(notif)
        notif_resp.customer_name = notif.customer.name if notif.customer else None
        notif_resp.customer_phone = notif.customer.phone if notif.customer else None
        notif_resp.customer_address = f"{notif.customer.address}, {notif.customer.area}" if notif.customer else None
        notif_resp.worker_name = notif.worker.full_name if notif.worker else None

        return SingleDeliveryRecordResponse(
            delivery_record=rec_resp,
            notification=notif_resp,
            customer_name=res["customer_name"],
            customer_phone=res["customer_phone"],
            customer_whatsapp_message=res["customer_whatsapp_message"],
            customer_whatsapp_url=res["customer_whatsapp_url"],
            whatsapp_message=res["customer_whatsapp_message"],
            whatsapp_url=res["customer_whatsapp_url"],
            owner_phone=res["owner_phone"],
            owner_whatsapp_message=res["owner_whatsapp_message"],
            owner_whatsapp_url=res["owner_whatsapp_url"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/notifications", response_model=DeliveryNotificationListResponse)
def get_delivery_notifications(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notifications, unread_count = DeliveryService.get_notifications(db=db, limit=limit)
    res_list = []
    for n in notifications:
        item = DeliveryNotificationResponse.model_validate(n)
        item.customer_name = n.customer.name if n.customer else None
        item.customer_phone = n.customer.phone if n.customer else None
        item.customer_address = f"{n.customer.address}, {n.customer.area}" if n.customer else None
        item.worker_name = n.worker.full_name if n.worker else None
        res_list.append(item)

    return DeliveryNotificationListResponse(
        notifications=res_list,
        unread_count=unread_count
    )

@router.post("/notifications/mark-read")
def mark_notifications_read(
    payload: Optional[dict] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ids = payload.get("notification_ids") if payload else None
    count = DeliveryService.mark_notifications_read(db=db, notification_ids=ids)
    return {"message": f"Marked {count} notifications as read", "count": count}

