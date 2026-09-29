import urllib.parse
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.models import (
    Customer, Subscription, Product, CustomerPause,
    DeliveryRecord, DeliveryAuditLog, DeliveryNotification,
    Business, User
)
from app.services.billing_service import BillingService

class DeliveryService:
    @staticmethod
    def is_customer_paused_on(db: Session, customer_id: int, check_date: date) -> tuple[bool, Optional[str]]:
        pause = db.query(CustomerPause).filter(
            CustomerPause.customer_id == customer_id,
            CustomerPause.is_active == True,
            CustomerPause.start_date <= check_date,
            or_(CustomerPause.end_date == None, CustomerPause.end_date >= check_date)
        ).first()
        if pause:
            return True, pause.reason or "Delivery Paused"
        return False, None

    @staticmethod
    def get_daily_sheet(
        db: Session,
        delivery_date: date,
        delivery_time: str = "morning",
        worker_id: Optional[int] = None,
        area: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        # Query active customers
        cust_query = db.query(Customer).filter(Customer.status != "inactive")
        if worker_id:
            cust_query = cust_query.filter(Customer.assigned_worker_id == worker_id)
        if area and area.strip():
            cust_query = cust_query.filter(Customer.area == area.strip())

        customers = cust_query.order_by(Customer.route_sequence.asc(), Customer.name.asc()).all()

        sheet_items = []

        for cust in customers:
            # Check pause status
            is_paused, pause_reason = DeliveryService.is_customer_paused_on(db, cust.id, delivery_date)

            # Check customer delivery time preference
            if cust.default_delivery_time != "both" and cust.default_delivery_time != delivery_time:
                continue

            # Fetch active subscriptions
            subs = db.query(Subscription).filter(
                Subscription.customer_id == cust.id,
                Subscription.is_active == True,
                Subscription.start_date <= delivery_date,
                or_(Subscription.end_date == None, Subscription.end_date >= delivery_date)
            ).all()

            # If customer has subscriptions matching shift
            matching_subs = [s for s in subs if s.delivery_time in [delivery_time, "both", "morning"]]
            
            # If no active subscriptions, fallback to default product (Cow Milk or first product)
            if not matching_subs:
                default_prod = db.query(Product).filter(Product.is_active == True).first()
                if default_prod:
                    applicable_rate = BillingService.get_applicable_rate(db, cust.id, default_prod.id, delivery_date)
                    
                    # Check existing record
                    rec = db.query(DeliveryRecord).filter(
                        DeliveryRecord.customer_id == cust.id,
                        DeliveryRecord.product_id == default_prod.id,
                        DeliveryRecord.delivery_date == delivery_date,
                        DeliveryRecord.delivery_time == delivery_time
                    ).first()

                    if rec:
                        sheet_items.append({
                            "customer_id": cust.id,
                            "customer_code": cust.customer_code,
                            "customer_name": cust.name,
                            "phone": cust.phone,
                            "address": cust.address,
                            "area": cust.area,
                            "route_sequence": cust.route_sequence,
                            "product_id": default_prod.id,
                            "product_name": default_prod.name,
                            "unit": default_prod.unit,
                            "subscription_id": None,
                            "delivery_time": delivery_time,
                            "is_paused": is_paused,
                            "pause_reason": pause_reason,
                            "scheduled_quantity": rec.scheduled_quantity,
                            "actual_quantity": rec.actual_quantity,
                            "applied_rate": rec.applied_rate,
                            "status": rec.status,
                            "skip_reason": rec.skip_reason,
                            "existing_record_id": rec.id,
                            "notes": rec.notes or cust.notes,
                            "delivered_at": rec.updated_at or rec.created_at,
                            "worker_name": rec.recorded_by.full_name if rec.recorded_by else None,
                            "assigned_worker_id": cust.assigned_worker_id,
                            "assigned_worker_name": cust.assigned_worker.full_name if cust.assigned_worker else None
                        })
                    else:
                        sheet_items.append({
                            "customer_id": cust.id,
                            "customer_code": cust.customer_code,
                            "customer_name": cust.name,
                            "phone": cust.phone,
                            "address": cust.address,
                            "area": cust.area,
                            "route_sequence": cust.route_sequence,
                            "product_id": default_prod.id,
                            "product_name": default_prod.name,
                            "unit": default_prod.unit,
                            "subscription_id": None,
                            "delivery_time": delivery_time,
                            "is_paused": is_paused,
                            "pause_reason": pause_reason,
                            "scheduled_quantity": 0.0 if is_paused else 1.0,
                            "actual_quantity": 0.0 if is_paused else 1.0,
                            "applied_rate": applicable_rate,
                            "status": "skipped" if is_paused else "pending",
                            "skip_reason": pause_reason if is_paused else None,
                            "existing_record_id": None,
                            "notes": cust.notes,
                            "delivered_at": None,
                            "worker_name": None,
                            "assigned_worker_id": cust.assigned_worker_id,
                            "assigned_worker_name": cust.assigned_worker.full_name if cust.assigned_worker else None
                        })
            else:
                for sub in matching_subs:
                    prod = sub.product or db.query(Product).filter(Product.id == sub.product_id).first()
                    p_name = prod.name if prod else f"Product #{sub.product_id}"
                    p_unit = prod.unit if prod else "Litre"
                    applicable_rate = BillingService.get_applicable_rate(db, cust.id, sub.product_id, delivery_date)

                    rec = db.query(DeliveryRecord).filter(
                        DeliveryRecord.customer_id == cust.id,
                        DeliveryRecord.product_id == sub.product_id,
                        DeliveryRecord.delivery_date == delivery_date,
                        DeliveryRecord.delivery_time == delivery_time
                    ).first()

                    if rec:
                        sheet_items.append({
                            "customer_id": cust.id,
                            "customer_code": cust.customer_code,
                            "customer_name": cust.name,
                            "phone": cust.phone,
                            "address": cust.address,
                            "area": cust.area,
                            "route_sequence": cust.route_sequence,
                            "product_id": sub.product_id,
                            "product_name": p_name,
                            "unit": p_unit,
                            "subscription_id": sub.id,
                            "delivery_time": delivery_time,
                            "is_paused": is_paused,
                            "pause_reason": pause_reason,
                            "scheduled_quantity": rec.scheduled_quantity,
                            "actual_quantity": rec.actual_quantity,
                            "applied_rate": rec.applied_rate,
                            "status": rec.status,
                            "skip_reason": rec.skip_reason,
                            "existing_record_id": rec.id,
                            "notes": rec.notes or cust.notes,
                            "delivered_at": rec.updated_at or rec.created_at,
                            "worker_name": rec.recorded_by.full_name if rec.recorded_by else None,
                            "assigned_worker_id": cust.assigned_worker_id,
                            "assigned_worker_name": cust.assigned_worker.full_name if cust.assigned_worker else None
                        })
                    else:
                        sched_qty = float(sub.default_quantity)
                        sheet_items.append({
                            "customer_id": cust.id,
                            "customer_code": cust.customer_code,
                            "customer_name": cust.name,
                            "phone": cust.phone,
                            "address": cust.address,
                            "area": cust.area,
                            "route_sequence": cust.route_sequence,
                            "product_id": sub.product_id,
                            "product_name": p_name,
                            "unit": p_unit,
                            "subscription_id": sub.id,
                            "delivery_time": delivery_time,
                            "is_paused": is_paused,
                            "pause_reason": pause_reason,
                            "scheduled_quantity": 0.0 if is_paused else sched_qty,
                            "actual_quantity": 0.0 if is_paused else sched_qty,
                            "applied_rate": applicable_rate,
                            "status": "skipped" if is_paused else "pending",
                            "skip_reason": pause_reason if is_paused else None,
                            "existing_record_id": None,
                            "notes": cust.notes,
                            "delivered_at": None,
                            "worker_name": None,
                            "assigned_worker_id": cust.assigned_worker_id,
                            "assigned_worker_name": cust.assigned_worker.full_name if cust.assigned_worker else None
                        })

        return sheet_items

    @staticmethod
    def bulk_save(
        db: Session,
        delivery_date: date,
        entries: List[Any],
        user_id: Optional[int] = None
    ) -> int:
        saved_count = 0
        acting_user = db.query(User).filter(User.id == user_id).first() if user_id else None
        worker_name = acting_user.full_name if acting_user else "Rajesh Sharma"
        is_admin_action = bool(acting_user and acting_user.role == "admin")
        now = datetime.utcnow()

        for entry in entries:
            # Lookup existing record
            rec = db.query(DeliveryRecord).filter(
                DeliveryRecord.customer_id == entry.customer_id,
                DeliveryRecord.product_id == entry.product_id,
                DeliveryRecord.delivery_date == delivery_date,
                DeliveryRecord.delivery_time == entry.delivery_time
            ).first()

            # Ensure actual_quantity is 0 if skipped or absent
            act_qty = entry.actual_quantity
            if entry.status in ["skipped", "absent", "holiday", "cancelled"]:
                act_qty = 0.0

            rate = entry.applied_rate
            if not rate or rate <= 0:
                rate = BillingService.get_applicable_rate(db, entry.customer_id, entry.product_id, delivery_date)

            if rec:
                # If quantity or status is changed, log audit
                if rec.actual_quantity != act_qty or rec.status != entry.status:
                    audit = DeliveryAuditLog(
                        delivery_id=rec.id,
                        changed_by_id=user_id,
                        old_quantity=rec.actual_quantity,
                        new_quantity=act_qty,
                        old_status=rec.status,
                        new_status=entry.status,
                        reason=entry.notes or "Bulk sheet update"
                    )
                    db.add(audit)

                rec.scheduled_quantity = entry.scheduled_quantity
                rec.actual_quantity = act_qty
                rec.status = entry.status
                rec.skip_reason = entry.skip_reason
                rec.notes = entry.notes
                rec.applied_rate = rate
                rec.recorded_by_id = user_id
            else:
                rec = DeliveryRecord(
                    customer_id=entry.customer_id,
                    product_id=entry.product_id,
                    subscription_id=entry.subscription_id,
                    delivery_date=delivery_date,
                    delivery_time=entry.delivery_time,
                    scheduled_quantity=entry.scheduled_quantity,
                    actual_quantity=act_qty,
                    applied_rate=rate,
                    status=entry.status,
                    skip_reason=entry.skip_reason,
                    notes=entry.notes,
                    recorded_by_id=user_id
                )
                db.add(rec)

            db.flush()

            # Record or update live delivery notification for recent activity feed
            if entry.status in ["delivered", "skipped"]:
                cust = db.query(Customer).filter(Customer.id == entry.customer_id).first()
                prod = db.query(Product).filter(Product.id == entry.product_id).first()
                if cust and prod:
                    notif_title = f"Milk Delivered: {cust.name}" if entry.status == "delivered" else f"Milk Skipped: {cust.name}"
                    owner_msg = (
                        f"🥛 *MilkFlow Delivery Log*\n"
                        f"✅ Status: {entry.status.upper()}\n"
                        f"👤 Customer: *{cust.name}* ({cust.customer_code})\n"
                        f"📦 Quantity: *{act_qty} {prod.unit}* ({prod.name})\n"
                        f"📍 Address: {cust.address}, {cust.area}\n"
                        f"🚴 Delivered by: {worker_name}"
                    )
                    existing_notif = (
                        db.query(DeliveryNotification)
                        .filter(DeliveryNotification.delivery_record_id == rec.id)
                        .first()
                    )
                    if existing_notif:
                        existing_notif.title = notif_title
                        existing_notif.message = owner_msg
                        existing_notif.quantity = act_qty
                        existing_notif.product_name = prod.name
                        existing_notif.status = entry.status
                        existing_notif.worker_id = user_id
                        existing_notif.created_at = now
                    else:
                        new_notif = DeliveryNotification(
                            delivery_record_id=rec.id,
                            customer_id=cust.id,
                            worker_id=user_id,
                            title=notif_title,
                            message=owner_msg,
                            quantity=act_qty,
                            product_name=prod.name,
                            status=entry.status,
                            is_read=is_admin_action,
                            created_at=now
                        )
                        db.add(new_notif)

            saved_count += 1

        db.commit()
        return saved_count

    @staticmethod
    def apply_same_as_yesterday(
        db: Session,
        target_date: date,
        delivery_time: str = "morning",
        user_id: Optional[int] = None
    ) -> int:
        yesterday = target_date - timedelta(days=1)
        yesterday_records = db.query(DeliveryRecord).filter(
            DeliveryRecord.delivery_date == yesterday,
            DeliveryRecord.delivery_time == delivery_time
        ).all()

        copied_count = 0
        for y_rec in yesterday_records:
            # Check if customer is paused today
            is_paused, pause_reason = DeliveryService.is_customer_paused_on(db, y_rec.customer_id, target_date)

            # Find or create today's record
            today_rec = db.query(DeliveryRecord).filter(
                DeliveryRecord.customer_id == y_rec.customer_id,
                DeliveryRecord.product_id == y_rec.product_id,
                DeliveryRecord.delivery_date == target_date,
                DeliveryRecord.delivery_time == delivery_time
            ).first()

            rate = BillingService.get_applicable_rate(db, y_rec.customer_id, y_rec.product_id, target_date)
            status = "skipped" if is_paused else y_rec.status
            qty = 0.0 if is_paused else y_rec.actual_quantity
            skip_reason = pause_reason if is_paused else y_rec.skip_reason

            if today_rec:
                today_rec.actual_quantity = qty
                today_rec.scheduled_quantity = y_rec.scheduled_quantity
                today_rec.applied_rate = rate
                today_rec.status = status
                today_rec.skip_reason = skip_reason
                today_rec.recorded_by_id = user_id
            else:
                today_rec = DeliveryRecord(
                    customer_id=y_rec.customer_id,
                    product_id=y_rec.product_id,
                    subscription_id=y_rec.subscription_id,
                    delivery_date=target_date,
                    delivery_time=delivery_time,
                    scheduled_quantity=y_rec.scheduled_quantity,
                    actual_quantity=qty,
                    applied_rate=rate,
                    status=status,
                    skip_reason=skip_reason,
                    recorded_by_id=user_id
                )
                db.add(today_rec)
            copied_count += 1

        db.commit()
        return copied_count

    @staticmethod
    def correct_delivery(
        db: Session,
        delivery_id: int,
        new_quantity: float,
        new_status: str,
        skip_reason: Optional[str],
        notes: Optional[str],
        reason: str,
        user_id: Optional[int]
    ) -> DeliveryRecord:
        rec = db.query(DeliveryRecord).filter(DeliveryRecord.id == delivery_id).first()
        if not rec:
            raise ValueError("Delivery record not found")

        audit = DeliveryAuditLog(
            delivery_id=rec.id,
            changed_by_id=user_id,
            old_quantity=rec.actual_quantity,
            new_quantity=new_quantity,
            old_status=rec.status,
            new_status=new_status,
            reason=reason
        )
        db.add(audit)

        rec.actual_quantity = new_quantity
        rec.status = new_status
        rec.skip_reason = skip_reason
        rec.notes = notes
        db.commit()
        db.refresh(rec)
        return rec

    @staticmethod
    def record_single_delivery(
        db: Session,
        customer_id: int,
        product_id: int,
        delivery_date: date,
        delivery_time: str,
        actual_quantity: float,
        status: str,
        skip_reason: Optional[str] = None,
        notes: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> tuple[DeliveryRecord, DeliveryNotification, str, str, str]:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise ValueError("Customer not found")

        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise ValueError("Product not found")

        worker = db.query(User).filter(User.id == user_id).first() if user_id else None
        worker_name = worker.full_name if worker else "Delivery Staff"

        biz = db.query(Business).first()
        raw_phone = (biz.phone if biz and biz.phone else "9876543210")
        owner_phone = "".join(ch for ch in raw_phone if ch.isdigit())

        rate = BillingService.get_applicable_rate(db, customer_id, product_id, delivery_date)

        sub = db.query(Subscription).filter(
            Subscription.customer_id == customer_id,
            Subscription.product_id == product_id,
            Subscription.is_active == True
        ).first()
        sched_qty = float(sub.default_quantity) if sub else 1.0

        rec = db.query(DeliveryRecord).filter(
            DeliveryRecord.customer_id == customer_id,
            DeliveryRecord.product_id == product_id,
            DeliveryRecord.delivery_date == delivery_date,
            DeliveryRecord.delivery_time == delivery_time
        ).first()

        act_qty = actual_quantity if status == "delivered" else 0.0
        now = datetime.utcnow()

        if rec:
            rec.actual_quantity = act_qty
            rec.status = status
            rec.skip_reason = skip_reason
            rec.notes = notes
            rec.recorded_by_id = user_id
            rec.applied_rate = rate
            rec.updated_at = now
        else:
            rec = DeliveryRecord(
                customer_id=customer_id,
                product_id=product_id,
                subscription_id=sub.id if sub else None,
                delivery_date=delivery_date,
                delivery_time=delivery_time,
                scheduled_quantity=sched_qty,
                actual_quantity=act_qty,
                applied_rate=rate,
                status=status,
                skip_reason=skip_reason,
                notes=notes,
                recorded_by_id=user_id,
                created_at=now,
                updated_at=now
            )
            db.add(rec)

        db.flush()

        time_str = now.strftime("%I:%M %p, %d-%b-%Y")
        biz_name = biz.name if biz else "Shree Krishna Dairy & Milk Services"

        # 1. Customer (House Owner) WhatsApp Receipt Message
        clean_cust_phone = "".join(ch for ch in (customer.phone or "") if ch.isdigit())
        if len(clean_cust_phone) == 10:
            clean_cust_phone = f"91{clean_cust_phone}"

        if status == "delivered":
            customer_msg = (
                f"🥛 *Fresh Milk Delivered!* 🏡\n\n"
                f"Namaste *{customer.name}* ji 🙏\n\n"
                f"Your daily fresh milk has just been delivered to your doorstep:\n"
                f"📦 *Amount of Milk:* *{act_qty} {product.unit}* ({product.name})\n"
                f"⏰ *Date & Time:* {time_str}\n"
                f"📍 *Delivered at:* {customer.address}, {customer.area}\n"
                f"🚴 *Delivered by:* {worker_name}\n"
                f"🏢 *Dairy:* {biz_name}\n\n"
                f"Thank you for choosing pure milk! Have a healthy day! ✨"
            )
            title = f"Milk Delivered: {customer.name}"
        else:
            reason_str = f" ({skip_reason})" if skip_reason else ""
            customer_msg = (
                f"⚠️ *Milk Delivery Notice*\n\n"
                f"Namaste *{customer.name}* ji 🙏\n\n"
                f"Your milk delivery could not be completed today{reason_str}.\n"
                f"⏰ *Date & Time:* {time_str}\n"
                f"🚴 *Delivery Executive:* {worker_name}\n"
                f"🏢 *Dairy:* {biz_name}\n\n"
                f"Please let us know if you need any assistance."
            )
            title = f"Milk Skipped: {customer.name}"

        customer_wa_url = f"https://wa.me/{clean_cust_phone}?text={urllib.parse.quote(customer_msg)}"

        # 2. Owner Alert Message (Internal feed and backup owner WA)
        status_disp = f"SKIPPED{reason_str}" if status == "skipped" else status.upper()
        owner_msg = (
            f"🥛 *MilkFlow Delivery Log*\n"
            f"✅ Status: *{status_disp}*\n"
            f"👤 Customer (House Owner): *{customer.name}* ({customer.customer_code})\n"
            f"📦 Quantity: *{act_qty} {product.unit}* ({product.name})\n"
            f"📍 Address: {customer.address}, {customer.area}\n"
            f"⏰ Time: {time_str}\n"
            f"🚴 Delivered by: {worker_name}"
        )

        clean_owner = owner_phone
        if len(clean_owner) == 10:
            clean_owner = f"91{clean_owner}"
        owner_wa_url = f"https://wa.me/{clean_owner}?text={urllib.parse.quote(owner_msg)}"

        # If the owner/admin records the delivery themselves, mark it read immediately (no need to alert oneself)
        acting_user = db.query(User).filter(User.id == user_id).first() if user_id else None
        is_admin_action = bool(acting_user and acting_user.role == "admin")
        initial_is_read = is_admin_action

        # Check if an existing notification exists for this delivery record (prevent duplicate rows on re-confirm/edit)
        notification = (
            db.query(DeliveryNotification)
            .filter(DeliveryNotification.delivery_record_id == rec.id)
            .first()
        )
        if notification:
            notification.title = title
            notification.message = owner_msg
            notification.quantity = act_qty
            notification.product_name = product.name
            notification.status = status
            notification.worker_id = user_id
            notification.is_read = initial_is_read
            notification.created_at = now
        else:
            notification = DeliveryNotification(
                delivery_record_id=rec.id,
                customer_id=customer.id,
                worker_id=user_id,
                title=title,
                message=owner_msg,
                quantity=act_qty,
                product_name=product.name,
                status=status,
                is_read=initial_is_read,
                created_at=now
            )
            db.add(notification)

        db.commit()
        db.refresh(rec)
        db.refresh(notification)

        return {
            "record": rec,
            "notification": notification,
            "customer_name": customer.name,
            "customer_phone": customer.phone,
            "customer_whatsapp_message": customer_msg,
            "customer_whatsapp_url": customer_wa_url,
            "owner_phone": owner_phone,
            "owner_whatsapp_message": owner_msg,
            "owner_whatsapp_url": owner_wa_url,
        }


    @staticmethod
    def get_notifications(db: Session, limit: int = 50) -> tuple[List[DeliveryNotification], int]:
        notifications = (
            db.query(DeliveryNotification)
            .order_by(DeliveryNotification.created_at.desc())
            .limit(limit)
            .all()
        )
        unread_count = db.query(DeliveryNotification).filter(DeliveryNotification.is_read == False).count()
        return notifications, unread_count

    @staticmethod
    def mark_notifications_read(db: Session, notification_ids: Optional[List[int]] = None) -> int:
        q = db.query(DeliveryNotification)
        if notification_ids:
            q = q.filter(DeliveryNotification.id.in_(notification_ids))
        else:
            q = q.filter(DeliveryNotification.is_read == False)
        count = q.update({DeliveryNotification.is_read: True}, synchronize_session=False)
        db.commit()
        return count

