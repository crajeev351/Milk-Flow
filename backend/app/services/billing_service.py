from typing import List, Dict, Any, Optional
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from app.models.models import (
    Customer, Subscription, Product, ProductPriceHistory,
    DeliveryRecord, Bill, BillItem, Payment, Business
)

class BillingService:
    @staticmethod
    def get_applicable_rate(db: Session, customer_id: int, product_id: int, delivery_date: date) -> float:
        """
        Determines the exact rate for a customer/product on a given date:
        1. Checks if customer has an active subscription with custom_rate
        2. Falls back to product price history active on delivery_date
        3. Falls back to product default_price
        """
        sub = db.query(Subscription).filter(
            Subscription.customer_id == customer_id,
            Subscription.product_id == product_id,
            Subscription.is_active == True,
            Subscription.start_date <= delivery_date,
            or_(Subscription.end_date == None, Subscription.end_date >= delivery_date)
        ).first()

        if sub and sub.custom_rate is not None and sub.custom_rate > 0:
            return float(sub.custom_rate)

        # Check price history
        price_entry = db.query(ProductPriceHistory).filter(
            ProductPriceHistory.product_id == product_id,
            ProductPriceHistory.effective_from <= delivery_date,
            or_(ProductPriceHistory.effective_to == None, ProductPriceHistory.effective_to >= delivery_date)
        ).order_by(ProductPriceHistory.effective_from.desc()).first()

        if price_entry:
            return float(price_entry.price)

        product = db.query(Product).filter(Product.id == product_id).first()
        return float(product.default_price) if product else 60.0

    @staticmethod
    def get_previous_balance(db: Session, customer_id: int, current_period_start: date) -> float:
        """
        Calculates remaining unpaid balance from prior generated bills.
        """
        prior_bills = db.query(Bill).filter(
            Bill.customer_id == customer_id,
            Bill.period_end < current_period_start,
            Bill.status.in_(["generated", "partially_paid", "overdue"])
        ).all()

        prev_balance = sum(bill.balance_remaining for bill in prior_bills)
        return round(float(prev_balance), 2)

    @staticmethod
    def calculate_customer_bill(
        db: Session,
        customer_id: int,
        period_start: date,
        period_end: date,
        additional_charges: float = 0.0,
        discount_amount: float = 0.0
    ) -> Dict[str, Any]:
        """
        Calculates exact billing breakdown for a customer within date range.
        Backend source of truth.
        """
        # Fetch deliveries marked 'delivered'
        deliveries = db.query(DeliveryRecord).filter(
            DeliveryRecord.customer_id == customer_id,
            DeliveryRecord.delivery_date >= period_start,
            DeliveryRecord.delivery_date <= period_end,
            DeliveryRecord.status == "delivered"
        ).order_by(DeliveryRecord.delivery_date.asc()).all()

        total_quantity = 0.0
        milk_total_amount = 0.0

        # Group by product and rate bracket for itemized breakdown
        # Key: (product_id, applied_rate)
        product_rate_map: Dict[tuple, Dict[str, Any]] = {}

        for d in deliveries:
            qty = float(d.actual_quantity)
            rate = float(d.applied_rate)
            amount = round(qty * rate, 2)
            total_quantity += qty
            milk_total_amount += amount

            key = (d.product_id, rate)
            if key not in product_rate_map:
                product = db.query(Product).filter(Product.id == d.product_id).first()
                p_name = product.name if product else f"Product #{d.product_id}"
                product_rate_map[key] = {
                    "product_id": d.product_id,
                    "product_name": p_name,
                    "rate": rate,
                    "total_quantity": 0.0,
                    "total_amount": 0.0,
                    "dates": []
                }
            product_rate_map[key]["total_quantity"] += qty
            product_rate_map[key]["total_amount"] += amount
            product_rate_map[key]["dates"].append(d.delivery_date)

        # Build bill items summary
        items = []
        for (prod_id, rate), info in product_rate_map.items():
            dates = sorted(info["dates"])
            min_d = dates[0].strftime("%b %d") if dates else ""
            max_d = dates[-1].strftime("%b %d") if dates else ""
            summary = f"{min_d} - {max_d}: {round(info['total_quantity'], 2)} L @ ₹{rate:.2f}"
            items.append({
                "product_id": prod_id,
                "product_name": info["product_name"],
                "rate": rate,
                "total_quantity": round(info["total_quantity"], 2),
                "total_amount": round(info["total_amount"], 2),
                "rate_period_description": summary
            })

        milk_total_amount = round(milk_total_amount, 2)
        total_quantity = round(total_quantity, 2)
        previous_balance = BillingService.get_previous_balance(db, customer_id, period_start)
        
        # Subtotal & Total Due
        subtotal = round(milk_total_amount + previous_balance + additional_charges - discount_amount, 2)
        total_due = max(0.0, subtotal)

        # Check any payments made for this period
        payments = db.query(Payment).filter(
            Payment.customer_id == customer_id,
            Payment.payment_date >= period_start,
            Payment.payment_date <= period_end
        ).all()
        amount_paid = round(sum(p.amount for p in payments), 2)
        balance_remaining = round(max(0.0, total_due - amount_paid), 2)

        status = "paid" if balance_remaining == 0 and total_due > 0 else (
            "partially_paid" if amount_paid > 0 else "generated"
        )
        if total_due == 0:
            status = "paid"

        return {
            "customer_id": customer_id,
            "period_start": period_start,
            "period_end": period_end,
            "total_quantity": total_quantity,
            "milk_total_amount": milk_total_amount,
            "previous_balance": previous_balance,
            "additional_charges": additional_charges,
            "discount_amount": discount_amount,
            "total_due": total_due,
            "amount_paid": amount_paid,
            "balance_remaining": balance_remaining,
            "status": status,
            "items": items
        }

    @staticmethod
    def generate_invoice_number(db: Session, period_start: date) -> str:
        biz = db.query(Business).first()
        prefix = biz.invoice_prefix if biz else "INV"
        year_month = period_start.strftime("%Y%m")
        count = db.query(Bill).filter(Bill.period_start == period_start).count() + 1
        return f"{prefix}-{year_month}-{count:04d}"

    @staticmethod
    def create_or_update_bill(
        db: Session,
        customer_id: int,
        period_start: date,
        period_end: date,
        additional_charges: float = 0.0,
        discount_amount: float = 0.0,
        generated_by_id: Optional[int] = None
    ) -> Bill:
        """
        Creates or updates a bill record atomically with item lines.
        """
        calc = BillingService.calculate_customer_bill(
            db, customer_id, period_start, period_end, additional_charges, discount_amount
        )

        existing_bill = db.query(Bill).filter(
            Bill.customer_id == customer_id,
            Bill.period_start == period_start,
            Bill.period_end == period_end
        ).first()

        if existing_bill:
            existing_bill.total_quantity = calc["total_quantity"]
            existing_bill.milk_total_amount = calc["milk_total_amount"]
            existing_bill.previous_balance = calc["previous_balance"]
            existing_bill.additional_charges = calc["additional_charges"]
            existing_bill.discount_amount = calc["discount_amount"]
            existing_bill.total_due = calc["total_due"]
            existing_bill.amount_paid = calc["amount_paid"]
            existing_bill.balance_remaining = calc["balance_remaining"]
            existing_bill.status = calc["status"]
            existing_bill.generated_by_id = generated_by_id
            
            # Recreate items
            db.query(BillItem).filter(BillItem.bill_id == existing_bill.id).delete()
            for item_data in calc["items"]:
                item = BillItem(
                    bill_id=existing_bill.id,
                    product_id=item_data["product_id"],
                    rate=item_data["rate"],
                    total_quantity=item_data["total_quantity"],
                    total_amount=item_data["total_amount"],
                    rate_period_description=item_data["rate_period_description"]
                )
                db.add(item)
            db.commit()
            db.refresh(existing_bill)
            return existing_bill
        else:
            bill_number = BillingService.generate_invoice_number(db, period_start)
            bill = Bill(
                bill_number=bill_number,
                customer_id=customer_id,
                period_start=period_start,
                period_end=period_end,
                total_quantity=calc["total_quantity"],
                milk_total_amount=calc["milk_total_amount"],
                previous_balance=calc["previous_balance"],
                additional_charges=calc["additional_charges"],
                discount_amount=calc["discount_amount"],
                total_due=calc["total_due"],
                amount_paid=calc["amount_paid"],
                balance_remaining=calc["balance_remaining"],
                status=calc["status"],
                generated_by_id=generated_by_id
            )
            db.add(bill)
            db.flush()

            for item_data in calc["items"]:
                item = BillItem(
                    bill_id=bill.id,
                    product_id=item_data["product_id"],
                    rate=item_data["rate"],
                    total_quantity=item_data["total_quantity"],
                    total_amount=item_data["total_amount"],
                    rate_period_description=item_data["rate_period_description"]
                )
                db.add(item)

            db.commit()
            db.refresh(bill)
            return bill
